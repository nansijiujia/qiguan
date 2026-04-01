//app.js
App({
  onLaunch: function () {
    // 展示本地存储能力
    var logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    console.log('小程序启动')
  },
  globalData: {
    cart: [],
    currentTabIndex: 0
  }
})