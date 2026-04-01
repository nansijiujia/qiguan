// detail.js
const { api, handleApiError } = require('../../utils/api');

Page({
  data: {
    // 商品信息
    productInfo: {
      id: 1,
      title: '高级按摩器 多频振动 静音设计',
      subtitle: '采用优质硅胶材质，10种振动模式，IPX7防水，静音设计，舒适体验',
      price: 299,
      originalPrice: 399,
      discount: 7.5,
      sales: 12580,

      stock: 156,
      isNew: true,
      isHot: true,
      brand: '绮梦之约'
    },
    // 规格组
    specGroups: [
      {
        id: 1,
        name: '颜色',
        options: [
          { id: 1, name: '粉色' },
          { id: 2, name: '蓝色' },
          { id: 3, name: '紫色' }
        ]
      },
      {
        id: 2,
        name: '尺寸',
        options: [
          { id: 4, name: '标准款' },
          { id: 5, name: '加大款' }
        ]
      }
    ],
    // 规格组合价格和库存
    specCombination: {
      '1-4': { price: 299, stock: 100 },
      '1-5': { price: 349, stock: 50 },
      '2-4': { price: 319, stock: 80 },
      '2-5': { price: 369, stock: 40 },
      '3-4': { price: 329, stock: 70 },
      '3-5': { price: 379, stock: 30 }
    },
    // 选中的规格
    selectedSpecs: {
      1: 1,
      2: 4
    },
    // 购买数量
    quantity: 1,
    // 收藏状态
    isFavorite: false,
    // 加载状态
    loading: false,
    // 当前选中规格的库存
    currentStock: 100,
    // 库存提示
    stockTip: ''
  },

  onLoad: function (options) {
    console.log('详情页加载');
    // 验证并绑定商品ID
    if (options.id) {
      const goodsId = parseInt(options.id);
      if (!isNaN(goodsId) && goodsId > 0) {
        this.data.productInfo.id = goodsId;
        console.log('商品ID绑定成功:', goodsId);
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
        return;
      }
    }
    this.loadGoodsData();
  },

  onShow: function () {
    console.log('详情页显示');
  },

  // 加载商品数据
  loadGoodsData: async function () {
    this.setData({ loading: true });
    try {
      // 尝试从本地缓存加载
      const cachedData = this.loadFromCache();
      if (cachedData) {
        this.setData({
          productInfo: cachedData.productInfo,
          specGroups: cachedData.specGroups || [],
          isFavorite: cachedData.isFavorite || false,
          loading: false
        });
      }
      
      // 采用正向传输方式，从后端获取商品详情
      const [productData, favoriteStatus] = await Promise.all([
        api.product.getDetail(this.data.productInfo.id),
        api.favorite.check(this.data.productInfo.id)
      ]);
      
      // 更新商品信息
      this.setData({
        productInfo: productData,
        specGroups: productData.specs || [],
        isFavorite: favoriteStatus.isFavorite || false,
        loading: false
      });
      
      // 缓存数据到本地
      this.saveToCache({
        productInfo: productData,
        specGroups: productData.specs || [],
        isFavorite: favoriteStatus.isFavorite || false
      });
    } catch (error) {
      handleApiError(error);
      this.setData({ loading: false });
    }
  },
  
  // 从本地缓存加载数据
  loadFromCache: function () {
    try {
      const cacheKey = `product_${this.data.productInfo.id}`;
      const cachedData = wx.getStorageSync(cacheKey);
      if (cachedData && Date.now() < cachedData.expiry) {
        return cachedData;
      }
    } catch (error) {
      console.error('加载缓存失败:', error);
    }
    return null;
  },
  
  // 保存数据到本地缓存
  saveToCache: function (data) {
    try {
      const cacheKey = `product_${this.data.productInfo.id}`;
      wx.setStorageSync(cacheKey, {
        ...data,
        expiry: Date.now() + 10 * 60 * 1000 // 10分钟缓存
      });
    } catch (error) {
      console.error('保存缓存失败:', error);
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
      if (stock <= 0) {
        stockTip = '库存不足';
      } else if (stock < 10) {
        stockTip = `仅剩${stock}件`;
      } else if (stock < 50) {
        stockTip = '库存紧张';
      }
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
      
      // 构建添加到购物车的数据
      const cartData = {
        productId: productInfo.id,
        quantity: quantity,
        specs: selectedSpecs
      };
      
      // 采用正向传输方式，向后端添加到购物车
      await api.cart.add(cartData);
      
      wx.showToast({
        title: '已添加到购物车',
        icon: 'success',
        duration: 1000
      });
    } catch (error) {
      handleApiError(error);
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
      
      // 跳转到订单确认页面
      wx.navigateTo({
        url: `/pages/order/confirm?id=${orderResult.id}`
      });
    } catch (error) {
      handleApiError(error);
    }
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
      imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=modern%20sex%20toy%20product%20elegant%20design%20white%20background&image_size=square'
    };
  },

  // 分享商品到朋友圈
  onShareTimeline: function () {
    const { productInfo } = this.data;
    return {
      title: productInfo.title,
      imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=modern%20sex%20toy%20product%20elegant%20design%20white%20background&image_size=square'
    };
  }
})