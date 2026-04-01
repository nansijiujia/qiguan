// category.js
const { api, handleApiError } = require('../../utils/api');

Page({
  data: {
    // 分类数据
    categories: [],
    // 子分类数据
    subcategories: [
      { id: 1, name: '全部商品' },
      { id: 2, name: '新品上市' },
      { id: 3, name: '热卖爆款' },
      { id: 4, name: '限时特惠' },
      { id: 5, name: '好评推荐' }
    ],
    // 商品数据
    products: [],
    // 状态数据
    activeCategoryId: 1,
    activeSubcategoryId: 1,
    activeSort: 'default',
    searchKeyword: '',
    loading: false,
    // 错误状态
    error: false,
    errorMessage: '',
    // 分页数据
    page: 1,
    pageSize: 10,
    hasMore: true,
    // 防抖定时器
    debounceTimer: null,
    // 骨架屏状态
    showSkeleton: true
  },

  onLoad: function (options) {
    console.log('分类页加载');
    this.loadCategoryData();
    
    // 如果从其他页面传入分类ID，则激活对应分类
    if (options.id) {
      this.setData({ activeCategoryId: parseInt(options.id) });
    }
  },

  onShow: function () {
    console.log('分类页显示');
    // 更新全局tabBar索引
    const app = getApp();
    app.globalData.currentTabIndex = 1;
  },

  // 加载分类数据
  loadCategoryData: function () {
    this.setData({ loading: true, error: false });
    
    // 先尝试从缓存获取数据
    const cachedCategories = wx.getStorageSync('categories');
    const cachedTime = wx.getStorageSync('categories_timestamp');
    const now = Date.now();
    
    // 如果缓存存在且未过期（10分钟）
    if (cachedCategories && cachedTime && (now - cachedTime < 10 * 60 * 1000)) {
      console.log('使用缓存的分类数据');
      this.setData({
        categories: cachedCategories,
        loading: false,
        showSkeleton: false
      });
      // 加载对应分类的商品
      this.loadCategoryProducts(this.data.activeCategoryId);
      return;
    }
    
    // 调用API获取分类数据
    api.category.getList()
      .then(res => {
        console.log('分类数据获取成功:', res);
        // 处理响应数据
        const categories = res.data || res || [];
        this.setData({
          categories: categories,
          loading: false,
          showSkeleton: false
        });
        
        // 缓存分类数据
        wx.setStorageSync('categories', categories);
        wx.setStorageSync('categories_timestamp', now);
        
        // 加载对应分类的商品
        this.loadCategoryProducts(this.data.activeCategoryId);
      })
      .catch(error => {
        console.error('分类数据获取失败:', error);
        this.setData({
          loading: false,
          error: true,
          errorMessage: error.message || '分类数据加载失败',
          showSkeleton: false
        });
        // 显示错误提示
        handleApiError(error);
        
        // 如果有缓存，使用缓存数据
        if (cachedCategories) {
          console.log('使用缓存的分类数据');
          this.setData({
            categories: cachedCategories,
            error: false,
            showSkeleton: false
          });
          // 加载对应分类的商品
          this.loadCategoryProducts(this.data.activeCategoryId);
        }
      });
  },

  // 加载分类商品
  loadCategoryProducts: function (categoryId, isLoadMore = false) {
    if (this.data.loading || (!isLoadMore && !this.data.hasMore)) {
      return;
    }
    
    this.setData({ loading: true, error: false });
    
    // 构建请求参数
    const params = {
      subcategoryId: this.data.activeSubcategoryId,
      sort: this.data.activeSort,
      page: isLoadMore ? this.data.page + 1 : 1,
      pageSize: this.data.pageSize
    };
    
    // 调用API获取分类商品
    api.category.getProducts(categoryId, params)
      .then(res => {
        console.log('分类商品获取成功:', res);
        // 处理响应数据
        const products = res.data || res || [];
        const newPage = isLoadMore ? this.data.page + 1 : 1;
        const newProducts = isLoadMore ? [...this.data.products, ...products] : products;
        
        this.setData({
          products: newProducts,
          loading: false,
          page: newPage,
          hasMore: products.length === this.data.pageSize
        });
      })
      .catch(error => {
        console.error('分类商品获取失败:', error);
        this.setData({
          loading: false,
          error: true,
          errorMessage: error.message || '商品数据加载失败'
        });
        // 显示错误提示
        handleApiError(error);
      });
  },

  // 分类切换事件
  onCategoryChange: function (e) {
    const categoryId = e.currentTarget.dataset.id;
    console.log('切换分类:', categoryId);
    // 重置分页参数
    this.setData({ 
      activeCategoryId: categoryId,
      page: 1,
      hasMore: true
    });
    // 加载对应分类的商品
    this.loadCategoryProducts(categoryId);
  },

  // 子分类切换事件
  onSubcategoryChange: function (e) {
    const subcategoryId = e.currentTarget.dataset.id;
    console.log('切换子分类:', subcategoryId);
    // 重置分页参数
    this.setData({ 
      activeSubcategoryId: subcategoryId,
      page: 1,
      hasMore: true
    });
    // 加载对应子分类的商品
    this.loadCategoryProducts(this.data.activeCategoryId);
  },

  // 排序切换事件
  onSortChange: function (e) {
    const sort = e.currentTarget.dataset.sort;
    console.log('切换排序:', sort);
    // 重置分页参数
    this.setData({ 
      activeSort: sort,
      page: 1,
      hasMore: true
    });
    // 根据排序方式重新加载商品
    this.loadCategoryProducts(this.data.activeCategoryId);
  },

  // 商品点击事件
  onProductClick: function (e) {
    const productId = e.currentTarget.dataset.id;
    console.log('点击商品:', productId);
    // 跳转到商品详情页面
    wx.navigateTo({
      url: `/pages/detail/detail?id=${productId}`
    });
  },

  // 添加到购物车
  onAddToCart: function (e) {
    const productId = e.currentTarget.dataset.id;
    console.log('添加到购物车:', productId);
    // 购物车逻辑
    wx.showToast({
      title: '已添加到购物车',
      icon: 'success',
      duration: 1000
    });
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
    }
  },

  // 重试加载数据
  retryLoadData: function () {
    this.loadCategoryData();
  },

  // 下拉刷新
  onPullDownRefresh: function () {
    console.log('下拉刷新');
    // 清除缓存，强制重新加载数据
    wx.removeStorageSync('categories');
    wx.removeStorageSync('categories_timestamp');
    // 重置分页参数
    this.setData({ 
      page: 1,
      hasMore: true
    });
    // 重新加载分类数据
    this.loadCategoryData();
    // 停止下拉刷新
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 1000);
  },

  // 触底加载更多
  onReachBottom: function () {
    if (this.data.hasMore && !this.data.loading) {
      console.log('触底加载更多');
      this.loadCategoryProducts(this.data.activeCategoryId, true);
    }
  },

  // 搜索输入事件（防抖处理）
  onSearchInput: function (e) {
    const keyword = e.detail.value;
    
    // 清除之前的定时器
    if (this.data.debounceTimer) {
      clearTimeout(this.data.debounceTimer);
    }
    
    // 设置新的定时器
    const timer = setTimeout(() => {
      this.setData({ searchKeyword: keyword });
    }, 300);
    
    this.setData({ debounceTimer: timer });
  }
})