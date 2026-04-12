// [TIMEOUT] 建议: 为长时间运行的数据库操作添加超时设置
// [PERFORMANCE] 建议: 考虑使用批量查询替代循环内单条查询以提高性能
// [PERFORMANCE] Example: 使用 IN (?) 和批量参数代替循环

const { 
  validateRequired, 
  validateString, 
  validateEmail, 
  validateNumber,
  validateEnum,
  sanitizeString,
  AppError 
} = require('../utils/validation');

const express = require('express');
const bcrypt = require('bcryptjs');
const { getOne, execute, query } = require('../db_unified');
const { verifyToken, generateToken, requireRole } = require('../middleware/auth');
const { sendErrorResponse } = require('../utils/errorHandler');
const router = express.Router();

router.post('/login', async (req, res) => {
  const startTime = Date.now();
  console.log('[AUTH/LOGIN] === 登录请求开始 ===');
  console.log('[AUTH/LOGIN] Request body:', JSON.stringify(req.body));
  console.log('[AUTH/LOGIN] Content-Type:', req.headers['content-type']);

  try {
    const { username, email, password } = req.body;

    // 输入验证
    validateRequired(['password'], req.body); // 密码必填
    
    if (!username && !email) {
      throw new AppError('用户名或邮箱至少填写一个', 400, 'INVALID_INPUT');
    }
    
    if (username) {
      validateString(username, '用户名', { min: 3, max: 20, pattern: /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/ });
      // XSS防护
      const sanitizedUsername = sanitizeString(username);
    }
    
    if (email) {
      validateEmail(email);
    }
    
    validateString(password, '密码', { min: 6, max: 128 });

    console.log('[AUTH/LOGIN] 解析参数 - username:', username, 'email:', email, 'hasPassword:', !!password);

    let user;
    if (username) {
      console.log('[AUTH/LOGIN] 查询用户 - username:', username);
      user = await getOne(
        'SELECT * FROM users WHERE username = ?',
        [username]
      );
    } else if (email) {
      console.log('[AUTH/LOGIN] 查询用户 - email:', email);
      user = await getOne(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );
    }

    console.log('[AUTH/LOGIN] 查询结果 - user found:', !!user);

    if (!user) {
      console.log('[AUTH/LOGIN] ❌ 用户不存在');
      throw new AppError('用户不存在', 401, 'USER_NOT_FOUND');
    }

    console.log('[AUTH/LOGIN] 用户信息 - id:', user.id, 'status:', user.status, 'role:', user.role);

    if (user.status === 'banned') {
      console.log('[AUTH/LOGIN] ❌ 账号已被禁用');
      throw new AppError('账号已被禁用', 403, 'ACCOUNT_BANNED');
    }

    if (user.status !== 'active') {
      console.log('[AUTH/LOGIN] ❌ 账号未激活 - status:', user.status);
      throw new AppError('账号未激活', 403, 'ACCOUNT_INACTIVE');
    }

    const passwordHash = user.password_hash || user.password;
    console.log('[AUTH/LOGIN] 密码哈希存在:', !!passwordHash);
    if (passwordHash) {
      console.log('[AUTH/LOGIN] 密码哈希前20位:', passwordHash.substring(0, 20));
    }

    if (!passwordHash) {
      console.log('[AUTH/LOGIN] ❌ 用户账号配置错误 - 无密码哈希');
      throw new AppError('用户账号配置错误', 500, 'SERVER_ERROR');
    }

    console.log('[AUTH/LOGIN] 开始验证密码...');
    const isMatch = await bcrypt.compare(password, passwordHash);
    console.log('[AUTH/LOGIN] 密码验证结果:', isMatch);

    if (!isMatch) {
      console.log('[AUTH/LOGIN] ❌ 密码错误');
      throw new AppError('密码错误', 401, 'INVALID_PASSWORD');
    }

    console.log('[AUTH/LOGIN] ✅ 密码正确! 生成JWT token...');
    const token = generateToken({
      userId: user.id,
      username: user.username,
      role: user.role
    });

    console.log('[AUTH/LOGIN] Token生成成功, 长度:', token.length);

    const responseData = {
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          avatar: user.avatar
        }
      }
    };

    const duration = Date.now() - startTime;
    console.log('[AUTH/LOGIN] ✅ 登录成功! 耗时:', duration, 'ms');
    console.log('[AUTH/LOGIN] === 登录请求结束 ===\n');

    return res.json(responseData);
  } catch (error) {
    return sendErrorResponse(res, error, 'AUTH/LOGIN');
  }
});

router.post('/register', async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    // 输入验证
    validateRequired(['username', 'email', 'password'], req.body);
    validateString(username, '用户名', { min: 3, max: 20, pattern: /^[a-zA-Z0-9_]+$/ });
    validateEmail(email);
    validateString(password, '密码', { min: 6, max: 128 });
    
    // 角色验证（如果提供）
    if (role) {
      validateEnum(role, ['admin', 'manager', 'user'], '角色');
    }

    const existingUser = await getOne(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUser) {
      throw new AppError('用户名或邮箱已存在', 409, 'CONFLICT');
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const result = await query(
      `INSERT INTO users (username, email, password, role, status, created_at)
       VALUES (?, ?, ?, 'user', 'active', NOW())`,
      [sanitizeString(username), email, passwordHash]
    );

    const newUser = await getOne(
      'SELECT * FROM users WHERE id = ?',
      [result.insertId]
    );

    const token = generateToken({
      userId: newUser.id,
      username: newUser.username,
      role: newUser.role
    });

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          role: newUser.role,
          avatar: newUser.avatar,
          status: newUser.status
        }
      }
    });
  } catch (error) {
    return sendErrorResponse(res, error, 'AUTH/REGISTER');
  }
});

router.get('/profile', verifyToken, async (req, res) => {
  try {
    // 验证用户ID
    const userId = validateId(req.user.userId, '用户ID');

    const user = await getOne(
      'SELECT id, username, email, avatar, role, status, phone, last_login, created_at, updated_at FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      throw new AppError('用户不存在', 404, 'NOT_FOUND');
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    return sendErrorResponse(res, error, 'AUTH/PROFILE');
  }
});

router.put('/profile', verifyToken, async (req, res) => {
  try {
    const { email, avatar, phone } = req.body;
    const allowedFields = ['email', 'avatar', 'phone'];
    const fields = [];
    const values = [];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        // 字段级别验证
        if (field === 'email') {
          validateEmail(email);
        }
        if (field === 'phone' && phone) {
          validatePhone(phone);
        }
        
        fields.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    }

    if (fields.length === 0) {
      throw new AppError('没有提供需要更新的字段。允许更新的字段: email, avatar, phone', 400, 'INVALID_INPUT');
    }

    if (email) {
      const existingEmail = await getOne(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, req.user.userId]
      );
      if (existingEmail) {
        throw new AppError('邮箱已被使用', 409, 'CONFLICT');
      }
    }

    values.push(req.user.userId);
    await execute(`UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`, values);

    const updatedUser = await getOne(
      'SELECT id, username, email, avatar, role, status, phone, last_login, created_at, updated_at FROM users WHERE id = ?',
      [req.user.userId]
    );

    res.json({
      success: true,
      data: updatedUser
    });
  } catch (error) {
    console.error('[AUTH/UPDATE_PROFILE] ❌ 更新用户信息失败:', error.message);
    return sendErrorResponse(res, error, 'Auth/UpdateProfile');
  }
});

module.exports = router;
