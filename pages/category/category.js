// category.js
const { api, handleApiError } = require('../../utils/api');

Page({
  data: {
    categories: [],
    subcategories: [],
    products: [],
    activeCategoryId: null,
    activeSubcategoryId: null,
    activeSort: 'default',
    searchKeyword: '',
    loading: false,
    error: false,
    errorMessage: '',
    page: 1,
    pageSize: 10,
    hasMore: true,
    debounceTimer: null,
    showSkeleton: true
  },

  onLoad: function (options) {
    console.log('分类页加载');
    if (options.id) {
      this.setData({ activeCategoryId: parseInt(options.id) });
    }
    this.loadCategoryData();
  },

  onShow: function () {
    console.log('分类页显示');
    const app = getApp();
    app.globalData.currentTabIndex = 1;
    
    const selectedCategoryId = wx.getStorageSync('selectedCategoryId');
    const categoryType = wx.getStorageSync('categoryType');
    
    if (selectedCategoryId) {
      console.log('从其他页面传递的分类ID:', selectedCategoryId);
      this.setData({ activeCategoryId: parseInt(selectedCategoryId) });
      wx.removeStorageSync('selectedCategoryId');
      if (this.data.categories.length > 0) {
        this.loadCategoryProducts(parseInt(selectedCategoryId));
      }
    } else if (categoryType) {
      console.log('从其他页面传递的分类类型:', categoryType);
      wx.removeStorageSync('categoryType');
      if (categoryType === 'all') {
        this.setData({ activeSubcategoryId: 1 });
      } else if (categoryType === 'hot') {
        this.setData({ activeSubcategoryId: 3 });
      }
      if (this.data.activeCategoryId) {
        this.loadCategoryProducts(this.data.activeCategoryId);
      }
    }
  },

  loadCategoryData: function () {
    this.setData({ loading: true, error: false });
    
    const cachedCategories = wx.getStorageSync('categories');
    const cachedTime = wx.getStorageSync('categories_timestamp');
    const now = Date.now();
    
    if (cachedCategories && cachedTime && (now - cachedTime < 10 * 60 * 1000)) {
      console.log('使用缓存的分类数据');
      this.processCategoryData(cachedCategories);
      return;
    }
    
    api.category.getList()
      .then(res => {
        console.log('分类数据获取成功:', res);
        const categories = res.data || res || [];
        wx.setStorageSync('categories', categories);
        wx.setStorageSync('categories_timestamp', now);
        this.processCategoryData(categories);
      })
      .catch(error => {
        console.error('分类数据获取失败:', error);
        this.setData({
          loading: false,
          error: true,
          errorMessage: error.message || '分类数据加载失败',
          showSkeleton: false
        });
        handleApiError(error);
        
        if (cachedCategories) {
          console.log('使用缓存的分类数据');
          this.processCategoryData(cachedCategories);
        }
      });
  },

  processCategoryData: function (categories) {
    const defaultSubcategories = [
      { id: null, name: '全部商品' },
      { id: 'new', name: '新品上市' },
      { id: 'hot', name: '热卖爆款' },
      { id: 'sale', name: '限时特惠' },
      { id: 'recommend', name: '好评推荐' }
    ];
    
    let activeCategoryId = this.data.activeCategoryId;
    let subcategories = defaultSubcategories;
    
    if (categories && categories.length > 0) {
      if (!activeCategoryId) {
        activeCategoryId = categories[0].id;
      }
      
      const activeCategory = categories.find(c => c.id === activeCategoryId);
      if (activeCategory && activeCategory.children && activeCategory.children.length > 0) {
        subcategories = [
          { id: null, name: '全部' },
          ...activeCategory.children.map(child => ({
            id: child.id,
            name: child.name
          }))
        ];
      }
    }
    
    this.setData({
      categories: categories,
      subcategories: subcategories,
      activeCategoryId: activeCategoryId,
      loading: false,
      showSkeleton: false
    });
    
    if (activeCategoryId) {
      this.loadCategoryProducts(activeCategoryId);
    }
  },

  loadCategoryProducts: function (categoryId, isLoadMore = false) {
    if (!categoryId || this.data.loading || (!isLoadMore && !this.data.hasMore)) {
      return;
    }
    
    this.setData({ loading: true, error: false });
    
    const params = {
      subcategoryId: this.data.activeSubcategoryId,
      sort: this.data.activeSort,
      page: isLoadMore ? this.data.page + 1 : 1,
      pageSize: this.data.pageSize
    };
    
    api.category.getProducts(categoryId, params)
      .then(res => {
        console.log('分类商品获取成功:', res);
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
        handleApiError(error);
      });
  },

  onCategoryChange: function (e) {
    const categoryId = e.currentTarget.dataset.id;
    console.log('切换分类:', categoryId);
    
    const activeCategory = this.data.categories.find(c => c.id === categoryId);
    let subcategories = [
      { id: null, name: '全部商品' },
      { id: 'new', name: '新品上市' },
      { id: 'hot', name: '热卖爆款' },
      { id: 'sale', name: '限时特惠' },
      { id: 'recommend', name: '好评推荐' }
    ];
    
    if (activeCategory && activeCategory.children && activeCategory.children.length > 0) {
      subcategories = [
        { id: null, name: '全部' },
        ...activeCategory.children.map(child => ({
          id: child.id,
          name: child.name
        }))
      ];
    }
    
    this.setData({ 
      activeCategoryId: categoryId,
      activeSubcategoryId: null,
      subcategories: subcategories,
      page: 1,
      hasMore: true,
      products: []
    });
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
  onAddToCart: async function (e) {
    const productId = e.currentTarget.dataset.id;
    console.log('添加到购物车:', productId);
    
    try {
      // 显示加载动画
      wx.showLoading({
        title: '添加中...',
        mask: true
      });
      
      // 构建添加到购物车的数据
      const cartData = {
        productId: productId,
        quantity: 1
      };
      
      // 调用真实API添加到购物车
      await api.cart.add(cartData);
      
      wx.hideLoading();
      
      // 显示成功提示
      wx.showToast({
        title: '已添加到购物车',
        icon: 'success',
        duration: 1000
      });
    } catch (error) {
      wx.hideLoading();
      console.error('添加到购物车失败:', error);
      handleApiError(error);
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