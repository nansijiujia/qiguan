// stock.js - 库存检查和提示工具函数

/**
 * 检查库存并生成库存提示
 * @param {number} stock - 库存数量
 * @returns {Object} 库存信息对象
 */
const checkStock = (stock) => {
  let stockTip = '';
  let isOutOfStock = false;
  let isLowStock = false;

  if (stock <= 0) {
    stockTip = '库存不足';
    isOutOfStock = true;
  } else if (stock < 10) {
    stockTip = `仅剩${stock}件`;
    isLowStock = true;
  } else if (stock < 50) {
    stockTip = '库存紧张';
  }

  return {
    stock,
    stockTip,
    isOutOfStock,
    isLowStock
  };
};

/**
 * 检查购买数量是否符合库存要求
 * @param {number} quantity - 购买数量
 * @param {number} stock - 库存数量
 * @returns {Object} 检查结果
 */
const checkQuantity = (quantity, stock) => {
  if (quantity <= 0) {
    return {
      valid: false,
      message: '购买数量必须大于0'
    };
  }

  if (quantity > stock) {
    return {
      valid: false,
      message: stock <= 0 ? '库存不足' : `库存仅剩${stock}件`
    };
  }

  return {
    valid: true,
    message: ''
  };
};

/**
 * 计算库存百分比
 * @param {number} stock - 当前库存
 * @param {number} totalStock - 总库存（可选）
 * @returns {number} 库存百分比
 */
const calculateStockPercentage = (stock, totalStock = 100) => {
  if (totalStock <= 0) return 0;
  const percentage = (stock / totalStock) * 100;
  return Math.max(0, Math.min(100, percentage));
};

/**
 * 获取库存状态颜色
 * @param {number} stock - 库存数量
 * @returns {string} 颜色代码
 */
const getStockColor = (stock) => {
  if (stock <= 0) {
    return '#999';
  } else if (stock < 10) {
    return '#ff4757';
  } else if (stock < 50) {
    return '#ffa502';
  } else {
    return '#2ed573';
  }
};

module.exports = {
  checkStock,
  checkQuantity,
  calculateStockPercentage,
  getStockColor
};