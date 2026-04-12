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

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or missing authentication token'
      }
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token has expired'
        }
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid token'
        }
      });
    }

    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or missing authentication token'
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
          message: 'Authentication required'
        }
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions'
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

module.exports = {
  verifyToken,
  optionalAuth,
  requireRole,
  generateToken,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  JWT_ALGORITHM
};
