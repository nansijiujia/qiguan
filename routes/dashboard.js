const express = require('express');
const router = express.Router();
const { query } = require('../db');

router.get('/overview', async (req, res) => {
  try {
    const [totalProducts, totalOrders, totalRevenue, totalUsers] = await Promise.all([
      query("SELECT COUNT(*) as count FROM products WHERE status='active'"),
      query('SELECT COUNT(*) as count FROM orders'),
      query("SELECT COALESCE(SUM(total_amount), 0) as revenue FROM orders WHERE status IN ('paid', 'shipped', 'completed')"),
      query('SELECT COUNT(*) as count FROM users')
    ]);

    res.json({
      success: true,
      data: {
        totalProducts: totalProducts[0].count,
        totalOrders: totalOrders[0].count,
        totalRevenue: parseFloat(totalRevenue[0].revenue).toFixed(2),
        totalUsers: totalUsers[0].count,
        productGrowth: '+12.3%',
        orderGrowth: '+8.1%',
        revenueGrowth: '-2.4%',
        userGrowth: '+15.7%'
      }
    });
  } catch (error) {
    console.error('Error getting overview:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/sales', async (req, res) => {
  try {
    const days = parseInt(req.query.period) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const salesData = await query(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as orders,
        COALESCE(SUM(total_amount), 0) as revenue
      FROM orders
      WHERE created_at >= ?
        AND status IN ('paid', 'shipped', 'completed')
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [startDate.toISOString().slice(0, 19).replace('T', ' ')]);

    const result = [];
    const currentDate = new Date(startDate);
    const today = new Date();
    while (currentDate <= today) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const found = salesData.find(row => row.date.toISOString ? row.date.toISOString().split('T')[0] : String(row.date) === dateStr);
      result.push({
        date: dateStr,
        orders: found ? found.orders : 0,
        revenue: found ? parseFloat(found.revenue) : 0
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting sales:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/products', async (req, res) => {
  try {
    const list = await query(`
      SELECT * FROM products
      WHERE status='active'
      ORDER BY stock DESC
      LIMIT 5
    `);
    const [{ count }] = await query(`SELECT COUNT(*) as count FROM products WHERE status='active'`);

    res.json({
      success: true,
      data: { list, pagination: { page: 1, limit: 5, total: count } }
    });
  } catch (error) {
    console.error('Error getting products:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/users', async (req, res) => {
  try {
    const list = await query(`
      SELECT id, username, email, avatar, role, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 5
    `);
    const [{ count }] = await query(`SELECT COUNT(*) as count FROM users`);

    res.json({
      success: true,
      data: { list, pagination: { page: 1, limit: 5, total: count } }
    });
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/orders', async (req, res) => {
  try {
    const list = await query(`
      SELECT o.*, u.username as customer_username
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
      LIMIT 10
    `);
    const [{ count }] = await query(`SELECT COUNT(*) as count FROM orders`);

    res.json({
      success: true,
      data: { list, pagination: { page: 1, limit: 10, total: count } }
    });
  } catch (error) {
    console.error('Error getting orders:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
