/**
 * 安全检查工具
 * 用于验证用户输入的安全性
 * @module utils/security-check
 */

/**
 * 清理字符串输入，移除危险字符
 * @param {*} input - 要清理的输入
 * @returns {*} 清理后的字符串或原始输入
 */
function sanitizeString(input) {
  if (typeof input !== 'string') return input;
  
  return input
    .trim()
    .replace(/[<>]/g, '') // 移除HTML标签
    .replace(/[\\'"]/g, '\\$&') // 转义引号和反斜杠
    .substring(0, 1000); // 限制长度
}

/**
 * 验证ID是否为有效正整数
 * @param {*} id - 要验证的ID
 * @returns {number|null} 验证通过后的数字ID，无效则返回null
 */
function validateId(id) {
  const numId = parseInt(id);
  if (!numId || numId < 1 || numId > Number.MAX_SAFE_INTEGER) {
    return null;
  }
  return numId;
}

/**
 * 验证并规范化分页参数
 * @param {*} page - 页码
 * @param {*} limit - 每页数量
 * @returns {Object} 包含page、limit、offset的分页参数对象
 */
function validatePageParams(page, limit) {
  const pageNum = parseInt(page) || 1;
  const limitNum = Math.min(parseInt(limit) || 20, 100); // 最大100条
  
  return {
    page: Math.max(1, pageNum),
    limit: Math.max(1, limitNum),
    offset: (Math.max(1, pageNum) - 1) * Math.max(1, limitNum)
  };
}

/**
 * 检查对象是否存在原型链污染风险
 * @param {*} obj - 要检查的对象
 * @returns {boolean} 对象是否安全
 */
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
