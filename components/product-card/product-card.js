// product-card.js
const { addToCart } = require('../../utils/cart');

Component({
  properties: {
    product: {
      type: Object,
      value: {},
      observer: function(newVal) {
        if (newVal) {
          // 组件数据更新时的处理
        }
      }
    }
  },

  data: {
    loadedImages: {}
  },

  methods: {
    // 商品点击事件
    handleProductClick: function() {
      const { product } = this.data;
      if (product.id) {
        this.triggerEvent('productClick', { productId: product.id });
      }
    },

    // 加入购物车事件
    handleAddToCart: function(e) {
      e.stopPropagation(); // 阻止冒泡，避免触发商品点击
      const { product } = this.data;
      
      if (product.stock <= 0) {
        wx.showToast({
          title: '库存不足',
          icon: 'none',
          duration: 1500
        });
        return;
      }

      wx.showLoading({
        title: '添加中...',
        mask: true
      });

      addToCart({
        productId: product.id,
        quantity: 1
      }).then(success => {
        wx.hideLoading();
        if (success) {
          wx.showToast({
            title: '已添加到购物车',
            icon: 'success',
            duration: 1000
          });
          this.triggerEvent('addToCart', { productId: product.id });
        }
      });
    },

    // 立即购买事件
    handleBuyNow: function(e) {
      e.stopPropagation(); // 阻止冒泡，避免触发商品点击
      const { product } = this.data;
      
      if (product.stock <= 0) {
        wx.showToast({
          title: '库存不足',
          icon: 'none',
          duration: 1500
        });
        return;
      }

      this.triggerEvent('buyNow', { productId: product.id });
    },

    // 图片加载完成事件
    handleImageLoad: function(e) {
      const key = e.target.dataset.key;
      if (key) {
        const loadedImages = { ...this.data.loadedImages };
        loadedImages[key] = true;
        this.setData({ loadedImages });
      }
    },

    // 图片加载失败事件
    handleImageError: function(e) {
      const key = e.target.dataset.key;
      console.log('图片加载失败:', key);
      // 可以设置默认图片
    }
  }
});