class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }
}

function sendErrorResponse(res, error, context = '') {
  const statusCode = error.statusCode || 500;
  const errorCode = error.code || 'INTERNAL_ERROR';

  console.error(`[${context}] Error:`, {
    message: error.message,
    code: errorCode,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    timestamp: new Date().toISOString()
  });

  return res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: error.message || '操作失败',
      timestamp: new Date().toISOString()
    }
  });
}

function createError(message, statusCode = 500, code = 'INTERNAL_ERROR') {
  return new AppError(message, statusCode, code);
}

const ERROR_CODES = {
  INVALID_INPUT: { statusCode: 400, code: 'INVALID_INPUT' },
  UNAUTHORIZED: { statusCode: 401, code: 'UNAUTHORIZED' },
  FORBIDDEN: { statusCode: 403, code: 'FORBIDDEN' },
  NOT_FOUND: { statusCode: 404, code: 'NOT_FOUND' },
  CONFLICT: { statusCode: 409, code: 'CONFLICT' },
  DATABASE_ERROR: { statusCode: 500, code: 'DATABASE_ERROR' },
  INTERNAL_ERROR: { statusCode: 500, code: 'INTERNAL_ERROR' },
  VALIDATION_ERROR: { statusCode: 400, code: 'VALIDATION_ERROR' },
  DUPLICATE_ERROR: { statusCode: 409, code: 'DUPLICATE_ERROR' }
};

module.exports = {
  AppError,
  sendErrorResponse,
  createError,
  ERROR_CODES
};
