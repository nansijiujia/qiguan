const { responseHelper, sendSuccessResponse, sendErrorResponse } = require('../../utils/response-helper');
const http = require('http');

describe('ResponseHelper - P1 新增工具库', () => {
  
  let mockReq, mockRes;

  beforeEach(() => {
    mockReq = {};
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
  });

  describe('success()', () => {
    test('应该返回标准成功响应', () => {
      const testData = { id: 1, name: 'test' };
      responseHelper.success(mockRes, testData, '操作成功', 200);

      expect(mockRes.statusCode).toBe(200);
      expect(mockRes.body.success).toBe(true);
      expect(mockRes.body.data).toEqual(testData);
      expect(mockRes.body.message).toBe('操作成功');
      expect(mockRes.body.timestamp).toBeDefined();
    });

    test('应该处理分页数据', () => {
      const paginatedData = {
        list: [{ id: 1 }],
        pagination: { page: 1, limit: 10, total: 100 }
      };
      
      responseHelper.success(mockRes, paginatedData);
      
      expect(mockRes.body.pagination).toBeDefined();
      expect(mockRes.body.pagination.total).toBe(100);
    });
  });

  describe('error()', () => {
    test('应该返回标准错误响应', () => {
      const error = new Error('测试错误');
      error.code = 'TEST_ERROR';
      error.statusCode = 400;

      responseHelper.error(mockRes, error, 'TestContext');

      expect(mockRes.statusCode).toBe(400);
      expect(mockRes.body.success).toBe(false);
      expect(mockRes.body.error.code).toBe('TEST_ERROR');
      expect(mockRes.body.error.message).toBe('测试错误');
      expect(mockRes.body.error.timestamp).toBeDefined();
    });

    test('应该使用默认状态码和错误码', () => {
      const error = new Error('未知错误');

      responseHelper.error(mockRes, error);

      expect(mockRes.statusCode).toBe(500);
      expect(mockRes.body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('paginated()', () => {
    test('应该返回分格式的分页响应', () => {
      const list = [{ id: 1 }, { id: 2 }];
      const pagination = { page: 1, limit: 10, total: 2 };

      responseHelper.paginated(mockRes, list, pagination);

      expect(mockRes.body.data.list).toEqual(list);
      expect(mockRes.body.data.pagination).toEqual(pagination);
      expect(mockRes.body.message).toBe('获取成功');
    });
  });

  describe('created()', () => {
    test('应该返回201状态码', () => {
      const newData = { id: 5, name: 'New Item' };

      responseHelper.created(mockRes, newData, '创建成功');

      expect(mockRes.statusCode).toBe(201);
      expect(mockRes.body.data).toEqual(newData);
      expect(mockRes.body.message).toBe('创建成功');
    });
  });

  describe('快捷方法', () => {
    test('badRequest() 应该返回400', () => {
      responseHelper.badRequest(mockRes, '参数错误');
      expect(mockRes.statusCode).toBe(400);
      expect(mockRes.body.error.message).toBe('参数错误');
    });

    test('notFound() 应该返回404', () => {
      responseHelper.notFound(mockRes, '用户');
      expect(mockRes.statusCode).toBe(404);
      expect(mockRes.body.error.message).toContain('用户');
    });

    test('unauthorized() 应该返回401', () => {
      responseHelper.unauthorized(mockRes);
      expect(mockRes.statusCode).toBe(401);
    });

    test('forbidden() 应该返回403', () => {
      responseHelper.forbidden(mockRes);
      expect(mockRes.statusCode).toBe(403);
    });

    test('serverError() 应该返回500', () => {
      responseHelper.serverError(mockRes, '服务器错误');
      expect(mockRes.statusCode).toBe(500);
    });
  });

  describe('缓存功能', () => {
    beforeEach(() => {
      responseHelper.cache.flushAll();
    });

    test('cachedQuery() 应该缓存查询结果', async () => {
      const queryFn = jest.fn().mockResolvedValue({ id: 1 });
      const cacheKey = 'test:key';

      const result1 = await responseHelper.cachedQuery(cacheKey, queryFn, 60);
      const result2 = await responseHelper.cachedQuery(cacheKey, queryFn, 60);

      expect(result1).toEqual({ id: 1 });
      expect(result2).toEqual({ id: 1 });
      expect(queryFn).toHaveBeenCalledTimes(1); // 只调用一次
    });

    test('invalidateCache() 应该清除匹配的缓存', () => {
      responseHelper.cache.set('users:list:all', { data: [] }, 300);
      responseHelper.cache.set('categories:list:all', { data: [] }, 300);

      const clearedCount = responseHelper.invalidateCache('users');

      expect(clearedCount).toBe(1);
      expect(responseHelper.cache.get('users:list:all')).toBeUndefined();
      expect(responseHelper.cache.get('categories:list:all')).toBeDefined();
    });

    test('getCacheStats() 应该返回缓存统计信息', () => {
      responseHelper.cache.set('key1', 'value1', 300);
      responseHelper.cache.set('key2', 'value2', 300);

      const stats = responseHelper.getCacheStats();

      expect(stats.keys).toBeGreaterThanOrEqual(2);
      expect(stats.hits).toBeDefined();
      expect(stats.misses).toBeDefined();
    });
  });
});