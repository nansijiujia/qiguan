// order/confirm/confirm.js
const { api, handleApiError } = require('../../../utils/api');

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
    loading: false
  },

  onLoad: function (options) {
    // 从购物车页面获取选中的商品
    const selectedGoods = wx.getStorageSync('selectedGoods') || [];
    if (selectedGoods.length > 0) {
      this.setData({ orderItems: selectedGoods });
      this.calculateOrderInfo(selectedGoods);
    } else {
      // 如果没有选中商品，返回购物车页面
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

  // 计算订单信息
  calculateOrderInfo: function (items) {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const shippingFee = subtotal >= 99 ? 0 : 10; // 满99免运费
    const discount = 0; // 暂时没有优惠
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

  // 选择地址
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

  // 选择支付方式
  selectPayment: function (e) {
    const paymentType = e.currentTarget.dataset.type;
    this.setData({ selectedPayment: paymentType });
  },

  // 提交订单
  submitOrder: async function () {
    // 验证地址
    if (!this.data.address) {
      wx.showToast({
        title: '请选择收货地址',
        icon: 'none',
        duration: 1000
      });
      return;
    }

    this.setData({ loading: true });

    try {
      // 构建订单数据
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
        status: 'pending' // 待付款状态
      };

      // 创建订单
      const orderResult = await api.order.create(orderData);

      // 清空购物车中已购买的商品
      const cartItems = wx.getStorageSync('cartItems') || [];
      const remainingItems = cartItems.filter(item => 
        !this.data.orderItems.some(orderItem => orderItem.id === item.id)
      );
      wx.setStorageSync('cartItems', remainingItems);

      // 清除选中商品的缓存
      wx.removeStorageSync('selectedGoods');

      // 跳转到订单详情页面
      wx.redirectTo({
        url: `/pages/order/detail/detail?id=${orderResult.id}`
      });
    } catch (error) {
      handleApiError(error);
    } finally {
      this.setData({ loading: false });
    }
  }
});