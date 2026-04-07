const express = require('express');
const { query } = require('../db');
const router = express.Router();

// 健康检查
router.get('/health', (req, res) => {
  try {
    res.json({ success: true, message: 'Service is healthy' });
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
