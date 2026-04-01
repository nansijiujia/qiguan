// api.js - 统一API请求服务

// API基础URL配置
const isProduction = false; // 生产环境设置为true
const API_BASE_URL = isProduction ? 'https://api.example.com' : 'http://localhost:3000/api';

// 请求缓存
const requestCache = new Map();
// 正在进行的请求
const pendingRequests = new Map();
// 缓存过期时间（毫秒）
const CACHE_EXPIRY = 5 * 60 * 1000; // 5分钟

// 生成请求签名
const generateSignature = (url, method, data) => {
  const timestamp = Date.now();
  const nonce = Math.random().toString(36).substring(2, 15);
  const signatureData = `${timestamp}${nonce}${method}${url}${JSON.stringify(data)}`;
  // 实际项目中应使用更安全的签名算法
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

// 通用请求方法
const request = (url, method = 'GET', data = {}, header = {}, options = {}) => {
  const { cache = true, retry = 2, sign = false } = options;
  const cacheKey = `${method}:${url}:${JSON.stringify(data)}`;
  
  // 检查缓存
  if (cache && method === 'GET') {
    const cached = requestCache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
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
        timeout: 30000, // 30秒超时
        success: (res) => {
          // 处理响应
          if (res.statusCode === 200) {
            // 检查响应数据格式
            if (res.data && typeof res.data === 'object') {
              // 缓存GET请求结果
              if (cache && method === 'GET') {
                requestCache.set(cacheKey, {
                  data: res.data,
                  expiry: Date.now() + CACHE_EXPIRY
                });
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
            }, 1000 * retryCount);
          } else {
            reject({ message: '网络请求失败', error: err });
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

// API方法封装
const api = {
  // 商品相关
  product: {
    // 获取商品列表
    getList: (params) => request(`/product?${objectToQueryString(params)}`),
    // 获取商品详情
    getDetail: (id) => request(`/product/${id}`),
    // 搜索商品
    search: (keyword) => request(`/product/search?keyword=${encodeURIComponent(keyword)}`),
    // 获取推荐商品
    getRecommended: () => request('/product/recommended'),
    // 获取热门商品
    getHot: () => request('/product/hot')
  },

  // 分类相关
  category: {
    // 获取分类列表
    getList: () => request('/product/category'),
    // 获取分类商品
    getProducts: (id, params) => request(`/product/category/${id}?${objectToQueryString(params)}`)
  },

  // 购物车相关
  cart: {
    // 获取购物车列表
    getList: () => request('/cart'),
    // 添加到购物车
    add: (data) => request('/cart', 'POST', data, {}, { sign: true }),
    // 更新购物车商品
    update: (id, data) => request(`/cart/${id}`, 'PUT', data, {}, { sign: true }),
    // 删除购物车商品
    delete: (id) => request(`/cart/${id}`, 'DELETE', {}, {}, { sign: true }),
    // 清空购物车
    clear: () => request('/cart', 'DELETE', {}, {}, { sign: true })
  },

  // 订单相关
  order: {
    // 创建订单
    create: (data) => request('/order', 'POST', data, {}, { sign: true }),
    // 获取订单列表
    getList: (params) => request(`/order?${objectToQueryString(params)}`),
    // 获取订单详情
    getDetail: (id) => request(`/order/${id}`),
    // 取消订单
    cancel: (id) => request(`/order/${id}/cancel`, 'PUT', {}, {}, { sign: true }),
    // 支付订单
    pay: (id, data) => request(`/order/${id}/pay`, 'POST', data, {}, { sign: true }),
    // 发货
    ship: (id, data) => request(`/order/${id}/ship`, 'POST', data, {}, { sign: true }),
    // 获取物流信息
    getLogistics: (id) => request(`/order/${id}/logistics`),
    // 获取物流轨迹
    getLogisticsTracking: (id) => request(`/order/${id}/logistics/tracking`),
    // 确认收货
    confirmReceipt: (id) => request(`/order/${id}/confirm`, 'PUT', {}, {}, { sign: true })
  },

  // 收藏相关
  favorite: {
    // 检查商品是否被收藏
    check: (productId) => request(`/user/favorite/check?productId=${productId}`),
    // 添加收藏
    add: (productId) => request('/user/favorite', 'POST', { productId }, {}, { sign: true }),
    // 删除收藏
    delete: (productId) => request(`/user/favorite/${productId}`, 'DELETE', {}, {}, { sign: true })
  },

  // 首页相关
  home: {
    // 获取首页数据
    getData: () => request('/content/homepage'),
    // 获取轮播图
    getBanners: () => request('/content/homepage/banners'),
    // 获取首页推荐
    getRecommendations: () => request('/content/homepage/recommendations')
  },

  // 活动相关
  activity: {
    // 获取活跃活动列表
    getActive: () => request('/marketing/promotion/active'),
    // 获取活动详情
    getDetail: (id) => request(`/marketing/promotion/${id}`),
    // 参与活动
    participate: (id) => request(`/marketing/promotion/${id}/participate`, 'POST', {}, {}, { sign: true })
  },

  // 健康检查
  health: {
    // 检查服务状态
    check: () => request('/health'),
    // 检查数据库连接
    checkDb: () => request('/health/db-test')
  }
};

// 工具函数：对象转查询字符串
const objectToQueryString = (obj) => {
  if (!obj || typeof obj !== 'object') return '';
  return Object.keys(obj)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(obj[key])}`)
    .join('&');
};

// 工具函数：处理API错误
const handleApiError = (error) => {
  console.error('API Error:', error);
  
  // 网络错误
  if (!error.code) {
    wx.showToast({
      title: '网络连接失败，请检查网络',
      icon: 'none',
      duration: 2000
    });
    return;
  }
  
  // 业务错误
  switch (error.code) {
    case 401:
      // 未授权，跳转到登录页
      wx.navigateTo({ url: '/pages/login/login' });
      break;
    case 403:
      wx.showToast({
        title: '没有权限执行此操作',
        icon: 'none',
        duration: 2000
      });
      break;
    case 404:
      wx.showToast({
        title: '请求的资源不存在',
        icon: 'none',
        duration: 2000
      });
      break;
    case 500:
      wx.showToast({
        title: '服务器内部错误，请稍后重试',
        icon: 'none',
        duration: 2000
      });
      break;
    default:
      wx.showToast({
        title: error.message || '操作失败，请重试',
        icon: 'none',
        duration: 2000
      });
  }
};

// 导出
module.exports = {
  api,
  handleApiError,
  request
};