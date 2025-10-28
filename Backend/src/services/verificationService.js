'use strict';

const crypto = require('crypto');
const { VerificationRequest, sequelize } = require('../models');
const config = require('../config');
const { ApiError } = require('../middleware/errorHandler');

const PROVIDER_TIMEOUT_FALLBACK = 10_000;

const isAdmin = (user) => Boolean(user && user.role === 'admin');

const resolveProviderName = () => {
  const baseUrl = config?.verification?.provider?.baseUrl;
  if (!baseUrl) return null;
  try {
    return new URL(baseUrl).hostname;
  } catch (error) {
    return baseUrl;
  }
};

const normalizeStatus = (value) => {
  if (!value) return 'pending';
  const normalized = String(value).toLowerCase();
  if (['verified', 'approved', 'completed', 'passed', 'accept'].includes(normalized)) {
    return 'verified';
  }
  if (['rejected', 'declined', 'failed', 'refused'].includes(normalized)) {
    return 'rejected';
  }
  return 'pending';
};

const resolveSubjectId = (actor, subjectType, subjectId) => {
  if (subjectType === 'user') {
    if (subjectId && subjectId !== actor.id && !isAdmin(actor)) {
      throw new ApiError(403, 'You are not allowed to start verification for this user', 'FORBIDDEN');
    }
    return subjectId || actor.id;
  }

  if (subjectType === 'org') {
    if (!subjectId) {
      throw new ApiError(400, 'subject_id is required for organisation verification', 'VALIDATION_ERROR');
    }
    if (!isAdmin(actor) && actor.org_id !== subjectId) {
      throw new ApiError(403, 'You are not allowed to start verification for this organisation', 'FORBIDDEN');
    }
    return subjectId;
  }

  throw new ApiError(400, 'Unsupported subject_type', 'VALIDATION_ERROR');
};

const dispatchToProvider = async (request, submission, actor) => {
  const baseUrl = config?.verification?.provider?.baseUrl;
  if (!baseUrl) return null;

  let endpoint;
  try {
    endpoint = new URL('/verifications', baseUrl).toString();
  } catch (error) {
    endpoint = baseUrl;
  }

  const controller = new AbortController();
  const timeoutMs = Number(config?.verification?.provider?.timeoutMs || PROVIDER_TIMEOUT_FALLBACK);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const headers = { 'Content-Type': 'application/json' };
  const apiKey = config?.verification?.provider?.apiKey;
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const payload = {
    request_id: request.id,
    subject_type: request.subject_type,
    subject_id: request.subject_id,
    submission,
    metadata: {
      initiated_by: actor.id,
      initiated_at: new Date().toISOString(),
    },
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    let responseBody = {};
    try {
      responseBody = await response.json();
    } catch (error) {
      responseBody = {};
    }

    if (!response.ok) {
      throw new Error(`Provider responded with status ${response.status}`);
    }

    return {
      endpoint,
      reference: responseBody.reference || responseBody.id || null,
      status: responseBody.status || 'submitted',
      payload: responseBody,
      submitted_at: new Date().toISOString(),
    };
  } catch (error) {
    clearTimeout(timeout);
    const existingData = request.data || {};
    const providerData = {
      ...(existingData.provider || {}),
      last_error: {
        message: error.message,
        at: new Date().toISOString(),
      },
    };
    await request.update({ data: { ...existingData, provider: providerData } });
    return null;
  }
};

const start = async (actor, body) => {
  const { subject_type, data = {} } = body;
  const subjectId = resolveSubjectId(actor, subject_type, body.subject_id);
  const providerName = resolveProviderName();
  const now = new Date();

  let request;
  let created = false;

  await sequelize.transaction(async (transaction) => {
    const existing = await VerificationRequest.findOne({
      where: { subject_type, subject_id: subjectId, status: 'pending' },
      order: [['created_at', 'DESC']],
      transaction,
      lock: transaction.LOCK?.UPDATE,
    });

    if (existing) {
      const existingData = existing.data || {};
      const mergedData = {
        ...existingData,
        submission: data,
        audit: {
          ...(existingData.audit || {}),
          last_submitted_at: now.toISOString(),
          last_actor_id: actor.id,
        },
      };
      await existing.update({ data: mergedData }, { transaction });
      request = existing;
      return;
    }

    request = await VerificationRequest.create(
      {
        subject_type,
        subject_id: subjectId,
        status: 'pending',
        provider: providerName,
        data: {
          submission: data,
          audit: {
            initiated_by: actor.id,
            initiated_at: now.toISOString(),
          },
        },
      },
      { transaction }
    );
    created = true;
  });

  if (created) {
    const providerResponse = await dispatchToProvider(request, data, actor);
    if (providerResponse) {
      await request.update({
        provider_reference: providerResponse.reference || request.provider_reference,
        data: { ...request.data, provider: providerResponse },
      });
    }
  } else if (config?.verification?.provider?.baseUrl) {
    const providerResponse = await dispatchToProvider(request, data, actor);
    if (providerResponse) {
      await request.update({
        provider_reference: providerResponse.reference || request.provider_reference,
        data: { ...request.data, provider: providerResponse },
      });
    }
  }

  if (created && config?.verification?.autoApprove) {
    const timestamp = new Date();
    await request.update({
      status: 'verified',
      verified_at: timestamp,
      reviewed_at: timestamp,
      decision_reason: 'auto_approved',
    });
  }

  await request.reload();
  return request.toJSON();
};

const ensureSubjectAccess = async (currentUser, subjectType, subjectId) => {
  if (isAdmin(currentUser)) return;

  if (subjectType === 'user' && subjectId !== currentUser.id) {
    throw new ApiError(403, 'You do not have access to this verification request', 'FORBIDDEN');
  }
  if (subjectType === 'org' && currentUser.org_id !== subjectId) {
    throw new ApiError(403, 'You do not have access to this verification request', 'FORBIDDEN');
  }
};

const status = async ({ subject_type, subject_id }, currentUser) => {
  await ensureSubjectAccess(currentUser, subject_type, subject_id);

  const request = await VerificationRequest.scope('withDeleted')
    .findOne({ where: { subject_type, subject_id }, order: [['created_at', 'DESC']] });

  if (!request) {
    return { subject_type, subject_id, status: 'not_requested' };
  }

  return request.toJSON();
};

const verifyWebhookSignature = (headers, rawBody, payload) => {
  const secret = config?.verification?.webhook?.secret;
  if (!secret) {
    throw new ApiError(500, 'Webhook secret is not configured', 'WEBHOOK_NOT_CONFIGURED');
  }

  const signature = headers['x-verification-signature'] || headers['x-signature'];
  if (!signature) {
    throw new ApiError(401, 'Missing verification signature header', 'INVALID_SIGNATURE');
  }

  const bodyToSign = rawBody || JSON.stringify(payload);
  const computed = crypto.createHmac('sha256', secret).update(bodyToSign).digest('hex');

  const providedBuffer = Buffer.from(signature, 'utf8');
  const computedBuffer = Buffer.from(computed, 'utf8');

  if (providedBuffer.length !== computedBuffer.length || !crypto.timingSafeEqual(providedBuffer, computedBuffer)) {
    throw new ApiError(401, 'Invalid webhook signature', 'INVALID_SIGNATURE');
  }
};

const locateRequestForWebhook = async (payload) => {
  if (payload.request_id) {
    const request = await VerificationRequest.scope('withDeleted').findByPk(payload.request_id);
    if (request) return request;
  }

  if (payload.provider_reference) {
    const request = await VerificationRequest.scope('withDeleted').findOne({
      where: { provider_reference: payload.provider_reference },
    });
    if (request) return request;
  }

  if (payload.reference) {
    const request = await VerificationRequest.scope('withDeleted').findOne({
      where: { provider_reference: payload.reference },
    });
    if (request) return request;
  }

  throw new ApiError(404, 'Verification request not found for webhook payload', 'VERIFICATION_NOT_FOUND');
};

const webhook = async (payload, headers = {}, rawBody) => {
  verifyWebhookSignature(headers, rawBody, payload);

  const request = await locateRequestForWebhook(payload);

  const statusValue = normalizeStatus(payload.status);
  const timestamp = new Date();
  const existingData = request.data || {};
  const signature = headers['x-verification-signature'] || headers['x-signature'] || null;

  const providerData = {
    ...(existingData.provider || {}),
    last_event: payload,
    last_event_at: timestamp.toISOString(),
  };

  if (rawBody) {
    providerData.last_event_raw = rawBody;
  }
  if (signature) {
    providerData.last_event_signature = signature;
  }

  const updates = {
    status: statusValue,
    provider_reference: payload.provider_reference || payload.reference || request.provider_reference,
    reviewed_at: timestamp,
    review_notes: payload.review_notes || payload.notes || request.review_notes,
    decision_reason: payload.reason || payload.reason_code || request.decision_reason,
    data: { ...existingData, provider: providerData },
  };

  if (statusValue === 'verified') {
    updates.verified_at = timestamp;
    updates.rejected_at = null;
  } else if (statusValue === 'rejected') {
    updates.rejected_at = timestamp;
  }

  await request.update(updates);
  await request.reload();

  return { success: true, id: request.id, status: request.status };
};

module.exports = { start, status, webhook };
