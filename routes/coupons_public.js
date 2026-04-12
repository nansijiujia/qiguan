// [TIMEOUT] 建议: 为长时间运行的数据库操作添加超时设置
const express = require('express');
const { getOne, query, execute } = require('../db_mysql');
const router = express.Router();

// P0 FIX #3: 优惠券用户端路由 - 普通登录用户可访问
// 路径: /api/v1/coupons (仅需要 verifyToken，不需要 admin 权限)

function formatCouponForUser(coupon) {
  return {
    id: coupon.id,
    name: coupon.name,
    code: coupon.code,
    type: coupon.type,
    type_label: coupon.type === 'fixed' ? '固定金额' : '百分比',
    value: coupon.value,
    min_order_amount: coupon.min_order_amount,
    max_discount: coupon.max_discount,
    start_time: coupon.start_time,
    end_time: coupon.end_time,
    description: coupon.description,
    stock: coupon.stock,
    per_user_limit: coupon.per_user_limit,
    status: coupon.status,
    received_count: coupon.received_count || 0
  };
}

router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    
    // 用户只能看到活跃且未过期的优惠券
    const sql = `SELECT c.*,
                 (SELECT COUNT(*) FROM user_coupons WHERE coupon_id = c.id) as received_count
                 FROM coupons c
                 WHERE c.status = 'active' 
                 AND c.start_time <= NOW() 
                 AND c.end_time >= NOW()
                 AND c.stock > 0
                 ORDER BY c.created_at DESC`;
    
    const coupons = await query(sql);
    
    // 如果用户已登录，检查每个优惠券的领取状态
    let userCouponMap = {};
    if (userId) {
      const userCoupons = await query(
        'SELECT coupon_id, COUNT(*) as claimed_count FROM user_coupons WHERE user_id = ? GROUP BY coupon_id',
        [userId]
      );
      userCouponMap = userCoupons.reduce((acc, uc) => {
        acc[uc.coupon_id] = uc.claimed_count;
        return acc;
      }, {});
    }

    const formattedList = coupons.map(coupon => ({
      ...formatCouponForUser(coupon),
      user_claimed_count: userCouponMap[coupon.id] || 0,
      can_claim: userId ? (userCouponMap[coupon.id] || 0) < coupon.per_user_limit : false
    }));

    res.json({
      success: true,
      data: formattedList
    });
  } catch (error) {
    
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '获取优惠券列表失败' }
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const sql = `SELECT c.*,
                 (SELECT COUNT(*) FROM user_coupons WHERE coupon_id = c.id) as received_count
                 FROM coupons c
                 WHERE c.id = ?`;
    const coupon = await getOne(sql, [id]);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '优惠券不存在' }
      });
    }

    // 检查用户是否已领取
    let userClaimedCount = 0;
    if (userId) {
      const claimInfo = await getOne(
        'SELECT COUNT(*) as cnt FROM user_coupons WHERE user_id = ? AND coupon_id = ?',
        [userId, id]
      );
      userClaimedCount = claimInfo?.cnt || 0;
    }

    res.json({
      success: true,
      data: {
        ...formatCouponForUser(coupon),
        user_claimed_count: userClaimedCount,
        can_claim: userId ? userClaimedCount < coupon.per_user_limit : false
      }
    });
  } catch (error) {
    
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '获取优惠券详情失败' }
    });
  }
});

router.post('/:id/claim', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: '请先登录后再领取优惠券' }
      });
    }

    // 检查优惠券是否存在且有效
    const coupon = await getOne(
      'SELECT * FROM coupons WHERE id = ? AND status = \'active\' AND start_time <= NOW() AND end_time >= NOW()',
      [id]
    );

    if (!coupon) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '优惠券不存在或已失效' }
      });
    }

    // 检查库存
    if (coupon.stock <= 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'OUT_OF_STOCK', message: '优惠券已被领完' }
      });
    }

    // 检查用户领取次数限制
    const claimCount = await getOne(
      'SELECT COUNT(*) as cnt FROM user_coupons WHERE user_id = ? AND coupon_id = ?',
      [userId, id]
    );

    if (claimCount && claimCount.cnt >= coupon.per_user_limit) {
      return res.status(400).json({
        success: false,
        error: { code: 'LIMIT_EXCEEDED', message: `您已领取过该优惠券，每人限领${coupon.per_user_limit}张` }
      });
    }

    // 检查是否重复领取（防止并发）
    const existingClaim = await getOne(
      'SELECT id FROM user_coupons WHERE user_id = ? AND coupon_id = ?',
      [userId, id]
    );

    if (existingClaim && claimCount && claimCount.cnt > 0) {
      return res.status(409).json({
        success: false,
        error: { code: 'DUPLICATE_CLAIM', message: '您已经领取过该优惠券' }
      });
    }

    // 领取优惠券
    const result = await execute(
      `INSERT INTO user_coupons (user_id, coupon_id, status, received_at) 
       VALUES (?, ?, 'unused', NOW())`,
      [userId, id]
    );

    // 更新库存
    await execute(
      'UPDATE coupons SET stock = stock - 1 WHERE id = ? AND stock > 0',
      [id]
    );

    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        coupon_id: parseInt(id),
        user_id: userId,
        status: 'unused'
      },
      message: '优惠券领取成功'
    });
  } catch (error) {
    
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '领取优惠券失败' }
    });
  }
});

module.exports = router;