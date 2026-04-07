const express = require('express');
const { query } = require('../db');
const router = express.Router();

// 获取热门关键词
router.get('/search/hot-keywords', (req, res) => {
  try {
    // 模拟热门关键词数据
    const hotKeywords = [
      '智能手机',
      '笔记本电脑',
      'T恤',
      '牛仔裤',
      '苹果',
      '牛奶'
    ];
    
    res.json({ success: true, data: hotKeywords });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 获取搜索建议
router.get('/search/suggestions', async (req, res) => {
  try {
    const { keyword } = req.query;
    
    if (!keyword) {
      return res.json({ success: true, data: [] });
    }
    
    const products = await query(
      'SELECT name FROM products WHERE status = ? AND name LIKE ? LIMIT 10',
      ['active', `${keyword}%`]
    );
    
    const suggestions = products.map(p => p.name);
    res.json({ success: true, data: suggestions });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
