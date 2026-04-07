const express = require('express');
const { db } = require('../db');
const router = express.Router();

// 生成订单号
function generateOrderNo() {
  const timestamp = new Date().getTime();
  const random = Math.floor(Math.random() * 1000);
  return `ORD${timestamp}${random.toString().padStart(3, '0')}`;
}

// 创建订单
router.post('/orders', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not initialized' });
    }
    
    const { userId, items, totalAmount, paymentMethod, shippingAddress, shippingPhone } = req.body;
    
    // 生成订单号
    const orderNo = generateOrderNo();
    
    // 插入订单
    const orderResult = await db.collection('orders').add({
      user_id: userId,
      order_no: orderNo,
      total_amount: totalAmount,
      status: 'pending',
      payment_method: paymentMethod,
      shipping_address: shippingAddress,
      shipping_phone: shippingPhone,
      created_at: new Date()
    });
    
    // 插入订单商品
    for (const item of items) {
      await db.collection('order_items').add({
        order_id: orderResult.id,
        product_id: item.productId,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.subtotal
      });
    }
    
    res.json({ success: true, data: { orderId: orderResult.id, orderNo } });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 获取订单列表
router.get('/orders', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not initialized' });
    }
    
    const { page = 1, limit = 10, status, userId } = req.query;
    const offset = (page - 1) * limit;
    
    let query = db.collection('orders');
    
    if (userId) {
      query = query.where({ user_id: userId });
    }
    
    if (status) {
      query = query.where({ status });
    }
    
    const orders = await query
      .orderBy('created_at', 'desc')
      .skip(offset)
      .limit(limit)
      .get();
    
    // 获取总数
    let countQuery = db.collection('orders');
    if (userId) {
      countQuery = countQuery.where({ user_id: userId });
    }
    if (status) {
      countQuery = countQuery.where({ status });
    }
    const count = await countQuery.count();
    
    res.json({
      success: true,
      data: {
        list: orders.data,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count.total
        }
      }
    });
  } catch (error) {
    console.error('Error getting orders:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 获取订单详情
router.get('/orders/:id', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not initialized' });
    }
    
    const { id } = req.params;
    
    // 获取订单信息
    const order = await db.collection('orders').doc(id).get();
    
    if (!order.data()) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    // 获取订单商品
    const items = await db.collection('order_items').where({ order_id: id }).get();
    
    const orderData = order.data();
    orderData.items = items.data;
    res.json({ success: true, data: orderData });
  } catch (error) {
    console.error('Error getting order details:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 取消订单
router.put('/orders/:id/cancel', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not initialized' });
    }
    
    const { id } = req.params;
    
    const order = await db.collection('orders').doc(id).get();
    if (!order.data() || order.data().status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Order cannot be cancelled' });
    }
    
    await db.collection('orders').doc(id).update({ status: 'cancelled' });
    res.json({ success: true, message: 'Order cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 支付订单
router.post('/orders/:id/pay', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not initialized' });
    }
    
    const { id } = req.params;
    const { paymentMethod } = req.body;
    
    const order = await db.collection('orders').doc(id).get();
    if (!order.data() || order.data().status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Order cannot be paid' });
    }
    
    await db.collection('orders').doc(id).update({ 
      status: 'paid',
      payment_method: paymentMethod 
    });
    res.json({ success: true, message: 'Order paid successfully' });
  } catch (error) {
    console.error('Error paying order:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 发货
router.post('/orders/:id/ship', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not initialized' });
    }
    
    const { id } = req.params;
    const { trackingNumber } = req.body;
    
    const order = await db.collection('orders').doc(id).get();
    if (!order.data() || order.data().status !== 'paid') {
      return res.status(400).json({ success: false, message: 'Order cannot be shipped' });
    }
    
    await db.collection('orders').doc(id).update({ 
      status: 'shipped',
      tracking_number: trackingNumber 
    });
    res.json({ success: true, message: 'Order shipped successfully' });
  } catch (error) {
    console.error('Error shipping order:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 获取物流信息
router.get('/orders/:id/logistics', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not initialized' });
    }
    
    const { id } = req.params;
    const order = await db.collection('orders').doc(id).get();
    
    if (!order.data()) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    res.json({ 
      success: true, 
      data: {
        trackingNumber: order.data().tracking_number,
        status: order.data().status
      }
    });
  } catch (error) {
    console.error('Error getting logistics info:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 获取物流跟踪
router.get('/orders/:id/logistics/tracking', async (req, res) => {
  try {
    const { id } = req.params;
    // 这里简化处理，实际应该调用物流API
    res.json({ 
      success: true, 
      data: [
        { time: new Date().toISOString(), status: '订单已创建' },
        { time: new Date().toISOString(), status: '订单已支付' },
        { time: new Date().toISOString(), status: '订单已发货' }
      ]
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 确认收货
router.put('/orders/:id/confirm', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not initialized' });
    }
    
    const { id } = req.params;
    
    const order = await db.collection('orders').doc(id).get();
    if (!order.data() || order.data().status !== 'shipped') {
      return res.status(400).json({ success: false, message: 'Order cannot be confirmed' });
    }
    
    await db.collection('orders').doc(id).update({ status: 'delivered' });
    res.json({ success: true, message: 'Order confirmed successfully' });
  } catch (error) {
    console.error('Error confirming order:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;