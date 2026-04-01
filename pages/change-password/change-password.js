// change-password.js
import { requireLogin } from '../../utils/auth';

Page({
  data: {
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
    loading: false
  },

  onLoad: function () {
    console.log('修改密码页面加载');
    // 检查登录状态
    if (!requireLogin()) {
      return;
    }
  },

  onOldPasswordInput: function (e) {
    this.setData({
      oldPassword: e.detail.value
    });
  },

  onNewPasswordInput: function (e) {
    this.setData({
      newPassword: e.detail.value
    });
  },

  onConfirmPasswordInput: function (e) {
    this.setData({
      confirmPassword: e.detail.value
    });
  },

  onSave: function () {
    const { oldPassword, newPassword, confirmPassword } = this.data;
    
    if (!oldPassword) {
      wx.showToast({
        title: '请输入旧密码',
        icon: 'none',
        duration: 1000
      });
      return;
    }
    
    if (!newPassword || newPassword.length < 6) {
      wx.showToast({
        title: '新密码长度至少6位',
        icon: 'none',
        duration: 1000
      });
      return;
    }
    
    if (newPassword !== confirmPassword) {
      wx.showToast({
        title: '两次输入的新密码不一致',
        icon: 'none',
        duration: 1000
      });
      return;
    }
    
    this.setData({ loading: true });
    
    // 模拟密码修改请求
    setTimeout(() => {
      this.setData({ loading: false });
      
      wx.showToast({
        title: '密码修改成功',
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

  onBack: function () {
    wx.navigateBack();
  }
})