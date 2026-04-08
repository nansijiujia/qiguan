const express = require('express');
const { query, getOne } = require('../db');
const router = express.Router();

router.get('/products', async (req, res) => {
  try {
    const { page = 1, limit = 10, category_id } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    let whereSql = 'WHERE status = ?';
    let countWhereSql = 'WHERE status = ?';
    const params = ['active'];
    const countParams = ['active'];

    if (category_id) {
      whereSql += ' AND category_id = ?';
      countWhereSql += ' AND category_id = ?';
      params.push(category_id);
      countParams.push(category_id);
    }

    const sql = `SELECT * FROM products ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limitNum, offset);

    const list = await query(sql, params);

    const countSql = `SELECT COUNT(*) AS total FROM products ${countWhereSql}`;
    const countResult = await getOne(countSql, countParams);
    const total = countResult ? countResult.total : 0;

    res.json({
      success: true,
      data: {
        list,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total
        }
      }
    });
  } catch (error) {
    console.error('Error getting products:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/products/search', async (req, res) => {
  try {
    const { keyword } = req.query;

    if (!keyword) {
      return res.json({ success: true, data: [] });
    }

    const likePattern = `%${keyword}%`;
    const sql = `SELECT * FROM products WHERE status = ? AND (name LIKE ? OR description LIKE ?)`;
    const products = await query(sql, ['active', likePattern, likePattern]);

    res.json({ success: true, data: products });
  } catch (error) {
    console.error('Error searching products:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/products/recommended', async (req, res) => {
  try {
    const sql = `SELECT * FROM products WHERE status = ? ORDER BY created_at DESC LIMIT 10`;
    const products = await query(sql, ['active']);
    res.json({ success: true, data: products });
  } catch (error) {
    console.error('Error getting recommended products:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/products/hot', async (req, res) => {
  try {
    const sql = `SELECT * FROM products WHERE status = ? ORDER BY stock DESC LIMIT 10`;
    const products = await query(sql, ['active']);
    res.json({ success: true, data: products });
  } catch (error) {
    console.error('Error getting hot products:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/products/suggestions', async (req, res) => {
  try {
    const { keyword } = req.query;

    if (!keyword) {
      return res.json({ success: true, data: [] });
    }

    const likePattern = `${keyword}%`;
    const sql = `SELECT name FROM products WHERE status = ? AND name LIKE ? LIMIT 10`;
    const rows = await query(sql, ['active', likePattern]);
    const suggestions = rows.map(p => p.name);
    res.json({ success: true, data: suggestions });
  } catch (error) {
    console.error('Error getting product suggestions:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const product = await getOne('SELECT * FROM products WHERE id = ?', [id]);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, data: product });
  } catch (error) {
    console.error('Error getting product details:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/products', async (req, res) => {
  try {
    const { name, description, price, stock, category_id, image, status } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Product name is required' });
    }

    if (price !== undefined && price < 0) {
      return res.status(400).json({ success: false, message: 'Price must be >= 0' });
    }

    if (stock !== undefined && stock < 0) {
      return res.status(400).json({ success: false, message: 'Stock must be >= 0' });
    }

    const sql = `INSERT INTO products (name, description, price, stock, category_id, image, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`;
    const result = await query(sql, [
      name,
      description || null,
      price || 0,
      stock || 0,
      category_id || null,
      image || null,
      status || 'active'
    ]);

    const insertId = result.insertId;
    res.json({
      success: true,
      data: {
        id: insertId,
        name,
        description: description || null,
        price: price || 0,
        stock: stock || 0,
        category_id: category_id || null,
        image: image || null,
        status: status || 'active'
      }
    });
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, stock, category_id, image, status } = req.body;

    const fields = [];
    const params = [];

    if (name !== undefined) {
      fields.push('name = ?');
      params.push(name);
    }
    if (description !== undefined) {
      fields.push('description = ?');
      params.push(description);
    }
    if (price !== undefined) {
      fields.push('price = ?');
      params.push(price);
    }
    if (stock !== undefined) {
      fields.push('stock = ?');
      params.push(stock);
    }
    if (category_id !== undefined) {
      fields.push('category_id = ?');
      params.push(category_id);
    }
    if (image !== undefined) {
      fields.push('image = ?');
      params.push(image);
    }
    if (status !== undefined) {
      fields.push('status = ?');
      params.push(status);
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    params.push(id);
    const sql = `UPDATE products SET ${fields.join(', ')} WHERE id = ?`;
    const result = await query(sql, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, data: { id, name, description, price, stock, category_id, image, status } });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM products WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/products/category/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const sql = `SELECT * FROM products WHERE status = ? AND category_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const list = await query(sql, ['active', id, limitNum, offset]);

    const countSql = `SELECT COUNT(*) AS total FROM products WHERE status = ? AND category_id = ?`;
    const countResult = await getOne(countSql, ['active', id]);
    const total = countResult ? countResult.total : 0;

    res.json({
      success: true,
      data: {
        list,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total
        }
      }
    });
  } catch (error) {
    console.error('Error getting products by category:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
