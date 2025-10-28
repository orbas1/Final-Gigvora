require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || '.env' });

const path = require('path');
const merge = require('lodash/merge');

const parseOrigins = (value) => {
  if (!value || value === '*') return '*';
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const parseTrustProxy = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  const numeric = Number(value);
  return Number.isNaN(numeric) ? value : numeric;
};

const env = process.env.NODE_ENV || 'development';

const baseConfig = {
  env,
  port: Number(process.env.PORT || 4000),
  app: {
    baseUrl: process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 4000}`,
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  email: {
    from: process.env.EMAIL_FROM || 'noreply@gigvora.test',
  },
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000),
    max: Number(process.env.RATE_LIMIT_MAX || 100),
  },
  verification: {
    provider: {
      baseUrl: process.env.VERIFICATION_PROVIDER_URL || '',
      apiKey: process.env.VERIFICATION_PROVIDER_API_KEY || '',
      timeoutMs: Number(process.env.VERIFICATION_PROVIDER_TIMEOUT_MS || 10_000),
    },
    webhook: {
      secret: process.env.VERIFICATION_WEBHOOK_SECRET || '',
    },
    autoApprove: process.env.VERIFICATION_AUTO_APPROVE
      ? process.env.VERIFICATION_AUTO_APPROVE === 'true'
      : false,
  realtime: {
    messageEditWindowMinutes: Number(process.env.MESSAGE_EDIT_WINDOW_MINUTES || 15),
  },
  otp: {
    ttlMinutes: Number(process.env.OTP_TTL_MINUTES || 10),
  },
  http: {
    cors: {
      origins: parseOrigins(process.env.CORS_ALLOWED_ORIGINS || '*'),
    },
    trustProxy: parseTrustProxy(process.env.TRUST_PROXY, false),
  },
  storage: {
    tokenSecret: process.env.FILE_TOKEN_SECRET || process.env.JWT_SECRET || 'file-token-secret',
    uploadUrlTtlSeconds: Number(process.env.FILE_UPLOAD_URL_TTL || 900),
    downloadUrlTtlSeconds: Number(process.env.FILE_DOWNLOAD_URL_TTL || 300),
    local: {
      baseDir: process.env.FILE_STORAGE_DIR
        ? path.resolve(process.env.FILE_STORAGE_DIR)
        : path.resolve(process.cwd(), process.env.NODE_ENV === 'test' ? 'storage/test-uploads' : 'storage/uploads'),
    },
  },
  database: {
    autoMigrate: process.env.DB_AUTO_MIGRATE
      ? process.env.DB_AUTO_MIGRATE === 'true'
      : env !== 'production' && env !== 'demo',
    primary: env,
  },
};

const environmentConfigs = {
  development: {
    http: {
      cors: {
        origins: parseOrigins(process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3000'),
      },
    },
  },
  demo: {
    database: { autoMigrate: false, primary: 'demo' },
    http: {
      trustProxy: parseTrustProxy(process.env.TRUST_PROXY, 'loopback'),
    },
  },
  production: {
    database: { autoMigrate: false, primary: 'production' },
    http: {
      trustProxy: parseTrustProxy(process.env.TRUST_PROXY, true),
    },
  },
  test: {
    database: { autoMigrate: true, primary: 'test' },
  },
};

const config = merge({}, baseConfig, environmentConfigs[env] || {});

module.exports = config;
