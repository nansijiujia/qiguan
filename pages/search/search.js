// search.js
const { api, handleApiError } = require('../../utils/api');

Page({
  data: {
    searchKeyword: '',
    searchHistory: [],
    hotKeywords: [
      '按摩器',
      '性感内衣',
      '润滑液',
      '避孕套',
      '延时喷剂',
      '情趣用品',
      '振动器',
      '按摩油'
    ],
    searchResults: [],
    hasSearched: false,
    loading: false
  },

  onLoad: function (options) {
    console.log('搜索页面加载', options);
    // 如果从首页跳转时带了关键词，直接搜索
    if (options.keyword) {
      this.setData({ searchKeyword: options.keyword });
      this.onSearch();
    }
    // 加载搜索历史
    this.loadSearchHistory();
  },

  // 加载搜索历史
  loadSearchHistory: function () {
    const history = wx.getStorageSync('searchHistory') || [];
    this.setData({ searchHistory: history });
  },

  // 保存搜索历史
  saveSearchHistory: function (keyword) {
    if (!keyword) return;
    
    let history = wx.getStorageSync('searchHistory') || [];
    // 移除重复项
    history = history.filter(item => item !== keyword);
    // 添加到开头
    history.unshift(keyword);
    // 限制历史记录数量
    if (history.length > 10) {
      history = history.slice(0, 10);
    }
    // 保存到本地存储
    wx.setStorageSync('searchHistory', history);
    this.setData({ searchHistory: history });
  },

  // 搜索输入事件
  onSearchInput: function (e) {
    this.setData({ searchKeyword: e.detail.value });
  },

  // 搜索提交事件
  onSearch: function () {
    const keyword = this.data.searchKeyword.trim();
    if (!keyword) {
      wx.showToast({
        title: '请输入搜索关键词',
        icon: 'none',
        duration: 1500
      });
      return;
    }

    this.setData({ loading: true });
    
    // 保存搜索历史
    this.saveSearchHistory(keyword);
    
    // 调用搜索API
    api.product.search(keyword)
      .then(res => {
        console.log('搜索结果:', res);
        // 模拟搜索结果数据
        const mockResults = [
          {
            id: 1,
            name: '高级按摩器 多频振动 静音设计',
            price: 299,
            originalPrice: 399,
            image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=modern%20sex%20toy%20product%20elegant%20design%20white%20background%20minimalist&image_size=square',
            isNew: true
          },
          {
            id: 2,
            name: '多频振动器 静音设计',
            price: 259,
            originalPrice: 359,
            image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=sex%20toy%20vibrator%20product%20elegant%20design%20white%20background&image_size=square',
            isHot: true
          },
          {
            id: 3,
            name: '仿真按摩器 硅胶材质',
            price: 399,
            originalPrice: 499,
            image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=sex%20toy%20product%20elegant%20design%20white%20background%20premium&image_size=square',
            isBestseller: true
          }
        ];
        
        this.setData({
          searchResults: mockResults,
          hasSearched: true,
          loading: false
        });
      })
      .catch(error => {
        handleApiError(error);
        this.setData({ loading: false });
      });
  },

  // 取消搜索
  onCancel: function () {
    wx.navigateBack();
  },

  // 点击历史记录项
  onHistoryItemClick: function (e) {
    const keyword = e.currentTarget.dataset.text || e.currentTarget.textContent;
    this.setData({ searchKeyword: keyword });
    this.onSearch();
  },

  // 点击热门搜索项
  onHotItemClick: function (e) {
    const keyword = e.currentTarget.dataset.text || e.currentTarget.textContent;
    this.setData({ searchKeyword: keyword });
    this.onSearch();
  },

  // 清除搜索历史
  onClearHistory: function () {
    wx.setStorageSync('searchHistory', []);
    this.setData({ searchHistory: [] });
    wx.showToast({
      title: '搜索历史已清除',
      icon: 'success',
      duration: 1500
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
    // 购物车逻辑
    wx.showToast({
      title: '已加入购物车',
      icon: 'success',
      duration: 1500
    });
  }
})