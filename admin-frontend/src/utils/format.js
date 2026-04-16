/**
 * 安全地将任意值转换为字符串
 * @param {*} value - 任意输入值（可以是 null、undefined、数字、对象等）
 * @param {string} [defaultValue='-'] - 当转换失败时的默认返回值
 * @returns {string} 转换后的字符串或默认值
 * @example
 * safeString(null) // '-'
 * safeString(undefined) // '-'
 * safeString(123) // '123'
 * safeString('hello') // 'hello'
 * safeString({}) // '[object Object]'
 */
export function safeString(value, defaultValue = '-') {
  if (value === null || value === undefined) return defaultValue
  try {
    return String(value)
  } catch (e) {
    return defaultValue
  }
}

export function safeFormatDate(value, format = 'YYYY-MM-DD HH:mm:ss') {
  if (!value && value !== 0) return '-'
  
  try {
    const date = new Date(value)
    if (isNaN(date.getTime())) return String(value)
    
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  } catch (e) {
    return String(value)
  }
}

export function safeFormatNumber(value, decimals = 0) {
  if (value === null || value === undefined || isNaN(Number(value))) return '-'
  
  try {
    const num = Number(value)
    if (decimals > 0) {
      return num.toLocaleString('zh-CN', { 
        minimumFractionDigits: decimals, 
        maximumFractionDigits: decimals 
      })
    }
    return num.toLocaleString('zh-CN')
  } catch (e) {
    return String(value)
  }
}

export function safeFormatPrice(value) {
  if (!value && value !== 0) return '-¥0.00'
  return '¥' + safeFormatNumber(value, 2)
}

/**
 * 安全地转换为大写
 * @param {*} value - 可能是 null/undefined/非字符串类型的任意值
 * @param {string} [defaultValue='-'] - 当转换失败时的默认返回值
 * @returns {string} 大写字符串或默认值
 * @example
 * safeToUpper(null) // '-'
 * safeToUpper(undefined) // '-'
 * safeToUpper('hello') // 'HELLO'
 * safeToUpper('Hello World') // 'HELLO WORLD'
 * safeToUpper(123) // '123'
 */
export function safeToUpper(value, defaultValue = '-') {
  if (value === null || value === undefined) return defaultValue
  try {
    return String(value).toUpperCase()
  } catch (e) {
    return defaultValue
  }
}

/**
 * 安全地转换为小写
 * @param {*} value - 可能是 null/undefined/非字符串类型的任意值
 * @param {string} [defaultValue='-'] - 当转换失败时的默认返回值
 * @returns {string} 小写字符串或默认值
 * @example
 * safeToLower(null) // '-'
 * safeToLower(undefined) // '-'
 * safeToLower('HELLO') // 'hello'
 * safeToLower('Hello World') // 'hello world'
 * safeToLower(123) // '123'
 */
export function safeToLower(value, defaultValue = '-') {
  if (value === null || value === undefined) return defaultValue
  try {
    return String(value).toLowerCase()
  } catch (e) {
    return defaultValue
  }
}

/**
 * 安全去空格
 * @param {*} value - 输入值
 * @param {string} [fallback=''] - 默认返回值
 * @returns {string} 去空格后的字符串或fallback值
 */
export function safeTrim(value, fallback = '') {
  if (value === null || value === undefined) return fallback
  try {
    const str = String(value).trim()
    return str.length > 0 ? str : fallback
  } catch (e) {
    return fallback
  }
}

/**
 * 安全截取字符串
 * @param {*} value - 输入值
 * @param {number} start - 起始位置
 * @param {number} end - 结束位置
 * @param {string} [fallback='-'] - 默认返回值
 * @returns {string} 截取后的字符串或fallback值
 */
export function safeSubstring(value, start, end, fallback = '-') {
  if (value === null || value === undefined) return fallback
  try {
    const str = String(value)
    if (start < 0) start = 0
    if (end === undefined || end > str.length) end = str.length
    if (start >= end) return fallback
    return str.substring(start, end)
  } catch (e) {
    return fallback
  }
}

/**
 * 安全地转换为整数
 * @param {*} value - 输入值（可以是字符串、数字、null、undefined等）
 * @param {number} [defaultValue=0] - 当转换失败时的默认返回值
 * @returns {number} 整数值或默认值
 * @example
 * safeToInt(null) // 0
 * safeToInt(undefined) // 0
 * safeToInt('123') // 123
 * safeToInt('abc') // 0
 * safeToInt(456.78) // 456
 * safeToInt('abc', -1) // -1
 */
export function safeToInt(value, defaultValue = 0) {
  if (value === null || value === undefined || value === '') return defaultValue
  try {
    const num = parseInt(String(value), 10)
    return isNaN(num) ? defaultValue : num
  } catch (e) {
    return defaultValue
  }
}

/**
 * 安全地转换为浮点数
 * @param {*} value - 输入值（可以是字符串、数字、null、undefined等）
 * @param {number} [defaultValue=0] - 当转换失败时的默认返回值
 * @returns {number} 浮点数值或默认值
 * @example
 * safeToFloat(null) // 0
 * safeToFloat(undefined) // 0
 * safeToFloat('123.45') // 123.45
 * safeToFloat('abc') // 0
 * safeToFloat(456) // 456
 * safeToFloat('abc', -1.5) // -1.5
 */
export function safeToFloat(value, defaultValue = 0) {
  if (value === null || value === undefined || value === '') return defaultValue
  try {
    const num = parseFloat(String(value))
    return isNaN(num) ? defaultValue : num
  } catch (e) {
    return defaultValue
  }
}

/**
 * 安全地格式化日期
 * 支持多种日期输入格式：Date对象、时间戳（毫秒/秒）、ISO字符串等
 * @param {*} value - 日期值（可以是 Date 对象、时间戳、ISO 字符串、null、undefined 等）
 * @param {string} [defaultValue='-'] - 当格式化失败时的默认返回值
 * @param {string} [format='YYYY-MM-DD HH:mm:ss'] - 目标日期格式（目前支持标准中文格式）
 * @returns {string} 格式化后的日期字符串或默认值
 * @example
 * safeDate(null) // '-'
 * safeDate(undefined) // '-'
 * safeDate(new Date('2024-01-15')) // '2024/01/15 08:00:00' (根据本地时区)
 * safeDate(1705276800000) // '2024/01/15 08:00:00'
 * safeDate('2024-01-15T10:30:00') // '2024/01/15 10:30:00'
 * safeDate('invalid-date') // '-'
 * safeDate('invalid-date', 'N/A') // 'N/A'
 */
export function safeDate(value, defaultValue = '-', format = 'YYYY-MM-DD HH:mm:ss') {
  if (value === null || value === undefined || value === '') return defaultValue

  try {
    const date = new Date(value)

    if (isNaN(date.getTime())) {
      return defaultValue
    }

    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  } catch (e) {
    return defaultValue
  }
}

/**
 * 安全转字符串
 * @param {*} value - 输入值
 * @param {string} [fallback='-'] - 默认返回值
 * @returns {string} 字符串或fallback值
 */
export function safeToString(value, fallback = '-') {
  if (value === null || value === undefined) return fallback
  try {
    return String(value)
  } catch (e) {
    return fallback
  }
}

/**
 * 安全转布尔值
 * @param {*} value - 输入值
 * @param {boolean} [fallback=false] - 默认返回值
 * @returns {boolean} 布尔值或fallback值
 */
export function safeToBoolean(value, fallback = false) {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const lowerVal = value.toLowerCase().trim()
    if (lowerVal === 'true' || lowerVal === '1' || lowerVal === 'yes' || lowerVal === 'on') return true
    if (lowerVal === 'false' || lowerVal === '0' || lowerVal === 'no' || lowerVal === 'off') return false
  }
  if (typeof value === 'number') return value !== 0
  try {
    return Boolean(value)
  } catch (e) {
    return fallback
  }
}

/**
 * 深度安全访问对象属性
 * @param {Object} obj - 目标对象
 * @param {string} path - 属性路径，如 'a.b.c'
 * @param {*} [fallback=undefined] - 默认返回值
 * @returns {*} 属性值或fallback值
 */
export function safeGet(obj, path, fallback = undefined) {
  if (obj === null || obj === undefined) return fallback
  if (!path || typeof path !== 'string') return fallback
  
  try {
    const keys = path.split('.').filter(k => k.trim() !== '')
    let current = obj
    
    for (const key of keys) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return fallback
      }
      current = current[key]
    }
    
    return current === undefined ? fallback : current
  } catch (e) {
    return fallback
  }
}

/**
 * 安全数组映射
 * @param {Array} arr - 目标数组
 * @param {Function} mapper - 映射函数
 * @param {Array} [fallback=[]] - 默认返回值
 * @returns {Array} 映射后的数组或fallback值
 */
export function safeArrayMap(arr, mapper, fallback = []) {
  if (!Array.isArray(arr)) return fallback
  if (typeof mapper !== 'function') return fallback
  
  try {
    return arr.map((item, index) => {
      try {
        return mapper(item, index)
      } catch (e) {
        console.warn('[safeArrayMap] 映射函数执行失败:', e)
        return null
      }
    }).filter(item => item !== null && item !== undefined)
  } catch (e) {
    return fallback
  }
}

/**
 * 安全地解析JSON字符串
 * 解析失败时返回默认值（而非抛出异常）
 * @param {string} value - JSON字符串
 * @param {*} [defaultValue={}] - 当解析失败时的默认返回值，默认为空对象
 * @returns {*} 解析后的JavaScript对象或默认值
 * @example
 * safeJsonParse(null) // {}
 * safeJsonParse(undefined) // {}
 * safeJsonParse('{"name": "test"}') // { name: 'test' }
 * safeJsonParse('invalid json') // {}
 * safeJsonParse('invalid json', []) // []
 * safeJsonParse('[1, 2, 3]') // [1, 2, 3]
 */
export function safeJsonParse(value, defaultValue = {}) {
  if (value === null || value === undefined) return defaultValue
  if (typeof value !== 'string') return defaultValue

  const trimmedStr = value.trim()
  if (trimmedStr === '' || trimmedStr === 'null' || trimmedStr === 'undefined') return defaultValue

  try {
    return JSON.parse(trimmedStr)
  } catch (e) {
    console.warn('[safeJsonParse] JSON解析失败:', e.message)
    return defaultValue
  }
}
