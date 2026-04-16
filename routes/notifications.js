const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { query, getOne, execute } = require('../db-unified');
const { 
  validateRequired, 
  validateString, 
  validateNumber,
  validateId,
  validateEnum,
  validatePagination,
  sanitizeString,
  AppError 
} = require('../utils/validation');
const { sendErrorResponse } = require('../utils/error-handler');

const VALID_TYPES = ['order', 'system', 'security', 'action'];
const VALID_STATUSES = ['unread', 'read', 'archived'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, type, status, keyword } = req.query;
    const userId = req.user?.id;
    
    const { page: pageNum, limit: limitNum, offset } = validatePagination(req);
    
    if (type) {
      validateEnum(type, VALID_TYPES, '通知类型');
    }
    if (status) {
      validateEnum(status, VALID_STATUSES, '通知状态');
    }

    const params = [userId];
    let whereSql = 'WHERE user_id = ?';

    if (type) {
      whereSql += ' AND type = ?';
      params.push(type);
    }

    if (status) {
      whereSql += ' AND status = ?';
      params.push(status);
    }

    if (keyword && keyword.trim()) {
      whereSql += ' AND (title LIKE ? OR content LIKE ?)';
      const kw = `%${sanitizeString(keyword.trim())}%`;
      params.push(kw, kw);
    }

    const countResult = await getOne(
      `SELECT COUNT(*) AS total FROM notifications ${whereSql}`,
      params
    );

    const notifications = await query(
      `SELECT * FROM notifications ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    res.json({
      success: true,
      data: {
        list: notifications,
        total: countResult.total || 0,
        page: pageNum
      }
    });
  } catch (error) {
    console.error('[Notifications/List] ❌ 获取通知列表失败:', error.message);
    return sendErrorResponse(res, error, 'Notifications/List');
  }
});

router.get('/unread-count', async (req, res) => {
  try {
    const userId = req.user?.id;

    const result = await getOne(
      'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND status = \'unread\'',
      [userId]
    );

    res.json({
      success: true,
      data: {
        count: result.count || 0
      }
    });
  } catch (error) {
    console.error('[Notifications/UnreadCount] ❌ 获取未读数量失败:', error.message);
    return sendErrorResponse(res, error, 'Notifications/UnreadCount');
  }
});

router.put('/:id/read', async (req, res) => {
  try {
    const notificationId = req.params.id;
    const userId = req.user?.id;

    validateId(notificationId, '通知ID');

    const notification = await getOne(
      'SELECT * FROM notifications WHERE id = ? AND user_id = ?',
      [notificationId, userId]
    );

    if (!notification) {
      throw new AppError('通知不存在或无权访问', 404, 'NOT_FOUND');
    }

    if (notification.status === 'read') {
      return res.json({
        success: true,
        message: '该通知已标记为已读'
      });
    }

    await execute(
      'UPDATE notifications SET status = \'read\', read_at = NOW() WHERE id = ?',
      [notificationId]
    );

    console.log(`[Notifications/Read] ✅ 通知已标记已读: ID=${notificationId}, User=${userId}`);

    res.json({
      success: true,
      message: '通知已标记为已读'
    });
  } catch (error) {
    console.error('[Notifications/Read] ❌ 标记已读失败:', error.message);
    return sendErrorResponse(res, error, 'Notifications/Read');
  }
});

router.put('/read-all', async (req, res) => {
  try {
    const userId = req.user?.id;

    const result = await execute(
      'UPDATE notifications SET status = \'read\', read_at = NOW() WHERE user_id = ? AND status = \'unread\'',
      [userId]
    );

    const affectedRows = result.affectedRows || 0;

    console.log(`[Notifications/ReadAll] ✅ 批量标记已读: User=${userId}, Count=${affectedRows}`);

    res.json({
      success: true,
      message: `成功标记${affectedRows}条通知为已读`,
      data: {
        count: affectedRows
      }
    });
  } catch (error) {
    console.error('[Notifications/ReadAll] ❌ 批量标记已读失败:', error.message);
    return sendErrorResponse(res, error, 'Notifications/ReadAll');
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const notificationId = req.params.id;
    const userId = req.user?.id;

    validateId(notificationId, '通知ID');

    const notification = await getOne(
      'SELECT * FROM notifications WHERE id = ? AND user_id = ?',
      [notificationId, userId]
    );

    if (!notification) {
      throw new AppError('通知不存在或无权删除', 404, 'NOT_FOUND');
    }

    await execute('DELETE FROM notifications WHERE id = ?', [notificationId]);

    console.log(`[Notifications/Delete] ✅ 通知已删除: ID=${notificationId}, User=${userId}`);

    res.json({
      success: true,
      message: '通知删除成功'
    });
  } catch (error) {
    console.error('[Notifications/Delete] ❌ 删除通知失败:', error.message);
    return sendErrorResponse(res, error, 'Notifications/Delete');
  }
});

router.post('/', async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      throw new AppError('权限不足，仅管理员可创建通知', 403, 'FORBIDDEN');
    }

    const { title, content, type = 'system', priority = 'medium', user_id: targetUserId } = req.body;

    validateRequired(['title', 'content'], req.body);
    validateString(title, '标题', { min: 1, max: 100 });
    validateString(content, '内容', { min: 1, max: 2000 });
    validateEnum(type, VALID_TYPES, '通知类型');
    validateEnum(priority, VALID_PRIORITIES, '优先级');

    const notificationId = uuidv4();

    await execute(
      `INSERT INTO notifications (id, user_id, type, title, content, status, priority, created_at)
       VALUES (?, ?, ?, ?, ?, 'unread', ?, NOW())`,
      [
        notificationId,
        targetUserId || null,
        type,
        sanitizeString(title),
        sanitizeString(content),
        priority
      ]
    );

    console.log(`[Notifications/Create] ✅ 通知创建成功: ID=${notificationId}, Type=${type}, TargetUser=${targetUserId || 'ALL'}`);

    res.status(201).json({
      success: true,
      message: '通知创建成功',
      data: {
        id: notificationId
      }
    });
  } catch (error) {
    console.error('[Notifications/Create] ❌ 创建通知失败:', error.message);
    return sendErrorResponse(res, error, 'Notifications/Create');
  }
});

module.exports = router;
