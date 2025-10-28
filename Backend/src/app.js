const fs = require('fs');
const path = require('path');
const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const config = require('./config');
const packageInfo = require('../package.json');
const { sequelize } = require('./models');
const { rateLimiter } = require('./middleware/rateLimiter');
const { errorConverter, errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const serviceMetadata = (req, res) => {
  res.status(200).json({
    status: 'ok',
    name: 'Gigvora API',
    version: packageInfo.version,
    environment: config.env,
    message: 'Gigvora API root. Refer to /api/v1 for the versioned REST interface.',
    links: {
      health: '/health',
      versionedHealth: '/api/v1/health',
      docs: config.app?.docsUrl || null,
    },
  });
};

const resolveFrontendPath = () => {
  const explicitPath = process.env.FRONTEND_DIST_PATH;
  if (explicitPath) {
    return path.resolve(explicitPath);
  }
  return path.resolve(__dirname, '..', '..', 'Front-End', 'gigvora-lander', 'dist');
};

const healthCheck = async (req, res) => {
  const start = process.hrtime.bigint();

  try {
    await sequelize.authenticate({ retry: { max: 0 } });
    const latencyMs = Number(process.hrtime.bigint() - start) / 1_000_000;

    res.status(200).json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      latencyMs,
      checks: {
        database: 'up',
      },
    });
  } catch (error) {
    const latencyMs = Number(process.hrtime.bigint() - start) / 1_000_000;

    res.status(503).json({
      status: 'error',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      latencyMs,
      checks: {
        database: 'down',
      },
      message: config.env === 'development' ? error.message : 'Service unavailable',
    });
  }
};

const createApp = () => {
  const app = express();

  if (config.http?.trustProxy !== undefined) {
    app.set('trust proxy', config.http.trustProxy);
  }

  const allowedOrigins = config.http?.cors?.origins;
  const corsOptions =
    !allowedOrigins || allowedOrigins === '*'
      ? { origin: true, credentials: true }
      : {
          origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) {
              return callback(null, true);
            }
            return callback(null, false);
          },
          credentials: true,
        };

  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(
    express.json({
      limit: '1mb',
      verify: (req, res, buf) => {
        if (buf && buf.length) {
          req.rawBody = buf.toString('utf8');
        }
      },
    })
  );
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));
  app.use(rateLimiter);

  const frontendDistPath = resolveFrontendPath();
  const frontendIndexPath = path.join(frontendDistPath, 'index.html');
  const hasFrontendBuild = fs.existsSync(frontendIndexPath);

  if (hasFrontendBuild) {
    app.use(express.static(frontendDistPath));
  }

  app.get('/health', healthCheck);
  app.get('/api/v1/health', healthCheck);

  if (process.env.API_SKIP_ROUTES === 'true') {
    if (config.env !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('API route autoload skipped because API_SKIP_ROUTES=true');
    }
  } else {
    try {
      // Require lazily so test runs can opt out of eagerly evaluating every route module.
      // This protects the boot process from partially migrated modules while still
      // surfacing failures when the flag is not set (e.g. in production).
      // eslint-disable-next-line global-require
      const routes = require('./routes');
      app.use('/api/v1', routes);
    } catch (error) {
      console.error('Failed to initialize API routes', error);
      if (config.env === 'production') {
        throw error;
      }
    }
  }

  if (hasFrontendBuild) {
    app.get('/api', serviceMetadata);
    app.get(/^\/(?!api\/).*/, (req, res) => {
      res.sendFile(frontendIndexPath);
    });
  } else {
    app.get('/', serviceMetadata);
  }

  app.use(notFoundHandler);
  app.use(errorConverter);
  app.use(errorHandler);

  return app;
};

const app = createApp();

module.exports = app;
module.exports.createApp = createApp;
