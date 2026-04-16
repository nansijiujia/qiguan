const express = require('express');
const router = express.Router();
const { validateRequestBody } = require('../utils/validation');
const { sendErrorResponse } = require('../utils/error-handler');
const { DOMAIN_CONFIG } = require('../config/domain');

// 模拟系统设置数据
let systemSettings = {
  systemName: '绮管后台管理系统',
  systemVersion: '1.0.0',
  apiUrl: `${DOMAIN_CONFIG.protocol}://${DOMAIN_CONFIG.api}/api`,
  uploadLimit: 10,
  cacheTime: 60,
  smtpServer: 'smtp.qq.com',
  smtpPort: 465,
  smtpUsername: '',
  smtpPassword: ''
};

// 模拟安全设置数据
let securitySettings = {
  passwordMinLength: 8,
  passwordComplexity: 'medium',
  passwordExpiryDays: 90,
  loginFailLimit: 5,
  loginLockMinutes: 30,
  sessionTimeoutMinutes: 60,
  ipWhitelist: '',
  httpsEnabled: true,
  csrfProtection: true
};

// 模拟日志数据
const generateMockLogs = (type, count = 50) => {
  const logs = [];
  const actions = type === 'operation' ? 
    ['登录', '退出', '添加商品', '编辑商品', '删除商品', '添加分类', '编辑分类', '删除分类', '处理订单', '查看报表'] :
    ['数据库连接失败', 'API请求超时', '权限验证失败', '参数验证错误', '服务器内部错误'];
  
  const users = ['admin', 'user1', 'user2', 'user3', 'user4'];
  const ips = ['192.168.1.1', '192.168.1.2', '192.168.1.3', '10.0.0.1', '10.0.0.2'];
  
  for (let i = 0; i < count; i++) {
    const action = actions[Math.floor(Math.random() * actions.length)];
    const user = users[Math.floor(Math.random() * users.length)];
    const ip = ips[Math.floor(Math.random() * ips.length)];
    const date = new Date();
    date.setMinutes(date.getMinutes() - Math.floor(Math.random() * 1440)); // 随机时间，最多24小时
    
    logs.push({
      id: i + 1,
      user,
      action,
      description: `${user}执行了${action}操作`,
      ip,
      createdAt: date.toISOString()
    });
  }
  
  return logs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

let operationLogs = generateMockLogs('operation');
let errorLogs = generateMockLogs('error');

// GET /api/v1/system/settings - 获取系统设置
router.get('/settings', async (req, res) => {
  try {
    res.json({ success: true, data: systemSettings });
  } catch (error) {
    console.error('[System/Settings] ❌ 获取系统设置失败:', error.message);
    return sendErrorResponse(res, error, 'System/Settings');
  }
});

// PUT /api/v1/system/settings - 更新系统设置
router.put('/settings', validateRequestBody, async (req, res) => {
  try {
    systemSettings = { ...systemSettings, ...req.body };
    res.json({ success: true, message: '系统设置更新成功' });
  } catch (error) {
    console.error('[System/Settings] ❌ 更新系统设置失败:', error.message);
    return sendErrorResponse(res, error, 'System/Settings');
  }
});

// GET /api/v1/system/security - 获取安全设置
router.get('/security', async (req, res) => {
  try {
    res.json({ success: true, data: securitySettings });
  } catch (error) {
    console.error('[System/Security] ❌ 获取安全设置失败:', error.message);
    return sendErrorResponse(res, error, 'System/Security');
  }
});

// PUT /api/v1/system/security - 更新安全设置
router.put('/security', validateRequestBody, async (req, res) => {
  try {
    securitySettings = { ...securitySettings, ...req.body };
    res.json({ success: true, message: '安全设置更新成功' });
  } catch (error) {
    console.error('[System/Security] ❌ 更新安全设置失败:', error.message);
    return sendErrorResponse(res, error, 'System/Security');
  }
});

// GET /api/v1/system/logs - 获取日志
router.get('/logs', async (req, res) => {
  try {
    const { type = 'operation', keyword = '', startDate = '', endDate = '', page = 1, pageSize = 10 } = req.query;
    
    let logs = type === 'operation' ? operationLogs : errorLogs;
    
    // 过滤日志
    if (keyword) {
      logs = logs.filter(log => 
        log.user.includes(keyword) || 
        log.action.includes(keyword) || 
        log.description.includes(keyword) ||
        log.ip.includes(keyword)
      );
    }
    
    if (startDate) {
      logs = logs.filter(log => new Date(log.createdAt) >= new Date(startDate));
    }
    
    if (endDate) {
      logs = logs.filter(log => new Date(log.createdAt) <= new Date(endDate));
    }
    
    // 分页
    const total = logs.length;
    const start = (page - 1) * pageSize;
    const end = start + parseInt(pageSize);
    const paginatedLogs = logs.slice(start, end);
    
    res.json({
      success: true,
      data: {
        list: paginatedLogs,
        total
      }
    });
  } catch (error) {
    console.error('[System/Logs] ❌ 获取日志失败:', error.message);
    return sendErrorResponse(res, error, 'System/Logs');
  }
});

module.exports = router;