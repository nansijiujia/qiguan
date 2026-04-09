const express = require('express');
const { query, getOne, execute } = require('../db_mysql');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

router.get('/', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const userId = req.query.userId;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const status = req.query.status;

    if (page < 1) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: '页码必须大于0'
        }
      });
    }

    if (pageSize < 1 || pageSize > 100) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: '每页数量必须在1-100之间'
        }
      });
    }

    const conditions = [];
    const params = [];

    if (userId) {
      conditions.push('c.user_id = ?');
      params.push(userId);
    }

    if (startDate) {
      conditions.push('c.updated_at >= ?');
      params.push(startDate + ' 00:00:00');
    }

    if (endDate) {
      conditions.push('c.updated_at <= ?');
      params.push(endDate + ' 23:59:59');
    }

    if (status === 'active') {
      conditions.push('c.updated_at > DATE_SUB(NOW(), INTERVAL 7 DAY)');
    } else if (status === 'expired') {
      conditions.push('c.updated_at <= DATE_SUB(NOW(), INTERVAL 7 DAY)');
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const countSql = `
      SELECT COUNT(DISTINCT c.user_id) AS total
      FROM cart c
      ${whereClause}
    `;
    const countResult = await getOne(countSql, params);
    const total = countResult ? countResult.total : 0;
    const totalPages = Math.ceil(total / pageSize);
    const offset = (page - 1) * pageSize;

    const listSql = `
      SELECT
        c.id,
        c.user_id,
        u.username,
        COUNT(c.product_id) AS product_count,
        SUM(c.price * c.quantity) AS total_price,
        MAX(c.updated_at) AS updated_at,
        CASE
          WHEN MAX(c.updated_at) > DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 'active'
          ELSE 'expired'
        END AS status
      FROM cart c
      LEFT JOIN users u ON c.user_id = u.id
      ${whereClause}
      GROUP BY c.user_id, c.id, u.username
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `;
    const listParams = [...params, pageSize, offset];
    const list = await query(listSql, listParams);

    res.json({
      success: true,
      data: {
        list: list.map(item => ({
          id: item.id,
          user_id: item.user_id,
          username: item.username,
          product_count: parseInt(item.product_count) || 0,
          total_price: parseFloat(item.total_price) || 0,
          updated_at: item.updated_at,
          status: item.status
        })),
        pagination: {
          total,
          page,
          pageSize,
          totalPages
        }
      }
    });
  } catch (error) {
    console.error('[CART_ADMIN] Get carts error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: '服务器内部错误'
      }
    });
  }
});

router.get('/stats', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const statsSql = `
      SELECT
        COUNT(DISTINCT user_id) AS totalCarts,
        COUNT(DISTINCT CASE WHEN updated_at > DATE_SUB(NOW(), INTERVAL 7 DAY) THEN user_id END) AS activeCarts,
        COUNT(DISTINCT CASE WHEN updated_at <= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN user_id END) AS expiredCarts,
        COALESCE(SUM(quantity), 0) AS totalItems,
        COALESCE(SUM(price * quantity), 0) AS totalValue
      FROM cart
    `;
    const stats = await getOne(statsSql);

    const abandonedRate = stats.totalCarts > 0
      ? ((stats.expiredCarts / stats.totalCarts) * 100).toFixed(1) + '%'
      : '0.0%';

    const avgItemsPerCart = stats.totalCarts > 0
      ? (stats.totalItems / stats.totalCarts).toFixed(2)
      : '0.00';

    const trendSql = `
      SELECT
        DATE(updated_at) AS date,
        COUNT(DISTINCT user_id) AS count
      FROM cart
      WHERE updated_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      GROUP BY DATE(updated_at)
      ORDER BY date ASC
    `;
    const trend = await query(trendSql);

    res.json({
      success: true,
      data: {
        totalCarts: parseInt(stats.totalCarts) || 0,
        activeCarts: parseInt(stats.activeCarts) || 0,
        expiredCarts: parseInt(stats.expiredCarts) || 0,
        totalItems: parseInt(stats.totalItems) || 0,
        totalValue: parseFloat(parseFloat(stats.totalValue || 0).toFixed(2)),
        abandonedRate,
        avgItemsPerCart: parseFloat(avgItemsPerCart),
        trend: trend.map(item => ({
          date: item.date.toISOString().split('T')[0],
          count: parseInt(item.count)
        }))
      }
    });
  } catch (error) {
    console.error('[CART_ADMIN] Get stats error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: '服务器内部错误'
      }
    });
  }
});

router.delete('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const cartId = req.params.id;

    if (!cartId || isNaN(parseInt(cartId))) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: '无效的购物车ID'
        }
      });
    }

    const existingCart = await getOne(
      'SELECT id FROM cart WHERE id = ?',
      [cartId]
    );

    if (!existingCart) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '购物车不存在'
        }
      });
    }

    await execute(
      'DELETE FROM cart WHERE id = ?',
      [cartId]
    );

    res.json({
      success: true,
      message: '购物车已删除'
    });
  } catch (error) {
    console.error('[CART_ADMIN] Delete cart error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: '服务器内部错误'
      }
    });
  }
});

router.delete('/expired', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const result = await execute(
      'DELETE FROM cart WHERE updated_at < DATE_SUB(NOW(), INTERVAL 30 DAY)'
    );

    res.json({
      success: true,
      data: {
        deletedCount: result.affectedRows || 0,
        message: `已清理${result.affectedRows || 0}个过期购物车`
      }
    });
  } catch (error) {
    console.error('[CART_ADMIN] Clear expired carts error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: '服务器内部错误'
      }
    });
  }
});

module.exports = router;
