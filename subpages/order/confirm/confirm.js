const { api, handleApiError } = require('../../../utils/api');
const {
  executePayment,
  PAYMENT_STATUS,
  PAYMENT_ERROR_CODES,
  calculatePaymentTimeout
} = require('../../../utils/payment');

Page({
  data: {
    address: null,
    orderItems: [],
    orderInfo: {
      subtotal: 0,
      shippingFee: 0,
      discount: 0,
      totalPrice: 0
    },
    selectedPayment: 'wechat',
    loading: false,
    paymentProcessing: false
  },

  onLoad: function (options) {
    const selectedGoods = wx.getStorageSync('selectedGoods') || [];
    if (selectedGoods.length > 0) {
      this.setData({ orderItems: selectedGoods });
      this.calculateOrderInfo(selectedGoods);
    } else {
      wx.showToast({
        title: '请选择要结算的商品',
        icon: 'none',
        duration: 1000
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1000);
    }
  },

  onUnload: function () {
    if (this.paymentPolling) {
      this.paymentPolling.stop();
    }
  },

  calculateOrderInfo: function (items) {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const shippingFee = subtotal >= 99 ? 0 : 10;
    const discount = 0;
    const totalPrice = subtotal + shippingFee - discount;

    this.setData({
      orderInfo: {
        subtotal,
        shippingFee,
        discount,
        totalPrice
      }
    });
  },

  chooseAddress: function () {
    wx.chooseAddress({
      success: (res) => {
        this.setData({ address: res });
      },
      fail: (err) => {
        console.error('选择地址失败:', err);
        wx.showToast({
          title: '选择地址失败',
          icon: 'none',
          duration: 1000
        });
      }
    });
  },

  selectPayment: function (e) {
    const paymentType = e.currentTarget.dataset.type;
    this.setData({ selectedPayment: paymentType });
  },

  generateAntiBrushToken: function () {
    const userId = wx.getStorageSync('userId') || 'unknown';
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    let hash = 0;
    const data = `${userId}:${timestamp}:${randomStr}`;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(32, '0');
  },

  submitOrder: async function () {
    if (!this.data.address) {
      wx.showToast({
        title: '请选择收货地址',
        icon: 'none',
        duration: 1000
      });
      return;
    }

    if (this.data.loading || this.data.paymentProcessing) {
      return;
    }

    this.setData({ loading: true });

    try {
      const antiBrushToken = this.generateAntiBrushToken();
      
      const orderData = {
        address: this.data.address,
        items: this.data.orderItems.map(item => ({
          productId: item.id,
          quantity: item.quantity,
          price: item.price,
          name: item.name,
          image: item.image
        })),
        orderInfo: this.data.orderInfo,
        paymentMethod: this.data.selectedPayment,
        status: 'pending',
        antiBrushToken
      };

      const orderResult = await api.order.create(orderData);

      const cartItems = wx.getStorageSync('cartItems') || [];
      const remainingItems = cartItems.filter(item => 
        !this.data.orderItems.some(orderItem => orderItem.id === item.id)
      );
      wx.setStorageSync('cartItems', remainingItems);
      wx.removeStorageSync('selectedGoods');

      this.setData({ loading: false, paymentProcessing: true });
      
      await this.processPayment(orderResult.id, orderResult);

    } catch (error) {
      this.setData({ loading: false, paymentProcessing: false });
      handleApiError(error);
    }
  },

  processPayment: async function (orderId, orderResult) {
    wx.showLoading({
      title: '正在支付...',
      mask: true
    });

    try {
      const paymentResult = await executePayment(orderId, {
        paymentMethod: this.data.selectedPayment,
        onSuccess: (data) => {
          this.handlePaymentSuccess(orderId, data);
        },
        onFail: (error) => {
          this.handlePaymentFail(orderId, error, orderResult);
        },
        onCancel: () => {
          this.handlePaymentCancel(orderId, orderResult);
        },
        onTimeout: () => {
          this.handlePaymentTimeout(orderId, orderResult);
        }
      });

      wx.hideLoading();

      if (paymentResult.success) {
        this.handlePaymentSuccess(orderId, orderResult);
      } else if (paymentResult.status === PAYMENT_STATUS.CANCELLED) {
        this.handlePaymentCancel(orderId, orderResult);
      }

    } catch (error) {
      wx.hideLoading();
      this.handlePaymentFail(orderId, error, orderResult);
    }
  },

  handlePaymentSuccess: function (orderId, orderData) {
    this.setData({ paymentProcessing: false });

    wx.redirectTo({
      url: `/subpages/order/result/result?orderId=${orderId}&status=success&amount=${this.data.orderInfo.totalPrice}`,
      fail: () => {
        wx.redirectTo({
          url: `/subpages/order/detail/detail?id=${orderId}`
        });
      }
    });
  },

  handlePaymentFail: function (orderId, error, orderData) {
    this.setData({ paymentProcessing: false });

    const errorMessage = error?.message || '支付失败，请重试';
    
    wx.showModal({
      title: '支付失败',
      content: errorMessage,
      confirmText: '重新支付',
      cancelText: '查看订单',
      success: (res) => {
        if (res.confirm) {
          this.retryPayment(orderId);
        } else {
          wx.redirectTo({
            url: `/subpages/order/detail/detail?id=${orderId}`
          });
        }
      }
    });
  },

  handlePaymentCancel: function (orderId, orderData) {
    this.setData({ paymentProcessing: false });

    wx.showModal({
      title: '支付已取消',
      content: '您已取消支付，订单已生成，您可以稍后继续支付',
      confirmText: '重新支付',
      cancelText: '查看订单',
      success: (res) => {
        if (res.confirm) {
          this.retryPayment(orderId);
        } else {
          wx.redirectTo({
            url: `/subpages/order/detail/detail?id=${orderId}`
          });
        }
      }
    });
  },

  handlePaymentTimeout: function (orderId, orderData) {
    this.setData({ paymentProcessing: false });

    wx.showModal({
      title: '支付超时',
      content: '支付结果确认超时，请检查订单状态或联系客服',
      confirmText: '查看订单',
      showCancel: false,
      success: () => {
        wx.redirectTo({
          url: `/subpages/order/detail/detail?id=${orderId}`
        });
      }
    });
  },

  retryPayment: async function (orderId) {
    this.setData({ paymentProcessing: true });

    wx.showLoading({
      title: '正在支付...',
      mask: true
    });

    try {
      const paymentResult = await executePayment(orderId, {
        paymentMethod: this.data.selectedPayment,
        onSuccess: (data) => {
          this.handlePaymentSuccess(orderId, data);
        },
        onFail: (error) => {
          wx.hideLoading();
          this.handlePaymentFail(orderId, error, {});
        },
        onCancel: () => {
          wx.hideLoading();
          this.handlePaymentCancel(orderId, {});
        },
        onTimeout: () => {
          wx.hideLoading();
          this.handlePaymentTimeout(orderId, {});
        }
      });

      wx.hideLoading();

      if (paymentResult.success) {
        this.handlePaymentSuccess(orderId, {});
      }

    } catch (error) {
      wx.hideLoading();
      this.setData({ paymentProcessing: false });
      
      wx.showModal({
        title: '支付失败',
        content: error.message || '支付失败，请稍后重试',
        showCancel: false,
        success: () => {
          wx.redirectTo({
            url: `/subpages/order/detail/detail?id=${orderId}`
          });
        }
      });
    }
  }
});
