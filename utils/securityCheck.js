/**
 * 安全检查工具
 * 用于验证用户输入的安全性
 */

function sanitizeString(input) {
  if (typeof input !== 'string') return input;
  
  return input
    .trim()
    .replace(/[<>]/g, '') // 移除HTML标签
    .replace(/[\\'"]/g, '\\$&') // 转义引号和反斜杠
    .substring(0, 1000); // 限制长度
}

function validateId(id) {
  const numId = parseInt(id);
  if (!numId || numId < 1 || numId > Number.MAX_SAFE_INTEGER) {
    return null;
  }
  return numId;
}

function validatePageParams(page, limit) {
  const pageNum = parseInt(page) || 1;
  const limitNum = Math.min(parseInt(limit) || 20, 100); // 最大100条
  
  return {
    page: Math.max(1, pageNum),
    limit: Math.max(1, limitNum),
    offset: (Math.max(1, pageNum) - 1) * Math.max(1, limitNum)
  };
}

function isSafeObject(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return false;
  }
  
  // 检查对象原型链污染
  if (obj.__proto__ !== Object.prototype) {
    return false;
  }
  
  // 检查危险属性
  const dangerousProps = ['__proto__', 'constructor', 'prototype'];
  return !dangerousProps.some(prop => prop in obj);
}

module.exports = {
  sanitizeString,
  validateId,
  validatePageParams,
  isSafeObject
};
