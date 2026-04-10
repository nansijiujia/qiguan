const express = require('express');
const { query, getOne, execute } = require('../db_mysql');
const router = express.Router();

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, char => map[char]);
}

function getStockStatus(stock) {
  if (stock > 10) return '充足';
  if (stock > 0 && stock <= 10) return '不足';
  return '缺货';
}

function formatProduct(product) {
  return {
    ...product,
    stock_status: getStockStatus(product.stock),
    category: product.category_id ? { id: product.category_id, name: product.category_name || null } : null
  };
}

router.get('/', async (req, res) => {
  const startTime = Date.now();
  try {
    let { page = 1, limit = 20, category_id, keyword, status, sort_by = 'created_at', sort_order = 'desc' } = req.query;

    page = parseInt(page);
    limit = Math.min(parseInt(limit), 100);

    if (!page || page < 1) page = 1;
    if (!limit || limit < 1) limit = 20;

    const offset = (page - 1) * limit;

    const validSortFields = ['price', 'created_at', 'sales', 'stock'];
    if (!validSortFields.includes(sort_by)) {
      sort_by = 'created_at';
    }
    if (sort_order !== 'asc' && sort_order !== 'desc') {
      sort_order = 'desc';
    }

    let whereConditions = [];
    let params = [];

    if (status === 'active' || status === 'inactive') {
      whereConditions.push('p.status = ?');
      params.push(status);
    }

    if (category_id) {
      whereConditions.push('p.category_id = ?');
      params.push(category_id);
    }

    if (keyword) {
      whereConditions.push('(p.name LIKE ? OR p.description LIKE ?)');
      const likePattern = `%${keyword}%`;
      params.push(likePattern, likePattern);
    }

    const whereSql = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) AS total FROM products p ${whereSql}`;
    const countResult = await getOne(countSql, params);
    const total = countResult ? countResult.total : 0;
    const totalPages = Math.ceil(total / limit);

    const sql = `SELECT p.*, c.name as category_name
                 FROM products p
                 LEFT JOIN categories c ON p.category_id = c.id
                 ${whereSql}
                 ORDER BY p.${sort_by} ${sort_order.toUpperCase()}
                 LIMIT ? OFFSET ?`;
    const listParams = [...params, limit, offset];
    const list = await query(sql, listParams);

    const formattedList = list.map(formatProduct);

    res.json({
      success: true,
      data: {
        list: formattedList,
        pagination: {
          total,
          totalPages,
          page,
          limit
        }
      },
      responseTime: Date.now() - startTime
    });
  } catch (error) {
    console.error('[ERROR] Getting products:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取商品列表失败'
      }
    });
  }
});

// 固定路径路由（必须在 /:id 之前，避免被参数路由拦截）
router.get('/recommended', async (req, res) => {
  try {
    const { limit = 10, user_id } = req.query;
    const limitNum = Math.min(parseInt(limit), 50);

    let products;
    if (user_id) {
      const orderSql = `SELECT oi.product_id, SUM(oi.quantity) as buy_count
                        FROM orders o
                        JOIN order_items oi ON o.id = oi.order_id
                        WHERE o.user_id = ? AND o.status IN ('paid', 'shipped', 'completed')
                        GROUP BY oi.product_id
                        ORDER BY buy_count DESC
                        LIMIT 5`;

      const userPurchased = await query(orderSql, [user_id]);
      const purchasedCategoryIds = userPurchased.length > 0
        ? userPurchased.map(p => p.product_id)
        : [];

      if (purchasedCategoryIds.length > 0) {
        const placeholders = purchasedCategoryIds.map(() => '?').join(',');
        const recommendSql = `SELECT p.*, c.name as category_name
                              FROM products p
                              LEFT JOIN categories c ON p.category_id = c.id
                              WHERE p.id NOT IN (${placeholders}) AND p.status = ?
                              ORDER BY RAND()
                              LIMIT ?`;
        products = await query(recommendSql, [...purchasedCategoryIds, 'active', limitNum]);
      } else {
        const defaultSql = `SELECT p.*, c.name as category_name
                            FROM products p
                            LEFT JOIN categories c ON p.category_id = c.id
                            WHERE p.status = ?
                            ORDER BY p.created_at DESC
                            LIMIT ?`;
        products = await query(defaultSql, ['active', limitNum]);
      }
    } else {
      const defaultSql = `SELECT p.*, c.name as category_name
                          FROM products p
                          LEFT JOIN categories c ON p.category_id = c.id
                          WHERE p.status = ?
                          ORDER BY p.created_at DESC
                          LIMIT ?`;
      products = await query(defaultSql, ['active', limitNum]);
    }

    res.json({
      success: true,
      data: products.map(formatProduct)
    });
  } catch (error) {
    console.error('[ERROR] Getting recommended products:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取推荐商品失败'
      }
    });
  }
});

router.get('/hot', async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    const limitNum = Math.min(parseInt(limit), 20);

    const sql = `SELECT p.id, p.name, p.price, p.image,
                 COALESCE(SUM(oi.quantity), 0) as sales_count
                 FROM products p
                 LEFT JOIN order_items oi ON p.id = oi.product_id
                 WHERE p.status = ?
                 GROUP BY p.id
                 ORDER BY sales_count DESC, p.created_at DESC
                 LIMIT ?`;
    const products = await query(sql, ['active', limitNum]);

    res.json({
      success: true,
      data: products.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        image: p.image,
        sales_count: p.sales_count,
        stock_status: getStockStatus(p.stock || 0)
      }))
    });
  } catch (error) {
    console.error('[ERROR] Getting hot products:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取热门商品失败'
      }
    });
  }
});

router.get('/search', async (req, res) => {
  try {
    const { q, highlight = 'false', page = 1, limit = 20 } = req.query;

    if (!q || q.trim() === '') {
      return res.json({ success: true, data: [], pagination: { total: 0, totalPages: 0, page: 1, limit: 20 } });
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const offset = (pageNum - 1) * limitNum;
    const shouldHighlight = highlight === 'true';

    const likePattern = `%${q}%`;

    const sql = `SELECT p.*, c.name as category_name,
                 CASE WHEN p.name LIKE ? THEN 1 ELSE 2 END as relevance
                 FROM products p
                 LEFT JOIN categories c ON p.category_id = c.id
                 WHERE p.status = ? AND (p.name LIKE ? OR p.description LIKE ?)
                 ORDER BY relevance ASC, p.created_at DESC
                 LIMIT ? OFFSET ?`;

    const products = await query(sql, [`%${q}%`, 'active', likePattern, likePattern, limitNum, offset]);

    const countSql = `SELECT COUNT(*) AS total
                      FROM products p
                      WHERE p.status = ? AND (p.name LIKE ? OR p.description LIKE ?)`;
    const countResult = await getOne(countSql, ['active', likePattern, likePattern]);
    const total = countResult ? countResult.total : 0;
    const totalPages = Math.ceil(total / limitNum);

    let result = products.map(formatProduct);

    if (shouldHighlight) {
      result = result.map(product => ({
        ...product,
        name_highlighted: product.name.replace(new RegExp(q, 'gi'), match => `<span class="highlight">${escapeHtml(match)}</span>`),
        description_highlighted: product.description ? product.description.replace(new RegExp(q, 'gi'), match => `<span class="highlight">${escapeHtml(match)}</span>`) : null
      }));
    }

    res.json({
      success: true,
      data: result,
      pagination: {
        total,
        totalPages,
        page: pageNum,
        limit: limitNum
      },
      searchQuery: q
    });
  } catch (error) {
    console.error('[ERROR] Searching products:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '搜索商品失败'
      }
    });
  }
});

router.get('/suggestions', async (req, res) => {
  try {
    const { keyword } = req.query;

    if (!keyword) {
      return res.json({ success: true, data: [] });
    }

    const likePattern = `${keyword}%`;
    const sql = `SELECT name FROM products WHERE status = ? AND name LIKE ? LIMIT 10`;
    const rows = await query(sql, ['active', likePattern]);
    const suggestions = rows.map(p => p.name);
    res.json({ success: true, data: suggestions });
  } catch (error) {
    console.error('[ERROR] Getting product suggestions:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取搜索建议失败'
      }
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, description, price, stock, category_id, image, status } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '商品名称不能为空'
        }
      });
    }

    if (price !== undefined && price < 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '价格不能为负数'
        }
      });
    }

    if (stock !== undefined && stock < 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '库存不能为负数'
        }
      });
    }

    const sql = `INSERT INTO products (name, description, price, stock, category_id, image, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`;
    const result = await execute(sql, [
      name,
      description || null,
      price || 0,
      stock || 0,
      category_id || null,
      image || null,
      status || 'active'
    ]);

    const insertId = result.insertId;
    res.status(201).json({
      success: true,
      data: {
        id: insertId,
        name,
        description: description || null,
        price: price || 0,
        stock: stock || 0,
        category_id: category_id || null,
        image: image || null,
        status: status || 'active'
      }
    });
  } catch (error) {
    console.error('[ERROR] Adding product:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '创建商品失败'
      }
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, stock, category_id, image, status } = req.body;

    const fields = [];
    const params = [];

    if (name !== undefined) {
      fields.push('name = ?');
      params.push(name);
    }
    if (description !== undefined) {
      fields.push('description = ?');
      params.push(description);
    }
    if (price !== undefined) {
      fields.push('price = ?');
      params.push(price);
    }
    if (stock !== undefined) {
      fields.push('stock = ?');
      params.push(stock);
    }
    if (category_id !== undefined) {
      fields.push('category_id = ?');
      params.push(category_id);
    }
    if (image !== undefined) {
      fields.push('image = ?');
      params.push(image);
    }
    if (status !== undefined) {
      fields.push('status = ?');
      params.push(status);
    }

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '没有提供需要更新的字段'
        }
      });
    }

    params.push(id);
    const sql = `UPDATE products SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`;
    const result = await execute(sql, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '商品不存在'
        }
      });
    }

    res.json({
      success: true,
      data: { id, name, description, price, stock, category_id, image, status }
    });
  } catch (error) {
    console.error('[ERROR] Updating product:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '更新商品失败'
      }
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await execute('DELETE FROM products WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '商品不存在'
        }
      });
    }

    res.json({ success: true, message: '商品删除成功' });
  } catch (error) {
    console.error('[ERROR] Deleting product:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '删除商品失败'
      }
    });
  }
});

router.get('/category/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const sql = `SELECT p.*, c.name as category_name
                 FROM products p
                 LEFT JOIN categories c ON p.category_id = c.id
                 WHERE p.status = ? AND p.category_id = ?
                 ORDER BY p.created_at DESC
                 LIMIT ? OFFSET ?`;
    const list = await query(sql, ['active', id, limitNum, offset]);

    const countSql = `SELECT COUNT(*) AS total FROM products WHERE status = ? AND category_id = ?`;
    const countResult = await getOne(countSql, ['active', id]);
    const total = countResult ? countResult.total : 0;
    const totalPages = Math.ceil(total / limitNum);

    res.json({
      success: true,
      data: list.map(formatProduct),
      pagination: {
        total,
        totalPages,
        page: pageNum,
        limit: limitNum
      }
    });
  } catch (error) {
    console.error('[ERROR] Getting products by category:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取分类下商品列表失败'
      }
    });
  }
});

// 参数路由（必须放在最后！避免拦截固定路径如 /recommended, /hot, /search）
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const sql = `SELECT p.*, c.name as category_name
                 FROM products p
                 LEFT JOIN categories c ON p.category_id = c.id
                 WHERE p.id = ?`;
    const product = await getOne(sql, [id]);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '商品不存在'
        }
      });
    }

    const formattedProduct = formatProduct(product);

    if (product.category_id) {
      const similarSql = `SELECT p.*, c.name as category_name
                          FROM products p
                          LEFT JOIN categories c ON p.category_id = c.id
                          WHERE p.category_id = ? AND p.id != ? AND p.status = ?
                          ORDER BY p.created_at DESC
                          LIMIT 5`;
      const similarProducts = await query(similarSql, [product.category_id, id, 'active']);
      formattedProduct.similar_products = similarProducts.map(formatProduct);
    } else {
      formattedProduct.similar_products = [];
    }

    res.json({
      success: true,
      data: formattedProduct
    });
  } catch (error) {
    console.error('[ERROR] Getting product details:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取商品详情失败'
      }
    });
  }
});

module.exports = router;
