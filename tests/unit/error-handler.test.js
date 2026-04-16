const { AppError, sendErrorResponse, createError, ERROR_CODES } = require('../../utils/error-handler');

describe('errorHandler', () => {
  let mockRes;

  beforeEach(() => {
    mockRes = {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      }
    };
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('AppError', () => {
    it('should create error with custom properties', () => {
      const err = new AppError('test error', 400, 'TEST_ERROR');
      expect(err.message).toBe('test error');
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('TEST_ERROR');
      expect(err.timestamp).toBeDefined();
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(AppError);
    });

    it('should use default statusCode and code', () => {
      const err = new AppError('default error');
      expect(err.statusCode).toBe(500);
      expect(err.code).toBe('INTERNAL_ERROR');
    });

    it('should capture stack trace', () => {
      const err = new AppError('stack test');
      expect(err.stack).toBeDefined();
    });
  });

  describe('sendErrorResponse()', () => {
    it('should send error response with correct structure', () => {
      const err = new AppError('test error', 400, 'TEST_ERROR');
      sendErrorResponse(mockRes, err, 'TestModule');

      expect(mockRes.statusCode).toBe(400);
      expect(mockRes.body.success).toBe(false);
      expect(mockRes.body.error.code).toBe('TEST_ERROR');
      expect(mockRes.body.error.message).toBe('test error');
      expect(mockRes.body.error.timestamp).toBeDefined();
    });

    it('should use default values when error lacks properties', () => {
      const err = new Error('plain error');
      sendErrorResponse(mockRes, err);

      expect(mockRes.statusCode).toBe(500);
      expect(mockRes.body.error.code).toBe('INTERNAL_ERROR');
      expect(mockRes.body.error.message).toBe('plain error');
    });

    it('should use default message when error.message is empty', () => {
      const err = new AppError('', 500, 'CUSTOM_CODE');
      sendErrorResponse(mockRes, err);

      expect(mockRes.body.error.message).toBe('操作失败');
    });

    it('should log error with context', () => {
      const err = new AppError('log test');
      sendErrorResponse(mockRes, err, 'AuthMiddleware');

      expect(console.error).toHaveBeenCalledWith(
        '[AuthMiddleware] Error:',
        expect.objectContaining({
          message: 'log test',
          code: 'INTERNAL_ERROR'
        })
      );
    });

    it('should include stack in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const err = new AppError('dev error');
      sendErrorResponse(mockRes, err, 'DevContext');

      expect(console.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          stack: expect.any(String)
        })
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should hide stack in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const err = new AppError('prod error');
      sendErrorResponse(mockRes, err, 'ProdContext');

      expect(console.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          stack: undefined
        })
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('createError()', () => {
    it('should create AppError instance', () => {
      const err = createError('created error', 404, 'NOT_FOUND');
      expect(err).toBeInstanceOf(AppError);
      expect(err.message).toBe('created error');
      expect(err.statusCode).toBe(404);
      expect(err.code).toBe('NOT_FOUND');
    });

    it('should create error with defaults', () => {
      const err = createError('default');
      expect(err.statusCode).toBe(500);
      expect(err.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('ERROR_CODES', () => {
    it('should contain all standard error codes', () => {
      expect(ERROR_CODES.INVALID_INPUT).toEqual({ statusCode: 400, code: 'INVALID_INPUT' });
      expect(ERROR_CODES.UNAUTHORIZED).toEqual({ statusCode: 401, code: 'UNAUTHORIZED' });
      expect(ERROR_CODES.FORBIDDEN).toEqual({ statusCode: 403, code: 'FORBIDDEN' });
      expect(ERROR_CODES.NOT_FOUND).toEqual({ statusCode: 404, code: 'NOT_FOUND' });
      expect(ERROR_CODES.CONFLICT).toEqual({ statusCode: 409, code: 'CONFLICT' });
      expect(ERROR_CODES.DATABASE_ERROR).toEqual({ statusCode: 500, code: 'DATABASE_ERROR' });
      expect(ERROR_CODES.INTERNAL_ERROR).toEqual({ statusCode: 500, code: 'INTERNAL_ERROR' });
      expect(ERROR_CODES.VALIDATION_ERROR).toEqual({ statusCode: 400, code: 'VALIDATION_ERROR' });
      expect(ERROR_CODES.DUPLICATE_ERROR).toEqual({ statusCode: 409, code: 'DUPLICATE_ERROR' });
    });

    it('should have correct count of error codes', () => {
      expect(Object.keys(ERROR_CODES)).toHaveLength(9);
    });
  });

  describe('sensitive data protection', () => {
    it('should handle null error gracefully', () => {
      const err = new AppError('test error', 500);
      sendErrorResponse(mockRes, err, 'TestContext');
      expect(mockRes.body).toBeDefined();
      expect(mockRes.body.success).toBe(false);
    });

    it('should use default message when error message is empty', () => {
      const err = new AppError('', 400, 'TEST');
      sendErrorResponse(mockRes, err, 'Test');
      expect(mockRes.body.error.message).toBe('操作失败');
    });
  });
});
