// [TIMEOUT] 建议: 为长时间运行的数据库操作添加超时设置
// [PERFORMANCE] 建议: 考虑使用批量查询替代循环内单条查询以提高性能
// [PERFORMANCE] Example: 使用 IN (?) 和批量参数代替循环

const { validateRequestBody } = require('../utils/validation');

const express = require('express');
const bcrypt = require('bcryptjs');
const { getOne, execute, query } = require('../db_mysql');
const { verifyToken, generateToken, requireRole } = require('../middleware/auth');
const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Password is required'
        }
      });
    }

    if (!username && !email) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Username or email is required'
        }
      });
    }

    let user;
    if (username) {
      user = await getOne(
        'SELECT * FROM users WHERE username = ?',
        [username]
      );
    } else if (email) {
      user = await getOne(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password'
        }
      });
    }

    if (user.status === 'banned') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_BANNED',
          message: 'Account has been banned'
        }
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_INACTIVE',
          message: 'Account is not active'
        }
      });
    }

    const passwordHash = user.password || user.password_hash;
    if (!passwordHash) {
      
      return res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'User account configuration error'
        }
      });
    }

    const isMatch = await bcrypt.compare(password, passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password'
        }
      });
    }

    const token = generateToken({
      userId: user.id,
      username: user.username,
      role: user.role
    });

    res.json({
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
    });
  } catch (error) {
    
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error'
      }
    });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Username, email and password are required'
        }
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PASSWORD',
          message: 'Password must be at least 6 characters'
        }
      });
    }

    const existingUser = await getOne(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'Username or email already exists'
        }
      });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const result = await query(
      `INSERT INTO users (username, email, password, role, status, created_at)
       VALUES (?, ?, ?, 'user', 'active', NOW())`,
      [username, email, passwordHash]
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
    
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error'
      }
    });
  }
});

router.get('/profile', verifyToken, async (req, res) => {
  try {
    const user = await getOne(
      'SELECT id, username, email, avatar, role, status, phone, last_login, created_at, updated_at FROM users WHERE id = ?',
      [req.user.userId]
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error'
      }
    });
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
        fields.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'No valid fields to update. Allowed fields: email, avatar, phone'
        }
      });
    }

    if (email) {
      const existingEmail = await getOne(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, req.user.userId]
      );
      if (existingEmail) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'Email already in use'
          }
        });
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
    
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error'
      }
    });
  }
});

module.exports = router;
