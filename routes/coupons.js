const express = require('express');
const { query, getOne, execute } = require('../db_mysql');
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

    page = parseInt(page);
    pageSize = Math.min(parseInt(pageSize), 100);

    if (!page || page < 1) page = 1;
    if (!pageSize || pageSize < 1) pageSize = 20;

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
          whereConditions.push('(start_time >= ? AND end_time <= ?)');
          params.push(startDate, endDate);
        }
      } catch (e) {}
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
    console.error('[ERROR] Getting coupons:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取优惠券列表失败'
      }
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, code, type, value, min_order_amount, max_discount, stock, per_user_limit, start_time, end_time, description } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '优惠券名称不能为空' }
      });
    }

    if (!type || !['fixed', 'percent'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '请选择有效的优惠券类型' }
      });
    }

    if (value === undefined || value <= 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '优惠值必须大于0' }
      });
    }

    if (!start_time || !end_time) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '请选择有效期' }
      });
    }

    if (new Date(start_time) >= new Date(end_time)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '开始时间必须早于结束时间' }
      });
    }

    if (!stock || stock < 1) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '库存数量至少为1' }
      });
    }

    if (type === 'percent' && value > 100) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '百分比折扣不能超过100%' }
      });
    }

    const finalCode = code && code.trim() !== '' ? code.trim() : generateCouponCode();

    const existingCode = await getOne('SELECT id FROM coupons WHERE code = ?', [finalCode]);
    if (existingCode) {
      return res.status(400).json({
        success: false,
        error: { code: 'DUPLICATE_CODE', message: '优惠码已存在，请更换' }
      });
    }

    const sql = `INSERT INTO coupons (name, code, type, value, min_order_amount, max_discount, stock, per_user_limit, start_time, end_time, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const result = await execute(sql, [
      name.trim(),
      finalCode,
      type,
      value,
      min_order_amount || 0,
      type === 'percent' ? (max_discount || null) : null,
      stock,
      per_user_limit || 1,
      start_time,
      end_time,
      description || null
    ]);

    const insertId = result.insertId;
    const newCoupon = await getOne('SELECT * FROM coupons WHERE id = ?', [insertId]);

    res.status(201).json({
      success: true,
      data: formatCoupon(newCoupon),
      message: '优惠券创建成功'
    });
  } catch (error) {
    console.error('[ERROR] Creating coupon:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '创建优惠券失败' }
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const sql = `SELECT c.*,
                 (SELECT COUNT(*) FROM user_coupons WHERE coupon_id = c.id) as received_count,
                 (SELECT COUNT(*) FROM user_coupons WHERE coupon_id = c.id AND status = 'used') as used_count
                 FROM coupons c
                 WHERE c.id = ?`;
    const coupon = await getOne(sql, [id]);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '优惠券不存在' }
      });
    }

    res.json({
      success: true,
      data: formatCoupon(coupon)
    });
  } catch (error) {
    console.error('[ERROR] Getting coupon details:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '获取优惠券详情失败' }
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, value, min_order_amount, max_discount, stock, per_user_limit, start_time, end_time, description, status } = req.body;

    const existingCoupon = await getOne('SELECT * FROM coupons WHERE id = ?', [id]);
    if (!existingCoupon) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '优惠券不存在' }
      });
    }

    const hasReceivedUsers = await getOne('SELECT COUNT(*) as cnt FROM user_coupons WHERE coupon_id = ?', [id]);
    
    const fields = [];
    const params = [];

    if (name !== undefined) {
      fields.push('name = ?');
      params.push(name.trim());
    }

    if (value !== undefined) {
      if (hasReceivedUsers.cnt > 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'UPDATE_NOT_ALLOWED', message: '已有用户领取的优惠券不允许修改优惠值' }
        });
      }
      if (value <= 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: '优惠值必须大于0' }
        });
      }
      fields.push('value = ?');
      params.push(value);
    }

    if (min_order_amount !== undefined) {
      fields.push('min_order_amount = ?');
      params.push(min_order_amount);
    }

    if (max_discount !== undefined) {
      fields.push('max_discount = ?');
      params.push(max_discount);
    }

    if (stock !== undefined) {
      if (stock < 1) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: '库存数量至少为1' }
        });
      }
      fields.push('stock = ?');
      params.push(stock);
    }

    if (per_user_limit !== undefined) {
      fields.push('per_user_limit = ?');
      params.push(per_user_limit);
    }

    if (start_time !== undefined && end_time !== undefined) {
      if (new Date(start_time) >= new Date(end_time)) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: '开始时间必须早于结束时间' }
        });
      }
      fields.push('start_time = ?, end_time = ?');
      params.push(start_time, end_time);
    }

    if (description !== undefined) {
      fields.push('description = ?');
      params.push(description);
    }

    if (status !== undefined && ['active', 'inactive', 'expired'].includes(status)) {
      fields.push('status = ?');
      params.push(status);
    }

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '没有提供需要更新的字段' }
      });
    }

    params.push(id);
    const sql = `UPDATE coupons SET ${fields.join(', ')} WHERE id = ?`;
    const result = await execute(sql, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '优惠券不存在' }
      });
    }

    const updatedCoupon = await getOne('SELECT * FROM coupons WHERE id = ?', [id]);

    res.json({
      success: true,
      data: formatCoupon(updatedCoupon),
      message: '优惠券更新成功'
    });
  } catch (error) {
    console.error('[ERROR] Updating coupon:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '更新优惠券失败' }
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const existingCoupon = await getOne('SELECT * FROM coupons WHERE id = ?', [id]);
    if (!existingCoupon) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '优惠券不存在' }
      });
    }

    const receivedCount = await getOne('SELECT COUNT(*) as cnt FROM user_coupons WHERE coupon_id = ?', [id]);
    if (receivedCount.cnt > 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'DELETE_NOT_ALLOWED', message: `该优惠券已有 ${receivedCount.cnt} 名用户领取，无法删除` }
      });
    }

    await execute('DELETE FROM coupons WHERE id = ?', [id]);

    res.json({ success: true, message: '优惠券删除成功' });
  } catch (error) {
    console.error('[ERROR] Deleting coupon:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '删除优惠券失败' }
    });
  }
});

router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;

    const coupon = await getOne('SELECT * FROM coupons WHERE id = ?', [id]);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '优惠券不存在' }
      });
    }

    const stats = await getOne(`
      SELECT 
        COUNT(*) as received_count,
        SUM(CASE WHEN status = 'used' THEN 1 ELSE 0 END) as used_count,
        SUM(CASE WHEN status = 'unused' THEN 1 ELSE 0 END) as unused_count,
        SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired_count
      FROM user_coupons WHERE coupon_id = ?
    `, [id]);

    const recentUsers = await query(`
      SELECT uc.user_id, uc.status, uc.received_at, uc.used_at, u.username, u.email
      FROM user_coupons uc
      LEFT JOIN users u ON uc.user_id = u.id
      WHERE uc.coupon_id = ?
      ORDER BY uc.received_at DESC
      LIMIT 10
    `, [id]);

    const dailyStats = await query(`
      SELECT DATE(received_at) as date, COUNT(*) as count
      FROM user_coupons
      WHERE coupon_id = ? AND received_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(received_at)
      ORDER BY date ASC
    `, [id]);

    res.json({
      success: true,
      data: {
        coupon_id: parseInt(id),
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
    console.error('[ERROR] Getting coupon stats:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '获取优惠券统计失败' }
    });
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
    console.error('[ERROR] Getting coupons overview:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '获取全局统计失败' }
    });
  }
});

module.exports = router;
