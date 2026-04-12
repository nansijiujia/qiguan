/**
 * 请求日志中间件
 */

function requestLogger(req, res, next) {
  const start = Date.now();
  
  // 记录请求信息
  const timestamp = new Date().toISOString();
  console.log('[' + timestamp + '] ' + req.method + ' ' + req.originalUrl);
  
  // 响应完成后记录耗时
  res.on('finish', () => {
    const duration = Date.now() - start;
    const endTimestamp = new Date().toISOString();
    console.log('[' + endTimestamp + '] ' + req.method + ' ' + req.originalUrl + ' - ' + res.statusCode + ' (' + duration + 'ms)');
  });
  
  next();
}

module.exports = { requestLogger };
