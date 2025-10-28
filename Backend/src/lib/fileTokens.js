const crypto = require('crypto');
const config = require('../config');

const secret = config.storage?.tokenSecret || config.jwt?.secret || 'file-token-secret';

const toBase64Url = (input) =>
  Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

const fromBase64Url = (input) => {
  const padLength = 4 - (input.length % 4 || 4);
  const padded = `${input}${'='.repeat(padLength % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded, 'base64');
};

const sign = (payload) => {
  const encoded = toBase64Url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', secret).update(encoded).digest('base64');
  const encodedSignature = toBase64Url(signature);
  return `${encoded}.${encodedSignature}`;
};

const verify = (token) => {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return null;
  }
  const [encodedPayload, encodedSignature] = token.split('.');
  const expectedSignature = toBase64Url(
    crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64')
  );
  const provided = fromBase64Url(encodedSignature);
  const expected = fromBase64Url(expectedSignature);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return null;
  }
  try {
    const payloadBuffer = fromBase64Url(encodedPayload);
    const payload = JSON.parse(payloadBuffer.toString('utf8'));
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return null;
    }
    return payload;
  } catch (error) {
    return null;
  }
};

module.exports = { sign, verify };
