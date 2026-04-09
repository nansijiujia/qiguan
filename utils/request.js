// request.js - 网络请求工具

// API基础URL配置
const API_BASE_URL = wx.getStorageSync('apiBaseUrl') || 'https://ecommerce-backend-nansijiujia-1gaeh8qpb9ad09a5.tcloudbaseapp.com'

// 请求缓存
const requestCache = new Map();
// 正在进行的请求
const pendingRequests = new Map();
// 缓存配置
const CACHE_CONFIG = {
  // 默认缓存过期时间（毫秒）
  defaultExpiry: 3 * 60 * 1000, // 3分钟
  // 首页数据缓存过期时间（毫秒）
  homeDataExpiry: 5 * 60 * 1000, // 5分钟
  // 分类数据缓存过期时间（毫秒）
  categoryExpiry: 15 * 60 * 1000, // 15分钟
  // 缓存大小限制
  maxSize: 100,
  // 缓存淘汰策略：LRU (Least Recently Used)
  useLRU: true
};

// 缓存使用记录（用于LRU策略）
const cacheUsage = new Map();

// 生成请求签名
const generateSignature = (url, method, data) => {
  const timestamp = Date.now();
  const nonce = Math.random().toString(36).substring(2, 15);
  const signatureData = `${timestamp}${nonce}${method}${url}${JSON.stringify(data)}`;
  return {
    timestamp,
    nonce,
    signature: signatureData
  };
};

// 检查网络状态
const checkNetworkStatus = () => {
  return new Promise((resolve) => {
    wx.getNetworkType({
      success: (res) => {
        const networkType = res.networkType;
        if (networkType === 'none') {
          wx.showToast({
            title: '网络连接已断开',
            icon: 'none',
            duration: 2000
          });
          resolve(false);
        } else {
          resolve(true);
        }
      },
      fail: () => {
        resolve(true); // 网络检查失败时默认继续
      }
    });
  });
};

// 检查缓存大小并执行淘汰策略
const checkCacheSize = () => {
  if (requestCache.size > CACHE_CONFIG.maxSize) {
    // 按使用时间排序，淘汰最久未使用的缓存
    const sortedKeys = Array.from(cacheUsage.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([key]) => key);
    
    // 淘汰超出限制的缓存
    const itemsToRemove = requestCache.size - CACHE_CONFIG.maxSize;
    for (let i = 0; i < itemsToRemove; i++) {
      const keyToRemove = sortedKeys[i];
      if (keyToRemove) {
        requestCache.delete(keyToRemove);
        cacheUsage.delete(keyToRemove);
      }
    }
  }
};

// 获取缓存过期时间
const getCacheExpiry = (url) => {
  if (url.includes('/content/homepage')) {
    return CACHE_CONFIG.homeDataExpiry;
  } else if (url.includes('/product/category')) {
    return CACHE_CONFIG.categoryExpiry;
  } else {
    return CACHE_CONFIG.defaultExpiry;
  }
};

// 通用请求方法
const request = (url, method = 'GET', data = {}, header = {}, options = {}) => {
  const { cache = true, retry = 2, sign = false } = options;
  const cacheKey = `${method}:${url}:${JSON.stringify(data)}`;
  
  // 检查缓存
  if (cache && method === 'GET') {
    const cached = requestCache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
      // 更新缓存使用时间（LRU策略）
      if (CACHE_CONFIG.useLRU) {
        cacheUsage.set(cacheKey, Date.now());
      }
      return Promise.resolve(cached.data);
    }
  }
  
  // 检查是否有相同请求正在进行
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey);
  }
  
  let retryCount = 0;
  const makeRequest = async () => {
    // 检查网络状态
    const networkOk = await checkNetworkStatus();
    if (!networkOk) {
      return Promise.reject({ message: '网络连接失败，请检查网络' });
    }
    
    return new Promise((resolve, reject) => {
      // 构建请求头
      // 从本地存储获取token
      const token = wx.getStorageSync('token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...header
      };

      // 添加请求签名
      if (sign) {
        const signature = generateSignature(url, method, data);
        Object.assign(headers, signature);
      }

      // 发送请求
      wx.request({
        url: `${API_BASE_URL}${url}`,
        method,
        data,
        header: headers,
        timeout: 15000, // 15秒超时
        success: (res) => {
          // 处理响应
          if (res.statusCode === 200) {
            // 检查响应数据格式
            if (res.data && typeof res.data === 'object') {
              // 缓存GET请求结果
              if (cache && method === 'GET') {
                // 获取缓存过期时间
                const expiry = getCacheExpiry(url);
                requestCache.set(cacheKey, {
                  data: res.data,
                  expiry: Date.now() + expiry
                });
                // 更新缓存使用时间
                if (CACHE_CONFIG.useLRU) {
                  cacheUsage.set(cacheKey, Date.now());
                }
                // 检查缓存大小
                checkCacheSize();
              }
              resolve(res.data);
            } else {
              reject({ message: '响应数据格式错误' });
            }
          } else {
            // 处理错误状态码
            const errorMessage = res.data?.message || `请求失败(${res.statusCode})`;
            reject({ code: res.statusCode, message: errorMessage });
          }
        },
        fail: (err) => {
          // 重试机制
          if (retryCount < retry) {
            retryCount++;
            setTimeout(() => {
              makeRequest().then(resolve).catch(reject);
            }, 500 * retryCount);
          } else {
            // 增强错误处理：区分不同类型的错误
            const errMsg = err.errMsg || '';
            let errorType = 'UNKNOWN';
            let userMessage = '网络请求失败';

            if (errMsg.includes('timeout')) {
              errorType = 'TIMEOUT';
              userMessage = '请求超时，请检查网络连接后重试';
            } else if (errMsg.includes('fail') || errMsg.includes('network')) {
              errorType = 'NETWORK_ERROR';
              userMessage = '网络连接异常，请检查网络设置';
            }

            // 根据状态码进一步分类
            if (err.statusCode) {
              if (err.statusCode >= 500) {
                errorType = 'SERVER_ERROR';
                userMessage = `服务器错误(${err.statusCode})，请稍后重试`;
              } else if (err.statusCode >= 400 && err.statusCode < 500) {
                errorType = 'CLIENT_ERROR';
                userMessage = `请求参数错误(${err.statusCode})，请检查输入`;
              }
            }

            reject({
              message: userMessage,
              errorType,
              error: err
            });
          }
        }
      });
    });
  };
  
  const requestPromise = makeRequest();
  pendingRequests.set(cacheKey, requestPromise);
  
  requestPromise.finally(() => {
    pendingRequests.delete(cacheKey);
  });
  
  return requestPromise;
};

// 工具函数：对象转查询字符串
const objectToQueryString = (obj) => {
  if (!obj || typeof obj !== 'object') return '';
  return Object.keys(obj)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(obj[key])}`)
    .join('&');
};

// 导出
module.exports = {
  request,
  objectToQueryString,
  CACHE_CONFIG
};
