const express = require('express');
const { query, getOne, db } = require('../db');
const router = express.Router();

function generateOrderNo() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `ORD${timestamp}${random.toString().padStart(3, '0')}`;
}

router.get('/orders', async (req, res) => {
  try {
    const { page = 1, limit = 10, status, keyword } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let whereSql = 'WHERE 1=1';

    if (status) {
      whereSql += ' AND o.status = ?';
      params.push(status);
    }
    if (keyword) {
      whereSql += ' AND (o.order_no LIKE ? OR u.username LIKE ?)';
      const kw = `%${keyword}%`;
      params.push(kw, kw);
    }

    const countResult = await getOne(
      `SELECT COUNT(*) AS total
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       ${whereSql}`,
      params
    );

    const list = await query(
      `SELECT o.*, u.username AS customer_name
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       ${whereSql}
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      success: true,
      data: {
        list,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult.total
        }
      }
    });
  } catch (error) {
    console.error('Error getting orders:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const order = await getOne('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const items = await query(
      'SELECT * FROM order_items WHERE order_id = ?',
      [id]
    );

    order.items = items;
    res.json({ success: true, data: order });
  } catch (error) {
    console.error('Error getting order details:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/orders', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { user_id, items, payment_method, shipping_address, shipping_phone } = req.body;

    if (!user_id || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'user_id and items array are required' });
    }

    const user = await connection.execute('SELECT id FROM users WHERE id = ?', [user_id]);
    if (user[0].length === 0) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    const orderNo = generateOrderNo();
    let totalAmount = 0;
    for (const item of items) {
      if (!item.product_id || !item.quantity || !item.price) {
        throw new Error('Each item must have product_id, quantity and price');
      }
      totalAmount += item.quantity * item.price;
    }

    await connection.beginTransaction();

    const [orderResult] = await connection.execute(
      `INSERT INTO orders (user_id, order_no, total_amount, status, payment_method, shipping_address, shipping_phone, created_at)
       VALUES (?, ?, ?, 'pending', ?, ?, ?, NOW())`,
      [user_id, orderNo, totalAmount, payment_method || null, shipping_address || null, shipping_phone || null]
    );
    const orderId = orderResult.insertId;

    const itemValues = items.map(item => [
      orderId,
      item.product_id,
      item.quantity,
      item.price,
      item.quantity * item.price
    ]);
    await connection.query(
      'INSERT INTO order_items (order_id, product_id, quantity, price, subtotal) VALUES ?',
      [itemValues]
    );

    await connection.commit();

    const newOrder = await getOne('SELECT * FROM orders WHERE id = ?', [orderId]);
    newOrder.items = await query('SELECT * FROM order_items WHERE order_id = ?', [orderId]);

    res.status(201).json({ success: true, data: newOrder });
  } catch (error) {
    await connection.rollback();
    console.error('Error creating order:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  } finally {
    connection.release();
  }
});

router.put('/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, payment_method, shipping_address, shipping_phone, tracking_number } = req.body;

    const order = await getOne('SELECT id FROM orders WHERE id = ?', [id]);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const fields = [];
    const values = [];

    if (status !== undefined) { fields.push('status = ?'); values.push(status); }
    if (payment_method !== undefined) { fields.push('payment_method = ?'); values.push(payment_method); }
    if (shipping_address !== undefined) { fields.push('shipping_address = ?'); values.push(shipping_address); }
    if (shipping_phone !== undefined) { fields.push('shipping_phone = ?'); values.push(shipping_phone); }
    if (tracking_number !== undefined) { fields.push('tracking_number = ?'); values.push(tracking_number); }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    values.push(id);
    await query(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`, values);

    const updatedOrder = await getOne('SELECT * FROM orders WHERE id = ?', [id]);
    updatedOrder.items = await query('SELECT * FROM order_items WHERE order_id = ?', [id]);

    res.json({ success: true, data: updatedOrder });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/orders/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;

    const order = await getOne('SELECT id, status FROM orders WHERE id = ?', [id]);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    if (order.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Only pending orders can be cancelled' });
    }

    await query("UPDATE orders SET status = 'cancelled' WHERE id = ?", [id]);
    res.json({ success: true, message: 'Order cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const order = await getOne('SELECT id FROM orders WHERE id = ?', [id]);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    await query('DELETE FROM order_items WHERE order_id = ?', [id]);
    await query('DELETE FROM orders WHERE id = ?', [id]);

    res.json({ success: true, message: 'Order deleted successfully' });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
