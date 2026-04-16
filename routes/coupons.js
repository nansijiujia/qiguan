// [TIMEOUT] 建议: 为长时间运行的数据库操作添加超时设置
const { 
  validateRequired, 
  validateString, 
  validateNumber, 
  validateId,
  validateEnum,
  validatePagination,
  validateDate,
  validateArray,
  sanitizeString,
  AppError 
} = require('../utils/validation');

const express = require('express');
const { query, getOne, execute } = require('../db-unified')
const { sendErrorResponse } = require('../utils/error-handler');
const router = express.Router();

function generateCouponCode() {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `COUPON${timestamp}${random}`;
}

function formatCoupon(coupon) {
  if (!coupon) return null;
  
  return {
    ...coupon,
    type_label: coupon.type === 'fixed' ? '固定金额' : (coupon.type === 'percent' ? '百分比' : '未知'),
    status_label: coupon.status === 'active' ? '活跃' : (coupon.status === 'inactive' ? '停用' : (coupon.status === 'expired' ? '已过期' : '未知')),
    usage_rate: coupon.stock > 0 ? ((coupon.used_count || 0) / coupon.stock * 100).toFixed(2) : '0'
  };
}

router.get('/', async (req, res) => {
  const startTime = Date.now();
  const requestId = `COUPON_LIST_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  try {
    console.log(`[${requestId}] 📥 请求参数:`, {
      query: req.query,
      ip: req.ip,
      userAgent: req.headers['user-agent']?.substring(0, 50)
    });
    
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

    const formattedList = (list || []).map(coupon => formatCoupon(coupon)).filter(c => c !== null);

    const responseTime = Date.now() - startTime;
    
    console.log(`[${requestId}] ✅ 查询成功:`, {
      total,
      page,
      pageSize,
      responseTime: `${responseTime}ms`,
      itemCount: formattedList.length
    });

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
      responseTime
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`[${requestId}] ❌ 获取优惠券列表失败 (${responseTime}ms):`, {
      message: error.message,
      code: error.code,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack?.substring(0, 500)
    });
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

    // 优惠码验证（如果提供）- 增强验证：6-32字符，仅大写字母和数字
    const finalCode = code && code.trim() !== '' ? code.trim().toUpperCase() : generateCouponCode();
    if (code && code.trim() !== '') {
      validateString(code, '优惠码', { min: 6, max: 32, pattern: /^[A-Z0-9]+$/ });
      
      // 额外检查：确保是大写字母和数字
      const upperCode = code.trim().toUpperCase();
      if (!/^[A-Z0-9]{6,32}$/.test(upperCode)) {
        throw new AppError('优惠码格式不正确：必须为6-32位大写字母或数字', 400, 'INVALID_CODE_FORMAT');
      }
    }

    const existingCode = await getOne('SELECT id FROM coupons WHERE code = ?', [finalCode]);
    if (existingCode) {
      throw new AppError('优惠码已存在，请更换', 400, 'DUPLICATE_CODE');
    }

    // 兼容性处理：支持不同的数据库字段名
    const sql = `INSERT INTO coupons (name, code, type, value, min_order_amount, max_discount, stock, per_user_limit, start_time, end_time, start_date, end_date, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
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
      start_time,  // start_date 字段兼容
      end_time,    // end_date 字段兼容
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
  const startTime = Date.now();
  const requestId = `COUPON_STATS_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  try {
    const { id } = req.params;
    
    // 验证ID
    const couponId = validateId(id, '优惠券ID');

    console.log(`[${requestId}] 📊 开始查询优惠券统计 ID:${couponId}`);

    const coupon = await getOne('SELECT * FROM coupons WHERE id = ?', [couponId]);
    if (!coupon) {
      throw new AppError('优惠券不存在', 404, 'NOT_FOUND');
    }

    // 兼容性处理：尝试多种可能的字段名组合
    let stats = { received_count: 0, used_count: 0, unused_count: 0, expired_count: 0 };
    
    try {
      stats = await getOne(`
        SELECT 
          COUNT(*) as received_count,
          SUM(CASE WHEN status = 'used' THEN 1 ELSE 0 END) as used_count,
          SUM(CASE WHEN status = 'unused' THEN 1 ELSE 0 END) as unused_count,
          SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired_count
        FROM user_coupons WHERE coupon_id = ?
      `, [couponId]) || stats;
      console.log(`[${requestId}] ✅ 基础统计查询成功`);
    } catch (e) {
      console.warn(`[${requestId}] ⚠️ user_coupons 表基础查询失败:`, e.message);
      // 尝试简化查询
      try {
        const simpleStats = await getOne(`
          SELECT COUNT(*) as received_count FROM user_coupons WHERE coupon_id = ?
        `, [couponId]);
        if (simpleStats) {
          stats.received_count = simpleStats.received_count || 0;
        }
        console.log(`[${requestId}] ✅ 简化统计查询成功`);
      } catch (e2) {
        console.error(`[${requestId}] ❌ 所有统计查询均失败:`, e2.message);
        stats = { received_count: 0, used_count: 0, unused_count: 0, expired_count: 0 };
      }
    }

    // 最近用户记录 - 使用字段降级机制
    let recentUsers = [];
    try {
      recentUsers = await query(`
        SELECT uc.user_id, uc.status, 
               COALESCE(uc.received_at, uc.created_at) as received_at,
               COALESCE(uc.used_at, uc.updated_at) as used_at,
               u.username, u.email
        FROM user_coupons uc
        LEFT JOIN users u ON uc.user_id = u.id
        WHERE uc.coupon_id = ?
        ORDER BY COALESCE(uc.received_at, uc.created_at, uc.updated_at) DESC
        LIMIT 10
      `, [couponId]) || [];
      console.log(`[${requestId}] ✅ 最近用户查询成功, 数量: ${recentUsers.length}`);
    } catch (e) {
      console.warn(`[${requestId}] ⚠️ 最近用户查询失败，使用空数组:`, e.message);
      recentUsers = [];
      
      // 尝试更简单的查询
      try {
        recentUsers = await query(`
          SELECT uc.user_id, uc.status, uc.created_at as received_at, NULL as used_at
          FROM user_coupons uc
          WHERE uc.coupon_id = ?
          ORDER BY uc.created_at DESC
          LIMIT 10
        `, [couponId]) || [];
        console.log(`[${requestId]} ✅ 简化最近用户查询成功`);
      } catch (e2) {
        console.error(`[${requestId}] ❌ 所有最近用户查询均失败`);
        recentUsers = [];
      }
    }

    // 每日统计 - 使用字段降级机制
    let dailyStats = [];
    try {
      dailyStats = await query(`
        SELECT DATE(COALESCE(received_at, created_at)) as date, COUNT(*) as count
        FROM user_coupons
        WHERE coupon_id = ? AND COALESCE(received_at, created_at) >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(COALESCE(received_at, created_at))
        ORDER BY date ASC
      `, [couponId]) || [];
      console.log(`[${requestId}] ✅ 每日统计查询成功, 数量: ${dailyStats.length}`);
    } catch (e) {
      console.warn(`[${requestId}] ⚠️ 每日统计查询失败，使用空数组:`, e.message);
      dailyStats = [];
      
      // 尝试使用 created_at 字段
      try {
        dailyStats = await query(`
          SELECT DATE(created_at) as date, COUNT(*) as count
          FROM user_coupons
          WHERE coupon_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
          GROUP BY DATE(created_at)
          ORDER BY date ASC
        `, [couponId]) || [];
        console.log(`[${requestId}] ✅ 简化每日统计查询成功`);
      } catch (e2) {
        console.error(`[${requestId}] ❌ 所有每日统计查询均失败`);
        dailyStats = [];
      }
    }

    const responseTime = Date.now() - startTime;
    console.log(`[${requestId}] ✅ 优惠券统计查询完成 (${responseTime}ms)`);

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
      },
      responseTime
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`[${requestId}] ❌ 获取优惠券统计失败 (${responseTime}ms):`, {
      message: error.message,
      code: error.code,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack?.substring(0, 500)
    });
    return sendErrorResponse(res, error, 'Coupons/Stats');
  }
});

router.get('/stats/overview', async (req, res) => {
  const startTime = Date.now();
  const requestId = `COUPON_OVERVIEW_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  try {
    console.log(`[${requestId}] 📊 开始查询全局统计概览`);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // 兼容性处理：优惠券基础统计
    let overview = { total_count: 0, active_count: 0, inactive_count: 0, expired_count: 0 };
    try {
      overview = await getOne(`
        SELECT
          COUNT(*) as total_count,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count,
          SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive_count,
          SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired_count
        FROM coupons
      `) || overview;
      console.log(`[${requestId}] ✅ 优惠券基础统计成功`);
    } catch (e) {
      console.error(`[${requestId}] ❌ 优惠券基础统计失败:`, e.message);
    }

    // 兼容性处理：尝试多个可能的字段名查询今日领取数
    let todayReceived = { count: 0 };
    
    try {
      todayReceived = await getOne(`
        SELECT COUNT(*) as count FROM user_coupons WHERE created_at >= ?
      `, [todayStart.toISOString()]);
      console.log(`[${requestId}] ✅ 今日领取数(created_at)查询成功`);
    } catch (e) {
      console.warn(`[${requestId}] ⚠️ created_at字段查询失败，尝试received_at字段:`, e.message);
      
      try {
        todayReceived = await getOne(`
          SELECT COUNT(*) as count FROM user_coupons WHERE received_at >= ?
        `, [todayStart.toISOString()]);
        console.log(`[${requestId}] ✅ 今日领取数(received_at)查询成功`);
      } catch (e2) {
        console.warn(`[${requestId}] ⚠️ received_at字段也不存在，今日领取数设为0`);
        
        try {
          todayReceived = await getOne(`
            SELECT COUNT(*) as count FROM user_coupons WHERE updated_at >= ?
          `, [todayStart.toISOString()]);
          console.log(`[${requestId}] ✅ 今日领取数(updated_at)查询成功`);
        } catch (e3) {
          console.error(`[${requestId}] ❌ 所有日期字段查询均失败，今日领取数设为0`);
          todayReceived = { count: 0 };
        }
      }
    }

    // 兼容性处理：尝试多个可能的字段名查询今日使用数
    let todayUsed = { count: 0 };
    
    try {
      todayUsed = await getOne(`
        SELECT COUNT(*) as count FROM user_coupons WHERE status = 'used' AND updated_at >= ?
      `, [todayStart.toISOString()]);
      console.log(`[${requestId}] ✅ 今日使用数(updated_at)查询成功`);
    } catch (e) {
      console.warn(`[${requestId}] ⚠️ used_at/updated_at字段查询失败，尝试替代方案:`, e.message);
      
      try {
        todayUsed = await getOne(`
          SELECT COUNT(*) as count FROM user_coupons WHERE status = 'used' AND created_at >= ?
        `, [todayStart.toISOString()]);
        console.log(`[${requestId}] ✅ 今日使用数(created_at)查询成功`);
      } catch (e2) {
        console.warn(`[${requestId}] ⚠️ 无法统计今日使用数，设为0`);
        todayUsed = { count: 0 };
      }
    }

    // 状态分布统计 - 增强错误处理
    let statusDistribution = [];
    try {
      statusDistribution = await query(`
        SELECT status, COUNT(*) as count FROM coupons GROUP BY status
      `) || [];
      console.log(`[${requestId}] ✅ 状态分布统计成功`);
    } catch (e) {
      console.warn(`[${requestId}] ⚠️ 状态分布统计失败:`, e.message);
      statusDistribution = [];
    }

    // 类型分布统计 - 增强错误处理
    let typeDistribution = [];
    try {
      typeDistribution = await query(`
        SELECT type, COUNT(*) as count FROM coupons GROUP BY type
      `) || [];
      console.log(`[${requestId}] ✅ 类型分布统计成功`);
    } catch (e) {
      console.warn(`[${requestId}] ⚠️ 类型分布统计失败:`, e.message);
      typeDistribution = [];
    }

    const responseTime = Date.now() - startTime;
    console.log(`[${requestId}] ✅ 全局统计概览查询完成 (${responseTime}ms)`);

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
      },
      responseTime
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`[${requestId}] ❌ 获取全局统计失败 (${responseTime}ms):`, {
      message: error.message,
      code: error.code,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack?.substring(0, 500)
    });
    
    // 即使出错也返回基本结构，避免前端崩溃
    res.json({
      success: true,
      data: {
        total: 0,
        active_count: 0,
        inactive_count: 0,
        expired_count: 0,
        today_received: 0,
        today_used: 0,
        status_distribution: [],
        type_distribution: []
      },
      responseTime,
      warning: '统计数据获取部分失败，显示默认值'
    });
  }
});

// ============================================================
// 新增接口：指定账号发放优惠券 POST /api/v1/admin/coupons/:id/assign
// 权限: requirePermission('coupons', 'assign')
// ============================================================
const { requirePermission } = require('../middleware/rbac');

router.post('/:id/assign', requirePermission('coupons', 'assign'), async (req, res) => {
  const startTime = Date.now();
  let connection;
  
  try {
    const { id } = req.params;
    const { userIds } = req.body;

    // 验证参数
    const couponId = validateId(id, '优惠券ID');
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      throw new AppError('请提供要发放的用户ID列表', 400, 'MISSING_USER_IDS');
    }

    if (userIds.length > 100) {
      throw new AppError('单次发放用户数量不能超过100个', 400, 'TOO_MANY_USERS');
    }

    validateArray(userIds, '用户ID列表', { maxLength: 100 });

    // 获取数据库连接用于事务
    const dbModule = require('../db-unified');
    const pool = dbModule.mysqlPool || global.mysqlPool;
    
    if (!pool) {
      throw new AppError('数据库连接池未初始化', 503, 'DB_NOT_READY');
    }
    
    connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 1. 验证优惠券存在且状态为 active
      const [couponRows] = await connection.query(
        'SELECT * FROM coupons WHERE id = ? FOR UPDATE',
        [couponId]
      );
      
      if (!couponRows || couponRows.length === 0) {
        await connection.rollback();
        throw new AppError('优惠券不存在', 404, 'COUPON_NOT_FOUND');
      }

      const coupon = couponRows[0];

      if (coupon.status !== 'active') {
        await connection.rollback();
        throw new AppError(`优惠券当前状态为"${coupon.status}"，无法发放`, 400, 'COUPON_INACTIVE');
      }

      // 2. 验证库存充足
      const remainingStock = coupon.stock - coupon.used_count;
      if (remainingStock <= 0) {
        await connection.rollback();
        throw new AppError('优惠券库存已不足，无法发放', 400, 'OUT_OF_STOCK');
      }

      if (userIds.length > remainingStock) {
        await connection.rollback();
        throw new AppError(`库存不足，剩余${remainingStock}张，但尝试发放${userIds.length}张`, 400, 'INSUFFICIENT_STOCK');
      }

      // 3. 验证用户存在（customers表）
      const [validUsers] = await connection.query(
        `SELECT openid, id, nickname FROM customers WHERE openid IN (?)`,
        [userIds]
      );

      const validOpenIds = validUsers.map(u => u.openid);
      const invalidUserIds = userIds.filter(id => !validOpenIds.includes(id));

      // 4. 过滤掉已领取过的用户
      const [existingClaims] = await connection.query(
        `SELECT user_id FROM user_coupons WHERE coupon_id = ? AND user_id IN (?)`,
        [couponId, validOpenIds]
      );
      
      const claimedUserIds = existingClaims.map(c => c.user_id);
      const newUserIds = validOpenIds.filter(id => !claimedUserIds.includes(id));

      if (newUserIds.length === 0) {
        await connection.rollback();
        return res.json({
          success: true,
          data: {
            assignedCount: 0,
            failedList: [
              ...invalidUserIds.map(id => ({ userId: id, reason: '用户不存在' })),
              ...claimedUserIds.map(id => ({ userId: id, reason: '已领取过' }))
            ]
          },
          message: '没有可发放的用户'
        });
      }

      // 5. 批量插入 user_coupons 记录
      const insertValues = newUserIds.map(userId => [userId, couponId, 'unused', new Date()]);
      await connection.query(
        `INSERT INTO user_coupons (user_id, coupon_id, status, received_at) VALUES ?`,
        [insertValues]
      );

      // 6. 更新优惠券的 used_count
      await connection.query(
        'UPDATE coupons SET used_count = used_count + ?, updated_at = NOW() WHERE id = ?',
        [newUserIds.length, couponId]
      );

      // 7. 批量记录日志到 coupon_receive_logs
      const clientIp = req.ip || req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'admin';
      const userAgent = req.headers['user-agent'] || 'admin-panel';
      const logValues = newUserIds.map(userId => [userId, couponId, clientIp, userAgent, 'admin_assign', new Date()]);
      
      await connection.query(
        `INSERT INTO coupon_receive_logs (user_id, coupon_id, ip, user_agent, receive_type, created_at) VALUES ?`,
        [logValues]
      );

      // 提交事务
      await connection.commit();

      // 构建失败列表
      const failedList = [
        ...invalidUserIds.map(id => ({ userId: id, reason: '用户不存在' })),
        ...claimedUserIds.map(id => ({ userId: id, reason: '已领取过' }))
      ];

      console.log(`[Coupons/Assign] ✅ 成功发放 ${newUserIds.length} 张优惠券 ID:${couponId}`);

      res.json({
        success: true,
        data: {
          assignedCount: newUserIds.length,
          failedList: failedList.length > 0 ? failedList : []
        },
        message: `成功向 ${newUserIds.length} 个用户发放优惠券`,
        responseTime: Date.now() - startTime
      });

    } catch (innerError) {
      await connection.rollback();
      throw innerError;
    }

  } catch (error) {
    console.error('[Coupons/Assign] ❌ 发放优惠券失败:', error.message);
    return sendErrorResponse(res, error, 'Coupons/Assign');
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (e) {}
    }
  }
});

// ============================================================
// 新增接口：获取领取记录 GET /api/v1/admin/coupons/:id/receive-logs
// 分页查询优惠券的领取日志
// ============================================================
router.get('/:id/receive-logs', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { id } = req.params;
    let { page = 1, pageSize = 20, startDate, endDate } = req.query;

    // 验证参数
    const couponId = validateId(id, '优惠券ID');

    page = Math.max(1, parseInt(page) || 1);
    pageSize = Math.min(100, Math.max(1, parseInt(pageSize) || 20));

    // 验证优惠券是否存在
    const coupon = await getOne('SELECT id, name FROM coupons WHERE id = ?', [couponId]);
    if (!coupon) {
      throw new AppError('优惠券不存在', 404, 'NOT_FOUND');
    }

    const offset = (page - 1) * pageSize;

    // 构建查询条件
    let whereConditions = ['crl.coupon_id = ?'];
    let params = [couponId];

    if (startDate) {
      whereConditions.push('crl.created_at >= ?');
      params.push(startDate);
    }

    if (endDate) {
      whereConditions.push('crl.created_at <= ?');
      params.push(endDate);
    }

    const whereSql = whereConditions.join(' AND ');

    // 查询总数
    const countResult = await getOne(
      `SELECT COUNT(*) as total FROM coupon_receive_logs crl WHERE ${whereSql}`,
      params
    );
    const total = countResult ? countResult.total : 0;
    const totalPages = Math.ceil(total / pageSize);

    // 查询领取记录列表（关联客户信息）
    const sql = `
      SELECT 
        crl.id,
        crl.user_id,
        crl.coupon_id,
        crl.ip,
        crl.user_agent,
        crl.receive_type,
        crl.created_at,
        c.nickname AS customer_name,
        c.phone AS customer_phone,
        uc.status AS coupon_status,
        uc.received_at
      FROM coupon_receive_logs crl
      LEFT JOIN customers c ON crl.user_id = c.openid
      LEFT JOIN user_coupons uc ON crl.user_id = uc.user_id AND crl.coupon_id = uc.coupon_id
      WHERE ${whereSql}
      ORDER BY crl.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const listParams = [...params, pageSize, offset];
    const list = await query(sql, listParams);

    // 统计信息
    const stats = await getOne(`
      SELECT 
        COUNT(*) as total_logs,
        SUM(CASE WHEN receive_type = 'self_claim' THEN 1 ELSE 0 END) as self_claim_count,
        SUM(CASE WHEN receive_type = 'admin_assign' THEN 1 ELSE 0 END) as admin_assign_count
      FROM coupon_receive_logs
      WHERE coupon_id = ?
    `, [couponId]);

    res.json({
      success: true,
      data: {
        coupon_info: {
          id: coupon.id,
          name: coupon.name
        },
        list: list,
        pagination: {
          total,
          totalPages,
          page,
          pageSize
        },
        statistics: {
          total_logs: stats?.total_logs || 0,
          self_claim_count: stats?.self_claim_count || 0,
          admin_assign_count: stats?.admin_assign_count || 0
        }
      },
      responseTime: Date.now() - startTime
    });

  } catch (error) {
    console.error('[Coupons/ReceiveLogs] ❌ 获取领取记录失败:', error.message);
    return sendErrorResponse(res, error, 'Coupons/ReceiveLogs');
  }
});

module.exports = router;
