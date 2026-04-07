const express = require('express');
const { db } = require('../db');
const router = express.Router();

// 模拟收藏数据（实际项目中应该使用数据库）
let favorites = [];
// 模拟足迹数据（实际项目中应该使用数据库）
let footprints = [];

// 获取用户列表
router.get('/users', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not initialized' });
    }
    
    const users = await db.collection('users').get();
    res.json({ success: true, data: users.data });
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 获取用户详情
router.get('/users/:id', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not initialized' });
    }
    
    const { id } = req.params;
    const user = await db.collection('users').doc(id).get();
    res.json({ success: true, data: user.data });
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 创建用户
router.post('/users', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not initialized' });
    }
    
    const { username, email, password, role } = req.body;
    const result = await db.collection('users').add({
      username,
      email,
      password,
      role: role || 'customer',
      created_at: new Date()
    });
    res.json({ success: true, data: { id: result.id, username, email, role } });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 编辑用户
router.put('/users/:id', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not initialized' });
    }
    
    const { id } = req.params;
    const { username, email, password, role } = req.body;
    await db.collection('users').doc(id).update({
      username,
      email,
      password,
      role
    });
    res.json({ success: true, data: { id, username, email, role } });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 删除用户
router.delete('/users/:id', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not initialized' });
    }
    
    const { id } = req.params;
    await db.collection('users').doc(id).remove();
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 获取用户信息
router.get('/users/me', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not initialized' });
    }
    
    // 这里简化处理，实际应该从token中获取用户信息
    const userId = '1'; // 模拟用户ID
    const user = await db.collection('users').doc(userId).get();
    
    if (!user.data()) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({ success: true, data: user.data() });
  } catch (error) {
    console.error('Error getting user info:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 更新用户信息
router.put('/users/me', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not initialized' });
    }
    
    const { email, phone } = req.body;
    // 这里简化处理，实际应该从token中获取用户信息
    const userId = '1'; // 模拟用户ID
    
    await db.collection('users').doc(userId).update({ email, phone });
    const updatedUser = await db.collection('users').doc(userId).get();
    
    res.json({ success: true, data: updatedUser.data() });
  } catch (error) {
    console.error('Error updating user info:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 获取订单统计
router.get('/users/order-stats', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not initialized' });
    }
    
    // 这里简化处理，实际应该从token中获取用户信息
    const userId = '1'; // 模拟用户ID
    
    const stats = {
      pending: 0,
      paid: 0,
      shipped: 0,
      delivered: 0
    };
    
    const orders = await db.collection('orders').where({ user_id: userId }).get();
    orders.data.forEach(order => {
      if (stats.hasOwnProperty(order.status)) {
        stats[order.status]++;
      }
    });
    
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error getting order stats:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 获取收藏列表
router.get('/users/favorites', (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const start = (page - 1) * limit;
    const end = start + parseInt(limit);
    
    const paginatedFavorites = favorites.slice(start, end);
    
    res.json({
      success: true,
      data: {
        list: paginatedFavorites,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: favorites.length
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 检查商品是否已收藏
router.get('/users/favorite/check', (req, res) => {
  try {
    const { productId } = req.query;
    const isFavorited = favorites.some(item => item.productId === parseInt(productId));
    res.json({ success: true, data: { isFavorited } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 添加收藏
router.post('/users/favorite', (req, res) => {
  try {
    const { productId } = req.body;
    
    if (!favorites.some(item => item.productId === productId)) {
      favorites.push({ id: favorites.length + 1, productId, createdAt: new Date() });
    }
    
    res.json({ success: true, message: 'Added to favorites' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 删除收藏
router.delete('/users/favorite/:productId', (req, res) => {
  try {
    const { productId } = req.params;
    favorites = favorites.filter(item => item.productId !== parseInt(productId));
    res.json({ success: true, message: 'Removed from favorites' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 获取足迹列表
router.get('/users/footprints', (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const start = (page - 1) * limit;
    const end = start + parseInt(limit);
    
    const paginatedFootprints = footprints.slice(start, end);
    
    res.json({
      success: true,
      data: {
        list: paginatedFootprints,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: footprints.length
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 添加足迹
router.post('/users/footprints', (req, res) => {
  try {
    const { productId } = req.body;
    footprints.unshift({ id: footprints.length + 1, productId, createdAt: new Date() });
    // 限制足迹数量
    if (footprints.length > 100) {
      footprints = footprints.slice(0, 100);
    }
    res.json({ success: true, message: 'Added to footprints' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 清空足迹
router.delete('/users/footprints', (req, res) => {
  try {
    footprints = [];
    res.json({ success: true, message: 'Footprints cleared' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 获取用户优惠券
router.get('/users/coupons', (req, res) => {
  try {
    // 模拟优惠券数据
    const coupons = [
      { id: 1, name: '满100减10', value: 10, minAmount: 100, expireAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      { id: 2, name: '满200减20', value: 20, minAmount: 200, expireAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) }
    ];
    res.json({ success: true, data: coupons });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 领取优惠券
router.post('/users/coupons/receive', (req, res) => {
  try {
    const { couponId } = req.body;
    res.json({ success: true, message: 'Coupon received successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 获取可用优惠券
router.get('/users/coupons/available', (req, res) => {
  try {
    // 模拟可用优惠券数据
    const coupons = [
      { id: 1, name: '满100减10', value: 10, minAmount: 100, expireAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
    ];
    res.json({ success: true, data: coupons });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
