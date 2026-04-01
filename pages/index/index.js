// index.js
const { api, handleApiError } = require('../../utils/api');

Page({
  data: {
    // 核心数据结构
    banners: [],
    categories: [],
    recommendedGoods: [],
    promotionGoods: [],
    hotGoods: [],
    searchKeyword: '',
    loading: false,
    loadedImages: {}, // 跟踪图片加载状态
    lazyLoadImages: {}, // 懒加载图片状态
    countdown: { // 倒计时数据
      days: 0,
      hours: 23,
      minutes: 59,
      seconds: 59
    }
  },

  onLoad: function () {
    console.log('首页加载');
    // 尝试从本地缓存加载数据
    this.loadFromCache();
    // 加载最新数据
    this.loadHomeData();
    // 初始化动画
    this.initAnimation();
    // 启动倒计时
    this.startCountdown();
  },

  // 初始化动画
  initAnimation: function () {
    this.animation = wx.createAnimation({
      duration: 500,
      timingFunction: 'ease',
    });
  },



  // 启动倒计时
  startCountdown: function () {
    setInterval(() => {
      const countdown = { ...this.data.countdown };
      if (countdown.seconds > 0) {
        countdown.seconds--;
      } else if (countdown.minutes > 0) {
        countdown.minutes--;
        countdown.seconds = 59;
      } else if (countdown.hours > 0) {
        countdown.hours--;
        countdown.minutes = 59;
        countdown.seconds = 59;
      } else if (countdown.days > 0) {
        countdown.days--;
        countdown.hours = 23;
        countdown.minutes = 59;
        countdown.seconds = 59;
      } else {
        // 倒计时结束，重置
        countdown.hours = 23;
        countdown.minutes = 59;
        countdown.seconds = 59;
      }
      this.setData({ countdown });
    }, 1000);
  },

  // 从本地缓存加载数据
  loadFromCache: function () {
    try {
      const cachedData = wx.getStorageSync('homePageData');
      if (cachedData && Date.now() < cachedData.expiry) {
        this.setData({
          banners: cachedData.banners || [],
          recommendedGoods: cachedData.recommendations || [],
          promotionGoods: cachedData.promotions || [],
          hotGoods: cachedData.hotProducts || [],
          categories: cachedData.categories || []
        });
      }
    } catch (error) {
      console.error('加载缓存失败:', error);
    }
  },

  // 加载首页数据
  loadHomeData: async function () {
    this.setData({ loading: true });
    try {
      // 采用正向传输方式，从后端获取数据
      const [homeData, categories] = await Promise.all([
        api.home.getData(),
        api.category.getList()
      ]);
      
      // 更新数据
      this.setData({
        banners: homeData.banners || [],
        recommendedGoods: homeData.recommendations || [],
        promotionGoods: homeData.promotions || [],
        hotGoods: homeData.hotProducts || [],
        categories: categories || []
      });
      
      // 缓存数据到本地
      this.saveToCache({ ...homeData, categories });
    } catch (error) {
      handleApiError(error);
    } finally {
      this.setData({ loading: false });
    }
  },
  
  // 保存数据到本地缓存
  saveToCache: function (data) {
    try {
      wx.setStorageSync('homePageData', {
        ...data,
        expiry: Date.now() + 5 * 60 * 1000 // 5分钟缓存
      });
    } catch (error) {
      console.error('保存缓存失败:', error);
    }
  },

  // 图片加载完成事件
  onImageLoad: function (e) {
    const key = e.target.dataset.key || e.currentTarget.dataset.key;
    if (key) {
      console.log('图片加载完成:', key);
      // 更新图片加载状态，触发淡入效果
      const loadedImages = { ...this.data.loadedImages };
      loadedImages[key] = true;
      this.setData({ loadedImages });
    }
  },

  // 图片加载失败事件
  onImageError: function (e) {
    const key = e.target.dataset.key || e.currentTarget.dataset.key;
    console.log('图片加载失败:', key);
    // 处理图片加载失败的情况
    const loadedImages = { ...this.data.loadedImages };
    loadedImages[key] = true; // 即使失败也标记为已加载，避免一直显示骨架屏
    this.setData({ loadedImages });
  },
  
  // 图片懒加载
  onImageLazyLoad: function (e) {
    const key = e.target.dataset.key;
    if (key) {
      const lazyLoadImages = { ...this.data.lazyLoadImages };
      lazyLoadImages[key] = true;
      this.setData({ lazyLoadImages });
    }
  },

  // 搜索输入事件
  onSearchInput: function (e) {
    this.setData({ searchKeyword: e.detail.value });
  },

  // 搜索提交事件
  onSearch: function () {
    const keyword = this.data.searchKeyword;
    if (keyword) {
      console.log('搜索关键词:', keyword);
      // 跳转到搜索结果页面
      wx.navigateTo({
        url: `/pages/search/search?keyword=${encodeURIComponent(keyword)}`
      });
    } else {
      // 显示提示
      wx.showToast({
        title: '请输入搜索关键词',
        icon: 'none',
        duration: 1500
      });
    }
  },

  // 分类点击事件
  onCategoryClick: function (e) {
    const categoryId = e.currentTarget.dataset.id;
    console.log('点击分类:', categoryId);
    // 添加点击动画
    this.animation.scale(0.95).step();
    this.setData({ animationData: this.animation.export() });
    setTimeout(() => {
      this.animation.scale(1).step();
      this.setData({ animationData: this.animation.export() });
    }, 100);
    // 跳转到分类商品页面
    wx.navigateTo({
      url: `/pages/category/category?id=${categoryId}`
    });
  },

  // 商品点击事件
  onGoodsClick: function (e) {
    const goodsId = e.currentTarget.dataset.id;
    console.log('点击商品:', goodsId);
    // 验证商品ID
    const validId = parseInt(goodsId);
    if (!isNaN(validId) && validId > 0) {
      // 跳转到商品详情页面
      wx.navigateTo({
        url: `/pages/detail/detail?id=${validId}`
      });
    } else {
      console.error('无效的商品ID:', goodsId);
      wx.showToast({
        title: '商品不存在',
        icon: 'none',
        duration: 1500
      });
    }
  },

  // 添加到购物车
  onAddToCart: function (e) {
    const goodsId = e.currentTarget.dataset.id;
    console.log('添加到购物车:', goodsId);
    // 添加动画效果
    const button = e.currentTarget;
    this.animation.scale(0.8).step();
    this.setData({ animationData: this.animation.export() });
    setTimeout(() => {
      this.animation.scale(1).step();
      this.setData({ animationData: this.animation.export() });
    }, 150);
    // 显示添加成功提示
    wx.showToast({
      title: '已添加到购物车',
      icon: 'success',
      duration: 1000
    });
  },

  // 下拉刷新事件
  onPullDownRefresh: function () {
    console.log('下拉刷新');
    this.loadHomeData();
    setTimeout(() => {
      wx.stopPullDownRefresh();
      // 显示刷新成功提示
      wx.showToast({
        title: '刷新成功',
        icon: 'success',
        duration: 1000
      });
    }, 1500);
  },

  // 上拉加载更多事件
  onReachBottom: function () {
    console.log('上拉加载更多');
    // 显示加载更多提示
    wx.showLoading({
      title: '加载中...',
      mask: true
    });
    setTimeout(() => {
      wx.hideLoading();
      // 显示没有更多数据提示
      wx.showToast({
        title: '没有更多商品了',
        icon: 'none',
        duration: 1000
      });
    }, 1000);
  },

  // 页面显示时的操作
  onShow: function () {
    console.log('首页显示');
    // 更新全局tabBar索引
    const app = getApp();
    app.globalData.currentTabIndex = 0;
  },

  // 立即购买
  onBuyNow: function (e) {
    const goodsId = e.currentTarget.dataset.id;
    console.log('立即购买:', goodsId);
    // 跳转到商品详情页
    wx.navigateTo({
      url: `/pages/detail/detail?id=${goodsId}&buyNow=true`
    });
  },

  // 跳转到活动列表
  goToActivityList: function () {
    console.log('跳转到活动中心');
    wx.navigateTo({
      url: '/pages/activity/activity'
    });
  },

  // 查看全部分类
  onViewAllCategories: function () {
    wx.navigateTo({
      url: '/pages/category/category'
    });
  },

  // 查看全部商品
  onViewAllGoods: function () {
    wx.navigateTo({
      url: '/pages/category/category?type=all'
    });
  },

  // 查看全部促销
  onViewAllPromotions: function () {
    wx.navigateTo({
      url: '/pages/activity/activity?type=promotion'
    });
  },

  // 查看全部热门商品
  onViewAllHotGoods: function () {
    wx.navigateTo({
      url: '/pages/category/category?type=hot'
    });
  }
})