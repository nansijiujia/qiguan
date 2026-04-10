const express = require('express');
const { query, getOne, run } = require('../db_mysql');
const router = express.Router();

const TABLE_NAME = 'cart_items';

async function ensureTableExists() {
  await run(`
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      product_id INT NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      selected TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user_product (user_id, product_id),
      INDEX idx_user_id (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

ensureTableExists().catch(err => console.error('[CART] Failed to ensure table exists:', err));

router.get('/cart', async (req, res) => {
  try {
    const userId = req.user.userId;
    const items = await query(
      `SELECT * FROM ${TABLE_NAME} WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    );
    res.json({ success: true, data: items });
  } catch (error) {
    console.error('[CART] Get cart error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/cart', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { productId, quantity = 1 } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product ID is required' });
    }

    const existingItem = await getOne(
      `SELECT * FROM ${TABLE_NAME} WHERE user_id = ? AND product_id = ?`,
      [userId, productId]
    );

    if (existingItem) {
      await run(
        `UPDATE ${TABLE_NAME} SET quantity = quantity + ?, updated_at = NOW() WHERE id = ?`,
        [quantity, existingItem.id]
      );
      const updatedItem = await getOne(
        `SELECT * FROM ${TABLE_NAME} WHERE id = ?`,
        [existingItem.id]
      );
      res.json({ success: true, data: updatedItem, message: 'Quantity updated' });
    } else {
      const result = await run(
        `INSERT INTO ${TABLE_NAME} (user_id, product_id, quantity) VALUES (?, ?, ?)`,
        [userId, productId, quantity]
      );
      const newItem = await getOne(
        `SELECT * FROM ${TABLE_NAME} WHERE id = ?`,
        [result.insertId]
      );
      res.status(201).json({ success: true, data: newItem, message: 'Item added to cart' });
    }
  } catch (error) {
    console.error('[CART] Add to cart error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/cart/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { quantity, selected } = req.body;

    const item = await getOne(
      `SELECT * FROM ${TABLE_NAME} WHERE id = ? AND user_id = ?`,
      [id, userId]
    );

    if (!item) {
      return res.status(404).json({ success: false, message: 'Cart item not found' });
    }

    const updates = [];
    const values = [];

    if (quantity !== undefined) {
      updates.push('quantity = ?');
      values.push(quantity);
    }
    if (selected !== undefined) {
      updates.push('selected = ?');
      values.push(selected ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    values.push(id, userId);
    await run(
      `UPDATE ${TABLE_NAME} SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ? AND user_id = ?`,
      values
    );

    const updatedItem = await getOne(
      `SELECT * FROM ${TABLE_NAME} WHERE id = ?`,
      [id]
    );
    res.json({ success: true, data: updatedItem });
  } catch (error) {
    console.error('[CART] Update cart item error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/cart/batch', async (req, res) => {
  try {
    const userId = req.user.userId;
    const items = req.body;

    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'Items must be an array' });
    }

    for (const item of items) {
      if (item.id && (item.quantity !== undefined || item.selected !== undefined)) {
        const updates = [];
        const values = [];

        if (item.quantity !== undefined) {
          updates.push('quantity = ?');
          values.push(item.quantity);
        }
        if (item.selected !== undefined) {
          updates.push('selected = ?');
          values.push(item.selected ? 1 : 0);
        }

        values.push(item.id, userId);
        await run(
          `UPDATE ${TABLE_NAME} SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ? AND user_id = ?`,
          values
        );
      }
    }

    const allItems = await query(
      `SELECT * FROM ${TABLE_NAME} WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    );
    res.json({ success: true, data: allItems });
  } catch (error) {
    console.error('[CART] Batch update error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/cart/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const result = await run(
      `DELETE FROM ${TABLE_NAME} WHERE id = ? AND user_id = ?`,
      [id, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Cart item not found' });
    }

    const remainingItems = await query(
      `SELECT * FROM ${TABLE_NAME} WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    );
    res.json({ success: true, data: remainingItems, message: 'Item removed from cart' });
  } catch (error) {
    console.error('[CART] Delete cart item error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/cart/batch', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'IDs must be a non-empty array' });
    }

    await run(
      `DELETE FROM ${TABLE_NAME} WHERE id IN (?) AND user_id = ?`,
      [ids.join(','), userId]
    );

    const remainingItems = await query(
      `SELECT * FROM ${TABLE_NAME} WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    );
    res.json({ success: true, data: remainingItems, message: `${ids.length} items removed` });
  } catch (error) {
    console.error('[CART] Batch delete error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/cart', async (req, res) => {
  try {
    const userId = req.user.userId;

    await run(`DELETE FROM ${TABLE_NAME} WHERE user_id = ?`, [userId]);

    res.json({ success: true, data: [], message: 'Cart cleared' });
  } catch (error) {
    console.error('[CART] Clear cart error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/cart/select/all', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { selected } = req.body;

    await run(
      `UPDATE ${TABLE_NAME} SET selected = ?, updated_at = NOW() WHERE user_id = ?`,
      [selected ? 1 : 0, userId]
    );

    const allItems = await query(
      `SELECT * FROM ${TABLE_NAME} WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    );
    res.json({ success: true, data: allItems });
  } catch (error) {
    console.error('[CART] Select all error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
