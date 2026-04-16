const {
  AppError,
  VALIDATION_RULES,
  validateField,
  validateRequestBody,
  validateQueryParams,
  sanitizeInput,
  isSafeSqlInput,
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
} = require('../../utils/validation');

describe('validation - 完整测试套件', () => {

  describe('VALIDATION_RULES', () => {
    it('should contain all rule types', () => {
      expect(VALIDATION_RULES.REQUIRED).toBe('required');
      expect(VALIDATION_RULES.STRING).toBe('string');
      expect(VALIDATION_RULES.NUMBER).toBe('number');
      expect(VALIDATION_RULES.BOOLEAN).toBe('boolean');
      expect(VALIDATION_RULES.ARRAY).toBe('array');
      expect(VALIDATION_RULES.OBJECT).toBe('object');
      expect(VALIDATION_RULES.EMAIL).toBe('email');
      expect(VALIDATION_RULES.PHONE).toBe('phone');
      expect(VALIDATION_RULES.URL).toBe('url');
      expect(VALIDATION_RULES.ENUM).toBe('enum');
      expect(VALIDATION_RULES.MIN_LENGTH).toBe('minLength');
      expect(VALIDATION_RULES.MAX_LENGTH).toBe('maxLength');
      expect(VALIDATION_RULES.MIN_VALUE).toBe('minValue');
      expect(VALIDATION_RULES.MAX_VALUE).toBe('maxValue');
      expect(VALIDATION_RULES.PATTERN).toBe('pattern');
    });
  });

  describe('validateField()', () => {
    it('should pass required field with value', () => {
      const result = validateField('test', { [VALIDATION_RULES.REQUIRED]: true, fieldName: 'name' });
      expect(result.valid).toBe(true);
    });

    it('should fail required field when empty', () => {
      const result = validateField('', { [VALIDATION_RULES.REQUIRED]: true, fieldName: 'name' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('不能为空');
    });

    it('should fail required field when null', () => {
      const result = validateField(null, { [VALIDATION_RULES.REQUIRED]: true, fieldName: 'name' });
      expect(result.valid).toBe(false);
    });

    it('should fail required field when undefined', () => {
      const result = validateField(undefined, { [VALIDATION_RULES.REQUIRED]: true, fieldName: 'name' });
      expect(result.valid).toBe(false);
    });

    it('should skip validation for non-required empty fields', () => {
      const result = validateField(null, { [VALIDATION_RULES.REQUIRED]: false });
      expect(result.valid).toBe(true);
    });

    it('should validate string type', () => {
      expect(validateField('hello', { [VALIDATION_RULES.STRING]: true }).valid).toBe(true);
      expect(validateField(123, { [VALIDATION_RULES.STRING]: true }).valid).toBe(false);
    });

    it('should validate number type', () => {
      expect(validateField(123, { [VALIDATION_RULES.NUMBER]: true }).valid).toBe(true);
      expect(validateField('123', { [VALIDATION_RULES.NUMBER]: true }).valid).toBe(false);
    });

    it('should validate boolean type', () => {
      expect(validateField(true, { [VALIDATION_RULES.BOOLEAN]: true }).valid).toBe(true);
      expect(validateField('true', { [VALIDATION_RULES.BOOLEAN]: true }).valid).toBe(false);
    });

    it('should validate array type', () => {
      expect(validateField([1, 2], { [VALIDATION_RULES.ARRAY]: true }).valid).toBe(true);
      expect(validateField('not array', { [VALIDATION_RULES.ARRAY]: true }).valid).toBe(false);
    });

    it('should validate object type (not array)', () => {
      expect(validateField({ a: 1 }, { [VALIDATION_RULES.OBJECT]: true }).valid).toBe(true);
      expect(validateField([1, 2], { [VALIDATION_RULES.OBJECT]: true }).valid).toBe(false);
    });

    it('should validate email format', () => {
      expect(validateField('test@example.com', { [VALIDATION_RULES.EMAIL]: true }).valid).toBe(true);
      expect(validateField('invalid-email', { [VALIDATION_RULES.EMAIL]: true }).valid).toBe(false);
    });

    it('should validate phone format', () => {
      expect(validateField('13800138000', { [VALIDATION_RULES.PHONE]: true }).valid).toBe(true);
      expect(validateField('12345', { [VALIDATION_RULES.PHONE]: true }).valid).toBe(false);
    });

    it('should validate URL format', () => {
      expect(validateField('https://example.com', { [VALIDATION_RULES.URL]: true }).valid).toBe(true);
      expect(validateField('not-a-url', { [VALIDATION_RULES.URL]: true }).valid).toBe(false);
    });

    it('should validate enum values', () => {
      const result = validateField('admin', { [VALIDATION_RULES.ENUM]: true, enumValues: ['admin', 'user'] });
      expect(result.valid).toBe(true);

      const invalidResult = validateField('superadmin', { [VALIDATION_RULES.ENUM]: true, enumValues: ['admin', 'user'] });
      expect(invalidResult.valid).toBe(false);
    });

    it('should validate min length', () => {
      expect(validateField('abc', { [VALIDATION_RULES.MIN_LENGTH]: 3 }).valid).toBe(true);
      expect(validateField('ab', { [VALIDATION_RULES.MIN_LENGTH]: 3 }).valid).toBe(false);
    });

    it('should validate max length', () => {
      expect(validateField('ab', { [VALIDATION_RULES.MAX_LENGTH]: 3 }).valid).toBe(true);
      expect(validateField('abcd', { [VALIDATION_RULES.MAX_LENGTH]: 3 }).valid).toBe(false);
    });

    it('should validate min value', () => {
      expect(validateField(10, { [VALIDATION_RULES.MIN_VALUE]: 5 }).valid).toBe(true);
      expect(validateField(3, { [VALIDATION_RULES.MIN_VALUE]: 5 }).valid).toBe(false);
    });

    it('should validate max value', () => {
      expect(validateField(3, { [VALIDATION_RULES.MAX_VALUE]: 5 }).valid).toBe(true);
      expect(validateField(10, { [VALIDATION_RULES.MAX_VALUE]: 5 }).valid).toBe(false);
    });

    it('should validate pattern', () => {
      expect(validateField('abc123', { [VALIDATION_RULES.PATTERN]: /^[a-z0-9]+$/ }).valid).toBe(true);
      expect(validateField('abc!@#', { [VALIDATION_RULES.PATTERN]: /^[a-z0-9]+$/ }).valid).toBe(false);
    });
  });

  describe('validateRequestBody()', () => {
    it('should return valid for correct data', () => {
      const rules = {
        name: { [VALIDATION_RULES.REQUIRED]: true, [VALIDATION_RULES.STRING]: true },
        age: { [VALIDATION_RULES.NUMBER]: true }
      };
      const result = validateRequestBody({ name: 'test', age: 25 }, rules);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should collect all errors', () => {
      const rules = {
        name: { [VALIDATION_RULES.REQUIRED]: true },
        email: { [VALIDATION_RULES.REQUIRED]: true, [VALIDATION_RULES.EMAIL]: true }
      };
      const result = validateRequestBody({}, rules);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('validateQueryParams()', () => {
    it('should sanitize valid query params', () => {
      const rules = {
        page: { [VALIDATION_RULES.NUMBER]: true },
        search: { [VALIDATION_RULES.STRING]: true }
      };
      const result = validateQueryParams({ page: '1', search: 'test' }, rules);
      expect(result.valid).toBe(true);
      expect(result.sanitizedQuery.page).toBe('1');
      expect(result.sanitizedQuery.search).toBe('test');
    });

    it('should exclude invalid params from sanitized output', () => {
      const rules = {
        page: { [VALIDATION_RULES.NUMBER]: true }
      };
      const result = validateQueryParams({ page: 'not_a_number' }, rules);
      expect(result.valid).toBe(false);
      expect(result.sanitizedQuery.page).toBeUndefined();
    });
  });

  describe('sanitizeInput()', () => {
    it('should escape HTML special characters', () => {
      expect(sanitizeInput('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('should escape ampersand first', () => {
      expect(sanitizeInput('a&b')).toBe('a&amp;b');
    });

    it('should handle non-string input', () => {
      expect(sanitizeInput(123)).toBe(123);
      expect(sanitizeInput(null)).toBeNull();
      expect(sanitizeInput(undefined)).toBeUndefined();
    });

    it('should preserve normal text', () => {
      expect(sanitizeInput('Hello World 你好')).toBe('Hello World 你好');
    });
  });

  describe('isSafeSqlInput()', () => {
    it('should detect SQL keywords', () => {
      expect(isSafeSqlInput("SELECT * FROM users")).toBe(false);
      expect(isSafeSqlInput("DROP TABLE users")).toBe(false);
      expect(isSafeSqlInput("1; DELETE FROM users")).toBe(false);
    });

    it('should detect SQL comments', () => {
      expect(isSafeSqlInput("test--comment")).toBe(false);
      expect(isSafeSqlInput("test/*comment*/")).toBe(false);
    });

    it('should detect UNION SELECT', () => {
      expect(isSafeSqlInput("1 UNION SELECT * FROM users")).toBe(false);
    });

    it('should allow safe input', () => {
      expect(isSafeSqlInput('hello world')).toBe(true);
      expect(isSafeSqlInput('test user 123')).toBe(true);
    });

    it('should handle non-string input', () => {
      expect(isSafeSqlInput(123)).toBe(true);
      expect(isSafeSqlInput(null)).toBe(true);
    });
  });

  describe('validateRequired()', () => {
    it('should pass when all required fields present', () => {
      expect(() => validateRequired(['name', 'email'], { name: 'test', email: 'a@b.com' })).not.toThrow();
    });

    it('should throw when missing required field', () => {
      expect(() => validateRequired(['name'], {})).toThrow(AppError);
    });

    it('should list all missing fields', () => {
      try {
        validateRequired(['name', 'email', 'phone'], { name: 'test' });
      } catch (e) {
        expect(e.message).toContain('email');
        expect(e.message).toContain('phone');
      }
    });
  });

  describe('validateString()', () => {
    it('should pass valid string', () => {
      expect(() => validateString('hello', 'Name')).not.toThrow();
    });

    it('should enforce required constraint', () => {
      expect(() => validateString(null, 'Name', { required: true })).toThrow(AppError);
    });

    it('should allow null when not required', () => {
      expect(() => validateString(null, 'Name', { required: false })).not.toThrow();
    });

    it('should validate min length', () => {
      expect(() => validateString('ab', 'Name', { min: 3 })).toThrow(AppError);
      expect(() => validateString('abc', 'Name', { min: 3 })).not.toThrow();
    });

    it('should validate max length', () => {
      expect(() => validateString('a'.repeat(256), 'Name', { max: 255 })).toThrow(AppError);
    });

    it('should validate pattern', () => {
      expect(() => validateString('abc!', 'Name', { pattern: /^[a-z]+$/ })).toThrow(AppError);
    });

    it('should reject non-string type', () => {
      expect(() => validateString(123, 'Name')).toThrow(AppError);
    });
  });

  describe('validateNumber()', () => {
    it('should pass valid number and return parsed value', () => {
      const result = validateNumber('100', 'Price', {});
      expect(result).toBe(100);
    });

    it('should enforce required constraint', () => {
      expect(() => validateNumber(null, 'Price', { required: true })).toThrow(AppError);
    });

    it('should reject NaN values', () => {
      expect(() => validateNumber('not a number', 'Price')).toThrow(AppError);
    });

    it('should validate integer constraint', () => {
      expect(() => validateNumber(5.5, 'Count', { integer: true })).toThrow(AppError);
      expect(() => validateNumber(5, 'Count', { integer: true })).not.toThrow();
    });

    it('should validate min value', () => {
      expect(() => validateNumber(-1, 'Price', { min: 0 })).toThrow(AppError);
    });

    it('should validate max value', () => {
      expect(() => validateNumber(101, 'Score', { max: 100 })).toThrow(AppError);
    });

    it('should return null for optional empty field', () => {
      const result = validateNumber(null, 'Optional', { required: false });
      expect(result).toBeNull();
    });
  });

  describe('validateEmail()', () => {
    it('should pass valid email', () => {
      expect(() => validateEmail('test@example.com')).not.toThrow();
    });

    it('should allow empty email (optional)', () => {
      expect(() => validateEmail('')).not.toThrow();
      expect(() => validateEmail(null)).not.toThrow();
      expect(() => validateEmail(undefined)).not.toThrow();
    });

    it('should reject invalid email format', () => {
      expect(() => validateEmail('invalid')).toThrow(AppError);
      expect(() => validateEmail('test@')).toThrow(AppError);
    });
  });

  describe('validateId()', () => {
    it('should pass valid positive integer ID', () => {
      const id = validateId('42', 'User ID');
      expect(id).toBe(42);
    });

    it('should reject zero', () => {
      expect(() => validateId(0)).toThrow(AppError);
    });

    it('reject negative numbers', () => {
      expect(() => validateId(-1)).toThrow(AppError);
    });

    it('should reject non-numeric strings', () => {
      expect(() => validateId('abc')).toThrow(AppError);
    });

    it('should reject empty/null', () => {
      expect(() => validateId(null)).toThrow(AppError);
      expect(() => validateId('')).toThrow(AppError);
    });
  });

  describe('validatePagination()', () => {
    let req;

    beforeEach(() => {
      req = { query: {} };
    });

    it('should return default values for missing params', () => {
      const result = validatePagination(req);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(0);
    });

    it('should clamp page to minimum 1', () => {
      req.query = { page: '0' };
      const result = validatePagination(req);
      expect(result.page).toBe(1);

      req.query = { page: '-5' };
      const result2 = validatePagination(req);
      expect(result2.page).toBe(1);
    });

    it('should limit max results per page to 100', () => {
      req.query = { limit: '1000' };
      const result = validatePagination(req);
      expect(result.limit).toBe(100);
    });

    it('should limit min results per page to 1', () => {
      req.query = { limit: '0' };
      const result = validatePagination(req);
      expect(result.limit).toBe(1);
    });

    it('should calculate offset correctly', () => {
      req.query = { page: '3', limit: '20' };
      const result = validatePagination(req);
      expect(result.offset).toBe(40);
    });

    it('should parse string parameters correctly', () => {
      req.query = { page: '5', limit: '25' };
      const result = validatePagination(req);
      expect(result.page).toBe(5);
      expect(result.limit).toBe(25);
      expect(result.offset).toBe(100);
    });
  });

  describe('sanitizeString()', () => {
    it('should escape HTML entities', () => {
      expect(sanitizeString('<script>')).toBe('&lt;script&gt;');
      expect(sanitizeString('"quoted"')).toBe('&quot;quoted&quot;');
      expect(sanitizeString("'single'")).toBe('&#x27;single&#x27;');
      expect(sanitizeString('path/to/file')).toBe('path&#x2F;to&#x2F;file');
      expect(sanitizeString('a&b')).toBe('a&amp;b');
    });

    it('should handle non-string input', () => {
      expect(sanitizeString(123)).toBe(123);
      expect(sanitizeString(null)).toBeNull();
      expect(sanitizeString(undefined)).toBeUndefined();
    });

    it('should preserve normal text', () => {
      expect(sanitizeString('Hello World 123')).toBe('Hello World 123');
    });
  });

  describe('validateEnum()', () => {
    it('should pass valid enum value', () => {
      expect(() => validateEnum('active', ['active', 'inactive'], 'Status')).not.toThrow();
    });

    it('should throw for invalid enum value', () => {
      expect(() => validateEnum('deleted', ['active', 'inactive'], 'Status')).toThrow(AppError);
    });
  });

  describe('validatePhone()', () => {
    it('should pass valid Chinese phone number', () => {
      expect(() => validatePhone('13800138000')).not.toThrow();
      expect(() => validatePhone('19912345678')).not.toThrow();
    });

    it('should allow empty phone (optional)', () => {
      expect(() => validatePhone('')).not.toThrow();
      expect(() => validatePhone(null)).not.toThrow();
    });

    it('should reject invalid phone format', () => {
      expect(() => validatePhone('12345')).toThrow(AppError);
      expect(() => validatePhone('12800138000')).toThrow(AppError);
    });
  });

  describe('validateUrl()', () => {
    it('should pass valid URL', () => {
      expect(() => validateUrl('https://example.com')).not.toThrow();
      expect(() => validateUrl('http://localhost:3000')).not.toThrow();
    });

    it('should allow empty URL (optional)', () => {
      expect(() => validateUrl('')).not.toThrow();
      expect(() => validateUrl(null)).not.toThrow();
    });

    it('should reject invalid URL', () => {
      expect(() => validateUrl('not-a-url')).toThrow(AppError);
    });
  });

  describe('validateDate()', () => {
    it('should pass valid date string', () => {
      const date = validateDate('2024-01-15', 'Birthday');
      expect(date).toBeInstanceOf(Date);
    });

    it('should allow empty date (optional)', () => {
      expect(() => validateDate('', 'Date')).not.toThrow();
      expect(() => validateDate(null, 'Date')).not.toThrow();
    });

    it('should reject invalid date string', () => {
      expect(() => validateDate('not-a-date', 'Date')).toThrow(AppError);
    });
  });

  describe('validateArray()', () => {
    it('should pass valid array', () => {
      expect(() => validateArray([1, 2, 3], 'Items')).not.toThrow();
    });

    it('should enforce required constraint', () => {
      expect(() => validateArray(null, 'Items', { required: true })).toThrow(AppError);
    });

    it('should reject non-array input', () => {
      expect(() => validateArray('not array', 'Items')).toThrow(AppError);
    });

    it('should validate minLength', () => {
      expect(() => validateArray([1], 'Items', { minLength: 2 })).toThrow(AppError);
      expect(() => validateArray([1, 2], 'Items', { minLength: 2 })).not.toThrow();
    });

    it('should validate maxLength', () => {
      expect(() => validateArray([1, 2, 3, 4], 'Items', { maxLength: 3 })).toThrow(AppError);
    });
  });

  describe('validateObject()', () => {
    it('should pass valid object', () => {
      expect(() => validateObject({ a: 1 }, 'Config')).not.toThrow();
    });

    it('should enforce required constraint', () => {
      expect(() => validateObject(null, 'Config', { required: true })).toThrow(AppError);
    });

    it('should reject arrays as objects', () => {
      expect(() => validateObject([1, 2, 3], 'Config')).toThrow(AppError);
    });

    it('should reject non-object types', () => {
      expect(() => validateObject('string', 'Config')).toThrow(AppError);
    });
  });

  describe('validateBoolean()', () => {
    it('should pass and return valid boolean', () => {
      expect(validateBoolean(true, 'Active')).toBe(true);
      expect(validateBoolean(false, 'Active')).toBe(false);
    });

    it('should return null for null/undefined', () => {
      expect(validateBoolean(null, 'Active')).toBeNull();
      expect(validateBoolean(undefined, 'Active')).toBeNull();
    });

    it('should reject non-boolean types', () => {
      expect(() => validateBoolean('true', 'Active')).toThrow(AppError);
      expect(() => validateBoolean(1, 'Active')).toThrow(AppError);
    });
  });

  describe('AppError class', () => {
    it('should create error with custom properties', () => {
      const err = new AppError('test message', 400, 'CUSTOM_CODE');
      expect(err.message).toBe('test message');
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('CUSTOM_CODE');
      expect(err.name).toBe('AppError');
    });

    it('should use defaults', () => {
      const err = new AppError('default');
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('VALIDATION_ERROR');
    });
  });
});
