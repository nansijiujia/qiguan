const express = require('express');
const { query, getOne, execute } = require('../db');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let whereSql = 'WHERE 1=1';

    if (status) {
      whereSql += ' AND o.status = ?';
      params.push(status);
    }

    const countResult = await getOne(
      `SELECT COUNT(*) AS total FROM orders o ${whereSql}`,
      params
    );

    const orders = await query(
      `SELECT o.*, u.username as customer_username
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
        list: orders.map(order => ({
          ...order,
          shipping_address: order.shipping_address ? JSON.parse(order.shipping_address) : null
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult.total || 0
        }
      }
    });
  } catch (error) {
    console.error('[ERROR] Getting orders:', error.message);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get orders' } });
  }
});

router.post('/', async (req, res) => {
  try {
    const { items, shipping_address, remark } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_ORDER', message: 'Order must contain at least one item' } });
    }

    let totalAmount = 0;
    for (const item of items) {
      if (!item.product_id || !item.quantity || !item.price || item.quantity <= 0 || item.price <= 0) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_ORDER', message: 'Each item must have valid product_id, quantity and price' } });
      }
      totalAmount += item.quantity * item.price;
    }

    const timestamp = Date.now();
    const random = Math.random().toString().slice(2, 8);
    const orderNumber = `ORD${timestamp}${random}`;
    const shippingAddressJson = shipping_address ? JSON.stringify(shipping_address) : null;

    const result = await execute(
      `INSERT INTO orders (order_no, user_id, total_amount, status, shipping_address, remark)
       VALUES (?, ?, ?, 'pending', ?, ?)`,
      [orderNumber, req.user?.userId || null, totalAmount, shippingAddressJson, remark || '']
    );

    const orderId = result.insertId;

    for (const item of items) {
      const product = await getOne('SELECT name FROM products WHERE id = ?', [item.product_id]);
      await execute(
        'INSERT INTO order_items (order_id, product_id, product_name, quantity, price) VALUES (?, ?, ?, ?, ?)',
        [orderId, item.product_id, product?.name || 'Unknown', item.quantity, item.price]
      );
    }

    res.status(201).json({
      success: true,
      data: { id: orderId, order_number: orderNumber, total_amount: totalAmount },
      message: 'Order created successfully'
    });
  } catch (error) {
    console.error('[ERROR] Creating order:', error.message);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create order' } });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const order = await getOne('SELECT * FROM orders WHERE id = ?', [id]);

    if (!order) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }

    const items = await query(
      'SELECT * FROM order_items WHERE order_id = ?',
      [id]
    );

    res.json({
      success: true,
      data: {
        ...order,
        shipping_address: order.shipping_address ? JSON.parse(order.shipping_address) : null,
        items
      }
    });
  } catch (error) {
    console.error('[ERROR] Getting order details:', error.message);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get order details' } });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: 'Status is required' } });
    }

    await execute("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?", [status, id]);

    const updatedOrder = await getOne('SELECT * FROM orders WHERE id = ?', [id]);
    res.json({ success: true, data: updatedOrder, message: `Order status updated to ${status}` });
  } catch (error) {
    console.error('[ERROR] Updating order status:', error.message);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update order status' } });
  }
});

module.exports = router;
