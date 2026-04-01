// coupon.js
Page({
  data: {
    coupons: [],
    loading: false,
    tabIndex: 0, // 0: 可使用, 1: 已使用, 2: 已过期
    tabs: ['可使用', '已使用', '已过期']
  },

  onLoad: function () {
    console.log('优惠券页面加载');
    this.loadCoupons();
  },

  onShow: function () {
    console.log('优惠券页面显示');
    this.loadCoupons();
  },

  // 加载优惠券列表
  loadCoupons: function () {
    this.setData({ loading: true });
    
    // 模拟API调用获取优惠券列表
    setTimeout(() => {
      const mockCoupons = [
        {
          id: 1,
          uniqueCode: 'COUPON_1A2B3C4D5E',
          name: '新人立减券',
          type: 'fixed',
          value: 20,
          minSpend: 100,
          endDate: '2026-12-31',
          status: 'unused',
          orderId: null
        },
        {
          id: 2,
          uniqueCode: 'COUPON_2F3G4H5I6J',
          name: '全场9折券',
          type: 'discount',
          value: 0.9,
          minSpend: 50,
          endDate: '2026-12-31',
          status: 'unused',
          orderId: null
        },
        {
          id: 3,
          uniqueCode: 'COUPON_3K4L5M6N7O',
          name: '满200减50',
          type: 'fixed',
          value: 50,
          minSpend: 200,
          endDate: '2026-12-31',
          status: 'used',
          orderId: 'ORD123456'
        },
        {
          id: 4,
          uniqueCode: 'COUPON_4P5Q6R7S8T',
          name: '限时优惠',
          type: 'fixed',
          value: 10,
          minSpend: 0,
          endDate: '2026-01-31',
          status: 'expired',
          orderId: null
        }
      ];
      
      // 计算不同状态的优惠券是否存在
      const hasUnusedCoupons = mockCoupons.some(function(coupon) {
        return coupon.status == 'unused';
      });
      
      const hasUsedCoupons = mockCoupons.some(function(coupon) {
        return coupon.status == 'used';
      });
      
      const hasExpiredCoupons = mockCoupons.some(function(coupon) {
        return coupon.status == 'expired';
      });
      
      this.setData({ 
        coupons: mockCoupons,
        hasUnusedCoupons: hasUnusedCoupons,
        hasUsedCoupons: hasUsedCoupons,
        hasExpiredCoupons: hasExpiredCoupons,
        loading: false 
      });
    }, 500);
  },

  // 切换标签
  switchTab: function (e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ tabIndex: index });
  },

  // 领取优惠券
  receiveCoupon: function (e) {
    const couponId = e.currentTarget.dataset.couponId;
    wx.showLoading({ title: '领取中...' });
    
    // 模拟API调用领取优惠券
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({
        title: '领取成功',
        icon: 'success',
        duration: 1000
      });
      // 重新加载优惠券列表
      this.loadCoupons();
    }, 1000);
  },

  // 查看优惠券详情
  viewCouponDetail: function (e) {
    const couponId = e.currentTarget.dataset.couponId;
    wx.showToast({
      title: '查看优惠券详情',
      icon: 'none',
      duration: 1000
    });
  },

  // 立即使用
  useCouponNow: function (e) {
    const coupon = e.currentTarget.dataset.coupon;
    // 跳转到购物车或商品列表页面
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  // 下拉刷新
  onPullDownRefresh: function () {
    console.log('下拉刷新');
    this.loadCoupons();
    wx.stopPullDownRefresh();
  }
});
