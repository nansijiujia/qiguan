const express = require('express');
const { query, getOne, execute } = require('../db-unified');
const { validateRequestBody } = require('../utils/validation');
const { asyncHandler } = require('../middleware/errorHandler');
const router = express.Router();

const TABLE_NAME = 'cart';

async function ensureTableExists() {
  await execute(`
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      product_id INT NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      selected TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT NOW(),
      updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
      UNIQUE KEY uk_user_product (user_id, product_id),
      INDEX idx_user_id (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

ensureTableExists().catch(err => console.error('[Cart] 表创建失败:', err));

router.get('/cart', asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const items = await query(
    `SELECT * FROM ${TABLE_NAME} WHERE user_id = ? ORDER BY created_at DESC`,
    [userId]
  );
  res.json({ success: true, data: items });
}));

router.post('/cart', asyncHandler(async (req, res) => {
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
    await execute(
      `UPDATE ${TABLE_NAME} SET quantity = quantity + ?, updated_at = NOW() WHERE id = ?`,
      [quantity, existingItem.id]
    );
    const updatedItem = await getOne(
      `SELECT * FROM ${TABLE_NAME} WHERE id = ?`,
      [existingItem.id]
    );
    res.json({ success: true, data: updatedItem, message: 'Quantity updated' });
  } else {
    const result = await execute(
      `INSERT INTO ${TABLE_NAME} (user_id, product_id, quantity) VALUES (?, ?, ?)`,
      [userId, productId, quantity]
    );
    const newItem = await getOne(
      `SELECT * FROM ${TABLE_NAME} WHERE id = ?`,
      [result.insertId]
    );
    res.status(201).json({ success: true, data: newItem, message: 'Item added to cart' });
  }
}));

router.put('/cart/:id', asyncHandler(async (req, res) => {
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
  await execute(
    `UPDATE ${TABLE_NAME} SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ? AND user_id = ?`,
    values
  );

  const updatedItem = await getOne(
    `SELECT * FROM ${TABLE_NAME} WHERE id = ?`,
    [id]
  );
  res.json({ success: true, data: updatedItem });
}));

router.put('/cart/batch', asyncHandler(async (req, res) => {
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
      await execute(
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
}));

router.delete('/cart/:id', asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { id } = req.params;

  const result = await execute(
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
}));

router.delete('/cart/batch', asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, message: 'IDs must be a non-empty array' });
  }

  const placeholders = ids.map(() => '?').join(',');
  await execute(
    `DELETE FROM ${TABLE_NAME} WHERE id IN (${placeholders}) AND user_id = ?`,
    [...ids, userId]
  );

  const remainingItems = await query(
    `SELECT * FROM ${TABLE_NAME} WHERE user_id = ? ORDER BY created_at DESC`,
    [userId]
  );
  res.json({ success: true, data: remainingItems, message: `${ids.length} items removed` });
}));

router.delete('/cart', asyncHandler(async (req, res) => {
  const userId = req.user.userId;

  await execute(`DELETE FROM ${TABLE_NAME} WHERE user_id = ?`, [userId]);

  res.json({ success: true, data: [], message: 'Cart cleared' });
}));

router.put('/cart/select/all', asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { selected } = req.body;

  await execute(
    `UPDATE ${TABLE_NAME} SET selected = ?, updated_at = NOW() WHERE user_id = ?`,
    [selected ? 1 : 0, userId]
  );

  const allItems = await query(
    `SELECT * FROM ${TABLE_NAME} WHERE user_id = ? ORDER BY created_at DESC`,
    [userId]
  );
  res.json({ success: true, data: allItems });
}));

module.exports = router;