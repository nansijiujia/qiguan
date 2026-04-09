// index.js
const { api, handleApiError } = require('../../utils/api');
const { saveToCache, loadFromCache, CACHE_CONFIG } = require('../../utils/cache');
const { preloadImages, extractImageUrls } = require('../../utils/image');
const { addToCart } = require('../../utils/cart');
const { createScaleAnimation } = require('../../utils/animation');
const { startCountdown, getFutureTimestamp } = require('../../utils/countdown');

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
    // 记录首屏加载开始时间
    this.startTime = Date.now();
    
    // 初始化动画
    this.initAnimation();
    // 启动倒计时
    this.startCountdown();
    
    // 尝试从本地缓存加载数据
    this.loadFromCache();
    
    // 立即加载最新数据，不需要延迟
    this.loadHomeData();
  },

  // 初始化动画
  initAnimation: function () {
    this.animation = wx.createAnimation({
      duration: 300,
      timingFunction: 'ease',
    });
  },

  // 启动倒计时
  startCountdown: function () {
    // 设置24小时倒计时
    const targetTime = getFutureTimestamp(24);
    
    // 使用公共倒计时函数
    this.countdownController = startCountdown(
      targetTime,
      (timeDiff) => {
        this.setData({
          countdown: {
            days: timeDiff.days,
            hours: timeDiff.hours,
            minutes: timeDiff.minutes,
            seconds: timeDiff.seconds
          }
        });
      },
      () => {
        // 倒计时结束，重置
        this.startCountdown();
      }
    );
  },

  // 页面卸载时清除定时器
  onUnload: function () {
    if (this.countdownController) {
      this.countdownController.stop();
    }
  },

  // 从本地缓存加载数据
  loadFromCache: function () {
    try {
      const cachedData = loadFromCache('homePageData');
      if (cachedData) {
        // 合并setData操作，减少渲染次数
        const data = {
          banners: cachedData.banners || [],
          recommendedGoods: cachedData.recommendations || [],
          promotionGoods: cachedData.promotions || [],
          hotGoods: cachedData.hotProducts || [],
          categories: cachedData.categories || [],
          loading: false // 缓存加载成功后直接设置为非加载状态
        };
        this.setData(data);
        
        // 计算首屏加载时间（从缓存加载）
        const loadTime = Date.now() - this.startTime;
        console.log('首屏加载时间（缓存）:', loadTime, 'ms');
        
        // 如果首屏加载时间超过2秒，记录警告
        if (loadTime > 2000) {
          console.warn('首屏加载时间（缓存）超过2秒:', loadTime, 'ms');
        }
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
      saveToCache('homePageData', { ...homeData, categories }, CACHE_CONFIG.homeDataExpiry);
      
      // 预加载图片
      this.preloadImages(homeData);
      
      // 计算首屏加载时间
      const loadTime = Date.now() - this.startTime;
      console.log('首屏加载时间:', loadTime, 'ms');
      
      // 如果首屏加载时间超过2秒，记录警告
      if (loadTime > 2000) {
        console.warn('首屏加载时间超过2秒:', loadTime, 'ms');
      }
    } catch (error) {
      handleApiError(error);
    } finally {
      this.setData({ loading: false });
    }
  },
  
  // 预加载图片
  preloadImages: function (homeData) {
    // 从数据中提取图片URL
    const imageUrls = extractImageUrls(homeData, [
      'banners',
      'recommendations',
      'promotions',
      'hotProducts'
    ]);
    
    // 批量预加载图片
    preloadImages(imageUrls, 10);
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
    // 使用本地存储传递分类ID，然后跳转到分类页面
    wx.setStorageSync('selectedCategoryId', categoryId);
    wx.switchTab({
      url: '/pages/category/category',
      fail: (error) => {
        console.error('跳转分类页失败:', error);
        wx.showToast({
          title: '跳转失败，请重试',
          icon: 'none',
          duration: 2000
        });
      }
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
  onAddToCart: async function (e) {
    const goodsId = e.currentTarget.dataset.id;
    console.log('添加到购物车:', goodsId);
    
    try {
      // 添加动画效果
      const animation = createScaleAnimation(0.8, 100);
      this.setData({ animationData: animation.export() });
      setTimeout(() => {
        const resetAnimation = createScaleAnimation(1, 100);
        this.setData({ animationData: resetAnimation.export() });
      }, 100);
      
      // 显示加载动画
      wx.showLoading({
        title: '添加中...',
        mask: true
      });
      
      // 构建添加到购物车的数据
      const cartData = {
        productId: goodsId,
        quantity: 1
      };
      
      // 调用公共购物车函数添加到购物车
      const success = await addToCart(cartData);
      
      wx.hideLoading();
      
      // 显示添加成功提示
      if (success) {
        wx.showToast({
          title: '已添加到购物车',
          icon: 'success',
          duration: 1000
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('添加到购物车失败:', error);
      handleApiError(error);
    }
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



  // 查看全部分类
  onViewAllCategories: function () {
    wx.switchTab({
      url: '/pages/category/category',
      fail: (error) => {
        console.error('跳转分类页失败:', error);
        wx.showToast({
          title: '跳转失败，请重试',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 查看全部商品
  onViewAllGoods: function () {
    wx.setStorageSync('categoryType', 'all');
    wx.switchTab({
      url: '/pages/category/category',
      fail: (error) => {
        console.error('跳转分类页失败:', error);
        wx.showToast({
          title: '跳转失败，请重试',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },



  // 查看全部热门商品
  onViewAllHotGoods: function () {
    wx.setStorageSync('categoryType', 'hot');
    wx.switchTab({
      url: '/pages/category/category',
      fail: (error) => {
        console.error('跳转分类页失败:', error);
        wx.showToast({
          title: '跳转失败，请重试',
          icon: 'none',
          duration: 2000
        });
      }
    });
  }
})