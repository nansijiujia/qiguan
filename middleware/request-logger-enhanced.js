/**
 * 增强版请求日志中间件
 * 提供全面的请求监控、性能追踪和告警功能
 * @version 2.0
 */

const crypto = require('crypto')

function generateRequestId() {
  const timestamp = Date.now().toString(36)
  const random = crypto.randomBytes(4).toString('hex')
  return `req_${timestamp}_${random}`
}

function getLogLevel(statusCode) {
  if (statusCode >= 500) return 'ERROR'
  if (statusCode >= 400) return 'WARN'
  if (statusCode >= 300) return 'INFO'
  return 'INFO'
}

function getStatusEmoji(statusCode) {
  if (statusCode >= 500) return '❌'
  if (statusCode >= 400) return '⚠️'
  if (statusCode >= 300) return '↪️'
  return '✅'
}

const SLOW_REQUEST_THRESHOLD = parseInt(process.env.SLOW_REQUEST_THRESHOLD) || 2000
const SKIP_PATHS = ['/health', '/uploads', '/admin']
const SENSITIVE_HEADERS = ['authorization', 'cookie', 'x-api-key']

function sanitizeHeaders(headers) {
  const sanitized = {}
  for (const [key, value] of Object.entries(headers)) {
    if (SENSITIVE_HEADERS.includes(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]'
    } else {
      sanitized[key] = typeof value === 'string' ? value.substring(0, 100) : value
    }
  }
  return sanitized
}

let requestCounter = 0
let errorCount = 0
let slowRequestCount = 0

function requestLogger(req, res, next) {
  const startTime = Date.now()
  const requestId = req.headers['x-request-id'] || generateRequestId()
  
  req.requestId = requestId
  
  requestCounter++
  
  const shouldLogDetailed = !SKIP_PATHS.some(path => req.path.startsWith(path))
  
  const logData = {
    requestId,
    method: req.method,
    url: req.originalUrl || req.url,
    path: req.path,
    query: req.query,
    ip: req.ip || req.connection?.remoteAddress || 'unknown',
    userAgent: req.headers['user-agent']?.substring(0, 150) || 'unknown',
    contentType: req.headers['content-type'] || 'undefined',
    timestamp: new Date().toISOString(),
    userId: req.user?.id || null,
    headers: process.env.NODE_ENV === 'development' ? sanitizeHeaders(req.headers) : undefined
  }
  
  if (shouldLogDetailed) {
    console.log(`[REQUEST] 📥 ${req.method} ${req.originalUrl} [${requestId}]`, {
      ip: logData.ip,
      contentType: logData.contentType,
      timestamp: logData.timestamp
    })
  }
  
  const originalEnd = res.end
  res.end = function(chunk, encoding, callback) {
    res.end = originalEnd
    res.end.call(this, chunk, encoding, callback)
  }
  
  res.on('finish', () => {
    const duration = Date.now() - startTime
    const statusCode = res.statusCode
    const contentLength = parseInt(res.get('content-length')) || 0
    
    const responseLogData = {
      ...logData,
      statusCode,
      duration: `${duration}ms`,
      durationMs: duration,
      contentLength,
      logLevel: getLogLevel(statusCode)
    }
    
    if (shouldLogDetailed) {
      const emoji = getStatusEmoji(statusCode)
      console.log(`[RESPONSE] ${emoji} ${req.method} ${req.originalUrl} -> ${statusCode} [${duration}ms] [${requestId}]`)
      
      if (statusCode >= 400) {
        errorCount++
        console.error(`[ERROR_RESPONSE] ⚠️ 错误响应:`, {
          method: req.method,
          url: req.originalUrl,
          statusCode,
          duration: `${duration}ms`,
          requestId,
          ip: logData.ip
        })
      }
      
      if (duration > SLOW_REQUEST_THRESHOLD) {
        slowRequestCount++
        console.warn(`[SLOW_REQUEST] 🐢 慢请求警告 (>${SLOW_REQUEST_THRESHOLD}ms):`, {
          method: req.method,
          url: req.originalUrl,
          duration: `${duration}ms`,
          statusCode,
          requestId,
          ip: logData.ip,
          threshold: `${SLOW_REQUEST_THRESHOLD}ms`
        })
        
        if (duration > 5000) {
          console.error(`[CRITICAL_SLOW] 🔴 极慢请求 (>5s):`, {
            method: req.method,
            url: req.originalUrl,
            duration: `${duration}ms`,
            requestId
          })
        }
      }
      
      if (statusCode >= 500 && duration < 100) {
        console.warn(`[FAST_FAIL] ⚡ 快速失败 (<100ms):`, {
          method: req.method,
          url: req.originalUrl,
          statusCode,
          duration: `${duration}ms`,
          requestId
        })
      }
    }
    
    if (global.requestMetrics) {
      global.requestMetrics.record(responseLogData)
    }
  })
  
  res.on('close', () => {
    const duration = Date.now() - startTime
    if (!res.headersSent || !res.finished) {
      console.warn(`[REQUEST_ABORTED] 🔌 客户端断开连接:`, {
        method: req.method,
        url: req.originalUrl,
        duration: `${duration}ms`,
        requestId,
        ip: logData.ip
      })
    }
  })
  
  next()
}

function getRequestStats() {
  return {
    totalRequests: requestCounter,
    errorResponses: errorCount,
    slowRequests: slowRequestCount,
    errorRate: requestCounter > 0 ? ((errorCount / requestCounter) * 100).toFixed(2) + '%' : '0%',
    slowRate: requestCounter > 0 ? ((slowRequestCount / requestCounter) * 100).toFixed(2) + '%' : '0%'
  }
}

function resetStats() {
  requestCounter = 0
  errorCount = 0
  slowRequestCount = 0
}

module.exports = { 
  requestLogger, 
  getRequestStats, 
  resetStats,
  generateRequestId 
}
