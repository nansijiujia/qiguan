// [TIMEOUT] 建议: 为长时间运行的数据库操作添加超时设置
// [PERFORMANCE] 建议: 考虑使用批量查询替代循环内单条查询以提高性能
// [PERFORMANCE] Example: 使用 IN (?) 和批量参数代替循环

const {
  validateRequired,
  validateString,
  validateEmail,
  validateNumber,
  validateId,
  validateEnum,
  sanitizeString,
  AppError
} = require('../utils/validation');

const express = require('express');
const bcrypt = require('bcryptjs');
const { getOne, execute, query } = require('../db-unified');
const { verifyToken, generateToken, requireRole } = require('../middleware/auth');
const { sendErrorResponse } = require('../utils/error-handler');
const router = express.Router();

router.post('/login', async (req, res) => {
  const startTime = Date.now();
  const requestId = `LOGIN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  console.log(`\n[AUTH/LOGIN][${requestId}] === 登录请求开始 ===`);
  console.log(`[AUTH/LOGIN][${requestId}] Request body:`, JSON.stringify(req.body));
  console.log(`[AUTH/LOGIN][${requestId}] Content-Type:`, req.headers['content-type']);
  console.log(`[AUTH/LOGIN][${requestId}] Raw body preview:`, (req.rawBody || '').substring(0, 200));

  try {
    // 防御性检查：确保请求体存在
    if (!req.body || typeof req.body !== 'object') {
      console.error(`[AUTH/LOGIN][${requestId}] ❌ 无效的请求体:`, typeof req.body);
      throw new AppError('无效的请求数据', 400, 'INVALID_REQUEST_BODY');
    }

    const { username, email, password } = req.body;

    // 输入验证 - 更宽松的验证以提供更好的错误提示
    if (!password) {
      console.warn(`[AUTH/LOGIN][${requestId}] ⚠️ 缺少password字段. 可用字段:`, Object.keys(req.body));
      throw new AppError('密码不能为空', 400, 'MISSING_PASSWORD');
    }

    if (!username && !email) {
      throw new AppError('用户名或邮箱至少填写一个', 400, 'INVALID_INPUT');
    }

    if (username) {
      validateString(username, '用户名', { min: 3, max: 20, pattern: /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/ });
    }

    if (email) {
      validateEmail(email);
    }

    validateString(password, '密码', { min: 6, max: 128 });

    console.log(`[AUTH/LOGIN][${requestId}] ✅ 参数验证通过 - username: ${username || '(未提供)'}, email: ${email || '(未提供)'}`);

    let user;
    if (username) {
      console.log(`[AUTH/LOGIN][${requestId}] 📡 查询用户 - username:`, username);
      try {
        user = await getOne(
          'SELECT * FROM users WHERE username = ?',
          [username]
        );
      } catch (dbErr) {
        console.error(`[AUTH/LOGIN][${requestId}] ❌ 数据库查询失败:`, dbErr.message);
        throw new AppError('数据库查询失败，请稍后重试', 503, 'DB_QUERY_ERROR');
      }
    } else if (email) {
      console.log(`[AUTH/LOGIN][${requestId}] 📡 查询用户 - email:`, email);
      try {
        user = await getOne(
          'SELECT * FROM users WHERE email = ?',
          [email]
        );
      } catch (dbErr) {
        console.error(`[AUTH/LOGIN][${requestId}] ❌ 数据库查询失败:`, dbErr.message);
        throw new AppError('数据库查询失败，请稍后重试', 503, 'DB_QUERY_ERROR');
      }
    }

    console.log(`[AUTH/LOGIN][${requestId}] 📊 查询结果 - user found:`, !!user);

    if (!user) {
      console.log(`[AUTH/LOGIN][${requestId}] ❌ 用户不存在`);
      throw new AppError('用户名或密码错误', 401, 'INVALID_CREDENTIALS');
    }

    console.log(`[AUTH/LOGIN][${requestId}] 👤 用户信息 - id: ${user.id}, status: ${user.status}, role: ${user.role}`);
    console.log(`[AUTH/LOGIN][${requestId}] 🔑 用户字段列表:`, Object.keys(user));

    if (user.status === 'banned') {
      console.log(`[AUTH/LOGIN][${requestId}] ❌ 账号已被禁用`);
      throw new AppError('账号已被禁用', 403, 'ACCOUNT_BANNED');
    }

    if (user.status !== 'active') {
      console.log(`[AUTH/LOGIN][${requestId}] ❌ 账号未激活 - status:`, user.status);
      throw new AppError('账号未激活', 403, 'ACCOUNT_INACTIVE');
    }

    // 获取密码哈希 - 兼容多种字段名
    const passwordHash = user.password || user.password_hash || user.pwd;
    console.log(`[AUTH/LOGIN][${requestId}] 🔐 密码哈希字段:`, passwordHash ? (user.password ? 'password' : (user.password_hash ? 'password_hash' : 'pwd')) : '❌ 未找到');
    console.log(`[AUTH/LOGIN][${requestId}] 🔐 密码哈希存在:`, !!passwordHash);
    if (passwordHash) {
      console.log(`[AUTH/LOGIN][${requestId}] 🔐 密码哈希前缀(20字符):`, passwordHash.substring(0, 20));
      console.log(`[AUTH/LOGIN][${requestId}] 🔐 密码哈希总长度:`, passwordHash.length);
      console.log(`[AUTH/LOGIN][${requestId}] 🔐 密码哈希类型判断:`,
        passwordHash.startsWith('$2a$') || passwordHash.startsWith('$2b$') ? 'bcrypt' :
        (passwordHash.length === 32 && /^[a-f0-9]{32}$/i.test(passwordHash) ? 'MD5' : '其他/明文')
      );
    }

    if (!passwordHash) {
      console.error(`[AUTH/LOGIN][${requestId}] 🔴 CRITICAL: 用户账号配置错误 - 无密码字段! 用户ID: ${user.id}`);
      throw new AppError('用户账号配置错误，请联系管理员', 500, 'SERVER_ERROR');
    }

    console.log(`[AUTH/LOGIN][${requestId}] 🔓 开始验证密码...`);

    let isMatch = false;
    try {
      isMatch = await bcrypt.compare(password, passwordHash);
      console.log(`[AUTH/LOGIN][${requestId}] ✅ 密码验证完成 - 结果:`, isMatch);
    } catch (bcryptErr) {
      console.error(`[AUTH/LOGIN][${requestId}] ❌ bcrypt.compare异常:`, bcryptErr.message);

      // 如果bcrypt失败，尝试其他验证方式（兼容性处理）
      if (passwordHash.length === 32 && /^[a-f0-9]{32}$/i.test(passwordHash)) {
        console.log(`[AUTH/LOGIN][${requestId}] 🔄 尝试MD5验证...`);
        const crypto = require('crypto');
        const md5Hash = crypto.createHash('md5').update(password).digest('hex');
        isMatch = (md5Hash === passwordHash);
        console.log(`[AUTH/LOGIN][${requestId}] MD5验证结果:`, isMatch);
      } else if (password === passwordHash) {
        console.log(`[AUTH/LOGIN][${requestId}] 🔄 使用明文比较...`);
        isMatch = true;
      }

      if (!isMatch) {
        throw new AppError('密码验证失败', 500, 'PASSWORD_VERIFY_ERROR');
      }
    }

    if (!isMatch) {
      console.log(`[AUTH/LOGIN][${requestId}] ❌ 密码错误`);
      throw new AppError('用户名或密码错误', 401, 'INVALID_CREDENTIALS');
    }

    console.log(`[AUTH/LOGIN][${requestId}] 🎉 密码正确! 生成JWT token...`);

    let token;
    try {
      token = generateToken({
        userId: user.id,
        username: user.username,
        role: user.role
      });
      console.log(`[AUTH/LOGIN][${requestId}] ✅ Token生成成功 - 长度: ${token.length}`);
    } catch (tokenErr) {
      console.error(`[AUTH/LOGIN][${requestId}] ❌ Token生成失败:`, tokenErr.message);
      throw new AppError('登录令牌生成失败', 500, 'TOKEN_GENERATION_ERROR');
    }

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
    console.log(`[AUTH/LOGIN][${requestId}] 🎉🎉🎉 登录成功! 耗时: ${duration}ms`);
    console.log(`[AUTH/LOGIN][${requestId}] === 登录请求结束 ===\n`);

    return res.json(responseData);
  } catch (error) {
    console.error(`[AUTH/LOGIN][${requestId}] 💥 登录失败:`, {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      timestamp: new Date().toISOString()
    });
    return sendErrorResponse(res, error, `AUTH/LOGIN[${requestId}]`);
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
