class ApiError extends Error {
  constructor(statusCode, message, code = 'UNEXPECTED_ERROR', details = {}) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

const formatProblem = (status, title, detail, instance, code, extras) => ({
  type: `https://httpstatuses.com/${status}`,
  title,
  status,
  detail,
  instance,
  code,
  ...extras,
});

const notFoundHandler = (req, res, next) => {
  next(new ApiError(404, 'Resource not found', 'NOT_FOUND'));
};

const errorConverter = (err, req, res, next) => {
  let error = err;
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'An unexpected error occurred';
    error = new ApiError(statusCode, message, error.code || 'UNEXPECTED_ERROR');
  }
  next(error);
};

const errorHandler = (err, req, res, next) => {
  const status = err.statusCode || 500;
  const response = formatProblem(
    status,
    err.title || err.code || 'Error',
    err.message,
    req.originalUrl,
    err.code || 'UNEXPECTED_ERROR',
    err.details
  );

  if (process.env.NODE_ENV !== 'production') {
    response.stack = err.stack;
  }

  res.status(status).json(response);
};

module.exports = {
  ApiError,
  errorHandler,
  errorConverter,
  notFoundHandler,
};
