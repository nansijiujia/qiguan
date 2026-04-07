const express = require('express');
const { db } = require('../db');
const router = express.Router();

// 获取商品列表
router.get('/products', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not initialized' });
    }
    
    const { page = 1, limit = 10, category_id } = req.query;
    const offset = (page - 1) * limit;
    
    let query = db.collection('products').where({ status: 'active' });
    
    if (category_id) {
      query = query.where({ category_id });
    }
    
    const products = await query
      .orderBy('created_at', 'desc')
      .skip(offset)
      .limit(limit)
      .get();
    
    // 获取总数
    let countQuery = db.collection('products').where({ status: 'active' });
    if (category_id) {
      countQuery = countQuery.where({ category_id });
    }
    const count = await countQuery.count();
    
    res.json({
      success: true,
      data: {
        list: products.data,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count.total
        }
      }
    });
  } catch (error) {
    console.error('Error getting products:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 搜索商品
router.get('/products/search', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not initialized' });
    }
    
    const { keyword } = req.query;
    
    if (!keyword) {
      return res.json({ success: true, data: [] });
    }
    
    // 云数据库不支持LIKE查询，这里使用正则表达式
    const products = await db.collection('products')
      .where({ status: 'active' })
      .where(db.command.or([
        { name: db.command.regex({ regex: keyword, options: 'i' }) },
        { description: db.command.regex({ regex: keyword, options: 'i' }) }
      ]))
      .get();
    
    res.json({ success: true, data: products.data });
  } catch (error) {
    console.error('Error searching products:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 获取推荐商品
router.get('/products/recommended', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not initialized' });
    }
    
    const products = await db.collection('products')
      .where({ status: 'active' })
      .orderBy('created_at', 'desc')
      .limit(10)
      .get();
    res.json({ success: true, data: products.data });
  } catch (error) {
    console.error('Error getting recommended products:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 获取热门商品
router.get('/products/hot', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not initialized' });
    }
    
    // 这里简化处理，实际应该根据销量或浏览量排序
    const products = await db.collection('products')
      .where({ status: 'active' })
      .orderBy('stock', 'desc')
      .limit(10)
      .get();
    res.json({ success: true, data: products.data });
  } catch (error) {
    console.error('Error getting hot products:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 获取商品建议
router.get('/products/suggestions', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not initialized' });
    }
    
    const { keyword } = req.query;
    
    if (!keyword) {
      return res.json({ success: true, data: [] });
    }
    
    // 云数据库不支持LIKE查询，这里使用正则表达式
    const products = await db.collection('products')
      .where({ status: 'active' })
      .where({ name: db.command.regex({ regex: `^${keyword}`, options: 'i' }) })
      .limit(10)
      .get();
    
    const suggestions = products.data.map(p => p.name);
    res.json({ success: true, data: suggestions });
  } catch (error) {
    console.error('Error getting product suggestions:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 获取商品详情
router.get('/products/:id', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not initialized' });
    }
    
    const { id } = req.params;
    const product = await db.collection('products').doc(id).get();
    
    if (!product.data()) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    res.json({ success: true, data: product.data() });
  } catch (error) {
    console.error('Error getting product details:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 添加商品
router.post('/products', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not initialized' });
    }
    
    const { name, description, price, stock, category_id, image, status } = req.body;
    const result = await db.collection('products').add({
      name,
      description,
      price,
      stock,
      category_id,
      image,
      status: status || 'active',
      created_at: new Date()
    });
    res.json({ success: true, data: { id: result.id, name, description, price, stock, category_id, image, status } });
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 编辑商品
router.put('/products/:id', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not initialized' });
    }
    
    const { id } = req.params;
    const { name, description, price, stock, category_id, image, status } = req.body;
    await db.collection('products').doc(id).update({
      name,
      description,
      price,
      stock,
      category_id,
      image,
      status
    });
    res.json({ success: true, data: { id, name, description, price, stock, category_id, image, status } });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 删除商品
router.delete('/products/:id', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not initialized' });
    }
    
    const { id } = req.params;
    await db.collection('products').doc(id).remove();
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
