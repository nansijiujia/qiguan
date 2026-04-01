// auth.js

// 检查用户是否已登录
export function checkLogin() {
  return wx.getStorageSync('isLoggedIn') || false;
}

// 获取当前用户信息
export function getCurrentUser() {
  return wx.getStorageSync('userInfo') || null;
}

// 登录成功后存储用户信息
export function setUserInfo(userInfo) {
  wx.setStorageSync('isLoggedIn', true);
  wx.setStorageSync('userInfo', userInfo);
}

// 登出
export function logout() {
  wx.removeStorageSync('isLoggedIn');
  wx.removeStorageSync('userInfo');
}

// 检查是否需要登录，如果未登录则跳转到登录页面
export function requireLogin() {
  if (!checkLogin()) {
    wx.navigateTo({
      url: '/pages/login/login'
    });
    return false;
  }
  return true;
}