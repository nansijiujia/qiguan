const { api, handleApiError } = require('../../../utils/api');
const {
  executePayment,
  queryPaymentStatus,
  retryPayment,
  handlePaymentTimeout,
  calculatePaymentTimeout,
  PAYMENT_STATUS,
  PAYMENT_ERROR_CODES
} = require('../../../utils/payment');

Page({
  data: {
    order: {},
    countdown: 30,
    timer: null,
    paymentProcessing: false,
    pollingInstance: null
  },

  onLoad: function (options) {
    const orderId = options.id;
    if (orderId) {
      this.getOrderDetail(orderId);
    }
  },

  onShow: function () {
    this.startCountdown();
  },

  onHide: function () {
    this.stopCountdown();
    this.stopPolling();
  },

  onUnload: function () {
    this.stopCountdown();
    this.stopPolling();
  },

  stopPolling: function () {
    if (this.data.pollingInstance) {
      this.data.pollingInstance.stop();
      this.setData({ pollingInstance: null });
    }
  },

  getOrderDetail: async function (orderId) {
    try {
      const order = await api.order.getDetail(orderId);
      this.setData({ order });

      if (order.status === 'pending') {
        const timeoutInfo = calculatePaymentTimeout(order.createdAt, 30);
        if (timeoutInfo.isExpired) {
          this.handleOrderTimeout(orderId);
        } else {
          this.setData({ countdown: timeoutInfo.remainingMinutes });
        }
      }
    } catch (error) {
      handleApiError(error);
    }
  },

  handleOrderTimeout: async function (orderId) {
    try {
      await handlePaymentTimeout(orderId);
      wx.showToast({
        title: '订单已超时取消',
        icon: 'none',
        duration: 2000
      });
      this.getOrderDetail(orderId);
    } catch (error) {
      console.error('处理订单超时失败:', error);
    }
  },

  startCountdown: function () {
    if (this.data.order.status === 'pending') {
      this.stopCountdown();
      this.timer = setInterval(() => {
        const newCountdown = this.data.countdown - 1;
        this.setData({ countdown: newCountdown });

        if (newCountdown <= 0) {
          this.stopCountdown();
          this.handleOrderTimeout(this.data.order.id);
        }
      }, 60000);
    }
  },

  stopCountdown: function () {
    if (this.data.timer) {
      clearInterval(this.data.timer);
      this.setData({ timer: null });
    }
  },

  cancelOrder: async function () {
    wx.showModal({
      title: '取消订单',
      content: '确定要取消这个订单吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await api.order.cancel(this.data.order.id);
            wx.showToast({
              title: '订单已取消',
              icon: 'success',
              duration: 1000
            });
            this.getOrderDetail(this.data.order.id);
          } catch (error) {
            handleApiError(error);
          }
        }
      }
    });
  },

  payOrder: async function () {
    if (this.data.paymentProcessing) return;

    this.setData({ paymentProcessing: true });

    wx.showLoading({
      title: '正在支付...',
      mask: true
    });

    try {
      const paymentResult = await executePayment(this.data.order.id, {
        paymentMethod: this.data.order.paymentMethod || 'wechat',
        onSuccess: (data) => {
          this.handlePaymentSuccess(data);
        },
        onFail: (error) => {
          this.handlePaymentFail(error);
        },
        onCancel: () => {
          this.handlePaymentCancel();
        },
        onTimeout: () => {
          this.handlePaymentTimeoutResult();
        }
      });

      wx.hideLoading();

      if (paymentResult.success) {
        this.handlePaymentSuccess({});
      } else if (paymentResult.status === PAYMENT_STATUS.CANCELLED) {
        this.handlePaymentCancel();
      }

    } catch (error) {
      wx.hideLoading();
      this.handlePaymentFail(error);
    }
  },

  handlePaymentSuccess: function (data) {
    this.setData({ paymentProcessing: false });
    this.stopPolling();

    wx.redirectTo({
      url: `/subpages/order/result/result?orderId=${this.data.order.id}&status=success&amount=${this.data.order.totalPrice || this.data.order.orderInfo?.totalPrice}`,
      fail: () => {
        wx.showToast({
          title: '支付成功',
          icon: 'success',
          duration: 1500
        });
        setTimeout(() => {
          this.getOrderDetail(this.data.order.id);
        }, 1500);
      }
    });
  },

  handlePaymentFail: function (error) {
    this.setData({ paymentProcessing: false });
    this.stopPolling();

    const errorMessage = error?.message || '支付失败，请重试';

    wx.showModal({
      title: '支付失败',
      content: errorMessage,
      confirmText: '重新支付',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.payOrder();
        }
      }
    });
  },

  handlePaymentCancel: function () {
    this.setData({ paymentProcessing: false });
    this.stopPolling();

    wx.showModal({
      title: '支付已取消',
      content: '您已取消支付，订单已生成，您可以稍后继续支付',
      confirmText: '重新支付',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.payOrder();
        }
      }
    });
  },

  handlePaymentTimeoutResult: function () {
    this.setData({ paymentProcessing: false });
    this.stopPolling();

    wx.showModal({
      title: '支付超时',
      content: '支付结果确认超时，请检查订单状态或联系客服',
      confirmText: '查询状态',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.queryPaymentStatus();
        }
      }
    });
  },

  queryPaymentStatus: async function () {
    wx.showLoading({
      title: '查询中...',
      mask: true
    });

    try {
      const result = await queryPaymentStatus(this.data.order.id);
      wx.hideLoading();

      if (result.success) {
        if (result.status === 'paid' || result.status === 'completed') {
          this.handlePaymentSuccess(result.data);
        } else if (result.status === 'cancelled' || result.status === 'closed') {
          wx.showToast({
            title: '订单已取消',
            icon: 'none',
            duration: 2000
          });
          this.getOrderDetail(this.data.order.id);
        } else {
          wx.showToast({
            title: '订单未支付',
            icon: 'none',
            duration: 2000
          });
        }
      }
    } catch (error) {
      wx.hideLoading();
      handleApiError(error);
    }
  },

  retryPaymentAction: async function () {
    if (this.data.paymentProcessing) return;

    this.setData({ paymentProcessing: true });

    wx.showLoading({
      title: '正在支付...',
      mask: true
    });

    try {
      const result = await retryPayment(this.data.order.id, {
        paymentMethod: this.data.order.paymentMethod || 'wechat',
        onSuccess: (data) => {
          this.handlePaymentSuccess(data);
        },
        onFail: (error) => {
          this.handlePaymentFail(error);
        },
        onCancel: () => {
          this.handlePaymentCancel();
        }
      });

      wx.hideLoading();

      if (result.success) {
        this.handlePaymentSuccess(result.data);
      } else {
        this.handlePaymentFail(result.error);
      }

    } catch (error) {
      wx.hideLoading();
      this.setData({ paymentProcessing: false });
      handleApiError(error);
    }
  },

  shipOrder: function () {
    wx.showModal({
      title: '发货',
      content: '确定要发货吗？',
      success: (res) => {
        if (res.confirm) {
          this.showShipForm();
        }
      }
    });
  },

  showShipForm: function () {
    wx.showModal({
      title: '填写物流信息',
      content: '请输入物流公司和物流单号',
      editable: true,
      placeholderText: '物流公司 物流单号',
      success: async (res) => {
        if (res.confirm) {
          const [company, trackingNumber] = res.content.split(' ');
          if (company && trackingNumber) {
            try {
              await api.order.ship(this.data.order.id, {
                shippingCompany: company,
                trackingNumber: trackingNumber
              });
              wx.showToast({
                title: '发货成功',
                icon: 'success',
                duration: 1000
              });
              setTimeout(() => {
                this.getOrderDetail(this.data.order.id);
              }, 1000);
            } catch (error) {
              handleApiError(error);
            }
          } else {
            wx.showToast({
              title: '请输入正确的物流信息',
              icon: 'none',
              duration: 2000
            });
          }
        }
      }
    });
  },

  getLogistics: function () {
    wx.navigateTo({
      url: `/subpages/order/logistics/logistics?id=${this.data.order.id}`
    });
  },

  confirmReceipt: function () {
    wx.showModal({
      title: '确认收货',
      content: '确定已经收到商品了吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await api.order.confirmReceipt(this.data.order.id);
            wx.showToast({
              title: '确认收货成功',
              icon: 'success',
              duration: 1000
            });
            setTimeout(() => {
              this.getOrderDetail(this.data.order.id);
            }, 1000);
          } catch (error) {
            handleApiError(error);
          }
        }
      }
    });
  },

  goToPay: function () {
    this.payOrder();
  }
});
