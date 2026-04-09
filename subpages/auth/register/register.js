// register.js
Page({
  data: {
    username: '',
    phone: '',
    password: '',
    confirmPassword: '',
    loading: false
  },

  onLoad: function () {
    console.log('注册页面加载');
  },

  onUsernameInput: function (e) {
    this.setData({
      username: e.detail.value
    });
  },

  onPhoneInput: function (e) {
    this.setData({
      phone: e.detail.value
    });
  },

  onPasswordInput: function (e) {
    this.setData({
      password: e.detail.value
    });
  },

  onConfirmPasswordInput: function (e) {
    this.setData({
      confirmPassword: e.detail.value
    });
  },

  onRegister: function () {
    const { username, phone, password, confirmPassword } = this.data;
    
    if (!username) {
      wx.showToast({
        title: '请设置用户名',
        icon: 'none',
        duration: 1000
      });
      return;
    }
    
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({
        title: '请输入正确的手机号',
        icon: 'none',
        duration: 1000
      });
      return;
    }
    
    if (!password || password.length < 6) {
      wx.showToast({
        title: '密码长度至少6位',
        icon: 'none',
        duration: 1000
      });
      return;
    }
    
    if (password !== confirmPassword) {
      wx.showToast({
        title: '两次输入的密码不一致',
        icon: 'none',
        duration: 1000
      });
      return;
    }
    
    this.setData({ loading: true });
    
    // 模拟注册请求
    setTimeout(() => {
      this.setData({ loading: false });
      
      wx.showToast({
        title: '注册成功',
        icon: 'success',
        duration: 1000,
        success: () => {
          setTimeout(() => {
            wx.navigateTo({
              url: '/pages/login/login'
            });
          }, 1000);
        }
      });
    }, 1000);
  },

  goToLogin: function () {
    wx.navigateTo({
      url: '/pages/login/login'
    });
  }
})