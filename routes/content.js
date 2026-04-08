const express = require('express');
const { query } = require('../db');
const router = express.Router();

// 获取首页数据
router.get('/content/homepage', async (req, res) => {
  try {
    // 模拟首页数据
    const homepageData = {
      banners: [
        { id: 1, image: 'https://example.com/banner1.jpg', link: '/products/category/1' },
        { id: 2, image: 'https://example.com/banner2.jpg', link: '/products/category/2' }
      ],
      recommendations: await query('SELECT * FROM products WHERE status = ? ORDER BY RAND() LIMIT 6', ['active']),
      hotProducts: await query('SELECT * FROM products WHERE status = ? ORDER BY stock DESC LIMIT 6', ['active']),
      promotions: [
        { id: 1, title: '限时特惠', description: '全场满100减20', link: '/products' },
        { id: 2, title: '新品上市', description: '新款手机8折起', link: '/products/category/1' }
      ]
    };
    
    res.json({ success: true, data: homepageData });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 获取首页横幅
router.get('/content/homepage/banners', (req, res) => {
  try {
    // 模拟横幅数据
    const banners = [
      { id: 1, image: 'https://example.com/banner1.jpg', link: '/products/category/1' },
      { id: 2, image: 'https://example.com/banner2.jpg', link: '/products/category/2' },
      { id: 3, image: 'https://example.com/banner3.jpg', link: '/products' }
    ];
    
    res.json({ success: true, data: banners });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 获取首页推荐
router.get('/content/homepage/recommendations', async (req, res) => {
  try {
    const products = await query('SELECT * FROM products WHERE status = ? ORDER BY RAND() LIMIT 10', ['active']);
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 获取首页促销
router.get('/content/homepage/promotions', (req, res) => {
  try {
    // 模拟促销数据
    const promotions = [
      { id: 1, title: '限时特惠', description: '全场满100减20', link: '/products' },
      { id: 2, title: '新品上市', description: '新款手机8折起', link: '/products/category/1' },
      { id: 3, title: '会员专享', description: '会员全场9折', link: '/products' }
    ];
    
    res.json({ success: true, data: promotions });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 获取首页热门商品
router.get('/content/homepage/hot-products', async (req, res) => {
  try {
    const products = await query('SELECT * FROM products WHERE status = ? ORDER BY stock DESC LIMIT 10', ['active']);
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
