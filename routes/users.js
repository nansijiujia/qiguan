// [TIMEOUT] 建议: 为长时间运行的数据库操作添加超时设置
const { 
  validateRequired, 
  validateString, 
  validateNumber, 
  validateId,
  validateEnum,
  validateEmail,
  validatePhone,
  validatePagination,
  sanitizeString,
  AppError 
} = require('../utils/validation');

const express = require('express');
const bcrypt = require('bcryptjs');
const { query, getOne, execute } = require('../db_unified');
const { sendErrorResponse } = require('../utils/errorHandler');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, role, status, keyword } = req.query;
    
    // 验证分页参数
    const { page: pageNum, limit: limitNum, offset } = validatePagination(req);

    const params = [];
    let whereSql = 'WHERE 1=1';

    // 验证角色参数（如果提供）
    if (role) {
      const validRoles = ['admin', 'manager', 'user'];
      validateEnum(role, validRoles, '角色');
      whereSql += ' AND role = ?';
      params.push(role);
    }
    
    // 验证状态参数（如果提供）
    if (status) {
      const validStatuses = ['active', 'inactive', 'banned'];
      validateEnum(status, validStatuses, '用户状态');
      whereSql += ' AND status = ?';
      params.push(status);
    }
    
    // 验证搜索关键词（如果提供）
    if (keyword) {
      validateString(keyword, '搜索关键词', { min: 1, max: 50, required: false });
      whereSql += ' AND (username LIKE ? OR email LIKE ?)';
      const kw = `%${keyword}%`;
      params.push(kw, kw);
    }

    const countResult = await getOne(`SELECT COUNT(*) AS total FROM users ${whereSql}`, params);
    const list = await query(
      `SELECT id, username, email, avatar, role, status, last_login, created_at
       FROM users ${whereSql}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    res.json({
      success: true,
      data: {
        list,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: countResult.total || 0
        }
      }
    });
  } catch (error) {
    console.error('[Users/List] ❌ 获取用户列表失败:', error.message);
    return sendErrorResponse(res, error, 'Users/List');
  }
});

router.post('/', async (req, res) => {
  try {
    const { username, email, password, avatar, role, status } = req.body;

    // 输入验证
    validateRequired(['username', 'email', 'password'], req.body);
    
    validateString(username, '用户名', { min: 3, max: 20, pattern: /^[a-zA-Z0-9_]+$/ });
    validateEmail(email);
    validateString(password, '密码', { min: 6, max: 128 });

    // 验证角色（如果提供）
    if (role) {
      validateEnum(role, ['admin', 'manager', 'user'], '角色');
    }

    // 验证状态（如果提供）
    if (status) {
      validateEnum(status, ['active', 'inactive', 'banned'], '用户状态');
    }

    const existing = await getOne('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing) {
      throw new AppError('用户名或邮箱已存在', 409, 'DUPLICATE_ERROR');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await execute(
      `INSERT INTO users (username, email, password, avatar, role, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sanitizeString(username), email, passwordHash, avatar || null, role || 'user', status || 'active']
    );

    const newUser = await getOne('SELECT id, username, email, avatar, role, status, created_at FROM users WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: newUser });
  } catch (error) {
    console.error('[Users/Create] ❌ 创建用户失败:', error.message);
    return sendErrorResponse(res, error, 'Users/Create');
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, password, avatar, role, status } = req.body;

    // 验证ID
    const userId = validateId(id, '用户ID');

    const user = await getOne('SELECT id FROM users WHERE id = ?', [userId]);
    if (!user) {
      throw new AppError('用户不存在', 404, 'NOT_FOUND');
    }

    const fields = [];
    const values = [];

    // 字段级别验证
    if (username !== undefined) {
      validateString(username, '用户名', { min: 3, max: 20, pattern: /^[a-zA-Z0-9_]+$/ });
      fields.push('username = ?');
      values.push(sanitizeString(username));
    }
    
    if (email !== undefined) {
      validateEmail(email);
      fields.push('email = ?');
      values.push(email);
    }
    
    if (password !== undefined) {
      validateString(password, '密码', { min: 6, max: 128 });
      const hash = await bcrypt.hash(password, 10);
      fields.push('password = ?');
      values.push(hash);
    }
    
    if (avatar !== undefined) {
      fields.push('avatar = ?');
      values.push(avatar);
    }
    
    if (role !== undefined) {
      validateEnum(role, ['admin', 'manager', 'user'], '角色');
      fields.push('role = ?');
      values.push(role);
    }
    
    if (status !== undefined) {
      validateEnum(status, ['active', 'inactive', 'banned'], '用户状态');
      fields.push('status = ?');
      values.push(status);
    }

    if (fields.length === 0) {
      throw new AppError('没有需要更新的字段', 400, 'VALIDATION_ERROR');
    }

    values.push(userId);
    await execute(`UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`, values);

    const updatedUser = await getOne('SELECT id, username, email, avatar, role, status, last_login, created_at FROM users WHERE id = ?', [userId]);
    res.json({ success: true, data: updatedUser });
  } catch (error) {
    console.error('[Users/Update] ❌ 更新用户失败:', error.message);
    return sendErrorResponse(res, error, 'Users/Update');
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 验证ID
    const userId = validateId(id, '用户ID');

    const user = await getOne('SELECT id FROM users WHERE id = ?', [userId]);
    if (!user) {
      throw new AppError('用户不存在', 404, 'NOT_FOUND');
    }

    await execute('DELETE FROM users WHERE id = ?', [userId]);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('[Users/Delete] ❌ 删除用户失败:', error.message);
    return sendErrorResponse(res, error, 'Users/Delete');
  }
});

module.exports = router;
