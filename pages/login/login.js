// login.js
Page({
  data: {
    username: '',
    password: '',
    loading: false
  },

  onLoad: function () {
    console.log('登录页面加载');
  },

  onUsernameInput: function (e) {
    this.setData({
      username: e.detail.value
    });
  },

  onPasswordInput: function (e) {
    this.setData({
      password: e.detail.value
    });
  },

  onLogin: function () {
    const { username, password } = this.data;
    
    if (!username) {
      wx.showToast({
        title: '请输入手机号或用户名',
        icon: 'none',
        duration: 1000
      });
      return;
    }
    
    if (!password) {
      wx.showToast({
        title: '请输入密码',
        icon: 'none',
        duration: 1000
      });
      return;
    }
    
    this.setData({ loading: true });
    
    // 模拟登录请求
    setTimeout(() => {
      // 存储登录状态和用户信息
      wx.setStorageSync('isLoggedIn', true);
      wx.setStorageSync('userInfo', {
        id: 1,
        username: username,
        nickname: '用户' + username.slice(-4),
        avatar: ''
      });
      
      this.setData({ loading: false });
      
      wx.showToast({
        title: '登录成功',
        icon: 'success',
        duration: 1000,
        success: () => {
          setTimeout(() => {
            wx.navigateBack();
          }, 1000);
        }
      });
    }, 1000);
  },

  goToRegister: function () {
    wx.navigateTo({
      url: '/pages/register/register'
    });
  },

  onForgotPassword: function () {
    wx.showToast({
      title: '忘记密码功能开发中',
      icon: 'none',
      duration: 1000
    });
  }
})