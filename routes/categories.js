const express = require('express');
const { query, getOne } = require('../db');
const router = express.Router();

router.get('/categories', async (req, res) => {
  try {
    const categories = await query('SELECT * FROM categories ORDER BY sort_order ASC');
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Error getting categories:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const category = await getOne('SELECT * FROM categories WHERE id = ?', [id]);

    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    res.json({ success: true, data: category });
  } catch (error) {
    console.error('Error getting category:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/categories', async (req, res) => {
  try {
    const { name, parent_id, sort_order, status } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }

    const sql = `INSERT INTO categories (name, parent_id, sort_order, status, created_at) VALUES (?, ?, ?, ?, NOW())`;
    const result = await query(sql, [
      name,
      parent_id || null,
      sort_order || 0,
      status || 'active'
    ]);

    const insertId = result.insertId;
    res.json({
      success: true,
      data: {
        id: insertId,
        name,
        parent_id: parent_id || null,
        sort_order: sort_order || 0,
        status: status || 'active'
      }
    });
  } catch (error) {
    console.error('Error adding category:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Category name already exists' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, parent_id, sort_order, status } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }

    const fields = [];
    const params = [];

    fields.push('name = ?');
    params.push(name);

    if (parent_id !== undefined) {
      fields.push('parent_id = ?');
      params.push(parent_id);
    }
    if (sort_order !== undefined) {
      fields.push('sort_order = ?');
      params.push(sort_order);
    }
    if (status !== undefined) {
      fields.push('status = ?');
      params.push(status);
    }

    params.push(id);
    const sql = `UPDATE categories SET ${fields.join(', ')} WHERE id = ?`;
    const result = await query(sql, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    res.json({
      success: true,
      data: {
        id: parseInt(id),
        name,
        parent_id: parent_id !== undefined ? parent_id : null,
        sort_order: sort_order !== undefined ? sort_order : 0,
        status: status !== undefined ? status : 'active'
      }
    });
  } catch (error) {
    console.error('Error updating category:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Category name already exists' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM categories WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
