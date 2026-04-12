/**
 * 全局错误处理中间件
 */

function errorHandler(err, req, res, next) {
  console.error('[Global Error]', err);
  
  const statusCode = err.statusCode || err.status || 500;
  const errorCode = err.code || 'INTERNAL_ERROR';
  const message = err.message || '服务器内部错误';
  const timestamp = new Date().toISOString();
  
  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: message
    },
    timestamp: timestamp
  });
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { errorHandler, asyncHandler };
