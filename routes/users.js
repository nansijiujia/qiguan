const express = require('express');
const bcrypt = require('bcryptjs');
const { query, getOne, execute } = require('../db');
const router = express.Router();

const SALT_ROUNDS = 10;

async function hashPassword(password) {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, role, status, keyword } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let whereSql = 'WHERE 1=1';

    if (role) {
      whereSql += ' AND role = ?';
      params.push(role);
    }
    if (status) {
      whereSql += ' AND status = ?';
      params.push(status);
    }
    if (keyword) {
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
      [...params, parseInt(limit), offset]
    );

    res.json({
      success: true,
      data: {
        list,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult.total
        }
      }
    });
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { username, email, password, avatar, role, status } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'Username, email and password are required' });
    }

    const existing = await getOne(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );
    if (existing) {
      return res.status(409).json({ success: false, message: 'Username or email already exists' });
    }

    const passwordHash = await hashPassword(password);
    const result = await execute(
      `INSERT INTO users (username, email, password_hash, avatar, role, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [username, email, passwordHash, avatar || null, role || 'user', status || 'active']
    );

    const newUser = await getOne(
      'SELECT id, username, email, avatar, role, status, created_at FROM users WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({ success: true, data: newUser });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, password, avatar, role, status } = req.body;

    const user = await getOne('SELECT id FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const fields = [];
    const values = [];

    if (username !== undefined) { fields.push('username = ?'); values.push(username); }
    if (email !== undefined) { fields.push('email = ?'); values.push(email); }
    if (password !== undefined) { fields.push('password_hash = ?'); values.push(await hashPassword(password)); }
    if (avatar !== undefined) { fields.push('avatar = ?'); values.push(avatar); }
    if (role !== undefined) { fields.push('role = ?'); values.push(role); }
    if (status !== undefined) { fields.push('status = ?'); values.push(status); }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    values.push(id);
    await execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);

    const updatedUser = await getOne(
      'SELECT id, username, email, avatar, role, status, last_login, created_at FROM users WHERE id = ?',
      [id]
    );

    res.json({ success: true, data: updatedUser });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const user = await getOne('SELECT id FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await execute('DELETE FROM users WHERE id = ?', [id]);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const user = await getOne('SELECT id FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await execute('UPDATE users SET status = ? WHERE id = ?', [status, id]);
    res.json({ success: true, message: 'User status updated successfully' });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
