/**
 * 错误处理工具
 * @module utils/error-handler
 */

/**
 * 自定义应用错误类
 * @extends Error
 */
class AppError extends Error {
  /**
   * 创建应用错误实例
   * @param {string} message - 错误信息
   * @param {number} [statusCode=500] - HTTP状态码
   * @param {string} [code='INTERNAL_ERROR'] - 错误代码
   */
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 发送错误响应到客户端
 * @param {Object} res - Express响应对象
 * @param {Error} error - 错误对象
 * @param {string} [context=''] - 错误上下文信息
 * @returns {Object} Express响应对象
 */
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

/**
 * 创建应用错误实例的便捷函数
 * @param {string} message - 错误信息
 * @param {number} [statusCode=500] - HTTP状态码
 * @param {string} [code='INTERNAL_ERROR'] - 错误代码
 * @returns {AppError} 应用错误实例
 */
function createError(message, statusCode = 500, code = 'INTERNAL_ERROR') {
  return new AppError(message, statusCode, code);
}

/**
 * 预定义的错误代码映射表
 * @type {Object.<string, {statusCode: number, code: string}>}
 */
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
