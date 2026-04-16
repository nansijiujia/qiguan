/**
 * 响应辅助工具
 * @module utils/response-helper
 */

const NodeCache = require('node-cache');

/**
 * 响应辅助类，提供统一的HTTP响应方法和缓存功能
 */
class ResponseHelper {
  /**
   * 创建响应辅助实例
   */
  constructor() {
    this.cache = new NodeCache({
      stdTTL: 300,
      checkperiod: 120,
      useClones: false,
      maxKeys: 1000
    });
  }

  /**
   * 发送成功响应
   * @param {Object} res - Express响应对象
   * @param {*} [data=null] - 响应数据
   * @param {string} [message='操作成功'] - 成功消息
   * @param {number} [statusCode=200] - HTTP状态码
   * @returns {Object} Express响应对象
   */
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

  /**
   * 发送错误响应
   * @param {Object} res - Express响应对象
   * @param {Error} error - 错误对象
   * @param {string} [context='Unknown'] - 错误上下文
   * @returns {Object} Express响应对象
   */
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

  /**
   * 发送分页响应
   * @param {Object} res - Express响应对象
   * @param {Array} list - 数据列表
   * @param {Object} pagination - 分页信息
   * @param {string} [message='获取成功'] - 成功消息
   * @returns {Object} Express响应对象
   */
  paginated(res, list, pagination, message = '获取成功') {
    return this.success(res, { list, pagination }, message);
  }

  /**
   * 发送创建成功响应 (HTTP 201)
   * @param {Object} res - Express响应对象
   * @param {*} data - 创建的数据
   * @param {string} [message='创建成功'] - 成功消息
   * @returns {Object} Express响应对象
   */
  created(res, data, message = '创建成功') {
    return this.success(res, data, message, 201);
  }

  /**
   * 发送无内容响应 (HTTP 204)
   * @param {Object} res - Express响应对象
   * @param {string} [message='删除成功'] - 成功消息
   * @returns {Object} Express响应对象
   */
  noContent(res, message = '删除成功') {
    return res.status(204).json({ success: true, message });
  }

  /**
   * 发送请求错误响应 (HTTP 400)
   * @param {Object} res - Express响应对象
   * @param {string} [message='请求参数错误'] - 错误消息
   * @param {string} [code='BAD_REQUEST'] - 错误代码
   * @returns {Object} Express响应对象
   */
  badRequest(res, message = '请求参数错误', code = 'BAD_REQUEST') {
    const error = new Error(message);
    error.code = code;
    error.statusCode = 400;
    return this.error(res, error, 'BadRequest');
  }

  /**
   * 发送资源不存在响应 (HTTP 404)
   * @param {Object} res - Express响应对象
   * @param {string} [resource='资源'] - 资源名称
   * @returns {Object} Express响应对象
   */
  notFound(res, resource = '资源') {
    const error = new Error(`${resource}不存在`);
    error.code = 'NOT_FOUND';
    error.statusCode = 404;
    return this.error(res, error, 'NotFound');
  }

  /**
   * 发送未授权响应 (HTTP 401)
   * @param {Object} res - Express响应对象
   * @param {string} [message='未授权访问'] - 错误消息
   * @returns {Object} Express响应对象
   */
  unauthorized(res, message = '未授权访问') {
    const error = new Error(message);
    error.code = 'UNAUTHORIZED';
    error.statusCode = 401;
    return this.error(res, error, 'Unauthorized');
  }

  /**
   * 发送权限不足响应 (HTTP 403)
   * @param {Object} res - Express响应对象
   * @param {string} [message='权限不足'] - 错误消息
   * @returns {Object} Express响应对象
   */
  forbidden(res, message = '权限不足') {
    const error = new Error(message);
    error.code = 'FORBIDDEN';
    error.statusCode = 403;
    return this.error(res, error, 'Forbidden');
  }

  /**
   * 发送服务器错误响应 (HTTP 500)
   * @param {Object} res - Express响应对象
   * @param {string} [message='服务器内部错误'] - 错误消息
   * @returns {Object} Express响应对象
   */
  serverError(res, message = '服务器内部错误') {
    const error = new Error(message);
    error.code = 'INTERNAL_ERROR';
    error.statusCode = 500;
    return this.error(res, error, 'ServerError');
  }

  /**
   * 带缓存的查询方法
   * @param {string} key - 缓存键名
   * @param {Function} queryFn - 查询函数
   * @param {number} [ttl=300] - 缓存过期时间（秒）
   * @returns {*} 查询结果
   */
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

  /**
   * 清除缓存
   * @param {string} [pattern] - 缓存键匹配模式，不传则清除所有缓存
   * @returns {boolean|number} 清除的缓存数量，如果清除所有则返回true
   */
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

  /**
   * 获取缓存统计信息
   * @returns {Object} 缓存统计信息
   * @returns {number} keys - 当前缓存键数量
   * @returns {number} hits - 缓存命中次数
   * @returns {number} misses - 缓存未命中次数
   * @returns {number} ksize - 键大小（KB）
   * @returns {number} vsize - 值大小（KB）
   */
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