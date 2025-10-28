const jwt = require('jsonwebtoken');
const dayjs = require('dayjs');
const config = require('../config');

const generateToken = (payload, options = {}) =>
  jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn, ...options });

const generateRefreshToken = (payload, options = {}) =>
  jwt.sign(payload, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshExpiresIn, ...options });

const verifyToken = (token, { refresh = false } = {}) =>
  jwt.verify(token, refresh ? config.jwt.refreshSecret : config.jwt.secret);

const tokenExpiresAt = (token, { refresh = false } = {}) => {
  const decoded = jwt.decode(token, { complete: true });
  const exp = decoded?.payload?.exp;
  return exp ? dayjs.unix(exp).toDate() : null;
};

module.exports = {
  generateToken,
  generateRefreshToken,
  verifyToken,
  tokenExpiresAt,
};
