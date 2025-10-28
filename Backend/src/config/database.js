require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || '.env' });

const common = {
  define: {
    underscored: true,
    paranoid: true,
  },
  logging: process.env.DB_LOGGING === 'true' ? console.log : false,
};

const int = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const buildConnection = (prefix, defaults) => {
  const upper = prefix ? `${prefix}_` : '';
  const dialect = process.env[`${upper}DB_DIALECT`] || process.env.DB_DIALECT || defaults.dialect;
  const connection = {
    dialect,
    host: process.env[`${upper}DB_HOST`] || process.env.DB_HOST || defaults.host,
    port: process.env[`${upper}DB_PORT`] || process.env.DB_PORT || defaults.port,
    username: process.env[`${upper}DB_USER`] || process.env.DB_USER || defaults.username,
    password: process.env[`${upper}DB_PASS`] || process.env.DB_PASS || defaults.password,
    database: process.env[`${upper}DB_NAME`] || process.env.DB_NAME || defaults.database,
    storage: process.env[`${upper}DB_STORAGE`] || process.env.DB_STORAGE || defaults.storage,
    pool: {
      max: int(process.env[`${upper}DB_POOL_MAX`] || process.env.DB_POOL_MAX, defaults.pool?.max ?? 10),
      min: int(process.env[`${upper}DB_POOL_MIN`] || process.env.DB_POOL_MIN, defaults.pool?.min ?? 0),
      idle: int(process.env[`${upper}DB_POOL_IDLE`] || process.env.DB_POOL_IDLE, defaults.pool?.idle ?? 10_000),
    },
    ...common,
  };

  if (connection.dialect === 'sqlite') {
    delete connection.host;
    delete connection.port;
    delete connection.pool;
  }

  return connection;
};

module.exports = {
  development: buildConnection('DEV', {
    dialect: 'sqlite',
    storage: './storage/dev.sqlite',
    database: 'gigvora_dev',
    pool: { max: 5, min: 0, idle: 5_000 },
  }),
  demo: buildConnection('DEMO', {
    dialect: 'mysql',
    host: '127.0.0.1',
    port: 3306,
    username: 'gigvora_demo',
    password: 'demo-pass',
    database: 'gigvora_demo',
    pool: { max: 10, min: 0, idle: 10_000 },
  }),
  production: buildConnection('PROD', {
    dialect: 'mysql',
    host: '127.0.0.1',
    port: 3306,
    username: 'gigvora',
    password: 'secure-password',
    database: 'gigvora',
    pool: { max: 20, min: 5, idle: 10_000 },
  }),
  test: {
    dialect: 'sqlite',
    storage: process.env.TEST_DB_STORAGE || ':memory:',
    logging: false,
    ...common,
  },
};
