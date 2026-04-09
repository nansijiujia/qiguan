import { wechatLogin, setUserInfo, checkLogin } from '../../utils/auth';

Page({
  data: {
    loading: false,
    errorMsg: ''
  },

  onLoad: function (options) {
    if (checkLogin()) {
      wx.navigateBack({
        delta: 1
      });
    }
  },

  onShow: function () {
    if (checkLogin()) {
      wx.navigateBack({
        delta: 1
      });
    }
  },

  onWechatLogin: async function () {
    if (this.data.loading) return;

    this.setData({ 
      loading: true, 
      errorMsg: '' 
    });

    try {
      const loginResult = await wechatLogin();
      
      if (loginResult.success) {
        setUserInfo(loginResult.user, loginResult.token);
        
        wx.showToast({
          title: '登录成功',
          icon: 'success',
          duration: 1500
        });

        setTimeout(() => {
          const pages = getCurrentPages();
          if (pages.length > 1) {
            wx.navigateBack({
              delta: 1
            });
          } else {
            wx.switchTab({
              url: '/pages/index/index'
            });
          }
        }, 1500);
      } else {
        this.setData({ 
          errorMsg: loginResult.message || '登录失败，请重试' 
        });
      }
    } catch (error) {
      console.error('微信登录失败:', error);
      this.setData({ 
        errorMsg: error.message || '登录失败，请检查网络后重试' 
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  onRetry: function () {
    this.setData({ errorMsg: '' });
    this.onWechatLogin();
  }
});
