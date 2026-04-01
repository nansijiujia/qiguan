// order/list/list.js
const { api, handleApiError } = require('../../../utils/api');

Page({
  data: {
    activeTab: 'all',
    orders: []
  },

  onLoad: function () {
    this.getOrders();
  },

  // 切换标签
  switchTab: function (e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    this.getOrders(tab);
  },

  // 获取订单列表
  getOrders: async function (status = 'all') {
    try {
      const params = status !== 'all' ? { status } : {};
      const orders = await api.order.getList(params);
      this.setData({ orders });
    } catch (error) {
      handleApiError(error);
    }
  },

  // 查看订单详情
  viewOrder: function (e) {
    const orderId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/order/detail/detail?id=${orderId}`
    });
  },

  // 取消订单
  cancelOrder: function (e) {
    const orderId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '取消订单',
      content: '确定要取消这个订单吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await api.order.cancel(orderId);
            wx.showToast({
              title: '订单已取消',
              icon: 'success',
              duration: 1000
            });
            // 刷新订单列表
            this.getOrders(this.data.activeTab);
          } catch (error) {
            handleApiError(error);
          }
        }
      }
    });
  },

  // 支付订单
  payOrder: function (e) {
    const orderId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/order/detail/detail?id=${orderId}`
    });
  },

  // 去购物
  goShopping: function () {
    wx.switchTab({
      url: '/pages/index/index'
    });
  }
});