const express = require('express');
const router = express.Router();

router.get('/overview', async (req, res) => {
  try {
    const data = {
      totalProducts: 128,
      totalOrders: 356,
      totalRevenue: 125680.50,
      totalUsers: 892,
      recentOrders: [
        { id: 'ORD001', customer: '张三', amount: 299.00, status: 'completed', date: '2024-01-15' },
        { id: 'ORD002', customer: '李四', amount: 1599.00, status: 'pending', date: '2024-01-14' }
      ]
    };
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error getting overview:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/products', async (req, res) => {
  try {
    const data = {
      list: [
        { id: '1', name: '智能手机 Pro', price: 2999, stock: 150, sales: 89, category: '电子产品' },
        { id: '2', name: '无线耳机', price: 399, stock: 300, sales: 234, category: '电子产品' },
        { id: '3', name: '笔记本电脑', price: 5999, stock: 80, sales: 45, category: '电子产品' },
        { id: '4', name: '智能手表', price: 1299, stock: 200, sales: 156, category: '穿戴设备' },
        { id: '5', name: '平板电脑', price: 2499, stock: 120, sales: 78, category: '电子产品' }
      ],
      pagination: { page: 1, limit: 10, total: 128 }
    };
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error getting products:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/users', async (req, res) => {
  try {
    const data = {
      list: [
        { id: '1', name: '张三', email: 'zhangsan@example.com', role: 'admin', status: 'active', joinDate: '2024-01-01' },
        { id: '2', name: '李四', email: 'lisi@example.com', role: 'user', status: 'active', joinDate: '2024-01-05' },
        { id: '3', name: '王五', email: 'wangwu@example.com', role: 'user', status: 'inactive', joinDate: '2024-01-10' }
      ],
      pagination: { page: 1, limit: 10, total: 892 }
    };
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/sales', async (req, res) => {
  try {
    const data = {
      monthlySales: [
        { month: '1月', revenue: 45600, orders: 89 },
        { month: '2月', revenue: 52300, orders: 102 },
        { month: '3月', revenue: 48900, orders: 95 },
        { month: '4月', revenue: 61200, orders: 118 },
        { month: '5月', revenue: 58700, orders: 112 },
        { month: '6月', revenue: 72300, orders: 145 }
      ],
      topProducts: [
        { name: '智能手机 Pro', sales: 89, revenue: 266911 },
        { name: '无线耳机', sales: 234, revenue: 93366 },
        { name: '智能手表', sales: 156, revenue: 202644 }
      ]
    };
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error getting sales:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/orders', async (req, res) => {
  try {
    const data = {
      list: [
        { id: 'ORD001', customer: '张三', products: ['智能手机 Pro'], total: 2999, status: 'completed', date: '2024-01-15 10:30' },
        { id: 'ORD002', customer: '李四', products: ['无线耳机', '智能手表'], total: 1698, status: 'pending', date: '2024-01-15 09:20' },
        { id: 'ORD003', customer: '王五', products: ['笔记本电脑'], total: 5999, status: 'shipping', date: '2024-01-14 16:45' },
        { id: 'ORD004', customer: '赵六', products: ['平板电脑'], total: 2499, status: 'completed', date: '2024-01-14 14:10' },
        { id: 'ORD005', customer: '钱七', products: ['无线耳机'], total: 399, status: 'cancelled', date: '2024-01-13 11:55' }
      ],
      pagination: { page: 1, limit: 10, total: 356 }
    };
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error getting orders:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
