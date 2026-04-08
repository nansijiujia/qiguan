const express = require('express');
const { query, getOne, execute, transaction } = require('../db');
const router = express.Router();

function generateOrderNumber() {
  const timestamp = Date.now();
  const random = Math.random().toString().slice(2, 8);
  return `ORD${timestamp}${random}`;
}

const VALID_STATUS_TRANSITIONS = {
  'pending': ['paid', 'cancelled'],
  'paid': ['shipped'],
  'shipped': ['completed']
};

router.post('/orders', async (req, res) => {
  try {
    const { items, shipping_address, remark } = req.body;
    const userId = req.user.id;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ORDER',
          message: 'Order must contain at least one item'
        }
      });
    }

    for (const item of items) {
      if (!item.product_id || !item.quantity || !item.price || item.quantity <= 0 || item.price <= 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_ORDER',
            message: 'Each item must have valid product_id, quantity (> 0) and price (> 0)'
          }
        });
      }
    }

    let totalAmount = 0;
    for (const item of items) {
      totalAmount += item.quantity * item.price;
    }

    const orderNumber = generateOrderNumber();
    const shippingAddressJson = shipping_address ? JSON.stringify(shipping_address) : null;

    const result = transaction((db) => {
      for (const item of items) {
        const product = db.prepare('SELECT id, name, stock FROM products WHERE id = ?').get(item.product_id);

        if (!product) {
          throw { code: 'PRODUCT_NOT_FOUND', message: `Product with ID ${item.product_id} not found` };
        }

        if (product.stock < item.quantity) {
          throw {
            code: 'INSUFFICIENT_STOCK',
            message: `Product ${product.name} only has ${product.stock} left, but ${item.quantity} requested`
          };
        }

        db.prepare('UPDATE products SET stock = stock - ?, updated_at = datetime(\'now\') WHERE id = ?')
          .run(item.quantity, item.product_id);
      }

      const orderResult = db.prepare(
        `INSERT INTO orders (order_no, user_id, total_amount, status, shipping_address, remark, created_at, updated_at)
         VALUES (?, ?, ?, 'pending', ?, ?, datetime('now'), datetime('now'))`
      ).run(orderNumber, userId, totalAmount, shippingAddressJson, remark || '');

      const orderId = orderResult.lastInsertRowid;

      const insertItemStmt = db.prepare(
        'INSERT INTO order_items (order_id, product_id, product_name, quantity, price) VALUES (?, ?, ?, ?, ?)'
      );

      for (const item of items) {
        const product = db.prepare('SELECT name FROM products WHERE id = ?').get(item.product_id);
        insertItemStmt.run(orderId, item.product_id, product.name, item.quantity, item.price);
      }

      return orderId;
    });

    const order = await getOne('SELECT * FROM orders WHERE id = ?', [result]);
    const orderItems = await query(
      `SELECT oi.*, p.name AS product_name, p.image AS product_image
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`,
      [result]
    );

    res.status(201).json({
      success: true,
      data: {
        id: order.id,
        order_number: order.order_no,
        total_amount: order.total_amount,
        status: order.status,
        items: orderItems,
        shipping_address: order.shipping_address ? JSON.parse(order.shipping_address) : null,
        remark: order.remark,
        created_at: order.created_at
      },
      message: 'Order created successfully'
    });
  } catch (error) {
    console.error('Error creating order:', error);

    if (error.code === 'PRODUCT_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    }

    if (error.code === 'INSUFFICIENT_STOCK') {
      return res.status(400).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create order'
      }
    });
  }
});

router.get('/orders/my', async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [userId];
    let whereSql = 'WHERE user_id = ?';

    if (status) {
      const validStatuses = ['pending', 'paid', 'shipped', 'completed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
          }
        });
      }
      whereSql += ' AND status = ?';
      params.push(status);
    }

    const countResult = await getOne(
      `SELECT COUNT(*) AS total FROM orders ${whereSql}`,
      params
    );

    const orders = await query(
      `SELECT o.*,
              (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) AS item_count
       FROM orders o
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
          total: countResult.total
        }
      }
    });
  } catch (error) {
    console.error('Error getting my orders:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get orders'
      }
    });
  }
});

router.get('/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const order = await getOne('SELECT * FROM orders WHERE id = ?', [id]);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ORDER_NOT_FOUND',
          message: 'Order not found'
        }
      });
    }

    if (userRole !== 'admin' && order.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to access this order'
        }
      });
    }

    const items = await query(
      `SELECT oi.*, p.name AS product_name, p.image AS product_image, p.description AS product_description
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...order,
        shipping_address: order.shipping_address ? JSON.parse(order.shipping_address) : null,
        items,
        timeline: {
          created_at: order.created_at,
          updated_at: order.updated_at
        }
      }
    });
  } catch (error) {
    console.error('Error getting order details:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get order details'
      }
    });
  }
});

router.put('/orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'Status is required'
        }
      });
    }

    const validStatuses = ['pending', 'paid', 'shipped', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        }
      });
    }

    const order = await getOne('SELECT * FROM orders WHERE id = ?', [id]);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ORDER_NOT_FOUND',
          message: 'Order not found'
        }
      });
    }

    if (userRole !== 'admin' && order.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to modify this order'
        }
      });
    }

    const allowedTransitions = VALID_STATUS_TRANSITIONS[order.status] || [];
    if (!allowedTransitions.includes(status)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS_TRANSITION',
          message: `Cannot change status from ${order.status} to ${status}`
        }
      });
    }

    if (status === 'cancelled') {
      transaction((db) => {
        const orderItems = db.prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?').all(id);

        for (const item of orderItems) {
          db.prepare(
            "UPDATE products SET stock = stock + ?, updated_at = datetime('now') WHERE id = ?"
          ).run(item.quantity, item.product_id);
        }

        db.prepare(
          "UPDATE orders SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?"
        ).run(id);
      });
    } else {
      await execute(
        "UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?",
        [status, id]
      );
    }

    const updatedOrder = await getOne('SELECT * FROM orders WHERE id = ?', [id]);
    const items = await query(
      `SELECT oi.*, p.name AS product_name, p.image AS product_image
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...updatedOrder,
        shipping_address: updatedOrder.shipping_address ? JSON.parse(updatedOrder.shipping_address) : null,
        items
      },
      message: `Order status updated to ${status}`
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update order status'
      }
    });
  }
});

module.exports = router;
