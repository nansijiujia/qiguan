// order/detail/detail.js
const { api, handleApiError } = require('../../../utils/api');

Page({
  data: {
    order: {},
    countdown: 30, // 30分钟倒计时
    timer: null
  },

  onLoad: function (options) {
    const orderId = options.id;
    if (orderId) {
      this.getOrderDetail(orderId);
    }
  },

  onShow: function () {
    // 页面显示时启动倒计时
    this.startCountdown();
  },

  onHide: function () {
    // 页面隐藏时停止倒计时
    this.stopCountdown();
  },

  onUnload: function () {
    // 页面卸载时停止倒计时
    this.stopCountdown();
  },

  // 获取订单详情
  getOrderDetail: async function (orderId) {
    try {
      const order = await api.order.getDetail(orderId);
      this.setData({ order });
      
      // 计算倒计时
      if (order.status === 'pending') {
        const createdTime = new Date(order.createdAt).getTime();
        const now = new Date().getTime();
        const elapsedMinutes = Math.floor((now - createdTime) / (1000 * 60));
        const remainingMinutes = Math.max(0, 30 - elapsedMinutes);
        this.setData({ countdown: remainingMinutes });
      }
    } catch (error) {
      handleApiError(error);
    }
  },

  // 启动倒计时
  startCountdown: function () {
    if (this.data.order.status === 'pending') {
      this.stopCountdown(); // 先停止之前的定时器
      this.timer = setInterval(() => {
        this.setData({
          countdown: this.data.countdown - 1
        });
        
        // 倒计时结束，自动取消订单
        if (this.data.countdown <= 0) {
          this.stopCountdown();
          this.cancelOrder();
        }
      }, 60000); // 每分钟更新一次
    }
  },

  // 停止倒计时
  stopCountdown: function () {
    if (this.data.timer) {
      clearInterval(this.data.timer);
      this.setData({ timer: null });
    }
  },

  // 取消订单
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
            // 刷新订单状态
            this.getOrderDetail(this.data.order.id);
          } catch (error) {
            handleApiError(error);
          }
        }
      }
    });
  },

  // 支付订单
  payOrder: async function (retryCount = 0) {
    try {
      // 调用支付接口获取支付参数
      const paymentParams = await api.order.pay(this.data.order.id, {
        paymentMethod: this.data.order.paymentMethod
      });
      
      // 调用微信支付接口
      wx.requestPayment({
        timeStamp: paymentParams.timeStamp,
        nonceStr: paymentParams.nonceStr,
        package: paymentParams.package,
        signType: paymentParams.signType,
        paySign: paymentParams.paySign,
        success: async (res) => {
          // 支付成功
          wx.showToast({
            title: '支付成功',
            icon: 'success',
            duration: 1500
          });
          
          // 刷新订单状态
          setTimeout(() => {
            this.getOrderDetail(this.data.order.id);
          }, 1500);
        },
        fail: (err) => {
          // 支付失败
          console.error('支付失败:', err);
          
          // 处理支付失败
          this.handlePaymentFailure(err, retryCount);
        },
        complete: () => {
          // 支付完成（无论成功失败）
          console.log('支付流程完成');
        }
      });
    } catch (error) {
      handleApiError(error);
    }
  },
  
  // 处理支付失败
  handlePaymentFailure: function (err, retryCount) {
    const maxRetries = 2; // 最大重试次数
    
    // 分析错误原因
    let errorMessage = '支付失败，请重试';
    if (err.errMsg.includes('cancel')) {
      errorMessage = '支付已取消';
    } else if (err.errMsg.includes('fail')) {
      errorMessage = '支付失败，请检查网络后重试';
    }
    
    // 显示错误信息
    wx.showModal({
      title: '支付失败',
      content: errorMessage,
      cancelText: '取消',
      confirmText: retryCount < maxRetries ? '重试' : '重新发起支付',
      success: (res) => {
        if (res.confirm) {
          if (retryCount < maxRetries) {
            // 重试支付
            this.payOrder(retryCount + 1);
          } else {
            // 重新发起支付流程
            this.payOrder(0);
          }
        }
      }
    });
  },

  // 发货
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

  // 显示发货表单
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
              // 刷新订单状态
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

  // 获取物流信息
  getLogistics: function () {
    wx.navigateTo({
      url: `/pages/logistics/logistics?id=${this.data.order.id}`
    });
  },

  // 确认收货
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
            // 刷新订单状态
            setTimeout(() => {
              this.getOrderDetail(this.data.order.id);
            }, 1000);
          } catch (error) {
            handleApiError(error);
          }
        }
      }
    });
  }
});