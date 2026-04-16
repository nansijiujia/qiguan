// [TIMEOUT] 建议: 为长时间运行的数据库操作添加超时设置
const express = require('express');
const { getOne, query, execute } = require('../db-unified');
const mysql = require('mysql2/promise');
let mysqlPool;

try {
  const dbModule = require('../db-unified');
  mysqlPool = dbModule.mysqlPool || global.mysqlPool;
} catch (e) {
  console.warn('[PublicCoupons] ⚠️ 无法获取mysqlPool，将使用延迟加载');
}

function getPool() {
  if (mysqlPool) return mysqlPool;
  try {
    const dbModule = require('../db-unified');
    mysqlPool = dbModule.mysqlPool || global.mysqlPool;
    return mysqlPool;
  } catch (e) {
    throw new Error('数据库连接池未初始化');
  }
}

const router = express.Router();

// ============================================================
// 格式化优惠券信息（用户视角）
// ============================================================
function formatCouponForUser(coupon) {
  return {
    id: coupon.id,
    name: coupon.name,
    code: coupon.code,
    type: coupon.type,
    type_label: coupon.type === 'fixed' ? '固定金额' : '百分比',
    value: parseFloat(coupon.value),
    min_order_amount: parseFloat(coupon.min_order_amount || 0),
    max_discount: coupon.max_discount ? parseFloat(coupon.max_discount) : null,
    start_time: coupon.start_time,
    end_time: coupon.end_time,
    description: coupon.description,
    stock: coupon.stock,
    per_user_limit: coupon.per_user_limit,
    status: coupon.status,
    received_count: coupon.received_count || 0
  };
}

// ============================================================
// 接口1: 领取优惠券 POST /api/v1/public/coupons/:id/receive
// 权限: 仅需 verifyToken（无需管理员权限）
// 安全防护:
//   - 数据库 UNIQUE(user_id, coupon_id) 约束防重复
//   - 应用层双重检查
//   - 事务保证原子性
//   - 完整的库存和时效验证
// ============================================================
router.post('/:id/receive', async (req, res) => {
  const startTime = Date.now();
  let connection;

  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?.openid;

    // 验证用户已登录
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: '请先登录后再领取优惠券' }
      });
    }

    // 验证优惠券ID
    const couponId = parseInt(id);
    if (!couponId || couponId <= 0 || !Number.isInteger(couponId)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: '无效的优惠券ID' }
      });
    }

    // 获取数据库连接并开始事务
    const pool = getPool();
    connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // ========== 步骤1: 验证优惠券存在且状态为 active ==========
      const [couponRows] = await connection.query(
        `SELECT * FROM coupons WHERE id = ? FOR UPDATE`,
        [couponId]
      );

      if (!couponRows || couponRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: '优惠券不存在' }
        });
      }

      const coupon = couponRows[0];

      // ========== 步骤2: 验证优惠券状态 ==========
      if (coupon.status !== 'active') {
        await connection.rollback();
        const statusMsg = coupon.status === 'inactive' ? '已停用' : '已过期';
        return res.status(400).json({
          success: false,
          error: { code: 'COUPON_INACTIVE', message: `优惠券${statusMsg}，无法领取` }
        });
      }

      // ========== 步骤3: 验证时间范围 ==========
      const now = new Date();
      const startTime_coupon = new Date(coupon.start_time);
      const endTime_coupon = new Date(coupon.end_time);

      if (now < startTime_coupon) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          error: { code: 'NOT_STARTED', message: '优惠券尚未开始发放' }
        });
      }

      if (now > endTime_coupon) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          error: { code: 'EXPIRED', message: '优惠券已过期' }
        });
      }

      // ========== 步骤4: 验证库存充足 ==========
      const remainingStock = coupon.stock - (coupon.used_count || 0);
      if (remainingStock <= 0) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          error: { code: 'OUT_OF_STOCK', message: '优惠券已被领完' }
        });
      }

      // ========== 步骤5: 验证用户领取次数限制 ==========
      const [claimCountRows] = await connection.query(
        `SELECT COUNT(*) as cnt FROM user_coupons WHERE user_id = ? AND coupon_id = ?`,
        [userId, couponId]
      );

      const currentClaimCount = claimCountRows[0]?.cnt || 0;
      
      if (currentClaimCount >= coupon.per_user_limit) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          error: { 
            code: 'LIMIT_EXCEEDED', 
            message: `您已领取过该优惠券，每人限领${coupon.per_user_limit}张` 
          }
        });
      }

      // ========== 步骤6: 检查是否重复领取（应用层二次验证）==========
      const [existingClaim] = await connection.query(
        `SELECT id FROM user_coupons WHERE user_id = ? AND coupon_id = ?`,
        [userId, couponId]
      );

      if (existingClaim && existingClaim.length > 0) {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          error: { code: 'DUPLICATE_CLAIM', message: '您已经领取过该优惠券' }
        });
      }

      // ========== 步骤7: 执行领取操作（事务内）==========
      
      // 7a. 插入 user_coupons 记录
      const [insertResult] = await connection.query(
        `INSERT INTO user_coupons (user_id, coupon_id, status, received_at) VALUES (?, ?, 'unused', NOW())`,
        [userId, couponId]
      );

      const newUserCouponId = insertResult.insertId;

      // 7b. 更新优惠券 used_count
      await connection.query(
        `UPDATE coupons SET used_count = used_count + 1, updated_at = NOW() WHERE id = ?`,
        [couponId]
      );

      // 7c. 记录领取日志
      const clientIp = req.ip || req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '';
      const userAgent = req.headers['user-agent'] || '';

      await connection.query(
        `INSERT INTO coupon_receive_logs (user_id, coupon_id, ip, user_agent, receive_type, created_at) VALUES (?, ?, ?, ?, 'self_claim', NOW())`,
        [userId, couponId, clientIp, userAgent]
      );

      // 提交事务
      await connection.commit();

      console.log(`[PublicCoupons/Receive] ✅ 用户 ${userId} 成功领取优惠券 ID:${couponId}`);

      // 返回成功响应
      res.status(201).json({
        success: true,
        data: {
          id: newUserCouponId,
          coupon_id: couponId,
          user_id: userId,
          status: 'unused',
          coupon_info: {
            name: coupon.name,
            value: parseFloat(coupon.value),
            type: coupon.type,
            min_order_amount: parseFloat(coupon.min_order_amount || 0)
          }
        },
        message: '优惠券领取成功',
        responseTime: Date.now() - startTime
      });

    } catch (innerError) {
      // 回滚事务
      await connection.rollback();
      throw innerError;
    }

  } catch (error) {
    console.error('[PublicCoupons/Receive] ❌ 领取优惠券失败:', error.message);

    // 处理唯一约束冲突（并发领取场景）
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        error: { code: 'DUPLICATE_CLAIM', message: '您已经领取过该优惠券' }
      });
    }

    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '领取优惠券失败，请稍后重试' }
    });
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (e) {}
    }
  }
});

// ============================================================
// 接口2: 我的优惠券列表 GET /api/v1/public/coupons/my
// 参数: status (optional: unused/used/expired)
// 返回: 用户的所有优惠券及详情（JOIN coupons表）
// ============================================================
router.get('/my', async (req, res) => {
  const startTime = Date.now();

  try {
    const userId = req.user?.id || req.user?.openid;

    // 验证用户已登录
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: '请先登录后查看优惠券' }
      });
    }

    const { status, page = 1, pageSize = 20 } = req.query;

    // 验证分页参数
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSizeNum = Math.min(50, Math.max(1, parseInt(pageSize) || 20));
    const offset = (pageNum - 1) * pageSizeNum;

    // 构建查询条件
    let whereConditions = ['uc.user_id = ?'];
    let params = [userId];

    // 状态筛选（如果提供）
    if (status) {
      const validStatuses = ['unused', 'used', 'expired'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_STATUS', message: '状态参数无效，可选值: unused, used, expired' }
        });
      }
      whereConditions.push('uc.status = ?');
      params.push(status);
    }

    const whereSql = whereConditions.join(' AND ');

    // 查询总数
    const countResult = await getOne(
      `SELECT COUNT(*) as total FROM user_coupons uc WHERE ${whereSql}`,
      params
    );
    const total = countResult ? countResult.total : 0;
    const totalPages = Math.ceil(total / pageSizeNum);

    // 查询用户的优惠券列表（JOIN coupons 表获取详情）
    const sql = `
      SELECT 
        uc.id AS user_coupon_id,
        uc.user_id,
        uc.coupon_id,
        uc.status,
        uc.received_at,
        uc.used_at,
        c.name AS coupon_name,
        c.code AS coupon_code,
        c.type,
        c.value,
        c.min_order_amount,
        c.max_discount,
        c.start_time,
        c.end_time,
        c.description,
        c.per_user_limit,
        CASE 
          WHEN c.end_time < NOW() THEN 'expired'
          WHEN uc.status = 'used' THEN 'used'
          ELSE uc.status 
        END AS effective_status
      FROM user_coupons uc
      INNER JOIN coupons c ON uc.coupon_id = c.id
      WHERE ${whereSql}
      ORDER BY uc.received_at DESC
      LIMIT ? OFFSET ?
    `;

    const listParams = [...params, pageSizeNum, offset];
    const list = await query(sql, listParams);

    // 格式化返回数据
    const formattedList = list.map(item => ({
      id: item.user_coupon_id,
      coupon_id: item.coupon_id,
      coupon_name: item.coupon_name,
      coupon_code: item.coupon_code,
      type: item.type,
      type_label: item.type === 'fixed' ? '固定金额' : '百分比折扣',
      value: parseFloat(item.value),
      min_order_amount: parseFloat(item.min_order_amount || 0),
      max_discount: item.max_discount ? parseFloat(item.max_discount) : null,
      start_time: item.start_time,
      end_time: item.end_time,
      description: item.description,
      status: item.effective_status || item.status,
      original_status: item.status,
      received_at: item.received_at,
      used_at: item.used_at,
      is_expired: new Date(item.end_time) < new Date(),
      is_usable: item.status === 'unused' && new Date(item.end_time) >= new Date()
    }));

    // 统计各状态数量
    const stats = await getOne(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'unused' AND (SELECT end_time FROM coupons WHERE id = coupon_id) >= NOW() THEN 1 ELSE 0 END) as unused_count,
        SUM(CASE WHEN status = 'used' THEN 1 ELSE 0 END) as used_count,
        SUM(CASE WHEN status = 'expired' OR (SELECT end_time FROM coupons WHERE id = coupon_id) < NOW() THEN 1 ELSE 0 END) as expired_count
      FROM user_coupons
      WHERE user_id = ?
    `, [userId]);

    res.json({
      success: true,
      data: {
        list: formattedList,
        pagination: {
          total,
          totalPages,
          page: pageNum,
          pageSize: pageSizeNum
        },
        statistics: {
          total: stats?.total || 0,
          unused_count: stats?.unused_count || 0,
          used_count: stats?.used_count || 0,
          expired_count: stats?.expired_count || 0
        }
      },
      responseTime: Date.now() - startTime
    });

  } catch (error) {
    console.error('[PublicCoupons/MyCoupons] ❌ 获取我的优惠券失败:', error.message);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '获取优惠券列表失败' }
    });
  }
});

module.exports = router;
