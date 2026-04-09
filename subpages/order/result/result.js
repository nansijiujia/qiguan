const { api, handleApiError } = require('../../../utils/api');
const { queryPaymentStatus, retryPayment, PAYMENT_STATUS } = require('../../../utils/payment');

Page({
  data: {
    status: 'success',
    orderId: '',
    amount: 0,
    orderInfo: null,
    loading: true,
    retrying: false,
    countdown: 5,
    autoJump: true
  },

  onLoad: function (options) {
    const { orderId, status, amount } = options;
    
    this.setData({
      orderId: orderId || '',
      status: status || 'success',
      amount: parseFloat(amount) || 0
    });

    if (orderId) {
      this.loadOrderDetail(orderId);
    }

    if (status === 'success') {
      this.startAutoJump();
    }
  },

  onUnload: function () {
    this.stopAutoJump();
  },

  onHide: function () {
    this.stopAutoJump();
  },

  loadOrderDetail: async function (orderId) {
    try {
      const orderInfo = await api.order.getDetail(orderId);
      this.setData({
        orderInfo,
        loading: false
      });

      if (orderInfo.status === 'paid' || orderInfo.status === 'completed') {
        this.setData({ status: 'success' });
      } else if (orderInfo.status === 'cancelled' || orderInfo.status === 'closed') {
        this.setData({ status: 'failed' });
      }
    } catch (error) {
      this.setData({ loading: false });
      handleApiError(error);
    }
  },

  startAutoJump: function () {
    this.autoJumpTimer = setInterval(() => {
      const countdown = this.data.countdown - 1;
      this.setData({ countdown });

      if (countdown <= 0) {
        this.stopAutoJump();
        this.goToOrderDetail();
      }
    }, 1000);
  },

  stopAutoJump: function () {
    if (this.autoJumpTimer) {
      clearInterval(this.autoJumpTimer);
      this.autoJumpTimer = null;
    }
  },

  goToOrderDetail: function () {
    this.stopAutoJump();
    wx.redirectTo({
      url: `/subpages/order/detail/detail?id=${this.data.orderId}`
    });
  },

  goToOrderList: function () {
    this.stopAutoJump();
    wx.redirectTo({
      url: '/subpages/order/list/list'
    });
  },

  goToHome: function () {
    this.stopAutoJump();
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  retryPaymentAction: async function () {
    if (this.data.retrying) return;

    this.setData({ retrying: true });

    wx.showLoading({
      title: '正在支付...',
      mask: true
    });

    try {
      const result = await retryPayment(this.data.orderId, {
        paymentMethod: 'wechat',
        onSuccess: () => {
          wx.hideLoading();
          this.setData({
            status: 'success',
            retrying: false
          });
          this.startAutoJump();
        },
        onFail: (error) => {
          wx.hideLoading();
          this.setData({ retrying: false });
          wx.showModal({
            title: '支付失败',
            content: error.message || '支付失败，请重试',
            showCancel: false
          });
        },
        onCancel: () => {
          wx.hideLoading();
          this.setData({ retrying: false });
        }
      });

      wx.hideLoading();

      if (result.success) {
        this.setData({
          status: 'success',
          retrying: false
        });
        this.startAutoJump();
      } else {
        this.setData({ retrying: false });
      }
    } catch (error) {
      wx.hideLoading();
      this.setData({ retrying: false });
      handleApiError(error);
    }
  },

  queryPaymentStatusAction: async function () {
    wx.showLoading({
      title: '查询中...',
      mask: true
    });

    try {
      const result = await queryPaymentStatus(this.data.orderId);
      wx.hideLoading();

      if (result.success) {
        if (result.status === 'paid' || result.status === 'completed') {
          this.setData({ status: 'success' });
          this.startAutoJump();
          wx.showToast({
            title: '支付成功',
            icon: 'success'
          });
        } else if (result.status === 'cancelled' || result.status === 'closed') {
          this.setData({ status: 'failed' });
          wx.showToast({
            title: '订单已取消',
            icon: 'none'
          });
        } else {
          wx.showToast({
            title: '订单未支付',
            icon: 'none'
          });
        }
      }
    } catch (error) {
      wx.hideLoading();
      handleApiError(error);
    }
  },

  contactService: function () {
    wx.navigateTo({
      url: '/subpages/service/customer-service/index'
    });
  }
});
