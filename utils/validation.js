/**
 * 输入验证工具
 * 用于验证API请求参数的有效性和安全性
 */

// 自定义错误类
class AppError extends Error {
  constructor(message, statusCode = 400, code = 'VALIDATION_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'AppError';
  }
}

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

// ============================================================
// 新增验证函数 - 完整的输入验证体系
// ============================================================

/**
 * 必填字段验证
 * @param {string[]} fields - 必填字段名数组
 * @param {Object} body - 请求体
 * @throws {AppError} 缺少必填字段时抛出错误
 */
function validateRequired(fields, body) {
  const missing = fields.filter(field => !body[field]);
  if (missing.length > 0) {
    throw new AppError(`缺少必填字段: ${missing.join(', ')}`, 400, 'MISSING_FIELDS');
  }
}

/**
 * 字符串验证
 * @param {any} value - 要验证的值
 * @param {string} fieldName - 字段名称（用于错误提示）
 * @param {Object} options - 验证选项
 * @param {number} options.min - 最小长度，默认0
 * @param {number} options.max - 最大长度，默认255
 * @param {boolean} options.required - 是否必填，默认true
 * @param {RegExp} options.pattern - 正则表达式模式
 * @throws {AppError} 验证失败时抛出错误
 */
function validateString(value, fieldName, options = {}) {
  const { min = 0, max = 255, required = true, pattern = null } = options;
  
  if (required && (value === undefined || value === null)) {
    throw new AppError(`${fieldName}不能为空`, 400, 'INVALID_INPUT');
  }
  
  if (value !== undefined && value !== null) {
    if (typeof value !== 'string') {
      throw new AppError(`${fieldName}必须是字符串`, 400, 'INVALID_TYPE');
    }
    if (value.length < min || value.length > max) {
      throw new AppError(`${fieldName}长度必须在${min}-${max}个字符之间`, 400, 'INVALID_LENGTH');
    }
    if (pattern && !pattern.test(value)) {
      throw new AppError(`${fieldName}格式不正确`, 400, 'INVALID_FORMAT');
    }
  }
}

/**
 * 数字验证
 * @param {any} value - 要验证的值
 * @param {string} fieldName - 字段名称
 * @param {Object} options - 验证选项
 * @param {boolean} options.required - 是否必填，默认true
 * @param {number} options.min - 最小值
 * @param {number} options.max - 最大值
 * @param {boolean} options.integer - 是否必须为整数
 * @throws {AppError} 验证失败时抛出错误
 */
function validateNumber(value, fieldName, options = {}) {
  const { required = true, min = null, max = null, integer = false } = options;
  
  if (required && (value === undefined || value === null)) {
    throw new AppError(`${fieldName}不能为空`, 400, 'INVALID_INPUT');
  }
  
  if (value !== undefined && value !== null) {
    const num = Number(value);
    if (isNaN(num)) {
      throw new AppError(`${fieldName}必须是有效数字`, 400, 'INVALID_TYPE');
    }
    if (integer && !Number.isInteger(num)) {
      throw new AppError(`${fieldName}必须是整数`, 400, 'INVALID_TYPE');
    }
    if (min !== null && num < min) {
      throw new AppError(`${fieldName}不能小于${min}`, 400, 'INVALID_RANGE');
    }
    if (max !== null && num > max) {
      throw new AppError(`${fieldName}不能大于${max}`, 400, 'INVALID_RANGE');
    }
  }
  
  return value !== undefined && value !== null ? Number(value) : null;
}

/**
 * 邮箱验证
 * @param {string} email - 邮箱地址
 * @throws {AppError} 邮箱格式不正确时抛出错误
 */
function validateEmail(email) {
  if (!email) return; // 可选字段
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new AppError('邮箱格式不正确', 400, 'INVALID_EMAIL');
  }
}

/**
 * ID验证（正整数）
 * @param {any} id - 要验证的ID
 * @param {string} fieldName - 字段名称，默认'ID'
 * @returns {number} 验证通过后的数字ID
 * @throws {AppError} 验证失败时抛出错误
 */
function validateId(id, fieldName = 'ID') {
  if (!id) throw new AppError(`${fieldName}不能为空`, 400, 'INVALID_ID');
  const num = Number(id);
  if (!Number.isInteger(num) || num <= 0) {
    throw new AppError(`${fieldName}必须是正整数`, 400, 'INVALID_ID');
  }
  return num;
}

/**
 * 分页参数验证
 * @param {Object} req - Express请求对象
 * @returns {Object} 分页参数 {page, limit, offset}
 */
function validatePagination(req) {
  let page = parseInt(req.query.page) || 1;
  let limit = parseInt(req.query.limit) || 10;
  
  page = Math.max(1, page);
  limit = Math.min(100, Math.max(1, limit)); // 限制1-100
  
  const offset = (page - 1) * limit;
  
  return { page, limit, offset };
}

/**
 * XSS防护 - 转义HTML特殊字符
 * @param {string} str - 要转义的字符串
 * @returns {string} 转义后的字符串
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * 枚举值验证
 * @param {any} value - 要验证的值
 * @param {Array} allowedValues - 允许的值数组
 * @param {string} fieldName - 字段名称
 * @throws {AppError} 值不在允许范围内时抛出错误
 */
function validateEnum(value, allowedValues, fieldName) {
  if (!allowedValues.includes(value)) {
    throw new AppError(
      `${fieldName}必须是以下值之一: ${allowedValues.join(', ')}`, 
      400, 
      'INVALID_ENUM'
    );
  }
}

/**
 * 手机号验证
 * @param {string} phone - 手机号
 * @throws {AppError} 格式不正确时抛出错误
 */
function validatePhone(phone) {
  if (!phone) return; // 可选字段
  const phoneRegex = /^1[3-9]\d{9}$/;
  if (!phoneRegex.test(phone)) {
    throw new AppError('手机号格式不正确', 400, 'INVALID_PHONE');
  }
}

/**
 * URL验证
 * @param {string} url - URL地址
 * @throws {AppError} 格式不正确时抛出错误
 */
function validateUrl(url) {
  if (!url) return; // 可选字段
  try {
    new URL(url);
  } catch (error) {
    throw new AppError('URL格式不正确', 400, 'INVALID_URL');
  }
}

/**
 * 日期验证
 * @param {string} dateStr - 日期字符串
 * @param {string} fieldName - 字段名称
 * @throws {AppError} 格式不正确时抛出错误
 */
function validateDate(dateStr, fieldName = '日期') {
  if (!dateStr) return; // 可选字段
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new AppError(`${fieldName}格式不正确`, 400, 'INVALID_DATE');
  }
  return date;
}

/**
 * 数组验证
 * @param {any} value - 要验证的值
 * @param {string} fieldName - 字段名称
 * @param {Object} options - 验证选项
 * @param {boolean} options.required - 是否必填
 * @param {number} options.minLength - 最小长度
 * @param {number} options.maxLength - 最大长度
 * @throws {AppError} 验证失败时抛出错误
 */
function validateArray(value, fieldName, options = {}) {
  const { required = true, minLength = 0, maxLength = Infinity } = options;
  
  if (required && (value === undefined || value === null)) {
    throw new AppError(`${fieldName}不能为空`, 400, 'INVALID_INPUT');
  }
  
  if (value !== undefined && value !== null) {
    if (!Array.isArray(value)) {
      throw new AppError(`${fieldName}必须是数组`, 400, 'INVALID_TYPE');
    }
    if (value.length < minLength) {
      throw new AppError(`${fieldName}至少包含${minLength}个元素`, 400, 'INVALID_LENGTH');
    }
    if (value.length > maxLength) {
      throw new AppError(`${fieldName}最多包含${maxLength}个元素`, 400, 'INVALID_LENGTH');
    }
  }
}

/**
 * 对象验证
 * @param {any} value - 要验证的值
 * @param {string} fieldName - 字段名称
 * @param {boolean} required - 是否必填
 * @throws {AppError} 验证失败时抛出错误
 */
function validateObject(value, fieldName, required = true) {
  if (required && (value === undefined || value === null)) {
    throw new AppError(`${fieldName}不能为空`, 400, 'INVALID_INPUT');
  }
  
  if (value !== undefined && value !== null) {
    if (typeof value !== 'object' || Array.isArray(value)) {
      throw new AppError(`${fieldName}必须是对象`, 400, 'INVALID_TYPE');
    }
  }
}

/**
 * 布尔值验证
 * @param {any} value - 要验证的值
 * @param {string} fieldName - 字段名称
 * @returns {boolean} 验证后的布尔值
 * @throws {AppError} 验证失败时抛出错误
 */
function validateBoolean(value, fieldName) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'boolean') {
    throw new AppError(`${fieldName}必须是布尔值`, 400, 'INVALID_TYPE');
  }
  return value;
}

module.exports = {
  AppError,
  VALIDATION_RULES,
  validateField,
  validateRequestBody,
  validateQueryParams,
  sanitizeInput,
  isSafeSqlInput,
  // 新增验证函数
  validateRequired,
  validateString,
  validateNumber,
  validateEmail,
  validateId,
  validatePagination,
  sanitizeString,
  validateEnum,
  validatePhone,
  validateUrl,
  validateDate,
  validateArray,
  validateObject,
  validateBoolean
};
