// detail.js
const { api, handleApiError } = require('../../utils/api');
const { saveToCache, loadFromCache, CACHE_CONFIG } = require('../../utils/cache');
const { preloadImages } = require('../../utils/image');
const { addToCart } = require('../../utils/cart');
const { checkStock } = require('../../utils/stock');

Page({
  data: {
    productInfo: null,
    specGroups: [],
    specCombination: {},
    selectedSpecs: {},
    quantity: 1,
    isFavorite: false,
    loading: true,
    currentStock: 0,
    stockTip: '',
    productId: null
  },

  onLoad: function (options) {
    console.log('详情页加载');
    if (options.id) {
      const goodsId = parseInt(options.id);
      if (!isNaN(goodsId) && goodsId > 0) {
        this.setData({ productId: goodsId });
        console.log('商品ID绑定成功:', goodsId);
        this.loadGoodsData();
      } else {
        console.error('无效的商品ID:', options.id);
        wx.showToast({
          title: '商品不存在',
          icon: 'none',
          duration: 2000
        });
        setTimeout(() => {
          wx.navigateBack();
        }, 2000);
      }
    } else {
      wx.showToast({
        title: '商品不存在',
        icon: 'none',
        duration: 2000
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 2000);
    }
  },

  onShow: function () {
    console.log('详情页显示');
  },

  loadGoodsData: async function () {
    const productId = this.data.productId;
    if (!productId) return;
    
    this.setData({ loading: true });
    try {
      wx.showLoading({
        title: '加载中...',
        mask: true
      });
      
      const cachedData = this.loadFromCache();
      if (cachedData) {
        this.setData({
          productInfo: cachedData.productInfo,
          specGroups: cachedData.specGroups || [],
          specCombination: cachedData.specCombination || {},
          isFavorite: cachedData.isFavorite || false,
          currentStock: cachedData.productInfo?.stock || 0
        });
        this.preloadImages(cachedData.productInfo.images || []);
      }
      
      const [productData, favoriteStatus] = await Promise.all([
        api.product.getDetail(productId),
        api.favorite.check(productId).catch(() => ({ isFavorite: false }))
      ]);
      
      const stockInfo = checkStock(productData.stock || 0);
      let currentStock = stockInfo.stock;
      let stockTip = stockInfo.stockTip;
      
      this.setData({
        productInfo: productData,
        specGroups: productData.specs || [],
        specCombination: productData.specCombination || {},
        isFavorite: favoriteStatus.isFavorite || false,
        currentStock: currentStock,
        stockTip: stockTip
      });
      
      this.preloadImages(productData.images || []);
      
      this.saveToCache({
        productInfo: productData,
        specGroups: productData.specs || [],
        specCombination: productData.specCombination || {},
        isFavorite: favoriteStatus.isFavorite || false
      });
    } catch (error) {
      console.error('加载商品数据失败:', error);
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none',
        duration: 2000
      });
    } finally {
      this.setData({ loading: false });
      wx.hideLoading();
    }
  },
  
  loadFromCache: function () {
    try {
      const cacheKey = `product_${this.data.productId}`;
      const cachedData = loadFromCache(cacheKey);
      return cachedData;
    } catch (error) {
      console.error('加载缓存失败:', error);
    }
    return null;
  },
  
  saveToCache: function (data) {
    try {
      const cacheKey = `product_${this.data.productId}`;
      saveToCache(cacheKey, data, CACHE_CONFIG.productExpiry);
    } catch (error) {
      console.error('保存缓存失败:', error);
    }
  },
  
  // 预加载图片
  preloadImages: function (images) {
    if (Array.isArray(images) && images.length > 0) {
      images.forEach(image => {
        wx.getImageInfo({ url: image });
      });
    }
  },

  // 规格选择事件
  onSpecSelect: function (e) {
    const groupId = e.currentTarget.dataset.groupId;
    const optionId = e.currentTarget.dataset.optionId;
    console.log('选择规格:', groupId, optionId);
    
    const selectedSpecs = { ...this.data.selectedSpecs };
    selectedSpecs[groupId] = optionId;
    
    // 计算规格组合键
    const specKeys = Object.keys(selectedSpecs).sort().map(key => selectedSpecs[key]);
    const specKey = specKeys.join('-');
    
    // 获取对应规格的价格和库存
    const combination = this.data.specCombination[specKey];
    let price = this.data.productInfo.price;
    let stock = this.data.productInfo.stock;
    let stockTip = '';
    
    if (combination) {
      price = combination.price;
      stock = combination.stock;
      
      // 生成库存提示
      const stockInfo = checkStock(stock);
      stockTip = stockInfo.stockTip;
    }
    
    // 更新商品信息和库存
    const productInfo = { ...this.data.productInfo, price };
    
    this.setData({
      selectedSpecs,
      productInfo,
      currentStock: stock,
      stockTip
    });
  },

  // 减少数量
  onDecreaseQuantity: function () {
    if (this.data.quantity > 1) {
      this.setData({ quantity: this.data.quantity - 1 });
    }
  },

  // 增加数量
  onIncreaseQuantity: function () {
    if (this.data.quantity < this.data.currentStock) {
      this.setData({ quantity: this.data.quantity + 1 });
    } else {
      wx.showToast({
        title: '已达到库存上限',
        icon: 'none',
        duration: 1500
      });
    }
  },

  // 添加到购物车
  onAddToCart: async function () {
    try {
      const { productInfo, quantity, selectedSpecs, currentStock } = this.data;
      
      // 检查库存
      if (quantity > currentStock) {
        wx.showToast({
          title: '库存不足',
          icon: 'none',
          duration: 1500
        });
        return;
      }
      
      // 显示加载动画
      wx.showLoading({
        title: '添加中...',
        mask: true
      });
      
      // 构建添加到购物车的数据
      const cartData = {
        productId: productInfo.id,
        quantity: quantity,
        specs: selectedSpecs
      };
      
      // 使用公共购物车函数添加到购物车
      const success = await addToCart(cartData);
      
      wx.hideLoading();
      
      // 显示成功动画
      if (success) {
        wx.showToast({
          title: '已添加到购物车',
          icon: 'success',
          duration: 1500
        });
        
        // 添加成功后，添加动画效果
        this.triggerAddToCartAnimation();
      }
    } catch (error) {
      wx.hideLoading();
      console.error('添加到购物车失败:', error);
      wx.showToast({
        title: '添加失败，请重试',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 立即购买
  onBuyNow: async function () {
    try {
      const { productInfo, quantity, selectedSpecs, currentStock } = this.data;
      
      // 检查库存
      if (quantity > currentStock) {
        wx.showToast({
          title: '库存不足',
          icon: 'none',
          duration: 1500
        });
        return;
      }
      
      // 显示加载动画
      wx.showLoading({
        title: '处理中...',
        mask: true
      });
      
      // 构建订单数据
      const orderData = {
        items: [{
          productId: productInfo.id,
          quantity: quantity,
          specs: selectedSpecs,
          price: productInfo.price
        }],
        totalPrice: productInfo.price * quantity,
        buyNow: true
      };
      
      // 采用正向传输方式，向后端创建订单
      const orderResult = await api.order.create(orderData);
      
      wx.hideLoading();
      
      // 跳转到订单确认页面
      wx.navigateTo({
        url: `/subpages/order/confirm/confirm?id=${orderResult.id}`,
        success: () => {
          wx.showToast({
            title: '订单创建成功',
            icon: 'success',
            duration: 1000
          });
        },
        fail: (error) => {
          console.error('跳转失败:', error);
          wx.showToast({
            title: '跳转失败，请重试',
            icon: 'none',
            duration: 2000
          });
        }
      });
    } catch (error) {
      wx.hideLoading();
      console.error('创建订单失败:', error);
      wx.showToast({
        title: '创建订单失败，请重试',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 添加到购物车动画
  triggerAddToCartAnimation: function () {
    // 这里可以实现添加到购物车的动画效果
    // 例如：商品图片飞进购物车的动画
    console.log('添加到购物车动画');
  },

  // 返回上一页
  onBack: function () {
    wx.navigateBack();
  },

  // 分享
  onShare: function () {
    console.log('分享商品');
    wx.showShareMenu({
      withShareTicket: true
    });
  },

  // 搜索
  onSearch: function () {
    console.log('搜索');
    wx.showToast({
      title: '搜索功能开发中',
      icon: 'none',
      duration: 1500
    });
  },

  // 收藏
  onFavorite: async function () {
    try {
      const { productInfo, isFavorite } = this.data;
      
      if (!isFavorite) {
        // 添加收藏
        await api.favorite.add(productInfo.id);
      } else {
        // 取消收藏
        await api.favorite.delete(productInfo.id);
      }
      
      // 更新本地状态
      this.setData({ isFavorite: !isFavorite });
      
      wx.showToast({
        title: !isFavorite ? '已添加收藏' : '已取消收藏',
        icon: 'success',
        duration: 1000
      });
    } catch (error) {
      handleApiError(error);
    }
  },

  // 首页
  onHome: function () {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  // 购物车
  onCart: function () {
    wx.switchTab({
      url: '/pages/cart/cart'
    });
  },



  // 分享商品给好友
  onShareAppMessage: function () {
    const { productInfo } = this.data;
    return {
      title: productInfo.title,
      path: '/pages/detail/detail?id=' + productInfo.id,
      imageUrl: productInfo.image || '/images/default-product.png'
    };
  },

  // 分享商品到朋友圈
  onShareTimeline: function () {
    const { productInfo } = this.data;
    return {
      title: productInfo.title,
      imageUrl: productInfo.image || '/images/default-product.png'
    };
  },


})