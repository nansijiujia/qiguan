const express = require('express');
const { query } = require('../db_mysql');
const router = express.Router();

// 健康检查 - 简单版本
router.get('/health', (req, res) => {
  try {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: 'v4.0.0',
      environment: process.env.NODE_ENV || 'development',
      memory: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 数据库测试
router.get('/health/db-test', async (req, res) => {
  try {
    const result = await query('SELECT 1 AS test');
    if (result && result.length > 0) {
      res.json({ success: true, message: 'Database connection is healthy' });
    } else {
      res.status(500).json({ success: false, message: 'Database connection failed' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Database connection error' });
  }
});

module.exports = router;
