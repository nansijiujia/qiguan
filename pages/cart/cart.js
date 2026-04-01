// cart.js
const { api, handleApiError } = require('../../utils/api');

Page({
  data: {
    cartItems: [],
    isEditing: false,
    isAllSelected: false,
    totalPrice: 0,
    selectedCount: 0,
    hasSelectedItems: false,
    loading: false,
    lastOperation: null
  },

  onLoad: function () {
    // 页面加载时获取购物车数据
    this.loadCartData();
  },

  onShow: function () {
    // 页面显示时重新获取购物车数据
    this.loadCartData();
  },

  // 显示加载状态
  showLoading: function (message = '处理中...') {
    this.setData({ loading: true });
    wx.showLoading({
      title: message,
      mask: true
    });
  },

  // 隐藏加载状态
  hideLoading: function () {
    this.setData({ loading: false });
    wx.hideLoading();
  },

  // 保存购物车数据到本地存储
  saveCartData: function () {
    try {
      wx.setStorageSync('cartItems', this.data.cartItems);
    } catch (error) {
      console.error('保存购物车数据失败:', error);
    }
  },

  // 从后端加载购物车数据
  loadCartData: async function () {
    this.showLoading('加载购物车...');
    try {
      // 采用正向传输方式，从后端获取购物车数据
      const cartData = await api.cart.getList();
      
      console.log('购物车原始数据:', cartData);
      
      // 检查后端返回的数据格式
      const items = cartData && cartData.data ? cartData.data : (cartData && cartData.items ? cartData.items : []);
      
      if (items && items.length > 0) {
        // 验证和转换购物车商品ID
        const validatedItems = items.map(item => {
          console.log('原始商品数据:', item);
          console.log('商品ID类型:', typeof item.id);
          console.log('商品数量类型:', typeof item.quantity);
          
          const validId = parseInt(item.id);
          const validatedItem = {
            ...item,
            id: validId > 0 ? validId.toString() : item.id
          };
          
          console.log('验证后商品数据:', validatedItem);
          console.log('验证后商品ID类型:', typeof validatedItem.id);
          console.log('验证后商品数量类型:', typeof validatedItem.quantity);
          
          return validatedItem;
        });
        
        console.log('验证后的购物车数据:', validatedItems);
        this.setData({ cartItems: validatedItems });
      } else {
        // 空购物车
        console.log('空购物车');
        this.setData({ cartItems: [] });
      }
      this.updateCartStatus();
    } catch (error) {
      handleApiError(error);
      // 错误时使用本地存储作为备份
      const storedCartItems = wx.getStorageSync('cartItems');
      if (storedCartItems && storedCartItems.length > 0) {
        console.log('使用本地存储的购物车数据:', storedCartItems);
        this.setData({ cartItems: storedCartItems });
        this.updateCartStatus();
      }
    } finally {
      this.hideLoading();
    }
  },

  // 更新购物车状态（全选、合计金额、选中数量）
  updateCartStatus: function () {
    const cartItems = this.data.cartItems;
    
    // 计算全选状态
    const isAllSelected = cartItems.length > 0 && cartItems.every(item => item.selected);
    
    // 计算合计金额和选中数量
    let totalPrice = 0;
    let selectedCount = 0;
    
    cartItems.forEach(item => {
      if (item.selected) {
        totalPrice += item.price * item.quantity;
        selectedCount += item.quantity;
      }
    });
    
    this.setData({
      isAllSelected,
      totalPrice: totalPrice.toFixed(2),
      selectedCount,
      hasSelectedItems: selectedCount > 0
    });
    
    // 保存数据到本地存储
    this.saveCartData();
  },

  // 返回上一页
  onBack: function () {
    wx.navigateBack();
  },

  // 编辑模式切换
  onEdit: function () {
    this.setData({ isEditing: !this.data.isEditing });
  },

  // 选择商品
  onSelectItem: async function (e) {
    const id = e.currentTarget.dataset.id;
    const cartItems = this.data.cartItems;
    const item = cartItems.find(item => item.id === id);
    
    try {
      // 先更新本地状态，提高用户体验
      const updatedItems = cartItems.map(item => {
        if (item.id === id) {
          return { ...item, selected: !item.selected };
        }
        return item;
      });
      
      this.setData({ cartItems: updatedItems });
      this.updateCartStatus();
      
      // 采用正向传输方式，向后端更新选择状态
      const response = await api.cart.update(id, { selected: !item.selected });
      console.log('更新选择状态响应:', response);
      
      // 操作成功反馈
      wx.showToast({
        title: '选择成功',
        icon: 'success',
        duration: 500
      });
    } catch (error) {
      handleApiError(error);
      // 错误时恢复原状态
      this.loadCartData();
    }
  },

  // 全选
  onSelectAll: async function () {
    const isAllSelected = this.data.isAllSelected;
    const cartItems = this.data.cartItems;
    const newSelectedStatus = !isAllSelected;
    
    try {
      // 先更新本地状态，提高用户体验
      const updatedItems = cartItems.map(item => ({
        ...item,
        selected: newSelectedStatus
      }));
      
      this.setData({ cartItems: updatedItems });
      this.updateCartStatus();
      
      // 采用正向传输方式，批量向后端更新选择状态
      // 这里可以优化为一个批量更新接口
      await Promise.all(
        cartItems.map(item => 
          api.cart.update(item.id, { selected: newSelectedStatus })
        )
      );
      
      // 操作成功反馈
      wx.showToast({
        title: newSelectedStatus ? '全选成功' : '取消全选成功',
        icon: 'success',
        duration: 500
      });
    } catch (error) {
      handleApiError(error);
      // 错误时恢复原状态
      this.loadCartData();
    }
  },

  // 减少数量
  onDecreaseQuantity: async function (e) {
    const id = e.currentTarget.dataset.id;
    const cartItems = this.data.cartItems;
    const item = cartItems.find(item => item.id === id);
    
    try {
      if (item && item.quantity > 1) {
        const newQuantity = item.quantity - 1;
        
        // 先更新本地状态，提高用户体验
        const updatedItems = cartItems.map(item => {
          if (item.id === id) {
            return { ...item, quantity: newQuantity };
          }
          return item;
        });
        
        this.setData({ cartItems: updatedItems });
        this.updateCartStatus();
        
        // 采用正向传输方式，向后端更新数量
        const response = await api.cart.update(id, { quantity: newQuantity });
        console.log('更新数量响应:', response);
      } else if (item && item.quantity <= 1) {
        wx.showToast({
          title: '商品数量不能少于1',
          icon: 'none',
          duration: 1000
        });
      }
    } catch (error) {
      handleApiError(error);
      // 错误时恢复原状态
      this.loadCartData();
    }
  },

  // 增加数量
  onIncreaseQuantity: async function (e) {
    const id = e.currentTarget.dataset.id;
    const cartItems = this.data.cartItems;
    const item = cartItems.find(item => item.id === id);
    
    try {
      if (item && item.quantity < item.stock) {
        const newQuantity = item.quantity + 1;
        
        // 先更新本地状态，提高用户体验
        const updatedItems = cartItems.map(item => {
          if (item.id === id) {
            return { ...item, quantity: newQuantity };
          }
          return item;
        });
        
        this.setData({ cartItems: updatedItems });
        this.updateCartStatus();
        
        // 采用正向传输方式，向后端更新数量
        const response = await api.cart.update(id, { quantity: newQuantity });
        console.log('更新数量响应:', response);
      } else if (item && item.quantity >= item.stock) {
        wx.showToast({
          title: '已达到库存上限',
          icon: 'none',
          duration: 1000
        });
      }
    } catch (error) {
      handleApiError(error);
      // 错误时恢复原状态
      this.loadCartData();
    }
  },

  // 数量输入
  onQuantityInput: async function (e) {
    const id = e.currentTarget.dataset.id;
    const value = parseInt(e.detail.value) || 0;
    const cartItems = this.data.cartItems;
    const item = cartItems.find(item => item.id === id);
    
    try {
      if (item) {
        // 验证输入值，确保在有效范围内
        let newQuantity = value;
        let message = '';
        
        if (newQuantity < 1) {
          newQuantity = 1;
          message = '商品数量不能少于1';
        } else if (newQuantity > item.stock) {
          newQuantity = item.stock;
          message = '已达到库存上限';
        }
        
        // 先更新本地状态，提高用户体验
        const updatedItems = cartItems.map(item => {
          if (item.id === id) {
            return { ...item, quantity: newQuantity };
          }
          return item;
        });
        
        this.setData({ cartItems: updatedItems });
        this.updateCartStatus();
        
        // 采用正向传输方式，向后端更新数量
        const response = await api.cart.update(id, { quantity: newQuantity });
        console.log('更新数量响应:', response);
        
        if (message) {
          wx.showToast({
            title: message,
            icon: 'none',
            duration: 1000
          });
        } else {
          wx.showToast({
            title: '数量更新成功',
            icon: 'success',
            duration: 500
          });
        }
      }
    } catch (error) {
      handleApiError(error);
      // 错误时恢复原状态
      this.loadCartData();
    }
  },

  // 删除商品
  onDeleteItem: function (e) {
    const id = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个商品吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            this.showLoading('删除中...');
            
            // 采用正向传输方式，向后端删除商品
            const response = await api.cart.delete(id);
            console.log('删除商品响应:', response);
            
            // 更新本地状态
            const cartItems = this.data.cartItems;
            const updatedItems = cartItems.filter(item => item.id !== id);
            
            this.setData({ cartItems: updatedItems });
            this.updateCartStatus();
            this.hideLoading();
            
            wx.showToast({
              title: '删除成功',
              icon: 'success',
              duration: 1000
            });
          } catch (error) {
            this.hideLoading();
            handleApiError(error);
            // 错误时重新加载购物车数据
            this.loadCartData();
          }
        }
      }
    });
  },

  // 批量删除
  onBatchDelete: function () {
    const cartItems = this.data.cartItems;
    const selectedItems = cartItems.filter(item => item.selected);
    
    if (selectedItems.length === 0) {
      wx.showToast({
        title: '请选择要删除的商品',
        icon: 'none',
        duration: 1000
      });
      return;
    }
    
    wx.showModal({
      title: '批量删除',
      content: `确定要删除选中的${selectedItems.length}个商品吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            this.showLoading('删除中...');
            
            // 采用正向传输方式，批量向后端删除商品
            // 这里可以优化为一个批量删除接口
            const responses = await Promise.all(
              selectedItems.map(item => api.cart.delete(item.id))
            );
            console.log('批量删除响应:', responses);
            
            // 更新本地状态
            const updatedItems = cartItems.filter(item => !item.selected);
            
            this.setData({ cartItems: updatedItems });
            this.updateCartStatus();
            this.hideLoading();
            
            wx.showToast({
              title: '删除成功',
              icon: 'success',
              duration: 1000
            });
          } catch (error) {
            this.hideLoading();
            handleApiError(error);
            // 错误时重新加载购物车数据
            this.loadCartData();
          }
        }
      }
    });
  },

  // 规格变更
  onSpecChange: function (e) {
    const id = e.currentTarget.dataset.id;
    // 这里可以实现规格变更的逻辑，比如弹出规格选择弹窗
    wx.showToast({
      title: '规格变更功能开发中',
      icon: 'none',
      duration: 1000
    });
  },

  // 收藏商品
  onToggleFavorite: function (e) {
    const id = e.currentTarget.dataset.id;
    const cartItems = this.data.cartItems;
    
    try {
      const updatedItems = cartItems.map(item => {
        if (item.id === id) {
          return { ...item, isFavorite: !item.isFavorite };
        }
        return item;
      });
      
      this.setData({ cartItems: updatedItems });
      this.saveCartData();
      
      wx.showToast({
        title: updatedItems.find(item => item.id === id).isFavorite ? '已添加到收藏夹' : '已从收藏夹移除',
        icon: 'success',
        duration: 1000
      });
    } catch (error) {
      console.error('收藏操作失败:', error);
      wx.showToast({
        title: '操作失败，请重试',
        icon: 'none',
        duration: 1500
      });
    }
  },

  // 上移商品
  onMoveUp: function (e) {
    const id = e.currentTarget.dataset.id;
    const cartItems = this.data.cartItems;
    const index = cartItems.findIndex(item => item.id === id);
    
    try {
      if (index > 0) {
        const updatedItems = [...cartItems];
        // 交换位置
        const temp = updatedItems[index];
        updatedItems[index] = updatedItems[index - 1];
        updatedItems[index - 1] = temp;
        
        this.setData({ cartItems: updatedItems });
        this.updateCartStatus();
        
        wx.showToast({
          title: '商品已上移',
          icon: 'success',
          duration: 500
        });
      }
    } catch (error) {
      console.error('上移商品失败:', error);
      wx.showToast({
        title: '操作失败，请重试',
        icon: 'none',
        duration: 1500
      });
    }
  },

  // 下移商品
  onMoveDown: function (e) {
    const id = e.currentTarget.dataset.id;
    const cartItems = this.data.cartItems;
    const index = cartItems.findIndex(item => item.id === id);
    
    try {
      if (index < cartItems.length - 1) {
        const updatedItems = [...cartItems];
        // 交换位置
        const temp = updatedItems[index];
        updatedItems[index] = updatedItems[index + 1];
        updatedItems[index + 1] = temp;
        
        this.setData({ cartItems: updatedItems });
        this.updateCartStatus();
        
        wx.showToast({
          title: '商品已下移',
          icon: 'success',
          duration: 500
        });
      }
    } catch (error) {
      console.error('下移商品失败:', error);
      wx.showToast({
        title: '操作失败，请重试',
        icon: 'none',
        duration: 1500
      });
    }
  },

  // 结算
  onCheckout: async function () {
    const cartItems = this.data.cartItems;
    const selectedGoods = cartItems.filter(item => item.selected);
    
    if (selectedGoods.length === 0) {
      wx.showToast({
        title: '请选择要结算的商品',
        icon: 'none',
        duration: 1000
      });
      return;
    }
    
    try {
      this.showLoading('结算中...');
      
      // 构建订单数据
      const orderData = {
        items: selectedGoods.map(item => ({
          productId: item.id,
          quantity: item.quantity,
          price: item.price
        })),
        totalPrice: selectedGoods.reduce((sum, item) => sum + item.price * item.quantity, 0)
      };
      
      // 保存选中的商品到本地存储
      wx.setStorageSync('selectedGoods', selectedGoods);
      
      this.hideLoading();
      
      // 跳转到订单确认页面
      wx.navigateTo({
        url: '/pages/order/confirm/confirm'
      });
    } catch (error) {
      this.hideLoading();
      handleApiError(error);
    }
  },

  // 去购物
  onGoShopping: function () {
    try {
      wx.switchTab({
        url: '/pages/index/index'
      });
    } catch (error) {
      console.error('跳转失败:', error);
      wx.showToast({
        title: '跳转失败，请重试',
        icon: 'none',
        duration: 1500
      });
    }
  },

  // 下拉刷新
  onPullDownRefresh: function () {
    try {
      this.loadCartData();
      wx.stopPullDownRefresh();
      wx.showToast({
        title: '刷新成功',
        icon: 'success',
        duration: 1000
      });
    } catch (error) {
      wx.stopPullDownRefresh();
      console.error('刷新失败:', error);
      wx.showToast({
        title: '刷新失败，请重试',
        icon: 'none',
        duration: 1500
      });
    }
  },

  // 页面卸载时保存数据
  onUnload: function () {
    this.saveCartData();
  },

  // 错误处理函数
  handleError: function (error, message = '操作失败，请重试') {
    console.error(message, error);
    wx.showToast({
      title: message,
      icon: 'none',
      duration: 1500
    });
  }
})