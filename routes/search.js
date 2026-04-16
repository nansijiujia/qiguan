// [TIMEOUT] 建议: 为长时间运行的数据库操作添加超时设置
const express = require('express');
const { query } = require('../db-unified')
const { validateRequestBody } = require('../utils/validation');
const { asyncHandler } = require('../middleware/errorHandler');
const router = express.Router();

router.get('/search/hot-keywords', asyncHandler(async (req, res) => {
  const hotKeywords = [
    '智能手机',
    '笔记本电脑',
    'T恤',
    '牛仔裤',
    '苹果',
    '牛奶'
  ];

  res.json({ success: true, data: hotKeywords });
}));

router.get('/search/suggestions', asyncHandler(async (req, res) => {
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
}));

module.exports = router;
