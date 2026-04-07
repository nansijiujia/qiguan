const express = require('express');
const router = express.Router();

// 模拟购物车数据（实际项目中应该使用数据库）
let cartItems = [];
let cartIdCounter = 1;

// 获取购物车列表
router.get('/cart', (req, res) => {
  try {
    res.json({ success: true, data: cartItems });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 添加商品到购物车
router.post('/cart', (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    
    // 检查商品是否已在购物车中
    const existingItem = cartItems.find(item => item.productId === productId);
    
    if (existingItem) {
      // 更新数量
      existingItem.quantity += quantity;
    } else {
      // 添加新商品
      const newItem = {
        id: cartIdCounter++,
        productId,
        quantity
      };
      cartItems.push(newItem);
    }
    
    res.json({ success: true, data: cartItems });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 更新购物车商品
router.put('/cart/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;
    
    const item = cartItems.find(item => item.id === parseInt(id));
    
    if (!item) {
      return res.status(404).json({ success: false, message: 'Cart item not found' });
    }
    
    item.quantity = quantity;
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 批量更新购物车商品
router.put('/cart/batch', (req, res) => {
  try {
    const items = req.body;
    
    items.forEach(item => {
      const cartItem = cartItems.find(cartItem => cartItem.id === item.id);
      if (cartItem) {
        cartItem.quantity = item.quantity;
      }
    });
    
    res.json({ success: true, data: cartItems });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 删除购物车商品
router.delete('/cart/:id', (req, res) => {
  try {
    const { id } = req.params;
    cartItems = cartItems.filter(item => item.id !== parseInt(id));
    res.json({ success: true, data: cartItems });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 批量删除购物车商品
router.delete('/cart/batch', (req, res) => {
  try {
    const { ids } = req.body;
    cartItems = cartItems.filter(item => !ids.includes(item.id));
    res.json({ success: true, data: cartItems });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 清空购物车
router.delete('/cart', (req, res) => {
  try {
    cartItems = [];
    res.json({ success: true, data: [] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 全选/取消全选
router.put('/cart/select/all', (req, res) => {
  try {
    const { selected } = req.body;
    // 这里简化处理，实际项目中应该有选中状态
    res.json({ success: true, data: cartItems });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
