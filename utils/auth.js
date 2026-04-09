// auth.js - 认证相关工具函数

// 从request.js获取API基础URL
const API_BASE_URL = wx.getStorageSync('apiBaseUrl') || 'https://ecommerce-backend-nansijiujia-1gaeh8qpb9ad09a5.tcloudbaseapp.com'

/**
 * 检查用户是否已登录
 * @returns {boolean} 是否已登录
 */
const checkLogin = () => {
  const token = wx.getStorageSync('token');
  return !!token;
};

/**
 * 获取当前用户信息
 * @returns {Object|null} 用户信息
 */
const getCurrentUser = () => {
  return wx.getStorageSync('userInfo') || null;
};

/**
 * 获取认证令牌
 * @returns {string} 认证令牌
 */
const getToken = () => {
  return wx.getStorageSync('token');
};

/**
 * 设置用户信息
 * @param {Object} userInfo - 用户信息
 * @param {string} token - 认证令牌
 */
const setUserInfo = (userInfo, token) => {
  wx.setStorageSync('isLoggedIn', true);
  wx.setStorageSync('userInfo', userInfo);
  wx.setStorageSync('token', token);
  wx.setStorageSync('loginTime', Date.now());
};

/**
 * 用户登出
 */
const logout = () => {
  wx.removeStorageSync('isLoggedIn');
  wx.removeStorageSync('userInfo');
  wx.removeStorageSync('token');
  wx.removeStorageSync('loginTime');
};

/**
 * 要求用户登录
 * @returns {boolean} 是否已登录
 */
const requireLogin = () => {
  if (!checkLogin()) {
    wx.navigateTo({
      url: '/subpages/auth/login/login'
    });
    return false;
  }
  return true;
};

/**
 * 微信登录
 * @returns {Promise<Object>} 登录结果
 */
const wechatLogin = () => {
  return new Promise((resolve, reject) => {
    wx.login({
      success: (loginRes) => {
        if (!loginRes.code) {
          reject(new Error('获取登录凭证失败'));
          return;
        }

        wx.request({
          url: `${API_BASE_URL}/auth/wechat-login`,
          method: 'POST',
          data: { code: loginRes.code },
          success: (res) => {
            if (res.statusCode === 200 && res.data.success) {
              resolve({
                success: true,
                user: res.data.user,
                token: res.data.token
              });
            } else {
              resolve({
                success: false,
                message: res.data?.message || '登录失败'
              });
            }
          },
          fail: (err) => {
            reject(new Error('网络请求失败，请检查网络连接'));
          }
        });
      },
      fail: (err) => {
        reject(new Error('微信登录失败，请稍后重试'));
      }
    });
  });
};

/**
 * 刷新认证令牌
 * @returns {Promise<Object>} 刷新结果
 */
const refreshToken = () => {
  const token = getToken();
  if (!token) return Promise.reject(new Error('无token'));
  
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE_URL}/auth/refresh`,
      method: 'POST',
      header: {
        'Authorization': `Bearer ${token}`
      },
      success: (res) => {
        if (res.statusCode === 200) {
          setUserInfo(res.data.user, res.data.token);
          resolve(res.data);
        } else {
          reject(new Error('刷新token失败'));
        }
      },
      fail: (err) => {
        reject(err);
      }
    });
  });
};

/**
 * 检查是否需要刷新令牌
 * @returns {boolean} 是否需要刷新
 */
const checkTokenRefresh = () => {
  const loginTime = wx.getStorageSync('loginTime');
  if (!loginTime) return false;
  
  const refreshTime = 45 * 60 * 1000;
  return Date.now() - loginTime > refreshTime;
};

// 导出
module.exports = {
  checkLogin,
  getCurrentUser,
  getToken,
  setUserInfo,
  logout,
  requireLogin,
  wechatLogin,
  refreshToken,
  checkTokenRefresh
};
