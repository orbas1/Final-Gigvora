const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const config = require('./config');
const routes = require('./routes');
const { rateLimiter } = require('./middleware/rateLimiter');
const { errorConverter, errorHandler, notFoundHandler } = require('./middleware/errorHandler');

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
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));
app.use(rateLimiter);

app.use('/api/v1', routes);

app.use(notFoundHandler);
app.use(errorConverter);
app.use(errorHandler);

module.exports = app;
