const { verifyToken } = require('../utils/token');
const { ApiError } = require('./errorHandler');
const { User, Session } = require('../models');

const auth = (required = true) => async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.cookies?.token;

    if (!token) {
      if (required) {
        throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
      }
      return next();
    }

    const payload = verifyToken(token);
    const session = await Session.findOne({ where: { id: payload.sessionId, revoked_at: null } });
    if (!session) {
      throw new ApiError(401, 'Session expired or revoked', 'SESSION_REVOKED');
    }
    const user = await User.scope('withSensitive').findByPk(payload.sub);
    if (!user) {
      throw new ApiError(401, 'User not found', 'USER_NOT_FOUND');
    }
    req.user = user;
    req.session = session;
    next();
  } catch (error) {
    next(error);
  }
};

const requireRole = (...roles) => {
  const allowed = roles.flat().filter(Boolean);
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required', 'AUTH_REQUIRED'));
    }
    if (allowed.length && !allowed.includes(req.user.role)) {
      return next(new ApiError(403, 'Forbidden', 'FORBIDDEN'));
    }
    return next();
  };
};

module.exports = { auth, requireRole };
