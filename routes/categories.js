const express = require('express');
const { db } = require('../db');
const router = express.Router();

// 获取分类列表
router.get('/categories', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not initialized' });
    }
    
    const categories = await db.collection('categories')
      .orderBy('sortOrder', 'asc')
      .get();
    
    console.log('Getting categories:', categories.data);
    res.json({ success: true, data: categories.data });
  } catch (error) {
    console.error('Error getting categories:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 获取分类详情
router.get('/categories/:id', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not initialized' });
    }
    
    const { id } = req.params;
    const category = await db.collection('categories')
      .where({ _id: id })
      .get();
    
    if (category.data.length === 0) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    
    console.log('Getting category:', category.data[0]);
    res.json({ success: true, data: category.data[0] });
  } catch (error) {
    console.error('Error getting category:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 添加分类
router.post('/categories', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not initialized' });
    }
    
    const { name, parentId, sortOrder, status } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }
    
    const newCategory = {
      name,
      parentId: parentId || null,
      sortOrder: sortOrder || 0,
      status: status || 'active',
      created_at: new Date()
    };
    
    const result = await db.collection('categories').add(newCategory);
    newCategory._id = result.id;
    
    console.log('Adding category:', newCategory);
    res.json({ success: true, data: newCategory });
  } catch (error) {
    console.error('Error adding category:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 编辑分类
router.put('/categories/:id', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not initialized' });
    }
    
    const { id } = req.params;
    const { name, parentId, sortOrder, status } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }
    
    const updatedCategory = {
      name,
      parentId: parentId || null,
      sortOrder: sortOrder || 0,
      status: status || 'active'
    };
    
    const result = await db.collection('categories')
      .where({ _id: id })
      .update(updatedCategory);
    
    if (result.updated === 0) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    
    updatedCategory._id = id;
    console.log('Updating category:', updatedCategory);
    res.json({ success: true, data: updatedCategory });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 删除分类
router.delete('/categories/:id', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not initialized' });
    }
    
    const { id } = req.params;
    const result = await db.collection('categories')
      .where({ _id: id })
      .remove();
    
    if (result.deleted === 0) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    
    console.log('Deleting category:', id);
    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 获取分类下的商品
router.get('/products/category/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    const products = await db.collection('products')
      .where({ status: 'active', category_id: id })
      .orderBy('created_at', 'desc')
      .skip(offset)
      .limit(limit)
      .get();
    
    // 获取总数
    const count = await db.collection('products')
      .where({ status: 'active', category_id: id })
      .count();
    
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
    console.error('Error getting products by category:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
