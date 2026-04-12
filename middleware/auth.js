const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { JWT_CONFIG } = require('../config/index');

let JWT_SECRET = JWT_CONFIG.secret;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  if (process.env.NODE_ENV === 'production') {
    console.error('========================================');
    console.error('[FATAL] Production environment requires JWT_SECRET');
    console.error('Please configure JWT_SECRET in .env.production file');
    console.error('========================================');

    process.exit(1);
  } else {
    console.warn('[WARNING] Using auto-generated JWT secret for development');
    JWT_SECRET = crypto.randomBytes(64).toString('hex');
  }
}
const JWT_EXPIRES_IN = JWT_CONFIG.expiresIn;
const JWT_ALGORITHM = JWT_CONFIG.algorithm;

// Token黑名单 - 用于强制登出（生产环境建议使用Redis）
const tokenBlacklist = new Set();

// 黑名单清理定时器（每小时清理过期token）
setInterval(() => {
  const now = Date.now();
  for (const token of tokenBlacklist) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
      if (decoded.exp * 1000 < now) {
        tokenBlacklist.delete(token);
      }
    } catch (e) {
      tokenBlacklist.delete(token);
    }
  }
}, 3600000);

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: '未提供认证令牌'
      }
    });
  }

  const token = authHeader.split(' ')[1];

  // 检查Token是否在黑名单中
  if (tokenBlacklist.has(token)) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'TOKEN_REVOKED',
        message: '令牌已失效，请重新登录'
      }
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });

    // 检查Token是否即将过期（<30分钟）- 可选：自动刷新提示
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp - now < 1800) {
      // 在响应头中返回提示，让前端可以提前刷新token
      res.setHeader('X-Token-Expiring-Soon', 'true');
      res.setHeader('X-Token-Expires-At', decoded.exp);
    }

    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: '登录已过期，请重新登录'
        }
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: '无效的认证令牌'
        }
      });
    }

    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: '认证失败'
      }
    });
  }
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];

  // 检查黑名单
  if (tokenBlacklist.has(token)) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
    req.user = decoded;
  } catch (error) {
    // Token无效但继续执行（可选认证）
  }

  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '需要认证才能访问此资源'
        }
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `权限不足：您的角色(${req.user.role})无权访问此资源`
        }
      });
    }

    next();
  };
}

function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: JWT_EXPIRES_IN
  });
}

// 将Token添加到黑名单（用于登出）
function revokeToken(token) {
  if (token) {
    tokenBlacklist.add(token);
    return true;
  }
  return false;
}

module.exports = {
  verifyToken,
  optionalAuth,
  requireRole,
  generateToken,
  revokeToken,
  tokenBlacklist,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  JWT_ALGORITHM
};
