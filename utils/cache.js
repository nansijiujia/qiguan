// cache.js - 缓存工具函数

const CACHE_CONFIG = {
  // 默认缓存过期时间（毫秒）
  defaultExpiry: 3 * 60 * 1000, // 3分钟
  // 商品详情缓存过期时间（毫秒）
  productExpiry: 30 * 60 * 1000, // 30分钟
  // 首页数据缓存过期时间（毫秒）
  homeDataExpiry: 5 * 60 * 1000, // 5分钟
  // 分类数据缓存过期时间（毫秒）
  categoryExpiry: 15 * 60 * 1000 // 15分钟
};

/**
 * 保存数据到本地缓存
 * @param {string} key - 缓存键
 * @param {any} data - 缓存数据
 * @param {number} expiry - 过期时间（毫秒）
 */
const saveToCache = (key, data, expiry = CACHE_CONFIG.defaultExpiry) => {
  try {
    wx.setStorageSync(key, {
      ...data,
      expiry: Date.now() + expiry
    });
  } catch (error) {
    console.error('保存缓存失败:', error);
  }
};

/**
 * 从本地缓存加载数据
 * @param {string} key - 缓存键
 * @returns {any} 缓存数据，如果不存在或已过期则返回null
 */
const loadFromCache = (key) => {
  try {
    const cachedData = wx.getStorageSync(key);
    if (cachedData && Date.now() < cachedData.expiry) {
      return cachedData;
    }
  } catch (error) {
    console.error('加载缓存失败:', error);
  }
  return null;
};

/**
 * 清除指定缓存
 * @param {string} key - 缓存键
 */
const clearCache = (key) => {
  try {
    wx.removeStorageSync(key);
  } catch (error) {
    console.error('清除缓存失败:', error);
  }
};

/**
 * 清除所有缓存
 */
const clearAllCache = () => {
  try {
    wx.clearStorageSync();
  } catch (error) {
    console.error('清除所有缓存失败:', error);
  }
};

/**
 * 获取缓存大小
 * @returns {number} 缓存大小（字节）
 */
const getCacheSize = () => {
  try {
    const size = wx.getStorageInfoSync().currentSize;
    return size;
  } catch (error) {
    console.error('获取缓存大小失败:', error);
    return 0;
  }
};

module.exports = {
  saveToCache,
  loadFromCache,
  clearCache,
  clearAllCache,
  getCacheSize,
  CACHE_CONFIG
};