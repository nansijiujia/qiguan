// profile.js
import { getCurrentUser, setUserInfo, requireLogin } from '../../utils/auth';

Page({
  data: {
    userInfo: {},
    genderText: '请选择'
  },

  onLoad: function () {
    console.log('个人信息页面加载');
    // 检查登录状态
    if (!requireLogin()) {
      return;
    }
    // 获取用户信息
    this.loadUserInfo();
  },

  loadUserInfo: function () {
    const userInfo = getCurrentUser();
    this.setData({
      userInfo: userInfo || {},
      genderText: this.getGenderText(userInfo.gender)
    });
  },

  getGenderText: function (gender) {
    switch (gender) {
      case 1:
        return '男';
      case 2:
        return '女';
      default:
        return '请选择';
    }
  },

  onNicknameInput: function (e) {
    this.setData({
      'userInfo.nickname': e.detail.value
    });
  },

  onChooseAvatar: function () {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({
          'userInfo.avatar': res.tempFilePaths[0]
        });
      }
    });
  },

  showGenderPicker: function () {
    wx.showActionSheet({
      itemList: ['男', '女', '取消'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.setData({
            'userInfo.gender': 1,
            genderText: '男'
          });
        } else if (res.tapIndex === 1) {
          this.setData({
            'userInfo.gender': 2,
            genderText: '女'
          });
        }
      }
    });
  },

  showDatePicker: function () {
    wx.showDatePicker({
      start: '1900-01-01',
      end: new Date().toISOString().split('T')[0],
      success: (res) => {
        this.setData({
          'userInfo.birthday': res.date
        });
      }
    });
  },

  onSave: function () {
    const userInfo = this.data.userInfo;
    
    if (!userInfo.nickname) {
      wx.showToast({
        title: '请输入昵称',
        icon: 'none',
        duration: 1000
      });
      return;
    }
    
    // 保存用户信息
    setUserInfo(userInfo);
    
    wx.showToast({
      title: '保存成功',
      icon: 'success',
      duration: 1000,
      success: () => {
        setTimeout(() => {
          wx.navigateBack();
        }, 1000);
      }
    });
  },

  onBack: function () {
    wx.navigateBack();
  }
})