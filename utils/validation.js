/**
 * 输入验证工具
 * 用于验证API请求参数的有效性和安全性
 */

// 验证规则类型
const VALIDATION_RULES = {
  REQUIRED: 'required',
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  ARRAY: 'array',
  OBJECT: 'object',
  EMAIL: 'email',
  PHONE: 'phone',
  URL: 'url',
  ENUM: 'enum',
  MIN_LENGTH: 'minLength',
  MAX_LENGTH: 'maxLength',
  MIN_VALUE: 'minValue',
  MAX_VALUE: 'maxValue',
  PATTERN: 'pattern'
};

/**
 * 验证单个字段
 * @param {any} value - 要验证的值
 * @param {Object} rule - 验证规则
 * @returns {Object} - 验证结果 {valid, error}
 */
function validateField(value, rule) {
  // 必填检查
  if (rule[VALIDATION_RULES.REQUIRED] && (value === undefined || value === null || value === '')) {
    return {
      valid: false,
      error: `${rule.fieldName || '字段'}不能为空`
    };
  }

  // 如果值不是必填且为空，跳过其他验证
  if (!rule[VALIDATION_RULES.REQUIRED] && (value === undefined || value === null)) {
    return { valid: true };
  }

  // 类型检查
  if (rule[VALIDATION_RULES.STRING] && typeof value !== 'string') {
    return {
      valid: false,
      error: `${rule.fieldName || '字段'}必须是字符串`
    };
  }

  if (rule[VALIDATION_RULES.NUMBER] && typeof value !== 'number') {
    return {
      valid: false,
      error: `${rule.fieldName || '字段'}必须是数字`
    };
  }

  if (rule[VALIDATION_RULES.BOOLEAN] && typeof value !== 'boolean') {
    return {
      valid: false,
      error: `${rule.fieldName || '字段'}必须是布尔值`
    };
  }

  if (rule[VALIDATION_RULES.ARRAY] && !Array.isArray(value)) {
    return {
      valid: false,
      error: `${rule.fieldName || '字段'}必须是数组`
    };
  }

  if (rule[VALIDATION_RULES.OBJECT] && typeof value !== 'object' || Array.isArray(value)) {
    return {
      valid: false,
      error: `${rule.fieldName || '字段'}必须是对象`
    };
  }

  // 格式检查
  if (rule[VALIDATION_RULES.EMAIL]) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return {
        valid: false,
        error: `${rule.fieldName || '字段'}格式不正确`
      };
    }
  }

  if (rule[VALIDATION_RULES.PHONE]) {
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(value)) {
      return {
        valid: false,
        error: `${rule.fieldName || '字段'}格式不正确`
      };
    }
  }

  if (rule[VALIDATION_RULES.URL]) {
    try {
      new URL(value);
    } catch (error) {
      return {
        valid: false,
        error: `${rule.fieldName || '字段'}URL格式不正确`
      };
    }
  }

  if (rule[VALIDATION_RULES.ENUM] && !rule.enumValues.includes(value)) {
    return {
      valid: false,
      error: `${rule.fieldName || '字段'}的值必须在允许范围内: ${rule.enumValues.join(', ')}`
    };
  }

  // 长度检查
  if (rule[VALIDATION_RULES.MIN_LENGTH] && typeof value === 'string' && value.length < rule.minLength) {
    return {
      valid: false,
      error: `${rule.fieldName || '字段'}长度不能少于${rule.minLength}个字符`
    };
  }

  if (rule[VALIDATION_RULES.MAX_LENGTH] && typeof value === 'string' && value.length > rule.maxLength) {
    return {
      valid: false,
      error: `${rule.fieldName || '字段'}长度不能超过${rule.maxLength}个字符`
    };
  }

  // 范围检查
  if (rule[VALIDATION_RULES.MIN_VALUE] !== undefined && typeof value === 'number' && value < rule.minValue) {
    return {
      valid: false,
      error: `${rule.fieldName || '字段'}的值不能小于${rule.minValue}`
    };
  }

  if (rule[VALIDATION_RULES.MAX_VALUE] !== undefined && typeof value === 'number' && value > rule.maxValue) {
    return {
      valid: false,
      error: `${rule.fieldName || '字段'}的值不能大于${rule.maxValue}`
    };
  }

  // 正则表达式检查
  if (rule[VALIDATION_RULES.PATTERN] && !rule.pattern.test(value)) {
    return {
      valid: false,
      error: `${rule.fieldName || '字段'}格式不正确`
    };
  }

  return { valid: true };
}

/**
 * 验证请求体
 * @param {Object} data - 请求数据
 * @param {Object} rules - 验证规则对象
 * @returns {Object} - 验证结果 {valid, errors}
 */
function validateRequestBody(data, rules) {
  const errors = [];

  Object.entries(rules).forEach(([field, rule]) => {
    const fieldName = rule.fieldName || field;
    const value = data[field];
    
    const result = validateField(value, { ...rule, fieldName });
    if (!result.valid) {
      errors.push(result.error);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 验证查询参数
 * @param {Object} query - 查询参数
 * @param {Object} rules - 验证规则对象
 * @returns {Object} - 验证结果 {valid, errors, sanitizedQuery}
 */
function validateQueryParams(query, rules) {
  const errors = [];
  const sanitizedQuery = {};

  Object.entries(rules).forEach(([field, rule]) => {
    const fieldName = rule.fieldName || field;
    const value = query[field];
    
    const result = validateField(value, { ...rule, fieldName });
    if (!result.valid) {
      errors.push(result.error);
    } else if (value !== undefined) {
      sanitizedQuery[field] = value;
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    sanitizedQuery
  };
}

/**
 * 清理用户输入，防止XSS攻击
 * @param {string} input - 用户输入
 * @returns {string} - 清理后的字符串
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * SQL注入防护 - 检测危险字符
 * @param {string} input - 用户输入
 * @returns {boolean} - 是否安全
 */
function isSafeSqlInput(input) {
  if (typeof input !== 'string') return true;
  
  const dangerousPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE)\b)/i,
    /(--|\#|\/\*)/,
    /(\b(OR|AND)\b\s+\d+\s*=\s*\d+)/i,
    /(\bUNION\b.*\bSELECT\b)/i
  ];

  return !dangerousPatterns.some(pattern => pattern.test(input));
}

module.exports = {
  VALIDATION_RULES,
  validateField,
  validateRequestBody,
  validateQueryParams,
  sanitizeInput,
  isSafeSqlInput
};
