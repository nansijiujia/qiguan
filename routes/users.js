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
const { asyncHandler } = require('../middleware/errorHandler');
const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, role, status, keyword } = req.query;
  const { page: pageNum, limit: limitNum, offset } = validatePagination(req);
  const params = [];
  let whereSql = 'WHERE 1=1';

  if (role) {
    const validRoles = ['admin', 'manager', 'user'];
    validateEnum(role, validRoles, '角色');
    whereSql += ' AND role = ?';
    params.push(role);
  }

  if (status) {
    const validStatuses = ['active', 'inactive', 'banned'];
    validateEnum(status, validStatuses, '用户状态');
    whereSql += ' AND status = ?';
    params.push(status);
  }

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
}));

router.post('/', asyncHandler(async (req, res) => {
  const { username, email, password, avatar, role, status } = req.body;

  validateRequired(['username', 'email', 'password'], req.body);

  validateString(username, '用户名', { min: 3, max: 20, pattern: /^[a-zA-Z0-9_]+$/ });
  validateEmail(email);
  validateString(password, '密码', { min: 6, max: 128 });

  if (role) {
    validateEnum(role, ['admin', 'manager', 'user'], '角色');
  }

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
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { username, email, password, avatar, role, status } = req.body;

  const userId = validateId(id, '用户ID');

  const user = await getOne('SELECT id FROM users WHERE id = ?', [userId]);
  if (!user) {
    throw new AppError('用户不存在', 404, 'NOT_FOUND');
  }

  const fields = [];
  const values = [];

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
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const userId = validateId(id, '用户ID');

  const user = await getOne('SELECT id FROM users WHERE id = ?', [userId]);
  if (!user) {
    throw new AppError('用户不存在', 404, 'NOT_FOUND');
  }

  await execute('DELETE FROM users WHERE id = ?', [userId]);
  res.json({ success: true, message: 'User deleted successfully' });
}));

module.exports = router;
