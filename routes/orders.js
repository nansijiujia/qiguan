// [TIMEOUT] 建议: 为长时间运行的数据库操作添加超时设置
// [PERFORMANCE] 建议: 考虑使用批量查询替代循环内单条查询以提高性能
// [PERFORMANCE] Example: 使用 IN (?) 和批量参数代替循环

const { 
  validateRequired, 
  validateString, 
  validateNumber, 
  validateId,
  validateEnum,
  validateArray,
  validateObject,
  validatePagination,
  sanitizeString,
  AppError 
} = require('../utils/validation');

const express = require('express');
const { query, getOne, execute } = require('../db-unified');
const { validateRequestBody } = require('../utils/validation');
const { sendErrorResponse } = require('../utils/error-handler');
const router = express.Router();

function createOrderNotification(orderData) {
  const template = {
    title: `新订单 #${orderData.order_number || orderData.id}`,
    content: `客户 ${orderData.customer_name || '未知'} 下了一笔新订单，金额 ¥${orderData.total_amount || orderData.amount || '0.00'}`,
    type: 'order',
    priority: 'high',
    related_type: 'order',
    related_id: orderData.id
  };
  return template;
}

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, status, keyword } = req.query;
    
    const { page: pageNum, limit: limitNum, offset } = validatePagination(req);
    
    if (status) {
      const validStatuses = ['pending', 'paid', 'shipped', 'completed', 'cancelled'];
      validateEnum(status, validStatuses, '订单状态');
    }

    const params = [];
    let whereSql = 'WHERE 1=1';

    if (status) {
      whereSql += ' AND o.status = ?';
      params.push(status);
    }

    if (keyword && keyword.trim()) {
      whereSql += ' AND (o.order_no LIKE ? OR u.username LIKE ?)';
      const kw = `%${keyword.trim()}%`;
      params.push(kw, kw);
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
      [...params, limitNum, offset]
    );

    const orderIds = orders.map(o => o.id);
    let itemsMap = {};
    if (orderIds.length > 0) {
      const allItems = await query(
        'SELECT * FROM order_items WHERE order_id IN (?)',
        [orderIds]
      );
      for (const item of allItems) {
        if (!itemsMap[item.order_id]) itemsMap[item.order_id] = [];
        itemsMap[item.order_id].push(item);
      }
    }

    res.json({
      success: true,
      data: {
        list: orders.map(order => ({
          ...order,
          shipping_address: order.shipping_address ? JSON.parse(order.shipping_address) : null,
          items: itemsMap[order.id] || []
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: countResult.total || 0
        }
      }
    });
  } catch (error) {
    console.error('[Orders/List] ❌ 获取订单列表失败:', error.message);
    return sendErrorResponse(res, error, 'Orders/List');
  }
});

router.post('/', async (req, res) => {
  try {
    const { items, shipping_address, remark } = req.body;

    // 输入验证 - 订单项必须存在且为数组
    validateArray(items, '订单项', { required: true, minLength: 1 });

    let totalAmount = 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // 验证每个订单项的字段
      if (!item.product_id) {
        throw new AppError(`订单项${i + 1}: 商品ID不能为空`, 400, 'INVALID_ORDER');
      }
      validateId(item.product_id, `订单项${i + 1}商品ID`);
      
      if (!item.quantity || item.quantity <= 0) {
        throw new AppError(`订单项${i + 1}: 数量必须是大于0的正整数`, 400, 'INVALID_ORDER');
      }
      validateNumber(item.quantity, `订单项${i + 1}数量`, { min: 1, integer: true });
      
      if (!item.price || item.price <= 0) {
        throw new AppError(`订单项${i + 1}: 价格必须大于0`, 400, 'INVALID_ORDER');
      }
      validateNumber(item.price, `订单项${i + 1}价格`, { min: 0.01, max: 999999.99 });
      
      totalAmount += parseInt(item.quantity) * Number(item.price);
    }

    // 验证收货地址（如果提供）
    if (shipping_address) {
      validateObject(shipping_address, '收货地址');
    }

    // 验证备注长度（如果提供）
    if (remark) {
      validateString(remark, '备注', { max: 500, required: false });
    }

    const timestamp = Date.now();
    const random = Math.random().toString().slice(2, 8);
    const orderNumber = `ORD${timestamp}${random}`;
    const shippingAddressJson = shipping_address ? JSON.stringify(shipping_address) : null;

    const result = await execute(
      `INSERT INTO orders (order_no, user_id, total_amount, status, shipping_address, remark)
       VALUES (?, ?, ?, 'pending', ?, ?)`,
      [orderNumber, req.user?.userId || null, totalAmount, shippingAddressJson, sanitizeString(remark || '')]
    );

    const orderId = result.insertId;

    for (const item of items) {
      const product = await getOne('SELECT name FROM products WHERE id = ?', [item.product_id]);
      await execute(
        'INSERT INTO order_items (order_id, product_id, product_name, quantity, price) VALUES (?, ?, ?, ?, ?)',
        [orderId, item.product_id, product?.name || 'Unknown', parseInt(item.quantity), Number(item.price)]
      );
    }

    try {
      const admins = await query('SELECT id FROM users WHERE role = \'admin\' AND status = \'active\'');
      
      if (admins && admins.length > 0) {
        const notification = createOrderNotification({
          id: orderId,
          order_number: orderNumber,
          total_amount: totalAmount,
          customer_name: req.user?.username || '未知'
        });
        
        for (const admin of admins) {
          await execute(
            `INSERT INTO notifications (user_id, title, content, type, priority, related_type, related_id, is_read, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, NOW())`,
            [admin.id, notification.title, notification.content, notification.type, 
             notification.priority, notification.related_type, notification.related_id]
          );
        }
        
        console.log(`[Orders/Notification] 📢 已向 ${admins.length} 位管理员发送订单通知 (订单ID: ${orderId})`);
      }
    } catch (notifyError) {
      console.error('[Orders/Notification] ❌ 发送订单通知失败:', notifyError.message);
    }

    res.status(201).json({
      success: true,
      data: { id: orderId, order_number: orderNumber, total_amount: totalAmount },
      message: 'Order created successfully'
    });
  } catch (error) {
    console.error('[Orders/Create] ❌ 创建订单失败:', error.message);
    return sendErrorResponse(res, error, 'Orders/Create');
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 验证ID
    const orderId = validateId(id, '订单ID');

    const order = await getOne('SELECT * FROM orders WHERE id = ?', [orderId]);

    if (!order) {
      throw new AppError('订单不存在', 404, 'NOT_FOUND');
    }

    const items = await query(
      'SELECT * FROM order_items WHERE order_id = ?',
      [orderId]
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
    console.error('[Orders/Detail] ❌ 获取订单详情失败:', error.message);
    return sendErrorResponse(res, error, 'Orders/Detail');
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // 验证ID和状态
    const orderId = validateId(id, '订单ID');
    
    if (!status) {
      throw new AppError('状态不能为空', 400, 'INVALID_STATUS');
    }
    
    const validStatuses = ['pending', 'paid', 'shipped', 'completed', 'cancelled'];
    validateEnum(status, validStatuses, '订单状态');

    await execute("UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?", [status, orderId]);

    const updatedOrder = await getOne('SELECT * FROM orders WHERE id = ?', [orderId]);
    res.json({ success: true, data: updatedOrder, message: `Order status updated to ${status}` });
  } catch (error) {
    console.error('[Orders/UpdateStatus] ❌ 更新订单状态失败:', error.message);
    return sendErrorResponse(res, error, 'Orders/UpdateStatus');
  }
});

// PUT /api/v1/orders/:id/cancel - 取消订单
router.put('/:id/cancel', async (req, res) => {
  try {
    const orderId = req.params.id;
    
    // 验证订单ID
    const validatedOrderId = validateId(orderId, '订单ID');
    
    const userId = req.user?.userId || req.user?.id;

    // 检查订单是否存在且属于当前用户（如果是普通用户）
    let order;
    if (userId) {
      const [orders] = await query(
        'SELECT * FROM orders WHERE id = ? AND user_id = ?',
        [validatedOrderId, userId]
      );

      if (!orders) {
        throw new AppError('订单不存在或无权操作', 404, 'NOT_FOUND');
      }
      order = orders;
    } else {
      // 管理员可以直接查询
      order = await getOne('SELECT * FROM orders WHERE id = ?', [validatedOrderId]);
      if (!order) {
        throw new AppError('订单不存在', 404, 'NOT_FOUND');
      }
    }

    // 检查订单状态是否可取消（只有待付款和待发货可取消）
    if (!['pending', 'paid'].includes(order.status)) {
      throw new AppError(`当前订单状态为${order.status}，无法取消`, 400, 'INVALID_STATUS');
    }

    // 更新订单状态
    await execute(
      "UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?",
      ['cancelled', validatedOrderId]
    );

    // 如果已支付，需要退款逻辑（此处简化处理）
    if (order.status === 'paid') {
      // TODO: 调用退款接口

    }

    // 记录管理员日志（如果有admin_logs表）
    try {
      await execute(
        `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, ip_address)
         VALUES (?, 'cancel_order', 'order', ?, ?, ?)`,
        [userId || 0, validatedOrderId, JSON.stringify({ orderId: validatedOrderId, previousStatus: order.status }), req.ip || 'unknown']
      );
    } catch (logError) {
      console.error('[orders] 日志记录失败:', logError.message);
    }
    
    res.json({
      success: true,
      message: '订单已成功取消',
      data: { orderId: validatedOrderId, newStatus: 'cancelled' }
    });
  } catch (error) {
    console.error('[Orders/Cancel] ❌ 取消订单失败:', error.message);
    return sendErrorResponse(res, error, 'Orders/Cancel');
  }
});

// PUT /api/v1/orders/:id/ship - 发货
router.put('/:id/ship', async (req, res) => {
  try {
    const orderId = req.params.id;
    
    // 验证订单ID
    const validatedOrderId = validateId(orderId, '订单ID');
    
    // 检查订单是否存在
    const order = await getOne('SELECT * FROM orders WHERE id = ?', [validatedOrderId]);
    if (!order) {
      throw new AppError('订单不存在', 404, 'NOT_FOUND');
    }

    // 检查订单状态是否可发货（只有已付款状态可发货）
    if (order.status !== 'paid') {
      throw new AppError(`当前订单状态为${order.status}，无法发货`, 400, 'INVALID_STATUS');
    }

    // 更新订单状态
    await execute(
      "UPDATE orders SET status = 'shipped', shipped_at = NOW(), updated_at = NOW() WHERE id = ?",
      [validatedOrderId]
    );

    res.json({
      success: true,
      message: '订单已成功发货',
      data: { orderId: validatedOrderId, newStatus: 'shipped' }
    });
  } catch (error) {
    console.error('[Orders/Ship] ❌ 发货失败:', error.message);
    return sendErrorResponse(res, error, 'Orders/Ship');
  }
});

// PUT /api/v1/orders/:id/confirm - 确认收货
router.put('/:id/confirm', async (req, res) => {
  try {
    const orderId = req.params.id;
    
    // 验证订单ID
    const validatedOrderId = validateId(orderId, '订单ID');
    
    // 检查订单是否存在
    const order = await getOne('SELECT * FROM orders WHERE id = ?', [validatedOrderId]);
    if (!order) {
      throw new AppError('订单不存在', 404, 'NOT_FOUND');
    }

    // 检查订单状态是否可确认收货（只有已发货状态可确认收货）
    if (order.status !== 'shipped') {
      throw new AppError(`当前订单状态为${order.status}，无法确认收货`, 400, 'INVALID_STATUS');
    }

    // 更新订单状态
    await execute(
      "UPDATE orders SET status = 'delivered', delivered_at = NOW(), updated_at = NOW() WHERE id = ?",
      [validatedOrderId]
    );

    res.json({
      success: true,
      message: '订单已成功确认收货',
      data: { orderId: validatedOrderId, newStatus: 'delivered' }
    });
  } catch (error) {
    console.error('[Orders/Confirm] ❌ 确认收货失败:', error.message);
    return sendErrorResponse(res, error, 'Orders/Confirm');
  }
});

module.exports = router;
