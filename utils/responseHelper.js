const NodeCache = require('node-cache');

class ResponseHelper {
  constructor() {
    this.cache = new NodeCache({
      stdTTL: 300,
      checkperiod: 120,
      useClones: false,
      maxKeys: 1000
    });
  }

  success(res, data = null, message = '操作成功', statusCode = 200) {
    const response = {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString()
    };

    if (data && data.pagination) {
      response.pagination = data.pagination;
    }

    return res.status(statusCode).json(response);
  }

  error(res, error, context = 'Unknown') {
    const statusCode = error.statusCode || error.status || 500;
    const errorCode = error.code || 'INTERNAL_ERROR';
    const message = error.message || '服务器内部错误';

    console.error(`[${context}] ❌ Error: ${message} | Code: ${errorCode} | Status: ${statusCode}`);

    return res.status(statusCode).json({
      success: false,
      error: {
        code: errorCode,
        message,
        timestamp: new Date().toISOString()
      }
    });
  }

  paginated(res, list, pagination, message = '获取成功') {
    return this.success(res, { list, pagination }, message);
  }

  created(res, data, message = '创建成功') {
    return this.success(res, data, message, 201);
  }

  noContent(res, message = '删除成功') {
    return res.status(204).json({ success: true, message });
  }

  badRequest(res, message = '请求参数错误', code = 'BAD_REQUEST') {
    const error = new Error(message);
    error.code = code;
    error.statusCode = 400;
    return this.error(res, error, 'BadRequest');
  }

  notFound(res, resource = '资源') {
    const error = new Error(`${resource}不存在`);
    error.code = 'NOT_FOUND';
    error.statusCode = 404;
    return this.error(res, error, 'NotFound');
  }

  unauthorized(res, message = '未授权访问') {
    const error = new Error(message);
    error.code = 'UNAUTHORIZED';
    error.statusCode = 401;
    return this.error(res, error, 'Unauthorized');
  }

  forbidden(res, message = '权限不足') {
    const error = new Error(message);
    error.code = 'FORBIDDEN';
    error.statusCode = 403;
    return this.error(res, error, 'Forbidden');
  }

  serverError(res, message = '服务器内部错误') {
    const error = new Error(message);
    error.code = 'INTERNAL_ERROR';
    error.statusCode = 500;
    return this.error(res, error, 'ServerError');
  }

  async cachedQuery(key, queryFn, ttl = 300) {
    try {
      const cachedData = this.cache.get(key);

      if (cachedData) {
        console.log(`[Cache] ✅ Hit: ${key}`);
        return cachedData;
      }

      console.log(`[Cache] 🔄 Miss: ${key}`);
      const freshData = await queryFn();

      if (freshData !== null && freshData !== undefined) {
        this.cache.set(key, freshData, ttl);
      }

      return freshData;
    } catch (error) {
      console.error(`[Cache] ❌ Query error for key ${key}:`, error.message);
      throw error;
    }
  }

  invalidateCache(pattern) {
    if (!pattern) {
      this.cache.flushAll();
      console.log('[Cache] 🗑️ All cache cleared');
      return true;
    }

    const keys = this.cache.keys();
    let clearedCount = 0;

    keys.forEach(key => {
      if (key.includes(pattern)) {
        this.cache.del(key);
        clearedCount++;
      }
    });

    console.log(`[Cache] 🗑️ Cleared ${clearedCount} keys matching pattern: ${pattern}`);
    return clearedCount;
  }

  getCacheStats() {
    const stats = this.cache.getStats();
    return {
      keys: stats.keys,
      hits: stats.hits,
      misses: stats.misses,
      ksize: Math.round(stats.ksize / 1024),
      vsize: Math.round(stats.vsize / 1024)
    };
  }
}

const responseHelper = new ResponseHelper();

module.exports = {
  responseHelper,

  sendSuccessResponse: (res, data, message, statusCode) =>
    responseHelper.success(res, data, message, statusCode),

  sendErrorResponse: (res, error, context) =>
    responseHelper.error(res, error, context),

  sendPaginatedResponse: (res, list, pagination, message) =>
    responseHelper.paginated(res, list, pagination, message),

  sendCreatedResponse: (res, data, message) =>
    responseHelper.created(res, data, message),

  sendNoContentResponse: (res, message) =>
    responseHelper.noContent(res, message),

  sendBadRequest: (res, message, code) =>
    responseHelper.badRequest(res, message, code),

  sendNotFound: (res, resource) =>
    responseHelper.notFound(res, resource),

  sendUnauthorized: (res, message) =>
    responseHelper.unauthorized(res, message),

  sendForbidden: (res, message) =>
    responseHelper.forbidden(res, message),

  sendServerError: (res, message) =>
    responseHelper.serverError(res, message)
};