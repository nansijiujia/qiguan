const express = require('express');
const { query, getOne, execute } = require('../db');
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
    console.error('[ERROR] Getting categories:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '获取分类列表失败' }
    });
  }
});

router.get('/tree', async (req, res) => {
  try {
    const { flat } = req.query;

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
    console.error('[ERROR] Getting category tree:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取分类树失败'
      }
    });
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

    const categorySql = `SELECT c.*, COUNT(p.id) as product_count
                         FROM categories c
                         LEFT JOIN products p ON c.id = p.category_id AND p.status = 'active'
                         WHERE c.id = ?
                         GROUP BY c.id`;
    const category = await getOne(categorySql, [id]);

    if (!category) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '分类不存在'
        }
      });
    }

    const childrenSql = `SELECT * FROM categories WHERE parent_id = ? ORDER BY sort_order ASC`;
    const children = await query(childrenSql, [id]);

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
    console.error('[ERROR] Getting category details:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取分类详情失败'
      }
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, parent_id, sort_order, status } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '分类名称不能为空'
        }
      });
    }

    // 检查分类名称是否已存在
    const existing = await getOne('SELECT id FROM categories WHERE name = ?', [name.trim()]);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_ERROR',
          message: `分类名称"${name}"已存在`
        }
      });
    }

    if (parent_id !== undefined && parent_id !== null) {
      const parentExists = await getOne('SELECT id FROM categories WHERE id = ?', [parent_id]);
      if (!parentExists) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '父分类不存在'
          }
        });
      }
    }

    const sql = `INSERT INTO categories (name, parent_id, sort_order, status, created_at) VALUES (?, ?, ?, ?, datetime('now'))`;
    const result = await execute(sql, [
      name.trim(),
      parent_id || null,
      sort_order || 0,
      status || 'active'
    ]);

    const insertId = result.insertId;
    res.status(201).json({
      success: true,
      data: {
        id: insertId,
        name: name.trim(),
        parent_id: parent_id || null,
        sort_order: sort_order || 0,
        status: status || 'active'
      }
    });
  } catch (error) {
    console.error('[ERROR] Adding category:', error);
    if (error.code === 'ER_DUP_ENTRY' || error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_ERROR',
          message: '分类名称已存在'
        }
      });
    }
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '创建分类失败'
      }
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, parent_id, sort_order, status } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '分类名称不能为空'
        }
      });
    }

    if (parent_id !== undefined && parent_id !== null && parseInt(parent_id) === parseInt(id)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '不能将自己设为父分类'
        }
      });
    }

    if (parent_id !== undefined && parent_id !== null) {
      const parentExists = await getOne('SELECT id FROM categories WHERE id = ?', [parent_id]);
      if (!parentExists) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '父分类不存在'
          }
        });
      }
    }

    const fields = [];
    const params = [];

    fields.push('name = ?');
    params.push(name);

    if (parent_id !== undefined) {
      fields.push('parent_id = ?');
      params.push(parent_id);
    }
    if (sort_order !== undefined) {
      fields.push('sort_order = ?');
      params.push(sort_order);
    }
    if (status !== undefined) {
      fields.push('status = ?');
      params.push(status);
    }

    params.push(id);
    const sql = `UPDATE categories SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`;
    const result = await execute(sql, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '分类不存在'
        }
      });
    }

    res.json({
      success: true,
      data: {
        id: parseInt(id),
        name,
        parent_id: parent_id !== undefined ? parent_id : null,
        sort_order: sort_order !== undefined ? sort_order : 0,
        status: status !== undefined ? status : 'active'
      }
    });
  } catch (error) {
    console.error('[ERROR] Updating category:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_ERROR',
          message: '分类名称已存在'
        }
      });
    }
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '更新分类失败'
      }
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const childCount = await getOne('SELECT COUNT(*) as count FROM categories WHERE parent_id = ?', [id]);
    if (childCount && childCount.count > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'HAS_CHILDREN',
          message: '该分类下存在子分类，无法删除'
        }
      });
    }

    const productCount = await getOne('SELECT COUNT(*) as count FROM products WHERE category_id = ?', [id]);
    if (productCount && productCount.count > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'HAS_PRODUCTS',
          message: '该分类下存在商品，无法删除'
        }
      });
    }

    const result = await execute('DELETE FROM categories WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '分类不存在'
        }
      });
    }

    res.json({ success: true, message: '分类删除成功' });
  } catch (error) {
    console.error('[ERROR] Deleting category:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '删除分类失败'
      }
    });
  }
});

module.exports = router;
