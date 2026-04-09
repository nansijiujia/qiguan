// image.js - 图片处理工具函数

/**
 * 预加载图片
 * @param {Array<string>} images - 图片URL数组
 * @param {number} maxPreload - 最大预加载数量
 * @returns {Promise<void>}
 */
const preloadImages = async (images, maxPreload = 10) => {
  if (!Array.isArray(images) || images.length === 0) {
    return;
  }

  // 限制预加载数量
  const imagesToPreload = images.slice(0, maxPreload);
  const preloadPromises = imagesToPreload.map(url => {
    return new Promise((resolve, reject) => {
      wx.getImageInfo({
        src: url,
        success: (res) => {
          console.log('预加载图片成功:', url);
          resolve(res);
        },
        fail: (err) => {
          console.error('预加载图片失败:', url, err);
          resolve(null); // 失败也解析，避免阻塞其他图片预加载
        }
      });
    });
  });

  await Promise.all(preloadPromises);
};

/**
 * 从数据中提取图片URL
 * @param {Object} data - 包含图片的数据对象
 * @param {Array<string>} paths - 图片路径数组
 * @returns {Array<string>} 提取的图片URL数组
 */
const extractImageUrls = (data, paths = []) => {
  const imageUrls = [];

  if (!data) return imageUrls;

  paths.forEach(path => {
    const value = getNestedValue(data, path);
    if (Array.isArray(value)) {
      value.forEach(item => {
        if (typeof item === 'string') {
          imageUrls.push(item);
        } else if (typeof item === 'object' && item.imageUrl) {
          imageUrls.push(item.imageUrl);
        }
      });
    } else if (typeof value === 'string') {
      imageUrls.push(value);
    } else if (typeof value === 'object' && value.imageUrl) {
      imageUrls.push(value.imageUrl);
    }
  });

  return imageUrls;
};

/**
 * 获取嵌套对象的值
 * @param {Object} obj - 目标对象
 * @param {string} path - 路径，如 'banners[0].imageUrl'
 * @returns {any} 对应路径的值
 */
const getNestedValue = (obj, path) => {
  return path.split('.').reduce((acc, key) => {
    // 处理数组索引，如 'banners[0]'
    const match = key.match(/(\w+)\[(\d+)\]/);
    if (match) {
      const [, arrayKey, index] = match;
      return acc && acc[arrayKey] ? acc[arrayKey][parseInt(index)] : undefined;
    }
    return acc && acc[key] !== undefined ? acc[key] : undefined;
  }, obj);
};

/**
 * 生成图片加载完成事件处理函数
 * @param {Function} callback - 回调函数
 * @returns {Function} 事件处理函数
 */
const createImageLoadHandler = (callback) => {
  return (e) => {
    const key = e.target.dataset.key || e.currentTarget.dataset.key;
    if (key) {
      console.log('图片加载完成:', key);
      if (callback) {
        callback(key);
      }
    }
  };
};

/**
 * 生成图片加载失败事件处理函数
 * @param {Function} callback - 回调函数
 * @returns {Function} 事件处理函数
 */
const createImageErrorHandler = (callback) => {
  return (e) => {
    const key = e.target.dataset.key || e.currentTarget.dataset.key;
    console.log('图片加载失败:', key);
    if (callback) {
      callback(key);
    }
  };
};

/**
 * 生成图片懒加载事件处理函数
 * @param {Function} callback - 回调函数
 * @returns {Function} 事件处理函数
 */
const createImageLazyLoadHandler = (callback) => {
  return (e) => {
    const key = e.target.dataset.key;
    if (key) {
      if (callback) {
        callback(key);
      }
    }
  };
};

module.exports = {
  preloadImages,
  extractImageUrls,
  createImageLoadHandler,
  createImageErrorHandler,
  createImageLazyLoadHandler
};