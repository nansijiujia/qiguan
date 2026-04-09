// api.js - API接口封装

const { request, objectToQueryString } = require('./request');

// API基础路径
const API_BASE_PATH = '/api/v1';

// API方法封装
const api = {
  // 商品相关
  product: {
    getList: (params) => request(`${API_BASE_PATH}/products?${objectToQueryString(params)}`),
    getDetail: (id) => request(`${API_BASE_PATH}/products/${id}`),
    search: (keyword) => request(`${API_BASE_PATH}/products/search?keyword=${encodeURIComponent(keyword)}`),
    getRecommended: () => request(`${API_BASE_PATH}/products/recommended`),
    getHot: () => request(`${API_BASE_PATH}/products/hot`),
    getSuggestions: (keyword) => request(`${API_BASE_PATH}/products/suggestions?keyword=${encodeURIComponent(keyword)}`)
  },

  // 分类相关
  category: {
    getList: () => request(`${API_BASE_PATH}/products/category`),
    getProducts: (id, params) => request(`${API_BASE_PATH}/products/category/${id}?${objectToQueryString(params)}`)
  },

  // 购物车相关
  cart: {
    getList: () => request(`${API_BASE_PATH}/cart`),
    add: (data) => request(`${API_BASE_PATH}/cart`, 'POST', data, {}, { sign: true }),
    update: (id, data) => request(`${API_BASE_PATH}/cart/${id}`, 'PUT', data, {}, { sign: true }),
    batchUpdate: (data) => request(`${API_BASE_PATH}/cart/batch`, 'PUT', data, {}, { sign: true }),
    delete: (id) => request(`${API_BASE_PATH}/cart/${id}`, 'DELETE', {}, {}, { sign: true }),
    batchDelete: (data) => request(`${API_BASE_PATH}/cart/batch`, 'DELETE', data, {}, { sign: true }),
    clear: () => request(`${API_BASE_PATH}/cart`, 'DELETE', {}, {}, { sign: true }),
    toggleAll: (selected) => request(`${API_BASE_PATH}/cart/select/all`, 'PUT', { selected }, {}, { sign: true })
  },

  // 订单相关
  order: {
    create: (data) => request(`${API_BASE_PATH}/orders`, 'POST', data, {}, { sign: true }),
    getList: (params) => request(`${API_BASE_PATH}/orders?${objectToQueryString(params)}`),
    getDetail: (id) => request(`${API_BASE_PATH}/orders/${id}`),
    cancel: (id) => request(`${API_BASE_PATH}/orders/${id}/cancel`, 'PUT', {}, {}, { sign: true }),
    pay: (id, data) => request(`${API_BASE_PATH}/orders/${id}/pay`, 'POST', data, {}, { sign: true }),
    ship: (id, data) => request(`${API_BASE_PATH}/orders/${id}/ship`, 'POST', data, {}, { sign: true }),
    getLogistics: (id) => request(`${API_BASE_PATH}/orders/${id}/logistics`),
    getLogisticsTracking: (id) => request(`${API_BASE_PATH}/orders/${id}/logistics/tracking`),
    confirmReceipt: (id) => request(`${API_BASE_PATH}/orders/${id}/confirm`, 'PUT', {}, {}, { sign: true })
  },

  // 收藏相关
  favorite: {
    check: (productId) => request(`${API_BASE_PATH}/users/favorite/check?productId=${productId}`),
    add: (productId) => request(`${API_BASE_PATH}/users/favorite`, 'POST', { productId }, {}, { sign: true }),
    delete: (productId) => request(`${API_BASE_PATH}/users/favorite/${productId}`, 'DELETE', {}, {}, { sign: true })
  },

  // 首页相关
  home: {
    getData: () => request(`${API_BASE_PATH}/content/homepage`),
    getBanners: () => request(`${API_BASE_PATH}/content/homepage/banners`),
    getRecommendations: () => request(`${API_BASE_PATH}/content/homepage/recommendations`),
    getPromotions: () => request(`${API_BASE_PATH}/content/homepage/promotions`),
    getHotProducts: () => request(`${API_BASE_PATH}/content/homepage/hot-products`)
  },



  // 用户相关
  user: {
    getInfo: () => request(`${API_BASE_PATH}/users/me`),
    getProfile: () => request(`${API_BASE_PATH}/users/me`),
    updateProfile: (data) => request(`${API_BASE_PATH}/users/me`, 'PUT', data, {}, { sign: true }),
    getOrderStats: () => request(`${API_BASE_PATH}/users/order-stats`),
    getFavorites: (params) => request(`${API_BASE_PATH}/users/favorites?${objectToQueryString(params)}`),
    getFootprints: (params) => request(`${API_BASE_PATH}/users/footprints?${objectToQueryString(params)}`),
    addFootprint: (productId) => request(`${API_BASE_PATH}/users/footprints`, 'POST', { productId }, {}, { sign: true }),
    clearFootprints: () => request(`${API_BASE_PATH}/users/footprints`, 'DELETE', {}, {}, { sign: true })
  },

  // 优惠券相关
  coupon: {
    getList: (params) => request(`${API_BASE_PATH}/users/coupons?${objectToQueryString(params)}`),
    receive: (couponId) => request(`${API_BASE_PATH}/users/coupons/receive`, 'POST', { couponId }, {}, { sign: true }),
    getAvailable: (params) => request(`${API_BASE_PATH}/users/coupons/available?${objectToQueryString(params)}`)
  },

  // 搜索相关
  search: {
    getHotKeywords: () => request(`${API_BASE_PATH}/search/hot-keywords`),
    getSuggestions: (keyword) => request(`${API_BASE_PATH}/search/suggestions?keyword=${encodeURIComponent(keyword)}`)
  },



  // 健康检查
  health: {
    check: () => request('/health'),
    checkDb: () => request('/health/db-test')
  }
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
      wx.navigateTo({ url: '/subpages/auth/login/login' });
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