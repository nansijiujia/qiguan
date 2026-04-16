/**
 * @swagger
 * tags:
 *   - name: Users
 *     description: 用户管理接口（管理员权限）
 */

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
const { query, getOne, execute } = require('../db-unified');
const { asyncHandler } = require('../middleware/errorHandler');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: 获取用户列表（分页）
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [admin, manager, user]
 *         description: 按角色筛选
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, banned]
 *         description: 按状态筛选
 *       - $ref: '#/components/parameters/KeywordParam'
 *     responses:
 *       200:
 *         description: 用户列表获取成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         list:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/User'
 *                         pagination:
 *                           $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
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

// ============================================================
// 用户密码修改接口 PUT /api/v1/users/password
// 用于个人账号修改密码
// ============================================================

router.put('/password', verifyToken, asyncHandler(async (req, res) => {
  const { current_password, new_password, confirm_password } = req.body;

  // 输入验证
  validateRequired(['current_password', 'new_password', 'confirm_password'], req.body);

  validateString(current_password, '当前密码', { min: 6, max: 128 });
  validateString(new_password, '新密码', { min: 8, max: 100 });

  if (new_password !== confirm_password) {
    throw new AppError('两次输入的密码不一致', 400, 'PASSWORD_MISMATCH');
  }

  if (current_password === new_password) {
    throw new AppError('新密码不能与当前密码相同', 400, 'SAME_PASSWORD');
  }

  // 密码强度验证
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(new_password)) {
    throw new AppError('密码需包含大小写字母和数字', 400, 'WEAK_PASSWORD');
  }

  // 获取当前用户信息
  const userId = req.user.userId;
  const user = await getOne('SELECT id, password FROM users WHERE id = ?', [userId]);

  if (!user) {
    throw new AppError('用户不存在', 404, 'NOT_FOUND');
  }

  // 验证当前密码
  const passwordHash = user.password || user.password_hash || user.pwd;
  if (!passwordHash) {
    throw new AppError('用户账号配置错误，请联系管理员', 500, 'SERVER_ERROR');
  }

  let isMatch = false;
  try {
    isMatch = await bcrypt.compare(current_password, passwordHash);
  } catch (bcryptErr) {
    console.error('[Users/Password] ❌ bcrypt.compare异常:', bcryptErr.message);
    throw new AppError('密码验证失败', 500, 'PASSWORD_VERIFY_ERROR');
  }

  if (!isMatch) {
    throw new AppError('当前密码错误', 401, 'WRONG_PASSWORD');
  }

  // 加密新密码并更新
  const newPasswordHash = await bcrypt.hash(new_password, 10);
  await execute(
    'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?',
    [newPasswordHash, userId]
  );

  res.json({
    success: true,
    message: '密码修改成功，请重新登录'
  });
}));

// ============================================================
// 用户名修改接口 PUT /api/v1/users/username
// 用于个人账号修改用户名
// ============================================================
router.put('/username', verifyToken, asyncHandler(async (req, res) => {
  const { new_username, current_password } = req.body;

  // 输入验证
  validateRequired(['new_username', 'current_password'], req.body);

  validateString(new_username, '新用户名', { min: 2, max: 50 });

  // 用户名格式验证
  if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(new_username)) {
    throw new AppError('用户名只能包含字母、数字、下划线和中文', 400, 'INVALID_USERNAME');
  }

  // 保留字检查
  const reservedUsernames = ['admin', 'root', 'system', 'administrator', 'test', 'guest', 'user', 'api', 'www', 'mail', 'ftp', 'db', 'database', 'sys', 'null', 'undefined', 'superuser', 'moderator', 'support', 'help', 'info', 'service'];
  if (reservedUsernames.includes(new_username.toLowerCase())) {
    throw new AppError(`"${new_username}" 是系统保留用户名，不能使用`, 400, 'RESERVED_USERNAME');
  }

  validateString(current_password, '当前密码', { min: 6, max: 128 });

  // 获取当前用户信息
  const userId = req.user.userId;
  const user = await getOne('SELECT id, username, password FROM users WHERE id = ?', [userId]);

  if (!user) {
    throw new AppError('用户不存在', 404, 'NOT_FOUND');
  }

  // 检查新用户名是否与当前相同
  if (user.username === new_username) {
    throw new AppError('新用户名不能与当前用户名相同', 400, 'SAME_USERNAME');
  }

  // 检查用户名是否已被使用
  const existingUser = await getOne('SELECT id FROM users WHERE username = ? AND id != ?', [new_username, userId]);
  if (existingUser) {
    throw new AppError('该用户名已被使用', 409, 'DUPLICATE_USERNAME');
  }

  // 验证当前密码
  const passwordHash = user.password || user.password_hash || user.pwd;
  if (!passwordHash) {
    throw new AppError('用户账号配置错误，请联系管理员', 500, 'SERVER_ERROR');
  }

  let isMatch = false;
  try {
    isMatch = await bcrypt.compare(current_password, passwordHash);
  } catch (bcryptErr) {
    console.error('[Users/Username] ❌ bcrypt.compare异常:', bcryptErr.message);
    throw new AppError('密码验证失败', 500, 'PASSWORD_VERIFY_ERROR');
  }

  if (!isMatch) {
    throw new AppError('当前密码错误', 401, 'WRONG_PASSWORD');
  }

  // 更新用户名
  await execute(
    'UPDATE users SET username = ?, updated_at = NOW() WHERE id = ?',
    [new_username, userId]
  );

  res.json({
    success: true,
    message: '用户名修改成功，请重新登录'
  });
}));

module.exports = router;
