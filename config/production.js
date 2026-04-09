// 生产环境配置
module.exports = {
  // API基础URL
  API_BASE_URL: 'https://ecommerce-backend-nansijiujia-1gaeh8qpb9ad09a5.tcloudbaseapp.com',
  
  // 小程序配置
  APP_ID: 'wx2ef7ce23a329a1ec',
  
  // 云开发环境ID
  CLOUDBASE_ENV_ID: 'nansijiujia-1gaeh8qpb9ad09a5',
  
  // 是否启用调试模式
  DEBUG: false,
  
  // 是否使用模拟数据
  USE_MOCK_DATA: false,
  
  // 请求超时时间
  REQUEST_TIMEOUT: 30000,
  
  // 缓存配置
  CACHE_CONFIG: {
    // 默认缓存过期时间（毫秒）
    defaultExpiry: 5 * 60 * 1000, // 5分钟
    // 首页数据缓存过期时间（毫秒）
    homeDataExpiry: 10 * 60 * 1000, // 10分钟
    // 分类数据缓存过期时间（毫秒）
    categoryExpiry: 30 * 60 * 1000, // 30分钟
    // 缓存大小限制
    maxSize: 100,
    // 缓存淘汰策略：LRU
    useLRU: true
  }
};