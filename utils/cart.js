// cart.js - 购物车操作工具函数
const { api, handleApiError } = require('./api');

/**
 * 添加商品到购物车
 * @param {Object} productData - 商品数据
 * @param {number} productData.productId - 商品ID
 * @param {number} productData.quantity - 数量
 * @param {Object} [productData.specs] - 规格
 * @returns {Promise<boolean>} 是否添加成功
 */
const addToCart = async (productData) => {
  try {
    await api.cart.add(productData);
    return true;
  } catch (error) {
    handleApiError(error);
    return false;
  }
};

/**
 * 更新购物车商品
 * @param {number} id - 购物车商品ID
 * @param {Object} data - 更新数据
 * @returns {Promise<boolean>} 是否更新成功
 */
const updateCartItem = async (id, data) => {
  try {
    await api.cart.update(id, data);
    return true;
  } catch (error) {
    handleApiError(error);
    return false;
  }
};

/**
 * 批量更新购物车商品
 * @param {Array} data - 批量更新数据
 * @returns {Promise<boolean>} 是否更新成功
 */
const batchUpdateCartItems = async (data) => {
  try {
    await api.cart.batchUpdate(data);
    return true;
  } catch (error) {
    handleApiError(error);
    return false;
  }
};

/**
 * 删除购物车商品
 * @param {number} id - 购物车商品ID
 * @returns {Promise<boolean>} 是否删除成功
 */
const deleteCartItem = async (id) => {
  try {
    await api.cart.delete(id);
    return true;
  } catch (error) {
    handleApiError(error);
    return false;
  }
};

/**
 * 批量删除购物车商品
 * @param {Array} data - 批量删除数据
 * @returns {Promise<boolean>} 是否删除成功
 */
const batchDeleteCartItems = async (data) => {
  try {
    await api.cart.batchDelete(data);
    return true;
  } catch (error) {
    handleApiError(error);
    return false;
  }
};

/**
 * 清空购物车
 * @returns {Promise<boolean>} 是否清空成功
 */
const clearCart = async () => {
  try {
    await api.cart.clear();
    return true;
  } catch (error) {
    handleApiError(error);
    return false;
  }
};

/**
 * 全选/取消全选购物车商品
 * @param {boolean} selected - 是否选中
 * @returns {Promise<boolean>} 是否操作成功
 */
const toggleAllCartItems = async (selected) => {
  try {
    await api.cart.toggleAll(selected);
    return true;
  } catch (error) {
    handleApiError(error);
    return false;
  }
};

/**
 * 获取购物车列表
 * @returns {Promise<Object>} 购物车数据
 */
const getCartList = async () => {
  try {
    return await api.cart.getList();
  } catch (error) {
    handleApiError(error);
    return { items: [] };
  }
};

/**
 * 计算购物车总价
 * @param {Array} items - 购物车商品列表
 * @returns {number} 总价
 */
const calculateTotalPrice = (items) => {
  if (!Array.isArray(items)) return 0;
  return items
    .filter(item => item.selected)
    .reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);
};

/**
 * 计算购物车选中商品数量
 * @param {Array} items - 购物车商品列表
 * @returns {number} 选中商品数量
 */
const calculateSelectedCount = (items) => {
  if (!Array.isArray(items)) return 0;
  return items
    .filter(item => item.selected)
    .reduce((count, item) => {
      return count + item.quantity;
    }, 0);
};

/**
 * 检查购物车是否全选
 * @param {Array} items - 购物车商品列表
 * @returns {boolean} 是否全选
 */
const isAllSelected = (items) => {
  if (!Array.isArray(items) || items.length === 0) return false;
  return items.every(item => item.selected);
};

module.exports = {
  addToCart,
  updateCartItem,
  batchUpdateCartItems,
  deleteCartItem,
  batchDeleteCartItems,
  clearCart,
  toggleAllCartItems,
  getCartList,
  calculateTotalPrice,
  calculateSelectedCount,
  isAllSelected
};