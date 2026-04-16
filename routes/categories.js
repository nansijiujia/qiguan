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
const { query, getOne, execute, pool } = require('../db-unified');
const { asyncHandler } = require('../middleware/errorHandler');
const { responseHelper, sendSuccessResponse, sendErrorResponse } = require('../utils/response-helper');
const { requirePermission } = require('../middleware/rbac');
const router = express.Router();

// ==================== 辅助函数和常量定义 ====================

/**
 * 错误码枚举
 */
const ERROR_CODES = {
  CATEGORY_NOT_FOUND: 'CATEGORY_NOT_FOUND',
  CATEGORY_VALIDATION_FAILED: 'CATEGORY_VALIDATION_FAILED',
  CATEGORY_NAME_DUPLICATE: 'CATEGORY_NAME_DUPLICATE',
  CATEGORY_DELETE_FAILED: 'CATEGORY_DELETE_FAILED',
  HAS_CHILDREN: 'HAS_CHILDREN',
  HAS_PRODUCTS: 'HAS_PRODUCTS',
  CIRCULAR_REFERENCE: 'CIRCULAR_REFERENCE',
  CONFLICT: 'CONFLICT',
  DATABASE_ERROR: 'DATABASE_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_PARENT_ID: 'INVALID_PARENT_ID',
  VALIDATION_ERROR: 'VALIDATION_ERROR'
};

/**
 * 允许的排序字段白名单（防止SQL注入）
 */
const ALLOWED_SORT_FIELDS = ['id', 'name', 'sort_order', 'created_at', 'updated_at', 'status'];

/**
 * 生成唯一的请求ID
 */
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 创建标准化的错误响应对象
 * @param {string} code - 错误码
 * @param {string} message - 错误消息
 * @param {Object|null} details - 详细错误信息
 * @param {Object} req - 请求对象（用于获取requestId）
 * @returns {Object} 标准化的错误响应
 */
function createErrorResponse(code, message, details = null, req = null) {
  const error = {
    success: false,
    error: {
      code,
      message,
      timestamp: new Date().toISOString(),
      requestId: (req && req.headers['x-request-id']) || generateRequestId()
    }
  };

  if (details) error.error.details = details;
  if (process.env.NODE_ENV === 'development') {
    error.error.stack = new Error().stack;
  }

  return error;
}

/**
 * 记录请求日志
 * @param {Object} req - 请求对象
 * @param {string} action - 操作类型
 * @param {Object} data - 额外数据
 */
function logRequest(req, action, data = {}) {
  const logData = {
    requestId: req.headers['x-request-id'] || generateRequestId(),
    action,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userId: req.user ? req.user.id : null,
    timestamp: new Date().toISOString(),
    ...data
  };

  if (action === 'ERROR') {
    console.error(`[CATEGORIES_API] ${JSON.stringify(logData, null, 2)}`);
  } else {
    console.log(`[CATEGORIES_API] ${JSON.stringify(logData, null, 2)}`);
  }
}

/**
 * 检查是否存在循环引用（递归检查子孙分类）
 * @param {number} categoryId - 当前分类ID
 * @param {number} targetParentId - 目标父分类ID
 * @returns {Promise<boolean>} 是否存在循环引用
 */
async function checkCircularReference(categoryId, targetParentId) {
  let currentId = targetParentId;
  const visited = new Set();
  const MAX_DEPTH = 20;

  while (currentId && visited.size < MAX_DEPTH) {
    if (currentId === categoryId) {
      return true;
    }

    if (visited.has(currentId)) {
      break;
    }
    visited.add(currentId);

    const parent = await getOne('SELECT parent_id FROM categories WHERE id = ? AND deleted_at IS NULL', [currentId]);
    if (!parent || !parent.parent_id) {
      break;
    }
    currentId = parent.parent_id;
  }

  return false;
}

// ==================== 树形结构构建函数 ====================

function buildTree(categories, parentId = null, visited = new Set()) {
  const categoryMap = new Map();
  const tree = [];

  categories.forEach(category => {
    categoryMap.set(category.id, {
      id: category.id,
      name: category.name,
      parent_id: category.parent_id,
      sort_order: category.sort_order,
      status: category.status,
      product_count: category.product_count || 0,
      created_at: category.created_at,
      children: []
    });
  });

  for (const [id, node] of categoryMap) {
    if (visited.has(id)) {
      console.warn(`[WARN] Circular reference detected in category ${id}, skipping`);
      continue;
    }
    visited.add(id);

    const parent = categoryMap.get(node.parent_id);
    if (parent) {
      if (visited.has(parent.id)) {
        console.warn(`[WARN] Circular reference: category ${id} -> parent ${parent.id} already visited`);
        tree.push(node);
      } else {
        parent.children.push(node);
      }
    } else if (node.parent_id === null || node.parent_id === undefined) {
      tree.push(node);
    }
  }

  function cleanEmptyChildren(node) {
    if (node.children.length === 0) {
      delete node.children;
    } else {
      node.children.forEach(cleanEmptyChildren);
    }
  }
  tree.forEach(cleanEmptyChildren);

  return tree;
}

function calculateLevel(categories, categoryId, depth = 0) {
  const MAX_DEPTH = 10;

  if (depth > MAX_DEPTH) {
    console.warn(`[WARN] Category tree depth exceeds limit (${MAX_DEPTH}) at category ${categoryId}`);
    return depth;
  }

  const category = categories.find(c => c.id === categoryId);
  if (!category || !category.parent_id) return depth;

  const parent = categories.find(c => c.id === category.parent_id);
  return parent ? calculateLevel(categories, category.parent_id, depth + 1) : depth;
}

// ==================== GET /categories - 获取分类列表（分页+搜索+筛选）====================

router.get('/', asyncHandler(async (req, res) => {
  const startTime = Date.now();

  try {
    // 参数验证和标准化
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || parseInt(req.query.limit) || 20));
    const offset = (page - 1) * pageSize;

    // 排序字段白名单验证（防止SQL注入）
    const sortField = ALLOWED_SORT_FIELDS.includes(req.query.sort_field)
      ? req.query.sort_field
      : 'created_at';
    const sortOrder = req.query.sort_order === 'asc' ? 'ASC' : 'DESC';

    // 搜索关键词
    const keyword = req.query.keyword ? req.query.keyword.trim() : null;

    // 状态筛选
    let statusFilter = null;
    if (req.query.status) {
      if (!['active', 'inactive'].includes(req.query.status)) {
        logRequest(req, 'VALIDATION_ERROR', { field: 'status', value: req.query.status });
        return res.status(400).json(createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          '状态值必须是 active 或 inactive',
          { field: 'status', received: req.query.status },
          req
        ));
      }
      statusFilter = req.query.status;
    }

    // 构建WHERE条件
    const conditions = ['deleted_at IS NULL'];
    const params = [];

    if (keyword) {
      conditions.push('name LIKE ?');
      params.push(`%${keyword}%`);
    }

    if (statusFilter) {
      conditions.push('status = ?');
      params.push(statusFilter);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // 缓存键（包含所有查询参数）
    const cacheKey = `categories:list:${page}:${pageSize}:${sortField}:${sortOrder}:${keyword || ''}:${statusFilter || 'all'}`;

    const result = await responseHelper.cachedQuery(cacheKey, async () => {
      // 查询总数
      const countSql = `SELECT COUNT(*) as total FROM categories ${whereClause}`;
      const [{ total }] = await query(countSql, params);

      // 查询数据（使用参数化查询防止SQL注入）
      const dataSql = `SELECT id, name, parent_id, sort_order, status, created_at, updated_at
                       FROM categories
                       ${whereClause}
                       ORDER BY ${sortField} ${sortOrder}
                       LIMIT ? OFFSET ?`;
      const list = await query(dataSql, [...params, pageSize, offset]);

      return { list, total: Number(total) };
    }, 120);

    const responseTime = Date.now() - startTime;

    // 标准化分页响应格式
    const responseData = {
      list: result.list,
      pagination: {
        page,
        pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / pageSize),
        hasNextPage: page < Math.ceil(result.total / pageSize),
        hasPrevPage: page > 1
      },
      _meta: {
        responseTime: `${responseTime}ms`,
        sortedBy: sortField,
        sortOrder: sortOrder.toLowerCase()
      }
    };

    logRequest(req, 'GET_LIST', {
      page,
      pageSize,
      total: result.total,
      responseTime: `${responseTime}ms`
    });

    sendSuccessResponse(res, responseData, '获取分类列表成功');

  } catch (error) {
    logRequest(req, 'ERROR', {
      action: 'GET_LIST',
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}));

// ==================== GET /categories/tree - 获取分类树形结构 ====================

router.get('/tree', asyncHandler(async (req, res) => {
  const startTime = Date.now();

  try {
    const { flat } = req.query;

    if (flat !== undefined && flat !== 'true' && flat !== 'false') {
      return res.status(400).json(createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'flat参数必须为true或false',
        { field: 'flat', received: flat },
        req
      ));
    }

    const cacheKey = `categories:tree:${flat === 'true' ? 'flat' : 'nested'}`;
    let result;

    if (flat === 'true') {
      result = await responseHelper.cachedQuery(cacheKey, async () => {
        const sql = `SELECT c.*,
                     COUNT(p.id) as product_count
                     FROM categories c
                     LEFT JOIN products p ON c.id = p.category_id AND p.status = 'active'
                     WHERE c.deleted_at IS NULL
                     GROUP BY c.id
                     ORDER BY c.sort_order ASC`;
        const categories = await query(sql);

        return categories.map(c => ({
          id: c.id,
          name: c.name,
          parent_id: c.parent_id,
          sort_order: c.sort_order,
          status: c.status,
          product_count: c.product_count || 0,
          level: calculateLevel(categories, c.id)
        }));
      }, 300);
    } else {
      result = await responseHelper.cachedQuery(cacheKey, async () => {
        const sql = `SELECT c.*,
                     COUNT(p.id) as product_count
                     FROM categories c
                     LEFT JOIN products p ON c.id = p.category_id AND p.status = 'active'
                     WHERE c.deleted_at IS NULL
                     GROUP BY c.id
                     ORDER BY c.sort_order ASC`;
        const categories = await query(sql);
        return buildTree(categories);
      }, 300);
    }

    const responseTime = Date.now() - startTime;
    logRequest(req, 'GET_TREE', { responseTime: `${responseTime}ms`, type: flat === 'true' ? 'flat' : 'nested' });

    sendSuccessResponse(res, result, '获取分类树成功');

  } catch (error) {
    logRequest(req, 'ERROR', { action: 'GET_TREE', error: error.message, stack: error.stack });
    throw error;
  }
}));

// ==================== GET /categories/:id - 获取单个分类详情 ====================

router.get('/:id', asyncHandler(async (req, res) => {
  const startTime = Date.now();

  try {
    const { id } = req.params;
    const categoryId = validateId(id, '分类ID');

    const cacheKey = `categories:detail:${categoryId}`;
    const category = await responseHelper.cachedQuery(cacheKey, async () => {
      const categorySql = `SELECT c.*, COUNT(p.id) as product_count
                           FROM categories c
                           LEFT JOIN products p ON c.id = p.category_id AND p.status = 'active'
                           WHERE c.id = ? AND c.deleted_at IS NULL
                           GROUP BY c.id`;
      return await getOne(categorySql, [categoryId]);
    }, 180);

    if (!category) {
      logRequest(req, 'NOT_FOUND', { categoryId });
      throw new AppError('分类不存在', 404, ERROR_CODES.CATEGORY_NOT_FOUND);
    }

    const childrenSql = `SELECT * FROM categories WHERE parent_id = ? AND deleted_at IS NULL ORDER BY sort_order ASC`;
    const children = await query(childrenSql, [categoryId]);

    let parent = null;
    if (category.parent_id) {
      parent = await getOne(`SELECT id, name FROM categories WHERE id = ? AND deleted_at IS NULL`, [category.parent_id]);
    }

    const responseTime = Date.now() - startTime;
    logRequest(req, 'GET_DETAIL', { categoryId, responseTime: `${responseTime}ms` });

    sendSuccessResponse(res, {
      ...category,
      children: children.length > 0 ? children : [],
      parent: parent ? { id: parent.id, name: parent.name } : null
    });

  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logRequest(req, 'ERROR', { action: 'GET_DETAIL', error: error.message, stack: error.stack });
    throw error;
  }
}));

// ==================== POST /categories - 创建分类（带完整验证和事务保护）====================

router.post('/', requirePermission('categories', 'create'), asyncHandler(async (req, res) => {
  const startTime = Date.now();
  let connection;

  try {
    const { name, parent_id, sort_order, status } = req.body;

    // ===== 字段级验证 =====

    // 名称必填验证
    if (!name || typeof name !== 'string') {
      logRequest(req, 'VALIDATION_ERROR', { field: 'name', error: '名称不能为空或不是字符串' });
      return res.status(400).json(createErrorResponse(
        ERROR_CODES.CATEGORY_VALIDATION_FAILED,
        '分类名称为必填项且必须是字符串',
        { field: 'name' },
        req
      ));
    }

    // 名称长度验证（2-50字符）
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 50) {
      logRequest(req, 'VALIDATION_ERROR', { field: 'name', length: trimmedName.length });
      return res.status(400).json(createErrorResponse(
        ERROR_CODES.CATEGORY_VALIDATION_FAILED,
        '分类名称长度必须在2-50个字符之间',
        { field: 'name', minLength: 2, maxLength: 50, actualLength: trimmedName.length },
        req
      ));
    }

    const sanitizedName = sanitizeString(trimmedName);

    // 排序字段验证
    let finalSortOrder = 0;
    if (sort_order !== undefined && sort_order !== null) {
      if (!Number.isInteger(sort_order) || sort_order < 0) {
        return res.status(400).json(createErrorResponse(
          ERROR_CODES.CATEGORY_VALIDATION_FAILED,
          '排序必须是大于等于0的整数',
          { field: 'sort_order', received: sort_order },
          req
        ));
      }
      finalSortOrder = parseInt(sort_order);
    }

    // 状态字段验证
    let finalStatus = 'active';
    if (status !== undefined && status !== null) {
      if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json(createErrorResponse(
          ERROR_CODES.CATEGORY_VALIDATION_FAILED,
          '状态值必须是 active 或 inactive',
          { field: 'status', received: status },
          req
        ));
      }
      finalStatus = status;
    }

    // ===== 唯一性检查（应用层 + 考虑软删除记录）=====
    const existing = await getOne(
      'SELECT id, name, deleted_at FROM categories WHERE LOWER(name) = LOWER(?)',
      [sanitizedName]
    );

    if (existing && existing.deleted_at === null) {
      // 存在未删除的同名分类
      logRequest(req, 'DUPLICATE_CHECK', { name: sanitizedName, existingId: existing.id, result: 'duplicate' });
      return res.status(409).json(createErrorResponse(
        ERROR_CODES.CATEGORY_NAME_DUPLICATE,
        `分类名称"${sanitizedName}"已存在`,
        { duplicateId: existing.id },
        req
      ));
    }

    // ===== 父分类存在性验证 =====
    if (parent_id !== undefined && parent_id !== null) {
      validateId(parent_id, '父分类ID');

      const parentExists = await getOne(
        'SELECT id, name, deleted_at FROM categories WHERE id = ?',
        [parent_id]
      );

      if (!parentExists || parentExists.deleted_at !== null) {
        logRequest(req, 'PARENT_CHECK', { parentId: parent_id, result: 'not_found' });
        return res.status(400).json(createErrorResponse(
          ERROR_CODES.INVALID_PARENT_ID,
          '父分类不存在或已被删除',
          { parent_id },
          req
        ));
      }
    }

    // ===== 使用事务保护插入操作 =====
    connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 再次检查唯一性（防止并发创建）
      const concurrentCheck = await connection.execute(
        'SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND deleted_at IS NULL FOR UPDATE',
        [sanitizedName]
      );

      if (concurrentCheck[0].length > 0) {
        await connection.rollback();
        return res.status(409).json(createErrorResponse(
          ERROR_CODES.CATEGORY_NAME_DUPLICATE,
          `分类名称"${sanitizedName}"已存在（并发检测）`,
          {},
          req
        ));
      }

      // 执行插入
      const sql = `INSERT INTO categories (name, parent_id, sort_order, status, created_at, updated_at)
                   VALUES (?, ?, ?, ?, NOW(), NOW())`;
      const [result] = await connection.execute(sql, [
        sanitizedName,
        parent_id || null,
        finalSortOrder,
        finalStatus
      ]);

      await connection.commit();

      // 清除缓存
      responseHelper.invalidateCache('categories');

      const responseTime = Date.now() - startTime;
      logRequest(req, 'CREATE_SUCCESS', {
        newId: result.insertId,
        name: sanitizedName,
        responseTime: `${responseTime}ms`
      });

      // 返回完整的创建结果（含 id, created_at）
      sendSuccessResponse(res, {
        id: result.insertId,
        name: sanitizedName,
        parent_id: parent_id || null,
        sort_order: finalSortOrder,
        status: finalStatus,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, '分类创建成功', 201);

    } catch (transactionError) {
      await connection.rollback();
      logRequest(req, 'TRANSACTION_ERROR', {
        action: 'CREATE',
        error: transactionError.message
      });
      throw transactionError;
    } finally {
      if (connection) connection.release();
    }

  } catch (error) {
    logRequest(req, 'ERROR', {
      action: 'CREATE',
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}));

// ==================== PUT /categories/:id - 更新分类（乐观锁+循环引用检测+部分更新）====================

router.put('/:id', requirePermission('categories', 'update'), asyncHandler(async (req, res) => {
  const startTime = Date.now();
  let connection;

  try {
    const { id } = req.params;
    const { name, parent_id, sort_order, status, updated_at: clientUpdatedAt } = req.body;
    const categoryId = validateId(id, '分类ID');

    // ===== 分类存在性预检 =====
    const existing = await getOne(
      'SELECT * FROM categories WHERE id = ? AND deleted_at IS NULL',
      [categoryId]
    );

    if (!existing) {
      logRequest(req, 'NOT_FOUND', { categoryId });
      throw new AppError('分类不存在', 404, ERROR_CODES.CATEGORY_NOT_FOUND);
    }

    // ===== 乐观锁实现（updated_at比对）=====
    if (clientUpdatedAt && existing.updated_at) {
      const serverTime = new Date(existing.updated_at).getTime();
      const clientTime = new Date(clientUpdatedAt).getTime();

      if (serverTime !== clientTime) {
        logRequest(req, 'CONFLICT', {
          categoryId,
          serverUpdatedAt: existing.updated_at,
          clientUpdatedAt: clientUpdatedAt
        });
        return res.status(409).json({
          ...createErrorResponse(ERROR_CODES.CONFLICT, '数据已被其他人修改，请刷新后重试', null, req),
          data: {
            current: {
              id: existing.id,
              name: existing.name,
              parent_id: existing.parent_id,
              sort_order: existing.sort_order,
              status: existing.status,
              updated_at: existing.updated_at
            }
          }
        });
      }
    }

    // ===== 字段级验证 =====

    // 名称验证
    if (name !== undefined && name !== null) {
      if (typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json(createErrorResponse(
          ERROR_CODES.CATEGORY_VALIDATION_FAILED,
          '分类名称不能为空且必须是字符串',
          { field: 'name' },
          req
        ));
      }

      const trimmedName = name.trim();
      if (trimmedName.length < 2 || trimmedName.length > 50) {
        return res.status(400).json(createErrorResponse(
          ERROR_CODES.CATEGORY_VALIDATION_FAILED,
          '分类名称长度必须在2-50个字符之间',
          { field: 'name', minLength: 2, maxLength: 50, actualLength: trimmedName.length },
          req
        ));
      }
    }

    // 循环引用检测 - 不能将自己设为父分类
    if (parent_id !== undefined && parent_id !== null) {
      validateId(parent_id, '父分类ID');

      if (parseInt(parent_id) === parseInt(categoryId)) {
        logRequest(req, 'CIRCULAR_REFERENCE', { categoryId, parentId: parent_id, type: 'self_reference' });
        return res.status(400).json(createErrorResponse(
          ERROR_CODES.CIRCULAR_REFERENCE,
          '不能将自己设为父分类',
          { categoryId, attemptedParentId: parent_id },
          req
        ));
      }

      // 检查是否将父分类设为自己的子孙分类（递归检测）
      const isCircular = await checkCircularReference(categoryId, parent_id);
      if (isCircular) {
        logRequest(req, 'CIRCULAR_REFERENCE', { categoryId, parentId: parent_id, type: 'descendant_reference' });
        return res.status(400).json(createErrorResponse(
          ERROR_CODES.CIRCULAR_REFERENCE,
          '不能将父分类设为自己的子孙分类，会导致循环引用',
          { categoryId, attemptedParentId: parent_id },
          req
        ));
      }

      // 父分类存在性验证
      const parentExists = await getOne(
        'SELECT id, deleted_at FROM categories WHERE id = ?',
        [parent_id]
      );

      if (!parentExists || parentExists.deleted_at !== null) {
        return res.status(400).json(createErrorResponse(
          ERROR_CODES.INVALID_PARENT_ID,
          '父分类不存在或已被删除',
          { parent_id },
          req
        ));
      }
    }

    // 排序字段验证
    if (sort_order !== undefined) {
      if (!Number.isInteger(sort_order) || sort_order < 0) {
        return res.status(400).json(createErrorResponse(
          ERROR_CODES.CATEGORY_VALIDATION_FAILED,
          '排序必须是大于等于0的整数',
          { field: 'sort_order', received: sort_order },
          req
        ));
      }
    }

    // 状态字段验证
    if (status !== undefined) {
      if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json(createErrorResponse(
          ERROR_CODES.CATEGORY_VALIDATION_FAILED,
          '状态值必须是 active 或 inactive',
          { field: 'status', received: status },
          req
        ));
      }
    }

    // ===== 构建更新字段（部分更新支持）=====
    const fields = [];
    const params = [];

    if (name !== undefined) {
      const sanitizedName = sanitizeString(name.trim());

      // 唯一性检查排除自身记录
      if (sanitizedName !== existing.name) {
        const duplicate = await getOne(
          'SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND id != ? AND deleted_at IS NULL',
          [sanitizedName, categoryId]
        );

        if (duplicate) {
          logRequest(req, 'DUPLICATE_CHECK', {
            name: sanitizedName,
            excludeId: categoryId,
            result: 'duplicate_found'
          });
          return res.status(409).json(createErrorResponse(
            ERROR_CODES.CATEGORY_NAME_DUPLICATE,
            `分类名称"${sanitizedName}"已被其他分类使用`,
            { duplicateId: duplicate.id },
            req
          ));
        }
      }

      fields.push('name = ?');
      params.push(sanitizedName);
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

    // 至少需要一个更新字段
    if (fields.length === 0) {
      return res.status(400).json(createErrorResponse(
        ERROR_CODES.CATEGORY_VALIDATION_FAILED,
        '没有提供需要更新的字段',
        null,
        req
      ));
    }

    // ===== 使用事务保护更新操作 =====
    connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 执行更新（包含乐观锁条件）
      fields.push('updated_at = NOW()');
      params.push(categoryId);

      let updateSql = `UPDATE categories SET ${fields.join(', ')} WHERE id = ?`;

      // 如果客户端提供了updated_at，添加乐观锁条件
      if (clientUpdatedAt && existing.updated_at) {
        updateSql += ' AND updated_at = ?';
        params.push(existing.updated_at);
      }

      const [result] = await connection.execute(updateSql, params);

      if (result.affectedRows === 0) {
        // 可能是乐观锁冲突或记录不存在
        await connection.rollback();

        // 重新查询确认记录状态
        const currentRecord = await getOne(
          'SELECT * FROM categories WHERE id = ? AND deleted_at IS NULL',
          [categoryId]
        );

        if (!currentRecord) {
          throw new AppError('分类不存在', 404, ERROR_CODES.CATEGORY_NOT_FOUND);
        }

        // 记录存在但未更新，说明是并发冲突
        logRequest(req, 'UPDATE_CONFLICT', {
          categoryId,
          clientUpdatedAt,
          serverUpdatedAt: currentRecord.updated_at
        });

        return res.status(409).json({
          ...createErrorResponse(ERROR_CODES.CONFLICT, '数据已被其他人修改，请刷新后重试', null, req),
          data: {
            current: {
              id: currentRecord.id,
              name: currentRecord.name,
              parent_id: currentRecord.parent_id,
              sort_order: currentRecord.sort_order,
              status: currentRecord.status,
              updated_at: currentRecord.updated_at
            }
          }
        });
      }

      await connection.commit();

      // 清除缓存
      responseHelper.invalidateCache('categories');

      // 返回更新后的完整数据
      const updatedCategory = await getOne(
        'SELECT id, name, parent_id, sort_order, status, created_at, updated_at FROM categories WHERE id = ?',
        [categoryId]
      );

      const responseTime = Date.now() - startTime;
      logRequest(req, 'UPDATE_SUCCESS', {
        categoryId,
        updatedFields: fields.map(f => f.split('=')[0].trim()),
        responseTime: `${responseTime}ms`
      });

      sendSuccessResponse(res, updatedCategory, '分类更新成功');

    } catch (transactionError) {
      await connection.rollback();
      logRequest(req, 'TRANSACTION_ERROR', {
        action: 'UPDATE',
        categoryId,
        error: transactionError.message
      });
      throw transactionError;
    } finally {
      if (connection) connection.release();
    }

  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logRequest(req, 'ERROR', {
      action: 'UPDATE',
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}));

// ==================== DELETE /categories/:id - 删除分类（软删除+关联检查+事务保护）====================

router.delete('/:id', requirePermission('categories', 'delete'), asyncHandler(async (req, res) => {
  const startTime = Date.now();
  let connection;

  try {
    const { id } = req.params;
    const categoryId = validateId(id, '分类ID');

    // ===== 存在性检查（返回404而非500）=====
    const category = await getOne(
      'SELECT id, name, deleted_at FROM categories WHERE id = ?',
      [categoryId]
    );

    if (!category) {
      logRequest(req, 'NOT_FOUND', { categoryId, reason: 'record_not_exist' });
      throw new AppError('分类不存在', 404, ERROR_CODES.CATEGORY_NOT_FOUND);
    }

    if (category.deleted_at !== null) {
      logRequest(req, 'NOT_FOUND', { categoryId, reason: 'already_deleted', deletedAt: category.deleted_at });
      throw new AppError('分类不存在或已被删除', 404, ERROR_CODES.CATEGORY_NOT_FOUND);
    }

    // ===== 关联检查（子分类）=====
    const childrenCount = await getOne(
      'SELECT COUNT(*) as count FROM categories WHERE parent_id = ? AND deleted_at IS NULL',
      [categoryId]
    );

    if (childrenCount && childrenCount.count > 0) {
      logRequest(req, 'HAS_CHILDREN', { categoryId, childCount: childrenCount.count });
      return res.status(400).json(createErrorResponse(
        ERROR_CODES.HAS_CHILDREN,
        `该分类下有 ${childrenCount.count} 个子分类，请先删除或移动子分类`,
        { categoryId, childCount: childrenCount.count },
        req
      ));
    }

    // ===== 关联检查（商品）=====
    const productCount = await getOne(
      'SELECT COUNT(*) as count FROM products WHERE category_id = ? AND deleted_at IS NULL',
      [categoryId]
    );

    if (productCount && productCount.count > 0) {
      logRequest(req, 'HAS_PRODUCTS', { categoryId, productCount: productCount.count });
      return res.status(400).json(createErrorResponse(
        ERROR_CODES.HAS_PRODUCTS,
        `该分类下关联了 ${productCount.count} 个商品，请先移除商品关联`,
        { categoryId, productCount: productCount.count },
        req
      ));
    }

    // ===== 使用事务保护执行软删除 =====
    connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 执行软删除（设置deleted_at）
      const [result] = await connection.execute(
        'UPDATE categories SET deleted_at = NOW(), updated_at = NOW() WHERE id = ? AND deleted_at IS NULL',
        [categoryId]
      );

      if (result.affectedRows === 0) {
        await connection.rollback();
        throw new AppError('分类不存在或已被删除', 404, ERROR_CODES.CATEGORY_NOT_FOUND);
      }

      await connection.commit();

      // 清除缓存
      responseHelper.invalidateCache('categories');

      const responseTime = Date.now() - startTime;
      logRequest(req, 'DELETE_SUCCESS', {
        categoryId,
        categoryName: category.name,
        deleteType: 'soft_delete',
        responseTime: `${responseTime}ms`
      });

      sendSuccessResponse(res, {
        id: parseInt(categoryId),
        deleted: true,
        deletedAt: new Date().toISOString(),
        message: '分类已软删除'
      }, '分类删除成功');

    } catch (transactionError) {
      await connection.rollback();
      logRequest(req, 'TRANSACTION_ERROR', {
        action: 'DELETE',
        categoryId,
        error: transactionError.message
      });

      if (transactionError instanceof AppError) {
        throw transactionError;
      }

      throw new AppError(
        '删除操作失败，请稍后重试',
        500,
        ERROR_CODES.CATEGORY_DELETE_FAILED
      );

    } finally {
      if (connection) connection.release();
    }

  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logRequest(req, 'ERROR', {
      action: 'DELETE',
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}));

module.exports = router;
