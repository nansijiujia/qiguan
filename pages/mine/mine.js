// mine.js
const { api, handleApiError } = require('../../utils/api');
const { checkLogin, getCurrentUser, logout } = require('../../utils/auth');

Page({
  data: {
    isLoggedIn: false,
    userInfo: null,
    orderStats: null,
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
    const token = wx.getStorageSync('token');
    const isLoggedIn = !!token;
    
    this.setData({
      isLoggedIn: isLoggedIn
    });
    
    if (isLoggedIn) {
      this.loadUserData();
    } else {
      this.setData({
        userInfo: null,
        orderStats: null
      });
    }
  },

  loadUserData: async function () {
    this.setData({ loading: true });
    try {
      const [userInfo, orderStats] = await Promise.all([
        api.user.getInfo().catch(() => null),
        api.user.getOrderStats().catch(() => null)
      ]);
      
      this.setData({
        userInfo: userInfo,
        orderStats: orderStats || { pending: 0, shipping: 0, delivered: 0 },
        loading: false
      });
    } catch (error) {
      console.error('加载用户数据失败:', error);
      this.setData({ loading: false });
    }
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
      url: '/subpages/order/list/list?tab=all',
      fail: (error) => {
        console.error('跳转订单列表失败:', error);
        wx.showToast({
          title: '跳转失败，请重试',
          icon: 'none',
          duration: 2000
        });
      }
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
      url: `/subpages/order/list/list?tab=${tab}`,
      fail: (error) => {
        console.error('跳转订单列表失败:', error);
        wx.showToast({
          title: '跳转失败，请重试',
          icon: 'none',
          duration: 2000
        });
      }
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
    wx.navigateTo({
      url: '/subpages/user/favorite/favorite',
      fail: (error) => {
        console.error('跳转收藏页失败:', error);
        wx.showToast({
          title: '跳转失败，请重试',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 跳转到浏览足迹
  onFootprint: function () {
    if (!this.data.isLoggedIn) {
      this.goToLogin();
      return;
    }
    wx.navigateTo({
      url: '/subpages/user/footprint/footprint',
      fail: (error) => {
        console.error('跳转足迹页失败:', error);
        wx.showToast({
          title: '跳转失败，请重试',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 跳转到客户服务页面
  onCustomerService: function () {
    wx.navigateTo({
      url: '/subpages/service/customer-service/index',
      fail: (error) => {
        console.error('跳转客服页失败:', error);
        wx.showToast({
          title: '跳转失败，请重试',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 跳转到收货地址
  onAddress: function () {
    if (!this.data.isLoggedIn) {
      this.goToLogin();
      return;
    }
    wx.navigateTo({
      url: '/subpages/user/address/list/list',
      fail: (error) => {
        console.error('跳转地址管理失败:', error);
        wx.showToast({
          title: '跳转失败，请重试',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 跳转到我的优惠券
  onCoupon: function () {
    if (!this.data.isLoggedIn) {
      this.goToLogin();
      return;
    }
    wx.navigateTo({
      url: '/subpages/user/coupon/coupon',
      fail: (error) => {
        console.error('跳转优惠券页失败:', error);
        wx.showToast({
          title: '跳转失败，请重试',
          icon: 'none',
          duration: 2000
        });
      }
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
      url: '/subpages/auth/login/login',
      fail: (error) => {
        console.error('跳转登录页失败:', error);
        wx.showToast({
          title: '跳转失败，请重试',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 跳转到个人信息页面
  onUserInfo: function () {
    if (!this.data.isLoggedIn) {
      this.goToLogin();
      return;
    }
    wx.navigateTo({
      url: '/subpages/auth/profile/profile',
      fail: (error) => {
        console.error('跳转个人信息页失败:', error);
        wx.showToast({
          title: '跳转失败，请重试',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 跳转到个人信息编辑页面
  onProfile: function () {
    wx.navigateTo({
      url: '/subpages/auth/profile/profile',
      fail: (error) => {
        console.error('跳转个人信息编辑页失败:', error);
        wx.showToast({
          title: '跳转失败，请重试',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 跳转到修改密码页面
  onChangePassword: function () {
    wx.navigateTo({
      url: '/subpages/auth/change-password/change-password',
      fail: (error) => {
        console.error('跳转修改密码页失败:', error);
        wx.showToast({
          title: '跳转失败，请重试',
          icon: 'none',
          duration: 2000
        });
      }
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