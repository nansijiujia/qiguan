// countdown.js - 倒计时工具函数

/**
 * 计算倒计时时间差
 * @param {number} targetTime - 目标时间戳
 * @returns {Object} 时间差对象
 */
const calculateTimeDiff = (targetTime) => {
  const now = Date.now();
  const diff = Math.max(0, targetTime - now);

  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((diff % (60 * 1000)) / 1000);

  return {
    days,
    hours,
    minutes,
    seconds,
    total: diff,
    isExpired: diff <= 0
  };
};

/**
 * 格式化倒计时数字，补零
 * @param {number} num - 数字
 * @returns {string} 格式化后的字符串
 */
const formatNumber = (num) => {
  return num < 10 ? `0${num}` : num;
};

/**
 * 启动倒计时
 * @param {number} targetTime - 目标时间戳
 * @param {Function} callback - 每秒钟的回调函数
 * @param {Function} endCallback - 倒计时结束的回调函数
 * @returns {Object} 倒计时控制对象
 */
const startCountdown = (targetTime, callback, endCallback) => {
  let timer = null;

  const updateCountdown = () => {
    const timeDiff = calculateTimeDiff(targetTime);
    
    if (callback) {
      callback(timeDiff);
    }

    if (timeDiff.isExpired) {
      clearInterval(timer);
      if (endCallback) {
        endCallback();
      }
    }
  };

  // 立即执行一次
  updateCountdown();
  
  // 每秒执行一次
  timer = setInterval(updateCountdown, 1000);

  return {
    stop: () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    pause: () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    resume: () => {
      if (!timer) {
        timer = setInterval(updateCountdown, 1000);
      }
    }
  };
};

/**
 * 计算指定时间后的时间戳
 * @param {number} hours - 小时
 * @param {number} minutes - 分钟
 * @param {number} seconds - 秒
 * @returns {number} 时间戳
 */
const getFutureTimestamp = (hours = 0, minutes = 0, seconds = 0) => {
  return Date.now() + (hours * 60 * 60 * 1000) + (minutes * 60 * 1000) + (seconds * 1000);
};

/**
 * 格式化倒计时显示
 * @param {Object} timeDiff - 时间差对象
 * @returns {string} 格式化后的字符串
 */
const formatCountdown = (timeDiff) => {
  const { days, hours, minutes, seconds } = timeDiff;
  
  if (days > 0) {
    return `${days}天 ${formatNumber(hours)}:${formatNumber(minutes)}:${formatNumber(seconds)}`;
  } else {
    return `${formatNumber(hours)}:${formatNumber(minutes)}:${formatNumber(seconds)}`;
  }
};

module.exports = {
  calculateTimeDiff,
  formatNumber,
  startCountdown,
  getFutureTimestamp,
  formatCountdown
};