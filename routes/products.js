// [TIMEOUT] 建议: 为长时间运行的数据库操作添加超时设置
const { 
  validateRequired, 
  validateString, 
  validateNumber, 
  validateId,
  validateEnum,
  validatePagination,
  sanitizeString,
  sanitizeInput,
  AppError 
} = require('../utils/validation');

const express = require('express');
const { query, getOne, execute } = require('../db_unified');
const { requirePermission } = require('../middleware/rbac');
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
    category: product.category_id ? { id: product.category_id, name: null } : null
  };
}

router.get('/', async (req, res) => {
  try {
    // 验证分页参数
    const { page, limit, offset } = validatePagination(req);

    // 简化版本：直接查询所有商品
    const list = await query('SELECT * FROM products ORDER BY created_at DESC LIMIT ?', [limit]);
    const total = Array.isArray(list) ? list.length : 0;
    
    const formattedList = list.map(formatProduct);

    res.json({
      success: true,
      data: {
        list: formattedList,
        pagination: {
          total: total,
          totalPages: Math.ceil(total / limit),
          page,
          limit
        }
      }
    });
  } catch (error) {
    return sendErrorResponse(res, error, 'PRODUCTS/LIST');
  }
});

// 固定路径路由（必须在 /:id 之前，避免被参数路由拦截）
router.get('/recommended', async (req, res) => {
  try {
    const { limit = 10, user_id } = req.query;
    
    // 验证limit参数
    const limitNum = Math.min(Math.max(1, parseInt(limit) || 10), 50);
    
    // 如果提供user_id，验证其格式
    if (user_id) {
      validateId(user_id, '用户ID');
    }

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
    return sendErrorResponse(res, error, 'PRODUCTS/RECOMMENDED');
  }
});

router.get('/hot', async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    const limitNum = Math.min(Math.max(1, parseInt(limit) || 5), 20);

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
    return sendErrorResponse(res, error, 'PRODUCTS/HOT');
  }
});

router.get('/search', async (req, res) => {
  try {
    const { q, highlight = 'false', page = 1, limit = 20 } = req.query;

    if (!q || q.trim() === '') {
      return res.json({ success: true, data: [], pagination: { total: 0, totalPages: 0, page: 1, limit: 20 } });
    }

    // 验证搜索关键词长度
    validateString(q, '搜索关键词', { min: 1, max: 100, required: false });

    const { page: pageNum, limit: limitNum, offset } = validatePagination(req);
    const shouldHighlight = highlight === 'true';

    const searchParam = `%${q}%`;

    const sql = `SELECT p.*, c.name as category_name,
                 CASE WHEN p.name LIKE ? THEN 1 ELSE 2 END as relevance
                 FROM products p
                 LEFT JOIN categories c ON p.category_id = c.id
                 WHERE p.status = ? AND (p.name LIKE ? OR p.description LIKE ?)
                 ORDER BY relevance ASC, p.created_at DESC
                 LIMIT ? OFFSET ?`;

    const products = await query(sql, [searchParam, 'active', searchParam, searchParam, limitNum, offset]);

    const countSql = `SELECT COUNT(*) AS total
                      FROM products p
                      WHERE p.status = ? AND (p.name LIKE ? OR p.description LIKE ?)`;
    const countResult = await getOne(countSql, ['active', searchParam, searchParam]);
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
      searchQuery: sanitizeString(q)
    });
  } catch (error) {
    return sendErrorResponse(res, error, 'PRODUCTS/SEARCH');
  }
});

router.get('/suggestions', async (req, res) => {
  try {
    const { keyword } = req.query;

    if (!keyword) {
      return res.json({ success: true, data: [] });
    }

    // 验证关键词长度
    validateString(keyword, '搜索关键词', { min: 1, max: 50, required: false });

    const likePattern = `${keyword}%`;
    const sql = `SELECT name FROM products WHERE status = ? AND name LIKE ? LIMIT 10`;
    const rows = await query(sql, ['active', likePattern]);
    const suggestions = rows.map(p => p.name);
    res.json({ success: true, data: suggestions });
  } catch (error) {
    return sendErrorResponse(res, error, 'PRODUCTS/SUGGESTIONS');
  }
});

router.post('/', requirePermission('products', 'create'), async (req, res) => {
  try {
    const { name, description, price, stock, category_id, image, status } = req.body;

    // 输入验证
    validateRequired(['name', 'price'], req.body);
    validateString(name, '商品名称', { min: 2, max: 100 });
    validateNumber(price, '价格', { min: 0.01, max: 999999.99 });
    validateNumber(stock, '库存', { min: 0, integer: true, required: false });
    
    if (category_id !== undefined && category_id !== null) {
      validateId(category_id, '分类ID');
    }
    
    validateString(description, '描述', { max: 2000, required: false });
    
    if (status) {
      validateEnum(status, ['active', 'inactive', 'draft'], '状态');
    }

    // XSS防护
    const sanitizedData = {
      name: sanitizeString(name),
      price: Number(price),
      stock: stock !== undefined ? parseInt(stock) : 0,
      category_id: category_id || null,
      description: sanitizeString(description || ''),
      image: image || null,
      status: status || 'active'
    };

    const sql = `INSERT INTO products (name, description, price, stock, category_id, image, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`;
    const result = await execute(sql, [
      sanitizedData.name,
      sanitizedData.description || null,
      sanitizedData.price,
      sanitizedData.stock,
      sanitizedData.category_id,
      sanitizedData.image,
      sanitizedData.status
    ]);

    const insertId = result.insertId;
    res.status(201).json({
      success: true,
      data: {
        id: insertId,
        ...sanitizedData
      }
    });
  } catch (error) {
    console.error('[Products/Create] ❌ 创建商品失败:', error.message);
    return sendErrorResponse(res, error, 'Products/Create');
  }
});

router.put('/:id', requirePermission('products', 'update'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // 验证ID
    const productId = validateId(id, '商品ID');
    
    const { name, description, price, stock, category_id, image, status } = req.body;

    const fields = [];
    const params = [];

    // 字段级别验证
    if (name !== undefined) {
      validateString(name, '商品名称', { min: 2, max: 100 });
      fields.push('name = ?');
      params.push(sanitizeString(name));
    }
    if (description !== undefined) {
      validateString(description, '描述', { max: 2000 });
      fields.push('description = ?');
      params.push(sanitizeString(description));
    }
    if (price !== undefined) {
      validateNumber(price, '价格', { min: 0.01, max: 999999.99 });
      fields.push('price = ?');
      params.push(Number(price));
    }
    if (stock !== undefined) {
      validateNumber(stock, '库存', { min: 0, integer: true });
      fields.push('stock = ?');
      params.push(parseInt(stock));
    }
    if (category_id !== undefined) {
      if (category_id !== null) {
        validateId(category_id, '分类ID');
      }
      fields.push('category_id = ?');
      params.push(category_id);
    }
    if (image !== undefined) {
      fields.push('image = ?');
      params.push(image);
    }
    if (status !== undefined) {
      validateEnum(status, ['active', 'inactive', 'draft'], '状态');
      fields.push('status = ?');
      params.push(status);
    }

    if (fields.length === 0) {
      throw new AppError('没有提供需要更新的字段', 400, 'VALIDATION_ERROR');
    }

    params.push(productId);
    const sql = `UPDATE products SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`;
    const result = await execute(sql, params);

    if (result.affectedRows === 0) {
      throw new AppError('商品不存在', 404, 'NOT_FOUND');
    }

    res.json({
      success: true,
      data: { id: productId, name, description, price, stock, category_id, image, status }
    });
  } catch (error) {
    console.error('[Products/Update] ❌ 更新商品失败:', error.message);
    return sendErrorResponse(res, error, 'Products/Update');
  }
});

router.delete('/:id', requirePermission('products', 'delete'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // 验证ID
    const productId = validateId(id, '商品ID');
    
    const result = await execute('DELETE FROM products WHERE id = ?', [productId]);

    if (result.affectedRows === 0) {
      throw new AppError('商品不存在', 404, 'NOT_FOUND');
    }

    res.json({ success: true, message: '商品删除成功' });
  } catch (error) {
    console.error('[Products/Delete] ❌ 删除商品失败:', error.message);
    return sendErrorResponse(res, error, 'Products/Delete');
  }
});

router.get('/category/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 验证分类ID
    const categoryId = validateId(id, '分类ID');
    
    const { page = 1, limit = 10 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10));
    const offset = (pageNum - 1) * limitNum;

    const sql = `SELECT p.*, c.name as category_name
                 FROM products p
                 LEFT JOIN categories c ON p.category_id = c.id
                 WHERE p.status = ? AND p.category_id = ?
                 ORDER BY p.created_at DESC
                 LIMIT ? OFFSET ?`;
    const list = await query(sql, ['active', categoryId, limitNum, offset]);

    const countSql = `SELECT COUNT(*) AS total FROM products WHERE status = ? AND category_id = ?`;
    const countResult = await getOne(countSql, ['active', categoryId]);
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
    console.error('[Products/Category] ❌ 获取分类下商品失败:', error.message);
    return sendErrorResponse(res, error, 'Products/Category');
  }
});

// 参数路由（必须放在最后！避免拦截固定路径如 /recommended, /hot, /search）
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 验证ID
    const productId = validateId(id, '商品ID');

    const sql = `SELECT p.*, c.name as category_name
                 FROM products p
                 LEFT JOIN categories c ON p.category_id = c.id
                 WHERE p.id = ?`;
    const product = await getOne(sql, [productId]);

    if (!product) {
      throw new AppError('商品不存在', 404, 'NOT_FOUND');
    }

    const formattedProduct = formatProduct(product);

    if (product.category_id) {
      const similarSql = `SELECT p.*, c.name as category_name
                          FROM products p
                          LEFT JOIN categories c ON p.category_id = c.id
                          WHERE p.category_id = ? AND p.id != ? AND p.status = ?
                          ORDER BY p.created_at DESC
                          LIMIT 5`;
      const similarProducts = await query(similarSql, [product.category_id, productId, 'active']);
      formattedProduct.similar_products = similarProducts.map(formatProduct);
    } else {
      formattedProduct.similar_products = [];
    }

    res.json({
      success: true,
      data: formattedProduct
    });
  } catch (error) {
    console.error('[Products/Detail] ❌ 获取商品详情失败:', error.message);
    return sendErrorResponse(res, error, 'Products/Detail');
  }
});

module.exports = router;
