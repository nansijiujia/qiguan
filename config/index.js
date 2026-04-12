/**
 * 后端配置管理模块
 * 用于管理所有配置项，支持环境变量和默认值
 */

require('dotenv').config({ path: '.env.production' });

// 安全检查：确保生产环境必须配置敏感信息
if (process.env.NODE_ENV === 'production') {
  const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('========================================');
    console.error('[FATAL] Production environment requires:');
    missingVars.forEach(varName => console.error(`  - ${varName}`));
    console.error('');
    console.error('Please configure these in .env.production file');
    console.error('========================================');
    process.exit(1);
  }
}

// 数据库配置 - 敏感信息不允许使用默认值
const DATABASE_CONFIG = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
  waitForConnections: true,
  queueLimit: 0
};

// 开发环境提供默认值（仅用于开发）
if (process.env.NODE_ENV !== 'production') {
  if (!DATABASE_CONFIG.host) DATABASE_CONFIG.host = 'localhost';
  if (!DATABASE_CONFIG.user) DATABASE_CONFIG.user = 'root';
  if (!DATABASE_CONFIG.password) DATABASE_CONFIG.password = '';
  if (!DATABASE_CONFIG.database) DATABASE_CONFIG.database = 'test';
}

// API配置
const API_CONFIG = {
  port: process.env.API_PORT || 3000,
  host: process.env.API_HOST || '0.0.0.0',
  basePath: process.env.API_BASE_PATH || '/api/v1',
  timeout: process.env.API_TIMEOUT || 15000,
  
  // API端点
  endpoints: {
    auth: {
      login: '/auth/login',
      logout: '/auth/logout',
      register: '/auth/register'
    },
    products: {
      list: '/products',
      detail: '/products/:id',
      create: '/products',
      update: '/products/:id',
      delete: '/products/:id'
    },
    categories: {
      list: '/categories',
      detail: '/categories/:id',
      create: '/categories',
      update: '/categories/:id',
      delete: '/categories/:id'
    },
    orders: {
      list: '/orders',
      detail: '/orders/:id',
      create: '/orders',
      update: '/orders/:id',
      cancel: '/orders/:id/cancel'
    },
    users: {
      list: '/users',
      detail: '/users/:id',
      update: '/users/:id',
      delete: '/users/:id'
    },
    cart: {
      list: '/cart',
      add: '/cart',
      remove: '/cart/:id',
      update: '/cart/:id'
    },
    coupons: {
      list: '/coupons',
      detail: '/coupons/:id',
      create: '/coupons',
      update: '/coupons/:id',
      delete: '/coupons/:id'
    },
    content: {
      banners: '/content/banners',
      homepage: '/content/homepage/config'
    },
    dashboard: {
      stats: '/dashboard/stats'
    },
    health: '/health'
  }
};

// JWT配置 - 敏感信息不允许使用默认值
const JWT_CONFIG = {
  secret: process.env.JWT_SECRET,
  expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  algorithm: process.env.JWT_ALGORITHM || 'HS256'
};

// 开发环境提供JWT默认值（仅用于开发）
if (process.env.NODE_ENV !== 'production' && !JWT_CONFIG.secret) {
  console.warn('[WARNING] Using auto-generated JWT secret for development. Please configure JWT_SECRET in .env file for production.');
  const crypto = require('crypto');
  JWT_CONFIG.secret = crypto.randomBytes(64).toString('hex');
}

// 业务常量
const BUSINESS_CONSTANTS = {
  // 分页配置
  pagination: {
    defaultPage: 1,
    defaultLimit: 20,
    maxLimit: 100
  },
  
  // 订单状态
  orderStatus: {
    PENDING: 'pending',
    PAID: 'paid',
    SHIPPED: 'shipped',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled'
  },
  
  // 商品状态
  productStatus: {
    ACTIVE: 'active',
    INACTIVE: 'inactive'
  },
  
  // 用户角色
  userRoles: {
    ADMIN: 'admin',
    USER: 'user',
    MANAGER: 'manager'
  },
  
  // 支付方式
  paymentMethods: {
    WECHAT: 'wechat',
    ALIPAY: 'alipay',
    CARD: 'card'
  },
  
  // 业务阈值
  thresholds: {
    maxCartItems: 100,
    maxOrderAmount: 99999,
    maxProductsPerPage: 100,
    minPasswordLength: 6,
    maxPasswordLength: 20
  }
};

// 状态码
const STATUS_CODES = {
  // HTTP状态码
  http: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INTERNAL_ERROR: 500,
    SERVICE_UNAVAILABLE: 503
  },
  
  // 业务状态码
  business: {
    SUCCESS: 0,
    ERROR: 1,
    INVALID_PARAMS: 2,
    UNAUTHENTICATED: 3,
    UNAUTHORIZED: 4,
    NOT_FOUND: 5,
    CONFLICT: 6
  }
};

// 错误消息
const ERROR_MESSAGES = {
  auth: {
    INVALID_CREDENTIALS: '用户名或密码错误',
    TOKEN_EXPIRED: '登录已过期，请重新登录',
    TOKEN_INVALID: '无效的登录凭证',
    UNAUTHORIZED: '权限不足，无法执行此操作'
  },
  product: {
    NOT_FOUND: '商品不存在',
    CREATE_FAILED: '创建商品失败',
    UPDATE_FAILED: '更新商品失败',
    DELETE_FAILED: '删除商品失败'
  },
  category: {
    NOT_FOUND: '分类不存在',
    CREATE_FAILED: '创建分类失败',
    UPDATE_FAILED: '更新分类失败',
    DELETE_FAILED: '删除分类失败'
  },
  order: {
    NOT_FOUND: '订单不存在',
    CREATE_FAILED: '创建订单失败',
    UPDATE_FAILED: '更新订单失败',
    CANCEL_FAILED: '取消订单失败'
  },
  user: {
    NOT_FOUND: '用户不存在',
    UPDATE_FAILED: '更新用户失败',
    DELETE_FAILED: '删除用户失败',
    EXISTS: '用户名已存在'
  },
  cart: {
    ADD_FAILED: '添加商品到购物车失败',
    REMOVE_FAILED: '从购物车移除商品失败',
    UPDATE_FAILED: '更新购物车商品失败'
  },
  coupon: {
    NOT_FOUND: '优惠券不存在',
    CREATE_FAILED: '创建优惠券失败',
    UPDATE_FAILED: '更新优惠券失败',
    DELETE_FAILED: '删除优惠券失败',
    INVALID: '无效的优惠券'
  },
  system: {
    INTERNAL_ERROR: '服务器内部错误，请稍后重试',
    NETWORK_ERROR: '网络连接失败，请检查网络',
    VALIDATION_ERROR: '参数验证失败',
    DATABASE_ERROR: '数据库操作失败'
  }
};

// 日志配置
const LOG_CONFIG = {
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.LOG_FORMAT || 'json',
  dir: process.env.LOG_DIR || './logs'
};

// 安全配置
const SECURITY_CONFIG = {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 100 // 每个IP限制100次请求
  }
};

// 导出配置
module.exports = {
  DATABASE_CONFIG,
  API_CONFIG,
  JWT_CONFIG,
  BUSINESS_CONSTANTS,
  STATUS_CODES,
  ERROR_MESSAGES,
  LOG_CONFIG,
  SECURITY_CONFIG
};
