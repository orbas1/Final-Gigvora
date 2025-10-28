const dayjs = require('dayjs');
const { Op, fn, col } = require('sequelize');
const config = require('../config');
const { FileAsset, sequelize } = require('../models');
const fileStorage = require('../lib/fileStorage');
const { sign: signToken, verify: verifyToken } = require('../lib/fileTokens');
const { scheduleScan } = require('../lib/virusScanner');
const { ApiError } = require('../middleware/errorHandler');
const { buildPagination, encodeCursor } = require('../utils/pagination');

const baseUrl = (config.app?.baseUrl || '').replace(/\/$/, '');

const parseListParam = (value) => {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const presentFile = (file, { includeUpload = false, includeDownload = false } = {}) => {
  const payload = {
    id: file.id,
    owner_id: file.owner_id,
    filename: file.filename,
    storage_key: file.storage_key,
    mime_type: file.mime_type,
    size_bytes: file.size_bytes,
    status: file.status,
    scanned_at: file.scanned_at,
    metadata: file.metadata || {},
    created_at: file.created_at,
    updated_at: file.updated_at,
  };

  if (includeUpload) {
    payload.upload = buildSignedResource(file, 'upload', config.storage.uploadUrlTtlSeconds);
  }

  if (includeDownload) {
    payload.download = buildSignedResource(file, 'download', config.storage.downloadUrlTtlSeconds);
  }

  return payload;
};

const buildSignedResource = (file, action, ttlSeconds) => {
  const expiresAt = Math.floor(Date.now() / 1000) + Number(ttlSeconds || 300);
  const token = signToken({
    sub: file.id,
    action,
    owner: file.owner_id,
    key: file.storage_key,
    exp: expiresAt,
  });

  return {
    url: `${baseUrl}/api/v1/files/${file.id}/content?token=${token}`,
    method: action === 'upload' ? 'PUT' : 'GET',
    expires_at: new Date(expiresAt * 1000).toISOString(),
    headers: action === 'upload' ? { 'Content-Type': 'application/octet-stream' } : undefined,
  };
};

const verifyOwnership = (file, user) => {
  if (!user) {
    throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  }
  if (file.owner_id !== user.id && user.role !== 'admin') {
    throw new ApiError(403, 'You do not have access to this file', 'FORBIDDEN');
  }
};

const registerFile = async (user, body) => {
  if (!body.filename) {
    throw new ApiError(400, 'filename is required', 'VALIDATION_ERROR');
  }

  const storageKey = body.storage_key || fileStorage.generateStorageKey(user.id, body.filename);
  const file = await FileAsset.create({
    owner_id: user.id,
    filename: body.filename,
    storage_key: storageKey,
    mime_type: body.mime_type || 'application/octet-stream',
    size_bytes: body.size_bytes || null,
    metadata: {
      ...(body.metadata || {}),
      upload: {
        ...(body.metadata?.upload || {}),
        requested_at: new Date().toISOString(),
        requested_by: user.id,
        checksum: body.checksum || null,
      },
    },
    status: 'pending',
  });

  return presentFile(file, { includeUpload: true, includeDownload: true });
};

const verifySignedToken = (token, { expectedAction, fileId }) => {
  const payload = verifyToken(token);
  if (!payload || payload.action !== expectedAction || payload.sub !== fileId) {
    throw new ApiError(401, 'Invalid or expired token', 'FILE_TOKEN_INVALID');
  }
  return payload;
};

const storeFileContent = async ({ fileId, token, buffer, contentType }) => {
  const contentBuffer = Buffer.isBuffer(buffer) ? buffer : buffer ? Buffer.from(buffer) : Buffer.alloc(0);
  if (!contentBuffer.length) {
    throw new ApiError(400, 'File content cannot be empty', 'FILE_EMPTY');
  }

  const payload = verifySignedToken(token, { expectedAction: 'upload', fileId });
  const file = await FileAsset.findByPk(fileId, { paranoid: false });
  if (!file) {
    throw new ApiError(404, 'File not found', 'FILE_NOT_FOUND');
  }
  if (file.deleted_at) {
    throw new ApiError(410, 'File has been deleted', 'FILE_DELETED');
  }
  if (file.owner_id !== payload.owner) {
    throw new ApiError(403, 'Token does not match file owner', 'FILE_TOKEN_MISMATCH');
  }

  await fileStorage.saveBuffer(file.storage_key, contentBuffer);
  await file.update({
    mime_type: contentType || file.mime_type || 'application/octet-stream',
    size_bytes: contentBuffer.length,
    status: 'pending',
    metadata: {
      ...(file.metadata || {}),
      upload: {
        ...(file.metadata?.upload || {}),
        uploaded_at: new Date().toISOString(),
        size_bytes: contentBuffer.length,
      },
    },
  });

  scheduleScan(file.id);

  return presentFile(file, { includeDownload: true });
};

const getFileForUser = async (id, user, { includeDeleted = false } = {}) => {
  const file = await FileAsset.findByPk(id, { paranoid: !includeDeleted });
  if (!file) {
    throw new ApiError(404, 'File not found', 'FILE_NOT_FOUND');
  }
  verifyOwnership(file, user);
  return file;
};

const buildDownloadRedirect = async (id, user) => {
  const file = await getFileForUser(id, user);
  if (file.status === 'blocked') {
    throw new ApiError(423, 'File is blocked by virus scanner', 'FILE_BLOCKED');
  }
  if (file.status !== 'ready' || !file.scanned_at) {
    throw new ApiError(409, 'File is still processing', 'FILE_PROCESSING');
  }

  const signed = buildSignedResource(file, 'download', config.storage.downloadUrlTtlSeconds);
  return { location: signed.url, expires_at: signed.expires_at };
};

const streamFile = async ({ fileId, token }) => {
  const payload = verifySignedToken(token, { expectedAction: 'download', fileId });
  const file = await FileAsset.findByPk(fileId, { paranoid: false });
  if (!file || file.deleted_at) {
    throw new ApiError(404, 'File not found', 'FILE_NOT_FOUND');
  }
  if (file.owner_id !== payload.owner) {
    throw new ApiError(403, 'Token does not match file owner', 'FILE_TOKEN_MISMATCH');
  }
  if (file.status === 'blocked') {
    throw new ApiError(423, 'File is blocked by virus scanner', 'FILE_BLOCKED');
  }
  if (file.status !== 'ready' || !file.scanned_at) {
    throw new ApiError(409, 'File is still processing', 'FILE_PROCESSING');
  }

  let stats;
  try {
    stats = await fileStorage.getFileStats(file.storage_key);
  } catch (error) {
    throw new ApiError(404, 'Stored file could not be located', 'FILE_NOT_AVAILABLE');
  }

  const stream = fileStorage.createStream(file.storage_key);
  return { file, stats, stream };
};

const deleteFile = async (id, user) => {
  const file = await getFileForUser(id, user);
  await file.destroy();
  return { success: true };
};

const storageAnalytics = async ({ owner_id, from, to, includeDeleted }, user) => {
  const targetOwner = owner_id || user.id;
  if (owner_id && user.role !== 'admin' && owner_id !== user.id) {
    throw new ApiError(403, 'Forbidden for requested owner_id', 'FORBIDDEN');
  }
  const where = { owner_id: targetOwner };
  if (from || to) {
    where.created_at = {};
    if (from) {
      where.created_at[Op.gte] = dayjs(from).toDate();
    }
    if (to) {
      where.created_at[Op.lte] = dayjs(to).toDate();
    }
  }

  const paranoid = !(includeDeleted === 'true' && user.role === 'admin');

  const [totalBytes, totalFiles, statusRows, seriesRows] = await Promise.all([
    FileAsset.sum('size_bytes', { where, paranoid }).then((value) => value || 0),
    FileAsset.count({ where, paranoid }),
    FileAsset.findAll({
      attributes: ['status', [fn('COUNT', col('*')), 'count']],
      where,
      paranoid,
      group: ['status'],
    }),
    FileAsset.findAll({
      attributes: [
        [fn('date', col('created_at')), 'bucket'],
        [fn('SUM', col('size_bytes')), 'total_bytes'],
        [fn('COUNT', col('*')), 'files'],
      ],
      where,
      paranoid,
      group: [fn('date', col('created_at'))],
      order: [[fn('date', col('created_at')), 'ASC']],
    }),
  ]);

  const byStatus = statusRows.reduce(
    (acc, row) => ({
      ...acc,
      [row.status]: Number(row.get('count')) || 0,
    }),
    { pending: 0, ready: 0, blocked: 0 }
  );

  const series = seriesRows.map((row) => ({
    date: row.get('bucket'),
    total_bytes: Number(row.get('total_bytes')) || 0,
    files: Number(row.get('files')) || 0,
  }));

  return {
    owner_id: targetOwner,
    total_files: totalFiles,
    total_bytes: totalBytes,
    by_status: byStatus,
    series,
    range: {
      from: from ? dayjs(from).toISOString() : null,
      to: to ? dayjs(to).toISOString() : null,
    },
  };
};

const listFiles = async (query, user) => {
  const pagination = buildPagination(query, ['created_at', 'updated_at']);
  const includes = new Set(parseListParam(query.include));
  const selectableFields = [
    'id',
    'owner_id',
    'filename',
    'storage_key',
    'mime_type',
    'size_bytes',
    'status',
    'scanned_at',
    'metadata',
    'created_at',
    'updated_at',
  ];
  const baseWhere = { owner_id: user.id };
  if (query.q) {
    const term = `%${String(query.q).toLowerCase()}%`;
    baseWhere[Op.or] = [
      sequelize.where(fn('lower', col('FileAsset.filename')), { [Op.like]: term }),
      sequelize.where(fn('lower', col('FileAsset.mime_type')), { [Op.like]: term }),
    ];
  }

  const where = { ...baseWhere };
  if (pagination.cursorValue !== undefined) {
    where[pagination.sortField] = {
      [pagination.cursorOperator]: pagination.cursorValue,
    };
  }

  const fields = parseListParam(query.fields).filter((field) => selectableFields.includes(field));
  const attributes = fields.length ? Array.from(new Set([...fields, 'id', pagination.sortField])) : undefined;

  const paranoid = !(includes.has('deleted') && user.role === 'admin');

  const rows = await FileAsset.findAll({
    where,
    attributes,
    limit: pagination.limit + 1,
    order: pagination.order,
    paranoid,
  });

  const hasMore = rows.length > pagination.limit;
  const sliced = hasMore ? rows.slice(0, pagination.limit) : rows;
  const data = sliced.map((row) => presentFile(row, { includeDownload: true }));
  const nextCursorValue = hasMore ? sliced[sliced.length - 1]?.[pagination.sortField] : undefined;

  const total = await FileAsset.count({ where: baseWhere, paranoid });

  let analytics;
  if (query.analytics === 'true') {
    const [totalBytes, ready] = await Promise.all([
      FileAsset.sum('size_bytes', { where: baseWhere, paranoid }),
      FileAsset.count({ where: { ...baseWhere, status: 'ready' }, paranoid }),
    ]);
    analytics = {
      total_bytes: totalBytes || 0,
      ready_files: ready,
    };
  }

  return {
    data,
    page: {
      next_cursor: hasMore ? encodeCursor(nextCursorValue) : null,
      limit: pagination.limit,
    },
    total,
    analytics,
  };
};

module.exports = {
  registerFile,
  storeFileContent,
  buildDownloadRedirect,
  streamFile,
  deleteFile,
  storageAnalytics,
  listFiles,
  presentFile,
};
