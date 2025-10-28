const rateLimit = require('express-rate-limit');
const config = require('../config');

const rateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  limit: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.setHeader('X-RateLimit-Limit', config.rateLimit.max);
    res.setHeader('X-RateLimit-Remaining', 0);
    res.setHeader('X-RateLimit-Reset', Math.ceil((Date.now() + config.rateLimit.windowMs) / 1000));
    res.status(429).json({
      type: 'https://httpstatuses.com/429',
      title: 'Too Many Requests',
      status: 429,
      detail: 'Rate limit exceeded',
      instance: req.originalUrl,
      code: 'RATE_LIMITED',
    });
  },
});

module.exports = { rateLimiter };
