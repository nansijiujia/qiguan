/**
 * RBAC (Role-Based Access Control) 权限控制系统
 * 基于角色的访问控制，提供细粒度的权限管理
 */

// 角色权限矩阵定义
const ROLE_PERMISSIONS = {
  admin: {
    dashboard: ['read', 'write'],
    products: ['create', 'read', 'update', 'delete'],
    categories: ['create', 'read', 'update', 'delete'],
    orders: ['create', 'read', 'update', 'delete'],
    users: ['create', 'read', 'update', 'delete'],
    coupons: ['create', 'read', 'update', 'delete'],
    content: ['create', 'read', 'update', 'delete'],
    cart: ['read', 'update', 'delete']
  },
  manager: {
    dashboard: ['read'],
    products: ['create', 'read', 'update'],
    categories: ['create', 'read', 'update'],
    orders: ['read', 'update'],
    users: ['read'],
    coupons: ['create', 'read', 'update', 'delete'],
    content: ['create', 'read', 'update', 'delete'],
    cart: ['read']
  },
  editor: {
    dashboard: ['read'],
    products: ['read'],
    categories: ['read'],
    orders: ['read'],
    users: [],
    coupons: [],
    content: ['create', 'read', 'update', 'delete'],
    cart: []
  },
  user: {
    dashboard: [],
    products: ['read'],
    categories: ['read'],
    orders: ['create', 'read'],
    users: [],
    coupons: ['read'],
    content: ['read'],
    cart: ['create', 'read', 'update', 'delete']
  }
};

/**
 * 检查用户是否拥有指定资源的特定权限
 * @param {string} resource - 资源名称（如 products, orders）
 * @param {string} action - 操作类型（如 create, read, update, delete）
 * @returns {Function} Express中间件
 */
function requirePermission(resource, action) {
  return (req, res, next) => {
    // 确保用户已认证
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '需要认证才能访问此资源'
        }
      });
    }

    const userRole = req.user.role;
    const permissions = ROLE_PERMISSIONS[userRole];

    // 检查角色是否存在
    if (!permissions) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `未知角色(${userRole})，无法确定权限`
        }
      });
    }

    // 检查资源权限
    const resourcePermissions = permissions[resource];

    // 如果资源未在权限矩阵中定义，默认拒绝
    if (!resourcePermissions) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `您的角色(${userRole})无权访问${resource}资源`
        }
      });
    }

    // 检查具体操作权限
    if (!resourcePermissions.includes(action)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `您的角色(${userRole})没有${resource}.${action}权限`
        }
      });
    }

    // 权限验证通过
    next();
  };
}

/**
 * 检查用户是否拥有任一角色
 * @param {...string} roles - 允许的角色列表
 * @returns {Function} Express中间件
 */
function requireAnyRole(...roles) {
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
          message: `需要以下角色之一: ${roles.join(', ')}, 当前角色: ${req.user.role}`
        }
      });
    }

    next();
  };
}

/**
 * 获取用户的所有权限（用于前端展示）
 * @param {string} role - 用户角色
 * @returns {Object} 该角色的所有权限
 */
function getPermissions(role) {
  return ROLE_PERMISSIONS[role] || {};
}

/**
 * 检查用户是否有某个资源的某种权限（不返回错误，只返回布尔值）
 * @param {string} role - 用户角色
 * @param {string} resource - 资源名称
 * @param {string} action - 操作类型
 * @returns {boolean}
 */
function hasPermission(role, resource, action) {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;

  const resourcePermissions = permissions[resource];
  if (!resourcePermissions) return false;

  return resourcePermissions.includes(action);
}

module.exports = {
  requirePermission,
  requireAnyRole,
  getPermissions,
  hasPermission,
  ROLE_PERMISSIONS
};
