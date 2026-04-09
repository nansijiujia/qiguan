// product-list.js
const { api, handleApiError } = require('../../utils/api');

Page({
  data: {
    // 商品数据
    products: [],
    // 筛选条件
    filters: {
      categoryId: 0,
      subcategoryId: 0,
      priceRange: {
        min: 0,
        max: 99999
      },
      sortBy: 'default', // default, price_asc, price_desc, sales, new
      attributes: {}
    },
    // 分页数据
    pagination: {
      page: 1,
      pageSize: 10,
      hasMore: true
    },
    // 状态数据
    loading: false,
    refreshing: false,
    showFilter: false,
    showPriceRange: false,
    // 分类数据
    categories: [],
    subcategories: [],
    // 价格区间选项
    priceRanges: [
      { label: '全部价格', min: 0, max: 99999 },
      { label: '0-99元', min: 0, max: 99 },
      { label: '100-299元', min: 100, max: 299 },
      { label: '300-599元', min: 300, max: 599 },
      { label: '600元以上', min: 600, max: 99999 }
    ],
    // 排序选项
    sortOptions: [
      { value: 'default', label: '综合排序' },
      { value: 'sales', label: '销量优先' },
      { value: 'price_asc', label: '价格从低到高' },
      { value: 'price_desc', label: '价格从高到低' },
      { value: 'new', label: '新品优先' }
    ]
  },

  onLoad: function (options) {
    console.log('商品列表页加载', options);
    // 处理传入的参数
    if (options.categoryId) {
      this.setData({ 'filters.categoryId': parseInt(options.categoryId) });
    }
    if (options.subcategoryId) {
      this.setData({ 'filters.subcategoryId': parseInt(options.subcategoryId) });
    }
    if (options.sortBy) {
      this.setData({ 'filters.sortBy': options.sortBy });
    }
    // 加载分类数据
    this.loadCategoryData();
    // 加载商品数据
    this.loadProducts();
  },

  onShow: function () {
    console.log('商品列表页显示');
  },

  // 加载分类数据
  loadCategoryData: function () {
    // 先尝试从缓存获取
    const cachedCategories = wx.getStorageSync('categories');
    const cachedTime = wx.getStorageSync('categories_timestamp');
    const now = Date.now();
    
    if (cachedCategories && cachedTime && (now - cachedTime < 10 * 60 * 1000)) {
      console.log('使用缓存的分类数据');
      this.setData({ categories: cachedCategories });
      return;
    }
    
    // 调用API获取分类数据
    api.category.getList()
      .then(res => {
        console.log('分类数据获取成功:', res);
        const categories = res.data || res || [];
        this.setData({ categories });
        
        // 缓存分类数据
        wx.setStorageSync('categories', categories);
        wx.setStorageSync('categories_timestamp', now);
      })
      .catch(error => {
        console.error('分类数据获取失败:', error);
        handleApiError(error);
      });
  },

  // 加载商品数据
  loadProducts: function (isLoadMore = false) {
    if (this.data.loading || (!isLoadMore && !this.data.pagination.hasMore)) {
      return;
    }
    
    this.setData({ loading: true });
    
    // 构建请求参数
    const params = {
      page: isLoadMore ? this.data.pagination.page + 1 : 1,
      pageSize: this.data.pagination.pageSize,
      sort: this.data.filters.sortBy,
      categoryId: this.data.filters.categoryId,
      subcategoryId: this.data.filters.subcategoryId,
      minPrice: this.data.filters.priceRange.min,
      maxPrice: this.data.filters.priceRange.max
    };
    
    // 添加属性筛选参数
    if (Object.keys(this.data.filters.attributes).length > 0) {
      params.attributes = this.data.filters.attributes;
    }
    
    // 调用API获取商品列表
    api.product.getList(params)
      .then(res => {
        console.log('商品数据获取成功:', res);
        const products = res.data || res || [];
        const newPage = isLoadMore ? this.data.pagination.page + 1 : 1;
        const newProducts = isLoadMore ? [...this.data.products, ...products] : products;
        
        this.setData({
          products: newProducts,
          loading: false,
          refreshing: false,
          'pagination.page': newPage,
          'pagination.hasMore': products.length === this.data.pagination.pageSize
        });
      })
      .catch(error => {
        console.error('商品数据获取失败:', error);
        this.setData({ loading: false, refreshing: false });
        handleApiError(error);
      });
  },

  // 分类切换
  onCategoryChange: function (e) {
    const categoryId = e.currentTarget.dataset.id;
    console.log('切换分类:', categoryId);
    this.setData({
      'filters.categoryId': categoryId,
      'filters.subcategoryId': 0,
      'pagination.page': 1,
      'pagination.hasMore': true
    });
    this.loadProducts();
  },

  // 子分类切换
  onSubcategoryChange: function (e) {
    const subcategoryId = e.currentTarget.dataset.id;
    console.log('切换子分类:', subcategoryId);
    this.setData({
      'filters.subcategoryId': subcategoryId,
      'pagination.page': 1,
      'pagination.hasMore': true
    });
    this.loadProducts();
  },

  // 排序切换
  onSortChange: function (e) {
    const sortBy = e.currentTarget.dataset.sort;
    console.log('切换排序:', sortBy);
    this.setData({
      'filters.sortBy': sortBy,
      'pagination.page': 1,
      'pagination.hasMore': true
    });
    this.loadProducts();
  },

  // 价格区间选择
  onPriceRangeChange: function (e) {
    const priceRange = e.currentTarget.dataset.range;
    console.log('选择价格区间:', priceRange);
    this.setData({
      'filters.priceRange': priceRange,
      'pagination.page': 1,
      'pagination.hasMore': true,
      showPriceRange: false
    });
    this.loadProducts();
  },

  // 属性筛选
  onAttributeChange: function (e) {
    const { attributeId, valueId } = e.currentTarget.dataset;
    console.log('选择属性:', attributeId, valueId);
    
    const attributes = { ...this.data.filters.attributes };
    if (attributes[attributeId] === valueId) {
      delete attributes[attributeId];
    } else {
      attributes[attributeId] = valueId;
    }
    
    this.setData({
      'filters.attributes': attributes,
      'pagination.page': 1,
      'pagination.hasMore': true
    });
    this.loadProducts();
  },

  // 重置筛选
  onResetFilter: function () {
    console.log('重置筛选');
    this.setData({
      filters: {
        categoryId: 0,
        subcategoryId: 0,
        priceRange: {
          min: 0,
          max: 99999
        },
        sortBy: 'default',
        attributes: {}
      },
      'pagination.page': 1,
      'pagination.hasMore': true
    });
    this.loadProducts();
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

  // 下拉刷新
  onPullDownRefresh: function () {
    console.log('下拉刷新');
    this.setData({
      refreshing: true,
      'pagination.page': 1,
      'pagination.hasMore': true
    });
    this.loadProducts();
    // 停止下拉刷新
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 1000);
  },

  // 触底加载更多
  onReachBottom: function () {
    if (this.data.pagination.hasMore && !this.data.loading) {
      console.log('触底加载更多');
      this.loadProducts(true);
    }
  },

  // 显示/隐藏筛选面板
  toggleFilter: function () {
    this.setData({ showFilter: !this.data.showFilter });
  },

  // 显示/隐藏价格区间选择
  togglePriceRange: function () {
    this.setData({ showPriceRange: !this.data.showPriceRange });
  }
})
