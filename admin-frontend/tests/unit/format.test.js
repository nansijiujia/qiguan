import { describe, it, expect, vi } from 'vitest'
import {
  safeString,
  safeToUpper,
  safeToLower,
  safeTrim,
  safeSubstring,
  safeToInt,
  safeToFloat,
  safeDate,
  safeToString,
  safeToBoolean,
  safeGet,
  safeArrayMap,
  safeJsonParse,
  safeFormatDate,
  safeFormatNumber,
  safeFormatPrice
} from '@/utils/format'

describe('safeString', () => {
  it('should return default value for null', () => {
    expect(safeString(null)).toBe('-')
  })

  it('should return default value for undefined', () => {
    expect(safeString(undefined)).toBe('-')
  })

  it('should convert number to string', () => {
    expect(safeString(123)).toBe('123')
  })

  it('should convert object using toString()', () => {
    expect(safeString({})).toBe('[object Object]')
  })

  it('should return string as-is', () => {
    expect(safeString('hello world')).toBe('hello world')
  })

  it('should use custom default value', () => {
    expect(safeString(null, 'N/A')).toBe('N/A')
  })

  it('should handle empty string', () => {
    expect(safeString('')).toBe('')
  })

  it('should convert boolean to string', () => {
    expect(safeString(true)).toBe('true')
  })

  it('should convert array using toString()', () => {
    expect(safeString([1, 2, 3])).toBe('1,2,3')
  })

  it('should handle zero value', () => {
    expect(safeString(0)).toBe('0')
  })
})

describe('safeToUpper', () => {
  it('should return default for null/undefined', () => {
    expect(safeToUpper(null)).toBe('-')
    expect(safeToUpper(undefined)).toBe('-')
  })

  it('should convert to uppercase', () => {
    expect(safeToUpper('hello')).toBe('HELLO')
  })

  it('should keep already uppercase unchanged', () => {
    expect(safeToUpper('HELLO')).toBe('HELLO')
  })

  it('should handle number input safely', () => {
    expect(safeToUpper(123)).toBe('123')
  })

  it('should handle empty string', () => {
    expect(safeToUpper('')).toBe('')
  })

  it('should convert mixed case', () => {
    expect(safeToUpper('Hello World')).toBe('HELLO WORLD')
  })

  it('should preserve special characters', () => {
    expect(safeToUpper('test@123')).toBe('TEST@123')
  })
})

describe('safeToLower', () => {
  it('should return default for null/undefined', () => {
    expect(safeToLower(null)).toBe('-')
    expect(safeToLower(undefined)).toBe('-')
  })

  it('should convert to lowercase', () => {
    expect(safeToLower('HELLO')).toBe('hello')
  })

  it('should keep already lowercase unchanged', () => {
    expect(safeToLower('hello')).toBe('hello')
  })

  it('should handle number input safely', () => {
    expect(safeToLower(456)).toBe('456')
  })

  it('should handle empty string', () => {
    expect(safeToLower('')).toBe('')
  })

  it('should convert mixed case', () => {
    expect(safeToLower('HELLO World')).toBe('hello world')
  })

  it('should accept custom default value', () => {
    expect(safeToLower(null, 'default')).toBe('default')
  })
})

describe('safeTrim', () => {
  it('should return fallback for null/undefined', () => {
    expect(safeTrim(null)).toBe('')
    expect(safeTrim(undefined)).toBe('')
  })

  it('should trim whitespace from both ends', () => {
    expect(safeTrim('  hello  ')).toBe('hello')
  })

  it('should return empty fallback when only spaces', () => {
    expect(safeTrim('   ')).toBe('')
  })

  it('should return string without spaces as-is', () => {
    expect(safeTrim('hello')).toBe('hello')
  })

  it('should convert number and trim', () => {
    expect(safeTrim(123)).toBe('123')
  })

  it('should use custom fallback value', () => {
    expect(safeTrim(null, 'fallback')).toBe('fallback')
  })

  it('should handle tabs and newlines', () => {
    expect(safeTrim('\t\nhello\t\n')).toBe('hello')
  })
})

describe('safeSubstring', () => {
  it('should return fallback for null/undefined', () => {
    expect(safeSubstring(null, 0, 5)).toBe('-')
    expect(safeSubstring(undefined, 0, 5)).toBe('-')
  })

  it('should extract substring correctly', () => {
    expect(safeSubstring('hello world', 0, 5)).toBe('hello')
  })

  it('should correct negative start to 0', () => {
    expect(safeSubstring('hello', -1, 3)).toBe('hel')
  })

  it('should auto-correct end beyond length', () => {
    expect(safeSubstring('hello', 0, 100)).toBe('hello')
  })

  it('should return fallback when start >= end', () => {
    expect(safeSubstring('hello', 5, 2)).toBe('-')
  })

  it('should slice to end when end is undefined', () => {
    expect(safeSubstring('hello', 2)).toBe('llo')
  })

  it('should use custom fallback', () => {
    expect(safeSubstring(null, 0, 5, 'error')).toBe('error')
  })

  it('should convert number input first', () => {
    expect(safeSubstring(12345, 1, 3)).toBe('23')
  })
})

describe('safeToInt', () => {
  it('should return 0 for null/undefined/empty', () => {
    expect(safeToInt(null)).toBe(0)
    expect(safeToInt(undefined)).toBe(0)
    expect(safeToInt('')).toBe(0)
  })

  it('should parse valid integer string', () => {
    expect(safeToInt('123')).toBe(123)
  })

  it('should return default for invalid string', () => {
    expect(safeToInt('abc')).toBe(0)
  })

  it('should truncate float string to integer', () => {
    expect(safeToInt('456.78')).toBe(456)
  })

  it('should truncate float number to integer', () => {
    expect(safeToInt(789.12)).toBe(789)
  })

  it('should use custom default value', () => {
    expect(safeToInt('abc', -1)).toBe(-1)
  })

  it('should parse negative numbers correctly', () => {
    expect(safeToInt('-42')).toBe(-42)
  })

  it('should parse octal-like strings as decimal', () => {
    expect(safeToInt('010')).toBe(10)
  })

  it('should handle very large numbers safely', () => {
    const result = safeToInt('99999999999999999')
    expect(typeof result).toBe('number')
  })
})

describe('safeToFloat', () => {
  it('should return 0 for null/undefined/empty', () => {
    expect(safeToFloat(null)).toBe(0)
    expect(safeToFloat(undefined)).toBe(0)
    expect(safeToFloat('')).toBe(0)
  })

  it('should parse valid float string', () => {
    expect(safeToFloat('123.45')).toBe(123.45)
  })

  it('should return default for invalid string', () => {
    expect(safeToFloat('abc')).toBe(0)
  })

  it('should convert integer to float', () => {
    expect(safeToFloat(100)).toBe(100)
  })

  it('should use custom default value', () => {
    expect(safeToFloat('invalid', -1.5)).toBe(-1.5)
  })

  it('should parse negative floats correctly', () => {
    expect(safeToFloat('-99.99')).toBe(-99.99)
  })

  it('should handle scientific notation', () => {
    const result = safeToFloat('1.23e-4')
    expect(result).toBeCloseTo(0.000123)
  })

  it('should handle NaN string safely', () => {
    const result = safeToFloat('NaN')
    expect(result).toBe(0)
  })
})

describe('safeDate', () => {
  it('should return default for null/undefined/empty', () => {
    expect(safeDate(null)).toBe('-')
    expect(safeDate(undefined)).toBe('-')
    expect(safeDate('')).toBe('-')
  })

  it('should format Date object correctly', () => {
    const date = new Date('2024-01-15T10:30:00')
    const result = safeDate(date)
    expect(result).toContain('2024')
    expect(result).toContain('01')
    expect(result).toContain('15')
  })

  it('should format timestamp in milliseconds', () => {
    const timestamp = 1705276800000
    const result = safeDate(timestamp)
    expect(result).toContain('2024')
  })

  it('should format ISO string', () => {
    const result = safeDate('2024-06-20T14:30:00Z')
    expect(result).toContain('2024')
  })

  it('should return default for invalid date string', () => {
    expect(safeDate('invalid-date')).toBe('-')
  })

  it('should use custom default value', () => {
    expect(safeDate('invalid', 'N/A')).toBe('N/A')
  })

  it('should treat 0 as valid date', () => {
    const result = safeDate(0)
    expect(result).not.toBe('-')
    expect(typeof result).toBe('string')
  })

  it('should return default for NaN Date', () => {
    expect(safeDate(new Date('invalid'))).toBe('-')
  })
})

describe('safeToString', () => {
  it('should return fallback for null/undefined', () => {
    expect(safeToString(null)).toBe('-')
    expect(safeToString(undefined)).toBe('-')
  })

  it('should convert primitives', () => {
    expect(safeToString(123)).toBe('123')
    expect(safeToString(true)).toBe('true')
  })

  it('should return string as-is', () => {
    expect(safeToString('test')).toBe('test')
  })

  it('should call toString() on objects', () => {
    expect(safeToString({ name: 'test' })).toBe('[object Object]')
  })

  it('should use custom fallback', () => {
    expect(safeToString(null, 'default')).toBe('default')
  })

  it('should convert arrays', () => {
    expect(safeToString([1, 2, 3])).toBe('1,2,3')
  })
})

describe('safeToBoolean', () => {
  it('should return false fallback for null/undefined', () => {
    expect(safeToBoolean(null)).toBe(false)
    expect(safeToBoolean(undefined)).toBe(false)
  })

  it('should return boolean as-is', () => {
    expect(safeToBoolean(true)).toBe(true)
    expect(safeToBoolean(false)).toBe(false)
  })

  it('should convert truthy strings to true', () => {
    expect(safeToBoolean('true')).toBe(true)
    expect(safeToBoolean('TRUE')).toBe(true)
    expect(safeToBoolean('1')).toBe(true)
    expect(safeToBoolean('yes')).toBe(true)
    expect(safeToBoolean('on')).toBe(true)
  })

  it('should convert falsy strings to false', () => {
    expect(safeToBoolean('false')).toBe(false)
    expect(safeToBoolean('FALSE')).toBe(false)
    expect(safeToBoolean('0')).toBe(false)
    expect(safeToBoolean('no')).toBe(false)
    expect(safeToBoolean('off')).toBe(false)
  })

  it('should convert non-zero numbers to true, zero to false', () => {
    expect(safeToBoolean(1)).toBe(true)
    expect(safeToBoolean(-1)).toBe(true)
    expect(safeToBoolean(0)).toBe(false)
  })

  it('should use custom fallback', () => {
    expect(safeToBoolean(null, true)).toBe(true)
  })

  it('should try Boolean() conversion for other types', () => {
    expect(safeToBoolean({})).toBe(true)
    expect(safeToBoolean([])).toBe(true)
  })
})

describe('safeGet', () => {
  it('should return undefined for null/undefined object', () => {
    expect(safeGet(null, 'a.b.c')).toBeUndefined()
    expect(safeGet(undefined, 'name')).toBeUndefined()
  })

  it('should return undefined for empty or non-string path', () => {
    expect(safeGet({ a: 1 }, '')).toBeUndefined()
    expect(safeGet({ a: 1 }, null)).toBeUndefined()
    expect(safeGet({ a: 1 }, 123)).toBeUndefined()
  })

  it('should access simple path', () => {
    expect(safeGet({ name: 'test' }, 'name')).toBe('test')
  })

  it('should access nested path', () => {
    const obj = { user: { profile: { age: 25 } } }
    expect(safeGet(obj, 'user.profile.age')).toBe(25)
  })

  it('should return fallback when middle property missing', () => {
    const obj = { user: {} }
    expect(safeGet(obj, 'user.profile.name', 'default')).toBe('default')
  })

  it('should return fallback when final value is undefined', () => {
    const obj = { user: { name: undefined } }
    expect(safeGet(obj, 'user.name', 'default')).toBe('default')
  })

  it('should use custom fallback', () => {
    expect(safeGet({}, 'missing', 'fallback')).toBe('fallback')
  })

  it('should filter out empty path segments', () => {
    const obj = { a: { b: 1 } }
    expect(safeGet(obj, 'a..b', 'default')).toBe(1)
  })

  it('should support array index style paths', () => {
    const obj = { items: [10, 20, 30] }
    expect(safeGet(obj, 'items.1')).toBe(20)
  })
})

describe('safeArrayMap', () => {
  it('should return empty fallback for non-array', () => {
    expect(safeArrayMap(null, x => x)).toEqual([])
    expect(safeArrayMap(undefined, x => x)).toEqual([])
    expect(safeArrayMap('not array', x => x)).toEqual([])
    expect(safeArrayMap({}, x => x)).toEqual([])
  })

  it('should return empty fallback when mapper is not a function', () => {
    expect(safeArrayMap([1, 2, 3], 'not function')).toEqual([])
  })

  it('should map array normally', () => {
    const result = safeArrayMap([1, 2, 3], x => x * 2)
    expect(result).toEqual([2, 4, 6])
  })

  it('should filter items that throw errors and log warning', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = safeArrayMap([1, 2, 3, 4], (item) => {
      if (item === 2) throw new Error('error')
      return item * 10
    })
    expect(result).toEqual([10, 30, 40])
    expect(consoleWarnSpy).toHaveBeenCalled()
    consoleWarnSpy.mockRestore()
  })

  it('should filter out null/undefined results', () => {
    const result = safeArrayMap([1, 2, 3], (item) => {
      if (item === 2) return null
      return item
    })
    expect(result).toEqual([1, 3])
  })

  it('should return empty array for empty input', () => {
    expect(safeArrayMap([], x => x)).toEqual([])
  })

  it('should use custom fallback', () => {
    expect(safeArrayMap(null, x => x, ['default'])).toEqual(['default'])
  })

  it('should pass index to mapper function', () => {
    const result = safeArrayMap([10, 20, 30], (item, index) => `${item}-${index}`)
    expect(result).toEqual(['10-0', '20-1', '30-2'])
  })
})

describe('safeJsonParse', () => {
  it('should return {} for null/undefined', () => {
    expect(safeJsonParse(null)).toEqual({})
    expect(safeJsonParse(undefined)).toEqual({})
  })

  it('should return {} for non-string inputs', () => {
    expect(safeJsonParse(123)).toEqual({})
    expect(safeJsonParse({})).toEqual({})
    expect(safeJsonParse([])).toEqual({})
  })

  it('should return {} for empty string', () => {
    expect(safeJsonParse('')).toEqual({})
  })

  it('should return {} for "null" and "undefined" strings', () => {
    expect(safeJsonParse('null')).toEqual({})
    expect(safeJsonParse('undefined')).toEqual({})
  })

  it('should parse valid JSON object', () => {
    const result = safeJsonParse('{"name": "test", "value": 123}')
    expect(result).toEqual({ name: 'test', value: 123 })
  })

  it('should parse valid JSON array', () => {
    const result = safeJsonParse('[1, 2, 3]')
    expect(result).toEqual([1, 2, 3])
  })

  it('should return default for invalid JSON and warn', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = safeJsonParse('invalid json')
    expect(result).toEqual({})
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[safeJsonParse]'),
      expect.any(String)
    )
    consoleWarnSpy.mockRestore()
  })

  it('should use custom default value', () => {
    expect(safeJsonParse('invalid', [])).toEqual([])
    expect(safeJsonParse(null, null)).toBeNull()
  })

  it('should trim whitespace before parsing', () => {
    const result = safeJsonParse('  {"key": "value"}  ')
    expect(result).toEqual({ key: 'value' })
  })

  it('should parse primitive JSON values', () => {
    expect(safeJsonParse('42')).toBe(42)
    expect(safeJsonParse('true')).toBe(true)
    expect(safeJsonParse('"hello"')).toBe('hello')
  })
})

describe('safeFormatDate', () => {
  it('should return "-" for null/undefined/falsey values', () => {
    expect(safeFormatDate(null)).toBe('-')
    expect(safeFormatDate(undefined)).toBe('-')
  })

  it('should treat 0 as valid date', () => {
    const result = safeFormatDate(0)
    expect(result).not.toBe('-')
  })

  it('should format Date object correctly', () => {
    const date = new Date('2024-03-15T08:00:00')
    const result = safeFormatDate(date)
    expect(result).toContain('2024')
  })

  it('should return original string for invalid date', () => {
    expect(safeFormatDate('not-a-date')).toBe('not-a-date')
  })

  it('should return string form on exception', () => {
    const result = safeFormatDate({ invalid: true })
    expect(typeof result).toBe('string')
  })
})

describe('safeFormatNumber', () => {
  it('should return "-" for null/undefined/NaN', () => {
    expect(safeFormatNumber(null)).toBe('-')
    expect(safeFormatNumber(undefined)).toBe('-')
    expect(safeFormatNumber(NaN)).toBe('-')
  })

  it('should format integer with no decimals by default', () => {
    const result = safeFormatNumber(1234)
    expect(result).toContain('1')
    expect(result).toContain('234')
  })

  it('should format with specified decimal places', () => {
    const result = safeFormatNumber(1234.5678, 2)
    expect(result).toContain('.')
    expect(result).toContain('57')
  })

  it('should display 0 correctly', () => {
    expect(safeFormatNumber(0)).toBe('0')
  })

  it('should format negative numbers', () => {
    const result = safeFormatNumber(-999)
    expect(result).toContain('-')
    expect(result).toContain('999')
  })

  it('should return string form on error', () => {
    expect(safeFormatNumber('invalid')).toBe('-')
  })
})

describe('safeFormatPrice', () => {
  it('should return "-¥0.00" for null/undefined/falsey', () => {
    expect(safeFormatPrice(null)).toBe('-¥0.00')
    expect(safeFormatPrice(undefined)).toBe('-¥0.00')
    expect(safeFormatPrice('')).toBe('-¥0.00')
  })

  it('should show ¥0.00 for zero price', () => {
    expect(safeFormatPrice(0)).toBe('¥0.00')
  })

  it('should format positive price', () => {
    expect(safeFormatPrice(99.99)).toBe('¥99.99')
  })

  it('should add two decimals for integer price', () => {
    expect(safeFormatPrice(100)).toBe('¥100.00')
  })

  it('should format large price amounts', () => {
    const result = safeFormatPrice(99999.99)
    expect(result).toContain('¥')
    expect(result).toContain('99')
  })
})
