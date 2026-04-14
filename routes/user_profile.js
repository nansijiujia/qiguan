// [TIMEOUT] 建议: 为长时间运行的数据库操作添加超时设置
const express = require('express');
const { getOne, query, execute } = require('../db_unified')
const { validateRequestBody } = require('../utils/validation');
const { asyncHandler } = require('../middleware/errorHandler');
const router = express.Router();

router.get('/me', asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } });
  }

  const user = await getOne(
    `SELECT id, username, email, avatar, role, status, last_login, created_at
     FROM users WHERE id = ?`,
    [userId]
  );

  if (!user) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '用户不存在' } });
  }

  res.json({ success: true, data: user });
}));

router.put('/me', asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } });
  }

  const { username, email, avatar } = req.body;
  const fields = [];
  const values = [];

  if (username !== undefined) { fields.push('username = ?'); values.push(username); }
  if (email !== undefined) { fields.push('email = ?'); values.push(email); }
  if (avatar !== undefined) { fields.push('avatar = ?'); values.push(avatar); }

  if (fields.length === 0) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '没有提供需要更新的字段' } });
  }

  values.push(userId);
  await execute(`UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`, values);

  const updatedUser = await getOne(
    `SELECT id, username, email, avatar, role, status, created_at FROM users WHERE id = ?`,
    [userId]
  );

  res.json({ success: true, data: updatedUser, message: '个人信息更新成功' });
}));

router.get('/favorites', asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } });
  }

  const { page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const favorites = await query(
    `SELECT f.*, p.name as product_name, p.price, p.image, p.status as product_status
     FROM favorites f
     LEFT JOIN products p ON f.product_id = p.id
     WHERE f.user_id = ?
     ORDER BY f.created_at DESC
     LIMIT ? OFFSET ?`,
    [userId, parseInt(limit), offset]
  );

  const countResult = await getOne('SELECT COUNT(*) AS total FROM favorites WHERE user_id = ?', [userId]);

  res.json({
    success: true,
    data: {
      list: favorites,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult?.total || 0
      }
    }
  });
}));

router.post('/favorites', asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } });
  }

  const { product_id } = req.body;
  if (!product_id) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '商品ID不能为空' } });
  }

  const existing = await getOne('SELECT id FROM favorites WHERE user_id = ? AND product_id = ?', [userId, product_id]);
  if (existing) {
    return res.status(409).json({ success: false, error: { code: 'DUPLICATE_ERROR', message: '已经收藏过该商品' } });
  }

  const result = await execute(
    'INSERT INTO favorites (user_id, product_id) VALUES (?, ?)',
    [userId, product_id]
  );

  res.status(201).json({ success: true, data: { id: result.insertId }, message: '收藏成功' });
}));

router.delete('/favorites/:product_id', asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } });
  }

  const { product_id } = req.params;
  await execute('DELETE FROM favorites WHERE user_id = ? AND product_id = ?', [userId, product_id]);

  res.json({ success: true, message: '取消收藏成功' });
}));

router.get('/footprints', asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } });
  }

  const { page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const footprints = await query(
    `SELECT f.*, p.name as product_name, p.price, p.image
     FROM footprints f
     LEFT JOIN products p ON f.product_id = p.id
     WHERE f.user_id = ?
     ORDER BY f.created_at DESC
     LIMIT ? OFFSET ?`,
    [userId, parseInt(limit), offset]
  );

  const countResult = await getOne('SELECT COUNT(*) AS total FROM footprints WHERE user_id = ?', [userId]);

  res.json({
    success: true,
    data: {
      list: footprints,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult?.total || 0
      }
    }
  });
}));

router.get('/coupons', asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } });
  }

  const { status } = req.query;
  let whereSql = 'WHERE uc.user_id = ?';
  const params = [userId];

  if (status && ['unused', 'used', 'expired'].includes(status)) {
    whereSql += ' AND uc.status = ?';
    params.push(status);
  }

  const coupons = await query(
    `SELECT uc.*, c.name as coupon_name, c.code, c.type, c.value,
            c.min_order_amount, c.start_time, c.end_time
     FROM user_coupons uc
     LEFT JOIN coupons c ON uc.coupon_id = c.id
     ${whereSql}
     ORDER BY uc.received_at DESC`,
    params
  );

  res.json({ success: true, data: coupons });
}));

module.exports = router;