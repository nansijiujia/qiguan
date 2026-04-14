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
// const swaggerUi = require('swagger-ui-express');
// const swaggerDocument = require('./swagger.json');
const { verifyToken, requireRole } = require('./middleware/auth');
const { DOMAIN_CONFIG, CORS_CONFIG } = require('./config/domain');
const { AppError, sendErrorResponse } = require('./utils/errorHandler');

// 使用统一的数据库模块
const dbType = process.env.DB_TYPE || 'sqlite';
const db = require('./db_unified');

// 初始化数据库
const initDatabase = async () => {
  try {
    await db.initPool();
    console.log('[DB] Database initialized successfully');
    return true;
  } catch (err) {
    console.error('[FATAL] Database initialization failed:', err.message);
    console.error('[FATAL] Cannot start without database. Exiting...');
    process.exit(1);
  }
};

const app = express();
const PORT = 3003;

// 服务器性能优化
app.set('etag', 'strong');
app.set('trust proxy', true);

// 压缩中间件
const compression = require('compression');
app.use(compression({ level: 6 }));

// 请求体解析优化
app.use(express.json({ limit: '10mb', strict: true }));
app.use(express.urlencoded({ extended: true, limit: '10mb', parameterLimit: 10000 }));
app.use(cors(CORS_CONFIG));

// Helmet安全头部配置
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

// Rate Limiting限流配置
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: '登录尝试过于频繁，请1分钟后重试',
      retryAfter: 60
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // 跳过健康检查
    return req.path.includes('/health');
  }
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
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

// 内存缓存
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300, checkperiod: 600 });

// 缓存中间件
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
console.log('[Static] Serving static files from:', path.join(__dirname, 'dist'));

app.options('*', (req, res) => res.status(200).send());

const routes = [
  { path: '/auth', module: './routes/auth', middleware: [loginLimiter] },
  { path: '/categories', module: './routes/categories', middleware: [apiLimiter, verifyToken, cacheMiddleware(60)] },
  { path: '/products', module: './routes/products', middleware: [apiLimiter, verifyToken, cacheMiddleware(60)] },
  { path: '/dashboard', module: './routes/dashboard', middleware: [apiLimiter, verifyToken, cacheMiddleware(30)] },
  { path: '/orders', module: './routes/orders', middleware: [apiLimiter, verifyToken] },
  { path: '/admin/users', module: './routes/users', middleware: [apiLimiter, verifyToken, requireRole('admin')] },
  { path: '/users', module: './routes/user_profile', middleware: [apiLimiter, verifyToken] },
  { path: '/cart', module: './routes/cart', middleware: [apiLimiter, verifyToken] },
  { path: '/content', module: './routes/content', middleware: [cacheMiddleware(120)] },
  { path: '/search', module: './routes/search', middleware: [cacheMiddleware(60)] },
  { path: '/admin/coupons', module: './routes/coupons', middleware: [apiLimiter, verifyToken, requireRole('admin')] },
  { path: '/coupons', module: './routes/coupons_public', middleware: [apiLimiter, verifyToken, cacheMiddleware(60)] },
  { path: '/system', module: './routes/system', middleware: [apiLimiter, verifyToken, requireRole('admin')] },
  { path: '/customers', module: './routes/customers', middleware: [apiLimiter, verifyToken] },
  { path: '/health', module: './routes/health' }
];

routes.forEach(({ path: routePath, module: modulePath, middleware }) => {
  try {
    const router = require(modulePath);
    if (middleware && middleware.length > 0) {
      app.use(`/api/v1${routePath}`, ...middleware, router);
    } else {
      app.use(`/api/v1${routePath}`, router);
    }
    console.log(`[Route] /api/v1${routePath} ✓`);
  } catch (e) {
    console.error(`[Route] ${routePath} ✗: ${e.message}`);
  }
});

// P0 FIX #1: 添加分类路由别名 - 兼容小程序端调用路径
// 小程序调用: /api/v1/products/category -> 实际映射到: /api/v1/categories
app.use('/api/v1/products/category', require('./routes/categories'));
console.log('[Route] /api/v1/products/category (alias) ✓');

// app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
//   customCss: '.swagger-ui .topbar { display: none }',
//   customSiteTitle: '绮管后台 API 文档'
// }));

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
  if (err instanceof AppError) {
    return sendErrorResponse(res, err, 'GlobalMiddleware');
  }

  // 未知错误
  console.error('[UNEXPECTED ERROR]', err.stack);
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? '服务器内部错误'
        : err.message,
      timestamp: new Date().toISOString()
    }
  });
});

const server = http.createServer(app);

// 服务器超时设置优化
server.setTimeout(60000);
server.keepAliveTimeout = 75000;
server.headersTimeout = 80000;

// 启用TCP_NODELAY以减少延迟
server.on('connection', (socket) => {
  socket.setNoDelay(true);
  socket.setKeepAlive(true, 60000);
});

// 启动服务器
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
    console.error('[FATAL] Failed to start server:', err.message);
    process.exit(1);
  }
};

// 启动服务器
startServer();

server.on('error', (err) => {
  console.error('[FATAL] Server error:', err.message);
  if (err.code === 'EADDRINUSE') {
    console.error(`[FATAL] Port ${PORT} already in use`);
  }
  process.exit(1);
});

exports.main = async function(event, context) {
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
      if (!resolved) { resolved = true; resolve({ statusCode: 500, headers: res.headers, body: JSON.stringify({error:err.message}), isBase64Encoded: false }); }
    }
  });
};

module.exports = { app, server, cache };
