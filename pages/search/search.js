// search.js
const { api, handleApiError } = require('../../utils/api');

Page({
  data: {
    searchKeyword: '',
    searchHistory: [],
    hotKeywords: [],
    searchResults: [],
    searchSuggestions: [],
    hasSearched: false,
    showSuggestions: false,
    loading: false,
    debounceTimer: null
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
    // 加载热门搜索
    this.loadHotKeywords();
  },

  // 加载搜索历史
  loadSearchHistory: function () {
    const history = wx.getStorageSync('searchHistory') || [];
    this.setData({ searchHistory: history });
  },

  // 加载热门搜索关键词
  loadHotKeywords: async function () {
    try {
      const hotKeywords = await api.search.getHotKeywords();
      this.setData({ hotKeywords: hotKeywords || [] });
    } catch (error) {
      console.error('加载热门搜索失败:', error);
      this.setData({ hotKeywords: [] });
    }
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

  // 搜索输入事件（带防抖）
  onSearchInput: function (e) {
    const keyword = e.detail.value;
    this.setData({ searchKeyword: keyword });
    
    // 清除之前的定时器
    if (this.data.debounceTimer) {
      clearTimeout(this.data.debounceTimer);
    }
    
    // 设置新的定时器
    const timer = setTimeout(() => {
      if (keyword.trim()) {
        this.getSearchSuggestions(keyword);
      } else {
        this.setData({ showSuggestions: false, searchSuggestions: [] });
      }
    }, 300);
    
    this.setData({ debounceTimer: timer });
  },

  // 获取搜索建议
  getSearchSuggestions: async function (keyword) {
    try {
      // 从后端获取搜索建议
      const suggestions = await api.search.getSuggestions(keyword);
      
      this.setData({
        searchSuggestions: suggestions || [],
        showSuggestions: true
      });
    } catch (error) {
      console.error('获取搜索建议失败:', error);
      // 如果获取失败，隐藏搜索建议
      this.setData({
        searchSuggestions: [],
        showSuggestions: false
      });
    }
  },

  // 搜索提交事件
  onSearch: async function () {
    const keyword = this.data.searchKeyword.trim();
    if (!keyword) {
      wx.showToast({
        title: '请输入搜索关键词',
        icon: 'none',
        duration: 1500
      });
      return;
    }

    this.setData({ loading: true, showSuggestions: false });
    
    // 保存搜索历史
    this.saveSearchHistory(keyword);
    
    try {
      // 调用搜索API
      const results = await api.product.search(keyword);
      console.log('搜索结果:', results);
      
      this.setData({
        searchResults: results || [],
        hasSearched: true,
        loading: false
      });
    } catch (error) {
      handleApiError(error);
      this.setData({ 
        loading: false,
        searchResults: [],
        hasSearched: true
      });
    }
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

  // 点击搜索建议
  onSuggestionClick: function (e) {
    const keyword = e.currentTarget.dataset.text;
    this.setData({ 
      searchKeyword: keyword,
      showSuggestions: false 
    });
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
  onAddToCart: async function (e) {
    const goodsId = e.currentTarget.dataset.id;
    console.log('添加到购物车:', goodsId);
    
    try {
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
      
      // 调用真实API添加到购物车
      await api.cart.add(cartData);
      
      wx.hideLoading();
      
      // 显示成功提示
      wx.showToast({
        title: '已加入购物车',
        icon: 'success',
        duration: 1500
      });
    } catch (error) {
      wx.hideLoading();
      console.error('添加到购物车失败:', error);
      handleApiError(error);
    }
  },

  // 点击空白区域关闭搜索建议
  onTapOutside: function () {
    this.setData({ showSuggestions: false });
  }
})