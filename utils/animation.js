// animation.js - 动画工具函数

/**
 * 创建缩放动画
 * @param {number} scale - 缩放比例
 * @param {number} duration - 动画 duration
 * @returns {Object} 动画实例
 */
const createScaleAnimation = (scale = 0.95, duration = 300) => {
  const animation = wx.createAnimation({
    duration,
    timingFunction: 'ease',
  });
  animation.scale(scale).step();
  return animation;
};

/**
 * 创建按钮点击动画
 * @param {Object} animation - 动画实例
 * @returns {Object} 动画数据
 */
const createButtonClickAnimation = (animation) => {
  if (!animation) {
    animation = wx.createAnimation({
      duration: 100,
      timingFunction: 'ease',
    });
  }
  
  animation.scale(0.95).step();
  const animationData = animation.export();
  
  setTimeout(() => {
    animation.scale(1).step();
  }, 100);
  
  return animationData;
};

/**
 * 创建淡入动画
 * @param {number} opacity - 透明度
 * @param {number} duration - 动画 duration
 * @returns {Object} 动画实例
 */
const createFadeInAnimation = (opacity = 1, duration = 300) => {
  const animation = wx.createAnimation({
    duration,
    timingFunction: 'ease',
  });
  animation.opacity(opacity).step();
  return animation;
};

/**
 * 创建淡入淡出动画
 * @param {number} startOpacity - 开始透明度
 * @param {number} endOpacity - 结束透明度
 * @param {number} duration - 动画 duration
 * @returns {Object} 动画实例
 */
const createFadeAnimation = (startOpacity = 0, endOpacity = 1, duration = 300) => {
  const animation = wx.createAnimation({
    duration,
    timingFunction: 'ease',
  });
  animation.opacity(startOpacity).step();
  animation.opacity(endOpacity).step();
  return animation;
};

/**
 * 创建添加到购物车的飞行动画
 * @param {Object} startRect - 起始位置
 * @param {Object} endRect - 结束位置
 * @returns {Object} 动画实例
 */
const createAddToCartAnimation = (startRect, endRect) => {
  const animation = wx.createAnimation({
    duration: 600,
    timingFunction: 'ease-in-out',
  });
  
  const translateX = endRect.left - startRect.left;
  const translateY = endRect.top - startRect.top;
  const scale = endRect.width / startRect.width;
  
  animation.translate(translateX, translateY).scale(scale).opacity(0).step();
  return animation;
};

/**
 * 执行动画序列
 * @param {Array} animations - 动画数组
 * @param {Function} callback - 回调函数
 */
const executeAnimationSequence = (animations, callback) => {
  if (!Array.isArray(animations) || animations.length === 0) {
    if (callback) callback();
    return;
  }
  
  let index = 0;
  const executeNext = () => {
    if (index < animations.length) {
      const animation = animations[index];
      animation();
      index++;
      setTimeout(executeNext, 300); // 假设每个动画持续300ms
    } else {
      if (callback) callback();
    }
  };
  
  executeNext();
};

module.exports = {
  createScaleAnimation,
  createButtonClickAnimation,
  createFadeInAnimation,
  createFadeAnimation,
  createAddToCartAnimation,
  executeAnimationSequence
};