// mine.js
import { checkLogin, getCurrentUser, logout } from '../../utils/auth';

Page({
  data: {
    isLoggedIn: false,
    userInfo: {},
    orderStats: {
      pending: 2,
      shipping: 1,
      delivered: 3
    },
    appInfo: {
      version: '1.0.0'
    },
    loading: false
  },

  onLoad: function () {
    console.log('个人中心加载');
    this.checkLoginStatus();
  },

  onShow: function () {
    console.log('个人中心显示');
    this.checkLoginStatus();
  },

  checkLoginStatus: function () {
    const isLoggedIn = checkLogin();
    const userInfo = getCurrentUser();
    this.setData({
      isLoggedIn: isLoggedIn,
      userInfo: userInfo || {}
    });
  },

  // 跳转到设置页面
  onSettings: function () {
    wx.showToast({
      title: '跳转到设置页面',
      icon: 'none',
      duration: 1000
    });
  },

  // 查看全部订单
  onViewAllOrders: function () {
    if (!this.data.isLoggedIn) {
      this.goToLogin();
      return;
    }
    wx.navigateTo({
      url: '/pages/order/list/list?tab=all'
    });
  },

  // 跳转到对应状态的订单页面
  onOrderStatus: function (e) {
    if (!this.data.isLoggedIn) {
      this.goToLogin();
      return;
    }
    const status = e.currentTarget.dataset.status;
    // 状态映射：个人中心的status -> 订单列表的tab
    const statusMap = {
      pending: 'pending',
      shipping: 'paid',
      delivered: 'shipped'
    };
    const tab = statusMap[status] || 'all';
    wx.navigateTo({
      url: `/pages/order/list/list?tab=${tab}`
    });
  },

  // 获取订单状态文本
  getStatusText: function (status) {
    const statusMap = {
      pending: '待付款',
      shipping: '待发货',
      delivered: '待收货'
    };
    return statusMap[status] || '';
  },

  // 跳转到我的收藏
  onFavorite: function () {
    if (!this.data.isLoggedIn) {
      this.goToLogin();
      return;
    }
    wx.showToast({
      title: '跳转到我的收藏页面',
      icon: 'none',
      duration: 1000
    });
  },

  // 跳转到浏览足迹
  onFootprint: function () {
    if (!this.data.isLoggedIn) {
      this.goToLogin();
      return;
    }
    wx.showToast({
      title: '跳转到浏览足迹页面',
      icon: 'none',
      duration: 1000
    });
  },

  // 跳转到客户服务页面
  onCustomerService: function () {
    wx.navigateTo({
      url: '/pages/customer-service/index'
    });
  },

  // 跳转到收货地址
  onAddress: function () {
    if (!this.data.isLoggedIn) {
      this.goToLogin();
      return;
    }
    wx.navigateTo({
      url: '/pages/address/list/list'
    });
  },

  // 跳转到我的优惠券
  onCoupon: function () {
    if (!this.data.isLoggedIn) {
      this.goToLogin();
      return;
    }
    wx.navigateTo({
      url: '/pages/coupon/coupon'
    });
  },

  // 跳转到意见反馈
  onFeedback: function () {
    wx.showToast({
      title: '跳转到意见反馈页面',
      icon: 'none',
      duration: 1000
    });
  },

  // 跳转到登录页面
  goToLogin: function () {
    wx.navigateTo({
      url: '/pages/login/login'
    });
  },

  // 跳转到个人信息页面
  onUserInfo: function () {
    if (!this.data.isLoggedIn) {
      this.goToLogin();
      return;
    }
    wx.navigateTo({
      url: '/pages/profile/profile'
    });
  },

  // 跳转到个人信息编辑页面
  onProfile: function () {
    wx.navigateTo({
      url: '/pages/profile/profile'
    });
  },

  // 跳转到修改密码页面
  onChangePassword: function () {
    wx.navigateTo({
      url: '/pages/change-password/change-password'
    });
  },

  // 退出登录
  onLogout: function () {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          logout();
          this.setData({
            isLoggedIn: false,
            userInfo: {}
          });
          wx.showToast({
            title: '已退出登录',
            icon: 'success',
            duration: 1000
          });
        }
      }
    });
  },

  // 下拉刷新
  onPullDownRefresh: function () {
    console.log('下拉刷新');
    this.checkLoginStatus();
    wx.stopPullDownRefresh();
    wx.showToast({
      title: '刷新成功',
      icon: 'success',
      duration: 1000
    });
  }
})