// [TIMEOUT] 建议: 为长时间运行的数据库操作添加超时设置
// [PERFORMANCE] 建议: 考虑使用批量查询替代循环内单条查询以提高性能
// [PERFORMANCE] Example: 使用 IN (?) 和批量参数代替循环

const { 
  validateRequired, 
  validateString, 
  validateNumber, 
  validateId,
  validateEnum,
  sanitizeString,
  AppError 
} = require('../utils/validation');

const express = require('express');
const { query, getOne, execute } = require('../db_unified');
const { sendErrorResponse } = require('../utils/errorHandler');
const router = express.Router();

function buildTree(categories, parentId = null) {
  const tree = [];
  for (const category of categories) {
    if (category.parent_id === parentId) {
      const children = buildTree(categories, category.id);
      const node = {
        id: category.id,
        name: category.name,
        parent_id: category.parent_id,
        sort_order: category.sort_order,
        status: category.status,
        product_count: category.product_count || 0,
        created_at: category.created_at
      };
      if (children.length > 0) {
        node.children = children;
      }
      tree.push(node);
    }
  }
  return tree;
}

router.get('/', async (req, res) => {
  try {
    const categories = await query('SELECT * FROM categories ORDER BY sort_order ASC');
    const total = Array.isArray(categories) ? categories.length : 0;
    res.json({
      success: true,
      data: {
        list: categories,
        pagination: {
          page: 1,
          limit: total,
          total: total
        }
      }
    });
  } catch (error) {
    console.error('[Categories/List] ❌ 获取分类列表失败:', error.message);
    return sendErrorResponse(res, error, 'Categories/List');
  }
});

router.get('/tree', async (req, res) => {
  try {
    const { flat } = req.query;

    // 验证flat参数（如果提供）
    if (flat !== undefined && flat !== 'true' && flat !== 'false') {
      throw new AppError('flat参数必须为true或false', 400, 'INVALID_INPUT');
    }

    const sql = `SELECT c.*,
                 COUNT(p.id) as product_count
                 FROM categories c
                 LEFT JOIN products p ON c.id = p.category_id AND p.status = 'active'
                 GROUP BY c.id
                 ORDER BY c.sort_order ASC`;
    const categories = await query(sql);

    if (flat === 'true') {
      return res.json({
        success: true,
        data: categories.map(c => ({
          id: c.id,
          name: c.name,
          parent_id: c.parent_id,
          sort_order: c.sort_order,
          status: c.status,
          product_count: c.product_count || 0,
          level: calculateLevel(categories, c.id)
        }))
      });
    }

    const tree = buildTree(categories);

    res.json({
      success: true,
      data: tree
    });
  } catch (error) {
    console.error('[Categories/Tree] ❌ 获取分类树失败:', error.message);
    return sendErrorResponse(res, error, 'Categories/Tree');
  }
});

function calculateLevel(categories, categoryId, level = 0) {
  if (level > 10) return level;
  const category = categories.find(c => c.id === categoryId);
  if (!category || !category.parent_id) return level;
  return calculateLevel(categories, category.parent_id, level + 1);
}

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 验证ID
    const categoryId = validateId(id, '分类ID');

    const categorySql = `SELECT c.*, COUNT(p.id) as product_count
                         FROM categories c
                         LEFT JOIN products p ON c.id = p.category_id AND p.status = 'active'
                         WHERE c.id = ?
                         GROUP BY c.id`;
    const category = await getOne(categorySql, [categoryId]);

    if (!category) {
      throw new AppError('分类不存在', 404, 'NOT_FOUND');
    }

    const childrenSql = `SELECT * FROM categories WHERE parent_id = ? ORDER BY sort_order ASC`;
    const children = await query(childrenSql, [categoryId]);

    const parentSql = `SELECT * FROM categories WHERE id = ?`;
    let parent = null;
    if (category.parent_id) {
      parent = await getOne(parentSql, [category.parent_id]);
    }

    res.json({
      success: true,
      data: {
        ...category,
        children: children.length > 0 ? children : [],
        parent: parent ? { id: parent.id, name: parent.name } : null
      }
    });
  } catch (error) {
    console.error('[Categories/Detail] ❌ 获取分类详情失败:', error.message);
    return sendErrorResponse(res, error, 'Categories/Detail');
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, parent_id, sort_order, status } = req.body;

    // 输入验证
    validateRequired(['name'], req.body);
    validateString(name, '分类名称', { min: 2, max: 50 });
    
    // XSS防护
    const sanitizedName = sanitizeString(name);
    
    if (parent_id !== undefined && parent_id !== null) {
      validateId(parent_id, '父分类ID');
    }
    
    validateNumber(sort_order, '排序', { min: 0, integer: true, required: false });
    
    if (status) {
      validateEnum(status, ['active', 'inactive'], '状态');
    }

    // 检查分类名称是否已存在
    const existing = await getOne('SELECT id FROM categories WHERE name = ?', [sanitizedName]);
    if (existing) {
      throw new AppError(`分类名称"${sanitizedName}"已存在`, 409, 'DUPLICATE_ERROR');
    }

    if (parent_id !== undefined && parent_id !== null) {
      const parentExists = await getOne('SELECT id FROM categories WHERE id = ?', [parent_id]);
      if (!parentExists) {
        throw new AppError('父分类不存在', 400, 'VALIDATION_ERROR');
      }
    }

    const sql = `INSERT INTO categories (name, parent_id, sort_order, status, created_at) VALUES (?, ?, ?, ?, NOW())`;
    const result = await execute(sql, [
      sanitizedName,
      parent_id || null,
      sort_order !== undefined ? parseInt(sort_order) : 0,
      status || 'active'
    ]);

    const insertId = result.insertId;
    res.status(201).json({
      success: true,
      data: {
        id: insertId,
        name: sanitizedName,
        parent_id: parent_id || null,
        sort_order: sort_order !== undefined ? parseInt(sort_order) : 0,
        status: status || 'active'
      }
    });
  } catch (error) {
    console.error('[Categories/Create] ❌ 创建分类失败:', error.message);
    if (error.code === 'ER_DUP_ENTRY' || error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return sendErrorResponse(res, error, 'Categories/Create');
    }
    return sendErrorResponse(res, error, 'Categories/Create');
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, parent_id, sort_order, status } = req.body;

    // 验证ID
    const categoryId = validateId(id, '分类ID');

    // 输入验证
    if (name !== undefined && name !== null && name.trim() !== '') {
      validateString(name, '分类名称', { min: 2, max: 50 });
    } else if (name !== undefined && (name === null || name.trim() === '')) {
      throw new AppError('分类名称不能为空', 400, 'VALIDATION_ERROR');
    }

    if (parent_id !== undefined && parent_id !== null && parseInt(parent_id) === parseInt(categoryId)) {
      throw new AppError('不能将自己设为父分类', 400, 'VALIDATION_ERROR');
    }

    if (parent_id !== undefined && parent_id !== null) {
      validateId(parent_id, '父分类ID');
      const parentExists = await getOne('SELECT id FROM categories WHERE id = ?', [parent_id]);
      if (!parentExists) {
        throw new AppError('父分类不存在', 400, 'VALIDATION_ERROR');
      }
    }

    if (sort_order !== undefined) {
      validateNumber(sort_order, '排序', { min: 0, integer: true });
    }

    if (status !== undefined) {
      validateEnum(status, ['active', 'inactive'], '状态');
    }

    const fields = [];
    const params = [];

    if (name !== undefined) {
      fields.push('name = ?');
      params.push(sanitizeString(name));
    }

    if (parent_id !== undefined) {
      fields.push('parent_id = ?');
      params.push(parent_id);
    }
    if (sort_order !== undefined) {
      fields.push('sort_order = ?');
      params.push(parseInt(sort_order));
    }
    if (status !== undefined) {
      fields.push('status = ?');
      params.push(status);
    }

    if (fields.length === 0) {
      throw new AppError('没有提供需要更新的字段', 400, 'VALIDATION_ERROR');
    }

    params.push(categoryId);
    const sql = `UPDATE categories SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`;
    const result = await execute(sql, params);

    if (result.affectedRows === 0) {
      throw new AppError('分类不存在', 404, 'NOT_FOUND');
    }

    res.json({
      success: true,
      data: {
        id: parseInt(categoryId),
        name,
        parent_id: parent_id !== undefined ? parent_id : null,
        sort_order: sort_order !== undefined ? parseInt(sort_order) : 0,
        status: status !== undefined ? status : 'active'
      }
    });
  } catch (error) {
    console.error('[Categories/Update] ❌ 更新分类失败:', error.message);
    if (error instanceof AppError) {
      return sendErrorResponse(res, error, 'Categories/Update');
    }
    
    if (error.code === 'ER_DUP_ENTRY') {
      return sendErrorResponse(res, new AppError('分类名称已存在', 409, 'DUPLICATE_ERROR'), 'Categories/Update');
    }
    return sendErrorResponse(res, error, 'Categories/Update');
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 验证ID
    const categoryId = validateId(id, '分类ID');

    const childCount = await getOne('SELECT COUNT(*) as count FROM categories WHERE parent_id = ?', [categoryId]);
    if (childCount && childCount.count > 0) {
      throw new AppError('该分类下存在子分类，无法删除', 400, 'HAS_CHILDREN');
    }

    const productCount = await getOne('SELECT COUNT(*) as count FROM products WHERE category_id = ?', [categoryId]);
    if (productCount && productCount.count > 0) {
      throw new AppError('该分类下存在商品，无法删除', 400, 'HAS_PRODUCTS');
    }

    const result = await execute('DELETE FROM categories WHERE id = ?', [categoryId]);

    if (result.affectedRows === 0) {
      throw new AppError('分类不存在', 404, 'NOT_FOUND');
    }

    res.json({ success: true, message: '分类删除成功' });
  } catch (error) {
    console.error('[Categories/Delete] ❌ 删除分类失败:', error.message);
    return sendErrorResponse(res, error, 'Categories/Delete');
  }
});

module.exports = router;
