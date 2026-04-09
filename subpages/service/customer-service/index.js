// customer-service/index.js
Page({
  data: {
    // 页面数据
  },

  onLoad: function () {
    console.log('客户服务页面加载');
  },

  // 返回上一页
  onBack: function () {
    wx.navigateBack();
  },

  // 跳转到在线客服聊天页面
  goToChat: function () {
    wx.navigateTo({
      url: '/pages/customer-service/chat'
    });
  },

  // 跳转到常见问题页面
  goToFAQ: function () {
    wx.navigateTo({
      url: '/pages/customer-service/faq'
    });
  },

  // 跳转到售后申请页面
  goToAfterSales: function () {
    wx.navigateTo({
      url: '/pages/customer-service/after-sales'
    });
  }
})