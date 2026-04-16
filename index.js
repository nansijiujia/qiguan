/**
 * @fileoverview E-commerce 后台管理系统主入口文件
 * @description 本文件是整个后端服务的主入口，负责：
 *   - 初始化 Express 应用和各种中间件
 *   - 配置安全头部、限流、压缩等
 *   - 注册所有 API 路由
 *   - 启动 HTTP 服务器
 *   - 提供云函数兼容接口
 * @version 2.0
 */

console.log('=== E-commerce Backend Starting ===');
console.log('Node:', process.version);
console.log('Time:', new Date().toISOString());

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const { swaggerSpec } = require('./config/swagger');
const { verifyToken, requireRole } = require('./middleware/auth');
const { DOMAIN_CONFIG, CORS_CONFIG } = require('./config/domain');
const { AppError, sendErrorResponse } = require('./utils/error-handler')
const { requestLogger, getRequestStats } = require('./middleware/request-logger-enhanced');

// 数据库类型配置
const db = require('./db-unified');

let dbInitPromise = null;

/**
 * 确保数据库已初始化
 * @returns {Promise} 数据库初始化 Promise
 */
function ensureDbInitialized() {
  if (!dbInitPromise) {
    dbInitPromise = db.initPool().catch(err => {
      dbInitPromise = null;
      throw err;
    });
  }
  return dbInitPromise;
}

/**
 * 数据库就绪检查中间件
 * 在路由处理前确保数据库连接正常
 * @param {Object} req - Express 请求对象
 * @param {Object} res - Express 响应对象
 * @param {Function} next - Express next 函数
 */
const dbReadyMiddleware = async (req, res, next) => {
  try {
    if (db.isDbReady()) {
      return next();
    }
  } catch (e) {
    // 忽略 isDbReady 检查错误，继续尝试初始化
  }
  try {
    await ensureDbInitialized();
    return next();
  } catch (err) {
    const status = err.statusCode || 503;
    return res.status(status).json({
      success: false,
      error: {
        code: err.code || 'DB_NOT_READY',
        message: process.env.NODE_ENV === 'production'
          ? '数据库服务暂时不可用，请稍后重试'
          : (err.message || '数据库未初始化'),
        timestamp: new Date().toISOString(),
        suggestion: '请联系管理员检查数据库配置和连接状态'
      }
    });
  }
};

/**
 * 初始化数据库连接池
 * @returns {Promise<boolean>} 初始化成功返回 true，失败则直接退出进程
 */
const initDatabase = async () => {
  try {
    await db.initPool();
    console.log('[DB] 数据库初始化成功');
    return true;
  } catch (err) {
    console.error('[FATAL] 数据库初始化失败:', err.message);
    console.error('[FATAL] 缺少数据库无法启动，正在退出...');
    process.exit(1);
  }
};

const app = express();
const PORT = 3003;

// 服务器性能优化
app.set('etag', 'strong');
app.set('trust proxy', true);

// 响应压缩中间件
const compression = require('compression');
app.use(compression({ level: 6 }));

// 请求体解析优化 - 增强容错和日志
app.use(express.json({
  limit: '10mb',
  strict: true,
  verify: (req, res, buf) => {
    // 保存原始请求体用于调试
    req.rawBody = buf.toString();
    // 记录大请求体或可疑内容（仅前200字符）
    if (buf.length > 0 && buf.length < 5000) {
      req.debugBody = buf.toString('utf8').substring(0, 200);
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb', parameterLimit: 10000 }));

// JSON 解析错误处理中间件
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('[JSON_PARSE_ERROR] ❌ JSON解析失败:', {
      message: err.message,
      contentType: req.headers['content-type'],
      bodyPreview: req.debugBody || req.rawBody?.substring(0, 100) || '(empty)',
      url: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString()
    });
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: '请求数据格式错误，请检查JSON格式是否正确',
        timestamp: new Date().toISOString(),
        suggestion: '确保Content-Type为application/json且JSON格式正确'
      }
    });
  }
  next(err);
});

// 请求超时中间件 (30秒超时)
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT) || 30000;

app.use((req, res, next) => {
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      console.warn(`[TIMEOUT] ⏰ 请求超时 (${REQUEST_TIMEOUT}ms):`, {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip
      });
      
      return res.status(504).json({
        success: false,
        error: {
          code: 'REQUEST_TIMEOUT',
          message: '请求处理超时，请稍后重试',
          timestamp: new Date().toISOString()
        }
      });
    }
  }, REQUEST_TIMEOUT);

  res.on('finish', () => clearTimeout(timeout));
  res.on('close', () => clearTimeout(timeout));
  
  next();
});

// ============================================================
// 增强版请求日志中间件 - 全面的请求监控和性能追踪
// ============================================================
app.use(requestLogger);
console.log('[Middleware] ✅ 增强版请求日志中间件已启用 (requestId追踪 + 慢请求告警)');

app.use(cors(CORS_CONFIG));

// Helmet 安全头部配置
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      fontSrc: ["'self'", "data:"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: [
        "'self'",
        `${DOMAIN_CONFIG.protocol}://${DOMAIN_CONFIG.primary}`,
        `${DOMAIN_CONFIG.protocol}://${DOMAIN_CONFIG.www}`,
        `${DOMAIN_CONFIG.protocol}://${DOMAIN_CONFIG.api}`,
        `${DOMAIN_CONFIG.protocol}://${DOMAIN_CONFIG.admin}`
      ],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// 限流配置 - 修复 trust proxy 安全警告
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  // 使用自定义keyGenerator避免trust proxy安全问题
  keyGenerator: (req) => {
    // 优先使用真实IP（考虑代理场景）
    const forwarded = req.headers['x-forwarded-for'];
    const realIp = req.headers['x-real-ip'];
    return (forwarded ? forwarded.split(',')[0].trim() : realIp) || req.ip || 'unknown';
  },
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: '登录尝试过于频繁，请1分钟后重试',
      retryAfter: 60
    }
  },
  skip: (req) => {
    // 跳过健康检查
    return req.path.includes('/health');
  }
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  // 使用自定义keyGenerator避免trust proxy安全问题
  keyGenerator: (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    const realIp = req.headers['x-real-ip'];
    return (forwarded ? forwarded.split(',')[0].trim() : realIp) || req.ip || 'unknown';
  },
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: '请求过于频繁，请稍后再试'
    }
  },
  skip: (req) => {
    // 跳过健康检查
    return req.path.includes('/health');
  }
});

// 内存缓存（NodeCache）
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300, checkperiod: 600 });

/**
 * 响应缓存中间件工厂函数
 * 仅缓存 GET 请求的响应
 * @param {number} duration - 缓存持续时间（秒）
 * @returns {Function} Express 中间件函数
 */
const cacheMiddleware = (duration) => {
  return (req, res, next) => {
    if (req.method !== 'GET') {
      return next();
    }
    
    const key = `__express__${req.originalUrl}`;
    const cachedBody = cache.get(key);
    
    if (cachedBody) {
      return res.json(cachedBody);
    }
    
    const originalSend = res.json;
    res.json = function(body) {
      cache.set(key, body, duration);
      return originalSend.call(this, body);
    };
    
    next();
  };
};

// CSRF防护配置（可选：对于Bearer Token认证的系统可禁用）
// 如果使用Cookie-based session，请取消下面的注释
/*
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });

// 为需要CSRF保护的路由启用
app.use('/api/v1', csrfProtection);

// 提供CSRF token给前端
app.get('/api/v1/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});
*/

// 静态文件服务 - 提供前端构建产物
app.use('/admin', express.static(path.join(__dirname, 'dist'), {
  maxAge: '1y',
  etag: true,
  lastModified: true,
  immutable: true
}));
console.log('[Static] 提供前端静态文件:', path.join(__dirname, 'dist'));

// 静态文件服务 - 上传的图片文件
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  etag: true,
  lastModified: true,
  maxAge: '30d'
}));
console.log('[Static] 提供上传文件目录:', path.join(__dirname, 'uploads'));

app.options('*', (req, res) => res.status(200).send());

const routes = [
  { path: '/auth', module: './routes/auth', middleware: [loginLimiter] },
  { path: '/categories', module: './routes/categories', middleware: [apiLimiter, verifyToken, cacheMiddleware(120)] },
  { path: '/products', module: './routes/products', middleware: [apiLimiter, verifyToken, cacheMiddleware(60)] },
  { path: '/dashboard', module: './routes/dashboard', middleware: [apiLimiter, verifyToken, cacheMiddleware(30)] },
  { path: '/orders', module: './routes/orders', middleware: [apiLimiter, verifyToken] },
  { path: '/admin/users', module: './routes/users', middleware: [apiLimiter, verifyToken, requireRole('admin')] },
  { path: '/users', module: './routes/users', middleware: [apiLimiter, verifyToken] },
  { path: '/user_profile', module: './routes/user-profile', middleware: [apiLimiter, verifyToken] },
  { path: '/cart', module: './routes/cart', middleware: [apiLimiter, verifyToken] },
  { path: '/content', module: './routes/content', middleware: [cacheMiddleware(120)] },
  { path: '/search', module: './routes/search', middleware: [cacheMiddleware(60)] },
  { path: '/admin/coupons', module: './routes/coupons', middleware: [apiLimiter, verifyToken, requireRole('admin')] },
  { path: '/coupons', module: './routes/coupons-public', middleware: [apiLimiter, verifyToken, cacheMiddleware(60)] },
  { path: '/public/coupons', module: './routes/public-coupons', middleware: [apiLimiter, verifyToken] },
  { path: '/system', module: './routes/system', middleware: [apiLimiter, verifyToken, requireRole('admin')] },
  { path: '/customers', module: './routes/customers', middleware: [apiLimiter, verifyToken] },
  { path: '/notifications', module: './routes/notifications', middleware: [apiLimiter, verifyToken] },
  { path: '/upload', module: './routes/upload', middleware: [apiLimiter] },
  { path: '/health', module: './routes/health' }
];

routes.forEach(({ path: routePath, module: modulePath, middleware }) => {
  try {
    const router = require(modulePath);
    const middlewares = [dbReadyMiddleware];
    if (middleware && middleware.length > 0) {
      middlewares.push(...middleware);
    }
    middlewares.push(router);
    app.use(`/api/v1${routePath}`, ...middlewares);
    console.log(`[Route] /api/v1${routePath} ✓`);
  } catch (e) {
    console.error(`[Route] ${routePath} ✗: ${e.message}`);
  }
});

// P0 FIX #1: 添加分类路由别名 - 兼容小程序端调用路径
// 小程序调用: /api/v1/products/category -> 实际映射到: /api/v1/categories
app.use('/api/v1/products/category', dbReadyMiddleware, apiLimiter, verifyToken, require('./routes/categories'));
console.log('[Route] /api/v1/products/category (alias) ✓');

// Swagger API 文档
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info .title { color: #2c5282; }
    .swagger-ui .info .base-url { display: none }
    .swagger-ui .execute-wrapper { margin: 20px 0; }
  `,
  customSiteTitle: '绮管后台 API 文档 v2.0 (P0+P1重构版)',
  customfavIcon: '/favicon.ico',
  explorer: true,
  deepLinking: true,
  displayOperationId: false,
  filter: true,
  showExtensions: true,
  showCommonExtensions: true
}));
console.log('[Swagger] API 文档地址: /api-docs');

// 前端路由支持 - 所有非API请求都返回index.html (SPA)
app.get('*', (req, res) => {
  // 如果是API请求，返回标准化的404响应
  if (req.path.startsWith('/api')) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `接口 ${req.method} ${req.path} 不存在`,
        timestamp: new Date().toISOString()
      }
    });
  }

  // 否则返回前端index.html
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// 全局错误处理中间件（放在所有路由之后）
app.use((err, req, res, next) => {
  const errorId = `ERR_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  console.error(`[GLOBAL_ERROR] ${errorId} 💥 未捕获异常:`, {
    message: err.message,
    code: err.code,
    statusCode: err.statusCode || 500,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack?.substring(0, 1000),
    timestamp: new Date().toISOString()
  });

  if (err instanceof AppError) {
    return sendErrorResponse(res, err, 'GlobalMiddleware');
  }

  const isDbError = err.code === 'DB_NOT_READY' || err.code === 'DB_INIT_FAILED' ||
    err.code === 'ECONNREFUSED' || err.code === 'PROTOCOL_CONNECTION_LOST' ||
    (err.message && (err.message.includes('database') || err.message.includes('Database') || err.message.includes('MySQL') || err.message.includes('TDSQL')));

  if (isDbError) {
    console.error(`[DB_ERROR] ${errorId}`, err.message);
    return res.status(err.statusCode || 503).json({
      success: false,
      error: {
        code: err.code || 'DB_ERROR',
        errorId,
        message: process.env.NODE_ENV === 'production'
          ? '数据库服务暂时不可用，请稍后重试'
          : (err.message || '数据库错误'),
        timestamp: new Date().toISOString(),
        suggestion: '请联系管理员检查数据库状态'
      }
    });
  }

  // 未知错误
  console.error(`[UNEXPECTED_ERROR] ${errorId} 🔥`, err.stack);
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      errorId,
      message: process.env.NODE_ENV === 'production'
        ? '服务器内部错误，请稍后重试'
        : err.message,
      timestamp: new Date().toISOString()
    }
  });
});

const server = http.createServer(app);

// 服务器超时设置
server.setTimeout(60000);
server.keepAliveTimeout = 75000;
server.headersTimeout = 80000;

// 启用 TCP_NODELAY 减少延迟
server.on('connection', (socket) => {
  socket.setNoDelay(true);
  socket.setKeepAlive(true, 60000);
});

/**
 * 启动服务器主函数
 * 先初始化数据库，再监听端口启动 HTTP 服务
 */
const startServer = async () => {
  try {
    // 初始化数据库
    await initDatabase();
    
    // 启动服务器
    server.listen(PORT, '127.0.0.1', () => {
      console.log('');
      console.log('✅✅✅ Server is RUNNING ✅✅✅');
      console.log(`   Port: ${PORT}`);
      console.log(`   Mode: ${process.env.NODE_ENV || 'development'}`);
      console.log(`   PID: ${process.pid}`);
      console.log(`   URL: http://127.0.0.1:${PORT}`);
      console.log('');
    });
  } catch (err) {
    console.error('[FATAL] 服务器启动失败:', err.message);
    process.exit(1);
  }
};

// 执行启动
startServer();

server.on('error', (err) => {
  console.error('[FATAL] Server error:', err.message);
  if (err.code === 'EADDRINUSE') {
    console.error(`[FATAL] Port ${PORT} already in use`);
  }
  process.exit(1);
});

/**
 * 云函数入口函数（腾讯云 SCF / 阿里云 FC 兼容）
 * 将云函数的 HTTP 事件转发给 Express 应用处理
 * @param {Object} event - 云函数事件对象
 * @param {Object} context - 云函数上下文对象
 * @returns {Promise<Object>} API Gateway 格式的响应对象
 */
exports.main = async function(event, context) {
  try {
    await ensureDbInitialized();
  } catch (dbErr) {
    return {
      statusCode: dbErr.statusCode || 503,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: false,
        error: {
          code: dbErr.code || 'DB_NOT_READY',
          message: process.env.NODE_ENV === 'production'
            ? '数据库服务暂时不可用'
            : (dbErr.message || '数据库未初始化'),
          timestamp: new Date().toISOString()
        }
      }),
      isBase64Encoded: false
    };
  }

  const httpContext = context.httpContext || {};
  const method = event.httpMethod || (httpContext.method || 'GET');
  const url = event.path || (httpContext.url || '/');
  const headers = event.headers || (httpContext.headers || {});
  const queryStringParameters = event.queryStringParameters || (httpContext.query || {});
  const body = event.body || '';

  let parsedBody = body;
  if (typeof body === 'string' && body.length > 0) {
    try {
      parsedBody = event.isBase64Encoded
        ? JSON.parse(Buffer.from(body, 'base64').toString())
        : JSON.parse(body);
    } catch (e) {
      parsedBody = body;
    }
  }

  return new Promise((resolve) => {
    const req = { method, url, headers, query: queryStringParameters, body: parsedBody };
    let resolved = false;
    const res = {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      status(code) { this.statusCode = code; return this; },
      setHeader(k, v) { this.headers[k] = v; },
      end(data) {
        if (!resolved) { resolved = true; resolve({ statusCode: this.statusCode, headers: this.headers, body: data || '', isBase64Encoded: false }); }
      },
      json(data) { this.headers['Content-Type'] = 'application/json'; this.end(JSON.stringify(data)); },
      send(data) { data != null && typeof data === 'object' ? this.json(data) : this.end(String(data ?? '')); }
    };

    const timeout = setTimeout(() => {
      if (!resolved) { resolved = true; resolve({ statusCode: 504, headers: res.headers, body: '{"timeout":true}', isBase64Encoded: false }); }
    }, 25000);

    try { app(req, res); clearTimeout(timeout); } catch (err) {
      clearTimeout(timeout);
      if (!resolved) { resolved = true; resolve({ statusCode: err.statusCode || 500, headers: res.headers, body: JSON.stringify({success:false,error:{code:err.code||'INTERNAL_ERROR',message:err.message}}), isBase64Encoded: false }); }
    }
  });
};

module.exports = { app, server, cache };
