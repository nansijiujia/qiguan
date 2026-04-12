// [TIMEOUT] 建议: 为长时间运行的数据库操作添加超时设置
const { 
  validateRequired, 
  validateString, 
  validateNumber, 
  validateId,
  validateEnum,
  validatePagination,
  validateDate,
  sanitizeString,
  AppError 
} = require('../utils/validation');

const express = require('express');
const { query, getOne, execute } = require('../db_unified')
const { sendErrorResponse } = require('../utils/errorHandler');
const router = express.Router();

function generateCouponCode() {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `COUPON${timestamp}${random}`;
}

function formatCoupon(coupon) {
  return {
    ...coupon,
    type_label: coupon.type === 'fixed' ? '固定金额' : '百分比',
    status_label: coupon.status === 'active' ? '活跃' : coupon.status === 'inactive' ? '停用' : '已过期',
    usage_rate: coupon.stock > 0 ? ((coupon.used_count / coupon.stock) * 100).toFixed(2) : 0
  };
}

router.get('/', async (req, res) => {
  const startTime = Date.now();
  try {
    let { page = 1, pageSize = 20, status, type, keyword, dateRange } = req.query;

    // 验证分页参数
    page = Math.max(1, parseInt(page) || 1);
    pageSize = Math.min(100, Math.max(1, parseInt(pageSize) || 20));

    // 验证状态参数（如果提供）
    if (status) {
      const validStatuses = ['active', 'inactive', 'expired'];
      validateEnum(status, validStatuses, '优惠券状态');
    }

    // 验证类型参数（如果提供）
    if (type) {
      const validTypes = ['fixed', 'percent'];
      validateEnum(type, validTypes, '优惠券类型');
    }

    // 验证搜索关键词（如果提供）
    if (keyword) {
      validateString(keyword, '搜索关键词', { min: 1, max: 50, required: false });
    }

    const offset = (page - 1) * pageSize;

    let whereConditions = [];
    let params = [];

    if (status && ['active', 'inactive', 'expired'].includes(status)) {
      whereConditions.push('status = ?');
      params.push(status);
    }

    if (type && ['fixed', 'percent'].includes(type)) {
      whereConditions.push('type = ?');
      params.push(type);
    }

    if (keyword) {
      whereConditions.push('(name LIKE ? OR code LIKE ?)');
      const likePattern = `%${keyword}%`;
      params.push(likePattern, likePattern);
    }

    if (dateRange) {
      try {
        const [startDate, endDate] = JSON.parse(dateRange);
        if (startDate && endDate) {
          // 验证日期格式
          const start = new Date(startDate);
          const end = new Date(endDate);
          if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            whereConditions.push('(start_time >= ? AND end_time <= ?)');
            params.push(startDate, endDate);
          }
        }
      } catch (e) {
        throw new AppError('日期范围格式不正确', 400, 'INVALID_DATE_RANGE');
      }
    }

    const whereSql = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) AS total FROM coupons ${whereSql}`;
    const countResult = await getOne(countSql, params);
    const total = countResult ? countResult.total : 0;
    const totalPages = Math.ceil(total / pageSize);

    const sql = `SELECT * FROM coupons ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const listParams = [...params, pageSize, offset];
    const list = await query(sql, listParams);

    const formattedList = list.map(formatCoupon);

    res.json({
      success: true,
      data: {
        list: formattedList,
        pagination: {
          total,
          totalPages,
          page,
          pageSize
        }
      },
      responseTime: Date.now() - startTime
    });
  } catch (error) {
    console.error('[Coupons/List] ❌ 获取优惠券列表失败:', error.message);
    return sendErrorResponse(res, error, 'Coupons/List');
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, code, type, value, min_order_amount, max_discount, stock, per_user_limit, start_time, end_time, description } = req.body;

    // 输入验证
    validateRequired(['name', 'type', 'value', 'start_time', 'end_time', 'stock'], req.body);
    
    validateString(name, '优惠券名称', { min: 2, max: 100 });
    
    const validTypes = ['fixed', 'percent'];
    validateEnum(type, validTypes, '优惠券类型');
    
    validateNumber(value, '优惠值', { min: 0.01, max: type === 'percent' ? 100 : 99999 });

    // 日期验证
    const startDate = validateDate(start_time, '开始时间');
    const endDate = validateDate(end_time, '结束时间');

    if (startDate >= endDate) {
      throw new AppError('开始时间必须早于结束时间', 400, 'INVALID_DATE_RANGE');
    }

    validateNumber(stock, '库存数量', { min: 1, integer: true });
    
    if (per_user_limit !== undefined) {
      validateNumber(per_user_limit, '每人限领数量', { min: 1, integer: true });
    }

    if (min_order_amount !== undefined) {
      validateNumber(min_order_amount, '最低订单金额', { min: 0 });
    }

    if (max_discount !== undefined && type === 'percent') {
      validateNumber(max_discount, '最大折扣金额', { min: 0 });
    }

    if (description) {
      validateString(description, '描述', { max: 500, required: false });
    }

    // 百分比类型特殊验证
    if (type === 'percent' && value > 100) {
      throw new AppError('百分比折扣不能超过100%', 400, 'VALIDATION_ERROR');
    }

    // 优惠码验证（如果提供）
    const finalCode = code && code.trim() !== '' ? code.trim() : generateCouponCode();
    if (code && code.trim() !== '') {
      validateString(code, '优惠码', { min: 4, max: 20, pattern: /^[A-Za-z0-9]+$/ });
    }

    const existingCode = await getOne('SELECT id FROM coupons WHERE code = ?', [finalCode]);
    if (existingCode) {
      throw new AppError('优惠码已存在，请更换', 400, 'DUPLICATE_CODE');
    }

    const sql = `INSERT INTO coupons (name, code, type, value, min_order_amount, max_discount, stock, per_user_limit, start_time, end_time, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const result = await execute(sql, [
      sanitizeString(name),
      finalCode,
      type,
      Number(value),
      min_order_amount || 0,
      type === 'percent' ? (max_discount || null) : null,
      parseInt(stock),
      per_user_limit || 1,
      start_time,
      end_time,
      sanitizeString(description || null)
    ]);

    const insertId = result.insertId;
    const newCoupon = await getOne('SELECT * FROM coupons WHERE id = ?', [insertId]);

    res.status(201).json({
      success: true,
      data: formatCoupon(newCoupon),
      message: '优惠券创建成功'
    });
  } catch (error) {
    console.error('[Coupons/Create] ❌ 创建优惠券失败:', error.message);
    return sendErrorResponse(res, error, 'Coupons/Create');
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 验证ID
    const couponId = validateId(id, '优惠券ID');

    const sql = `SELECT c.*,
                 (SELECT COUNT(*) FROM user_coupons WHERE coupon_id = c.id) as received_count,
                 (SELECT COUNT(*) FROM user_coupons WHERE coupon_id = c.id AND status = 'used') as used_count
                 FROM coupons c
                 WHERE c.id = ?`;
    const coupon = await getOne(sql, [couponId]);

    if (!coupon) {
      throw new AppError('优惠券不存在', 404, 'NOT_FOUND');
    }

    res.json({
      success: true,
      data: formatCoupon(coupon)
    });
  } catch (error) {
    console.error('[Coupons/Detail] ❌ 获取优惠券详情失败:', error.message);
    return sendErrorResponse(res, error, 'Coupons/Detail');
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, value, min_order_amount, max_discount, stock, per_user_limit, start_time, end_time, description, status } = req.body;

    // 验证ID
    const couponId = validateId(id, '优惠券ID');

    const existingCoupon = await getOne('SELECT * FROM coupons WHERE id = ?', [couponId]);
    if (!existingCoupon) {
      throw new AppError('优惠券不存在', 404, 'NOT_FOUND');
    }

    const hasReceivedUsers = await getOne('SELECT COUNT(*) as cnt FROM user_coupons WHERE coupon_id = ?', [couponId]);
    
    const fields = [];
    const params = [];

    // 字段级别验证
    if (name !== undefined) {
      validateString(name, '优惠券名称', { min: 2, max: 100 });
      fields.push('name = ?');
      params.push(sanitizeString(name));
    }

    if (value !== undefined) {
      if (hasReceivedUsers.cnt > 0) {
        throw new AppError('已有用户领取的优惠券不允许修改优惠值', 400, 'UPDATE_NOT_ALLOWED');
      }
      validateNumber(value, '优惠值', { min: 0.01, max: existingCoupon.type === 'percent' ? 100 : 99999 });
      
      // 百分比类型特殊验证
      if (existingCoupon.type === 'percent' && value > 100) {
        throw new AppError('百分比折扣不能超过100%', 400, 'VALIDATION_ERROR');
      }
      
      fields.push('value = ?');
      params.push(Number(value));
    }

    if (min_order_amount !== undefined) {
      validateNumber(min_order_amount, '最低订单金额', { min: 0 });
      fields.push('min_order_amount = ?');
      params.push(Number(min_order_amount));
    }

    if (max_discount !== undefined) {
      validateNumber(max_discount, '最大折扣金额', { min: 0 });
      fields.push('max_discount = ?');
      params.push(max_discount);
    }

    if (stock !== undefined) {
      validateNumber(stock, '库存数量', { min: 1, integer: true });
      fields.push('stock = ?');
      params.push(parseInt(stock));
    }

    if (per_user_limit !== undefined) {
      validateNumber(per_user_limit, '每人限领数量', { min: 1, integer: true });
      fields.push('per_user_limit = ?');
      params.push(parseInt(per_user_limit));
    }

    if (start_time !== undefined && end_time !== undefined) {
      const startDate = validateDate(start_time, '开始时间');
      const endDate = validateDate(end_time, '结束时间');
      
      if (startDate >= endDate) {
        throw new AppError('开始时间必须早于结束时间', 400, 'INVALID_DATE_RANGE');
      }
      fields.push('start_time = ?, end_time = ?');
      params.push(start_time, end_time);
    }

    if (description !== undefined) {
      validateString(description, '描述', { max: 500 });
      fields.push('description = ?');
      params.push(sanitizeString(description));
    }

    if (status !== undefined) {
      const validStatuses = ['active', 'inactive', 'expired'];
      validateEnum(status, validStatuses, '优惠券状态');
      fields.push('status = ?');
      params.push(status);
    }

    if (fields.length === 0) {
      throw new AppError('没有提供需要更新的字段', 400, 'VALIDATION_ERROR');
    }

    params.push(couponId);
    const sql = `UPDATE coupons SET ${fields.join(' ')} WHERE id = ?`;
    const result = await execute(sql, params);

    if (result.affectedRows === 0) {
      throw new AppError('优惠券不存在', 404, 'NOT_FOUND');
    }

    const updatedCoupon = await getOne('SELECT * FROM coupons WHERE id = ?', [couponId]);

    res.json({
      success: true,
      data: formatCoupon(updatedCoupon),
      message: '优惠券更新成功'
    });
  } catch (error) {
    console.error('[Coupons/Update] ❌ 更新优惠券失败:', error.message);
    return sendErrorResponse(res, error, 'Coupons/Update');
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 验证ID
    const couponId = validateId(id, '优惠券ID');

    const existingCoupon = await getOne('SELECT * FROM coupons WHERE id = ?', [couponId]);
    if (!existingCoupon) {
      throw new AppError('优惠券不存在', 404, 'NOT_FOUND');
    }

    const receivedCount = await getOne('SELECT COUNT(*) as cnt FROM user_coupons WHERE coupon_id = ?', [couponId]);
    if (receivedCount.cnt > 0) {
      throw new AppError(`该优惠券已有 ${receivedCount.cnt} 名用户领取，无法删除`, 400, 'DELETE_NOT_ALLOWED');
    }

    await execute('DELETE FROM coupons WHERE id = ?', [couponId]);

    res.json({ success: true, message: '优惠券删除成功' });
  } catch (error) {
    console.error('[Coupons/Delete] ❌ 删除优惠券失败:', error.message);
    return sendErrorResponse(res, error, 'Coupons/Delete');
  }
});

router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 验证ID
    const couponId = validateId(id, '优惠券ID');

    const coupon = await getOne('SELECT * FROM coupons WHERE id = ?', [couponId]);
    if (!coupon) {
      throw new AppError('优惠券不存在', 404, 'NOT_FOUND');
    }

    const stats = await getOne(`
      SELECT 
        COUNT(*) as received_count,
        SUM(CASE WHEN status = 'used' THEN 1 ELSE 0 END) as used_count,
        SUM(CASE WHEN status = 'unused' THEN 1 ELSE 0 END) as unused_count,
        SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired_count
      FROM user_coupons WHERE coupon_id = ?
    `, [couponId]);

    const recentUsers = await query(`
      SELECT uc.user_id, uc.status, uc.received_at, uc.used_at, u.username, u.email
      FROM user_coupons uc
      LEFT JOIN users u ON uc.user_id = u.id
      WHERE uc.coupon_id = ?
      ORDER BY uc.received_at DESC
      LIMIT 10
    `, [couponId]);

    const dailyStats = await query(`
      SELECT DATE(received_at) as date, COUNT(*) as count
      FROM user_coupons
      WHERE coupon_id = ? AND received_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(received_at)
      ORDER BY date ASC
    `, [couponId]);

    res.json({
      success: true,
      data: {
        coupon_id: parseInt(couponId),
        coupon_name: coupon.name,
        received_count: stats?.received_count || 0,
        used_count: stats?.used_count || 0,
        unused_count: stats?.unused_count || 0,
        expired_count: stats?.expired_count || 0,
        usage_rate: stats?.received_count > 0 ? ((stats.used_count / stats.received_count) * 100).toFixed(2) : 0,
        recent_users: recentUsers,
        daily_stats: dailyStats
      }
    });
  } catch (error) {
    console.error('[Coupons/Stats] ❌ 获取优惠券统计失败:', error.message);
    return sendErrorResponse(res, error, 'Coupons/Stats');
  }
});

router.get('/stats/overview', async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const overview = await getOne(`
      SELECT 
        COUNT(*) as total_count,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count,
        SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive_count,
        SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired_count
      FROM coupons
    `);

    const todayReceived = await getOne(`
      SELECT COUNT(*) as count FROM user_coupons WHERE received_at >= ?
    `, [todayStart.toISOString()]);

    const todayUsed = await getOne(`
      SELECT COUNT(*) as count FROM user_coupons WHERE used_at >= ?
    `, [todayStart.toISOString()]);

    const statusDistribution = await query(`
      SELECT status, COUNT(*) as count FROM coupons GROUP BY status
    `);

    const typeDistribution = await query(`
      SELECT type, COUNT(*) as count FROM coupons GROUP BY type
    `);

    res.json({
      success: true,
      data: {
        total: overview?.total_count || 0,
        active_count: overview?.active_count || 0,
        inactive_count: overview?.inactive_count || 0,
        expired_count: overview?.expired_count || 0,
        today_received: todayReceived?.count || 0,
        today_used: todayUsed?.count || 0,
        status_distribution: statusDistribution,
        type_distribution: typeDistribution
      }
    });
  } catch (error) {
    console.error('[Coupons/Overview] ❌ 获取全局统计失败:', error.message);
    return sendErrorResponse(res, error, 'Coupons/Overview');
  }
});

module.exports = router;
