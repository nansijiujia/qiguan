// logistics/logistics.js
const { api, handleApiError } = require('../../utils/api');

Page({
  data: {
    orderId: '',
    logistics: {},
    tracking: [],
    loading: true,
    error: ''
  },

  onLoad: function (options) {
    const orderId = options.id;
    if (orderId) {
      this.setData({ orderId });
      this.getLogisticsDetail(orderId);
    }
  },

  // 获取物流详情和轨迹
  getLogisticsDetail: async function (orderId) {
    try {
      this.setData({ loading: true, error: '' });
      
      // 获取物流基本信息
      const logistics = await api.order.getLogistics(orderId);
      
      // 获取物流轨迹
      const tracking = await api.order.getLogisticsTracking(orderId);
      
      this.setData({
        logistics,
        tracking,
        loading: false
      });
    } catch (error) {
      this.setData({
        loading: false,
        error: error.message || '获取物流信息失败'
      });
      handleApiError(error);
    }
  },

  // 刷新物流信息
  refreshLogistics: function () {
    this.getLogisticsDetail(this.data.orderId);
  },

  // 复制物流单号
  copyTrackingNumber: function () {
    const trackingNumber = this.data.logistics.trackingNumber;
    if (trackingNumber) {
      wx.setClipboardData({
        data: trackingNumber,
        success: function () {
          wx.showToast({
            title: '物流单号已复制',
            icon: 'success',
            duration: 1500
          });
        }
      });
    }
  },

  // 拨打电话
  callService: function () {
    wx.makePhoneCall({
      phoneNumber: '400-123-4567', // 物流客服电话
      success: function () {
        console.log('拨打电话成功');
      },
      fail: function (err) {
        console.error('拨打电话失败:', err);
      }
    });
  }
});