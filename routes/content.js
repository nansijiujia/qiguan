// [TIMEOUT] 建议: 为长时间运行的数据库操作添加超时设置
// [PERFORMANCE] 建议: 考虑使用批量查询替代循环内单条查询以提高性能
// [PERFORMANCE] Example: 使用 IN (?) 和批量参数代替循环

// 公共错误处理函数
function sendErrorResponse(res, statusCode, errorCode, message, error = null) {
  if (error) {
    console.error(`[Content] ${message}:`, error.message, error.stack);
  }
  return res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: message
    }
  });
}


const express = require('express');
const path = require('path');
const fs = require('fs');
const { query, getOne, execute } = require('../db_mysql');
const { verifyToken, requireRole } = require('../middleware/auth');
const { validateRequestBody } = require('../utils/validation');
const router = express.Router();

// 权限验证中间件
function checkContentPermission(req, res, next) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: '需要登录才能访问此接口'
      }
    });
  }
  
  // 检查用户角色是否具有内容管理权限
  if (user.role !== 'admin' && user.role !== 'manager') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: '权限不足，无法执行此操作'
      }
    });
  }
  
  next();
}

let multer;
try {
  multer = require('multer');
} catch (e) {
  
}

const uploadDir = path.join(__dirname, '../uploads/banners');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

let upload;
if (multer) {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, 'banner-' + uniqueSuffix + ext);
    }
  });

  upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('只支持 JPG/PNG/GIF 格式的图片'));
      }
    }
  });
}

// ============================================================
// Banner管理API
// ============================================================

// 1. GET /api/v1/content/banners - 获取Banner列表
router.get('/banners', async (req, res) => {
  // 处理逻辑...
});

// 1.1 GET /api/v1/content/homepage/banners - 兼容小程序调用路径
router.get('/homepage/banners', async (req, res) => {
  try {
    const { status: statusFilter } = req.query;
    let whereSql = '';
    let params = [];

    if (statusFilter === 'active' || statusFilter === 'inactive') {
      whereSql = 'WHERE status = ?';
      params.push(statusFilter);
    }

    const sql = `SELECT * FROM banners ${whereSql} ORDER BY position ASC, id ASC`;
    const banners = await query(sql, params);

    res.json({
      success: true,
      data: banners
    });
  } catch (error) {
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取Banner列表失败'
      }
    });
  }
});

// 2. POST /api/v1/content/banners - 新建Banner
router.post('/banners', verifyToken, checkContentPermission, async (req, res) => {
  try {
    const { title, image_url, link_url, link_type, position, start_time, end_time } = req.body;

    if (!image_url) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '图片URL不能为空'
        }
      });
    }

    let finalPosition = position;
    if (finalPosition === undefined || finalPosition === null) {
      const maxPosResult = await getOne('SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM banners', []);
      finalPosition = maxPosResult ? maxPosResult.next_pos : 0;
    }

    const validLinkTypes = ['product', 'category', 'url', 'none'];
    const finalLinkType = validLinkTypes.includes(link_type) ? link_type : 'none';

    const sql = `INSERT INTO banners (title, image_url, link_url, link_type, position, start_time, end_time, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`;
    const result = await execute(sql, [
      title || '',
      image_url,
      link_url || null,
      finalLinkType,
      finalPosition,
      start_time || null,
      end_time || null
    ]);

    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        title,
        image_url,
        link_url,
        link_type: finalLinkType,
        position: finalPosition,
        start_time,
        end_time,
        status: 'active'
      }
    });
  } catch (error) {
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '创建Banner失败'
      }
    });
  }
});

// 3. PUT /api/v1/content/banners/:id - 更新Banner
router.put('/banners/:id', verifyToken, checkContentPermission, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, image_url, link_url, link_type, position, status, start_time, end_time } = req.body;

    const fields = [];
    const params = [];

    if (title !== undefined) {
      fields.push('title = ?');
      params.push(title);
    }
    if (image_url !== undefined) {
      fields.push('image_url = ?');
      params.push(image_url);
    }
    if (link_url !== undefined) {
      fields.push('link_url = ?');
      params.push(link_url);
    }
    if (link_type !== undefined) {
      const validLinkTypes = ['product', 'category', 'url', 'none'];
      if (validLinkTypes.includes(link_type)) {
        fields.push('link_type = ?');
        params.push(link_type);
      }
    }
    if (position !== undefined) {
      fields.push('position = ?');
      params.push(position);
    }
    if (status !== undefined && (status === 'active' || status === 'inactive')) {
      fields.push('status = ?');
      params.push(status);
    }
    if (start_time !== undefined) {
      fields.push('start_time = ?');
      params.push(start_time || null);
    }
    if (end_time !== undefined) {
      fields.push('end_time = ?');
      params.push(end_time || null);
    }

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '没有提供需要更新的字段'
        }
      });
    }

    params.push(id);
    const sql = `UPDATE banners SET ${fields.join(', ')} WHERE id = ?`;
    const result = await execute(sql, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Banner不存在'
        }
      });
    }

    res.json({
      success: true,
      message: 'Banner更新成功',
      data: { id }
    });
  } catch (error) {
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '更新Banner失败'
      }
    });
  }
});

// 4. DELETE /api/v1/content/banners/:id - 删除Banner
router.delete('/banners/:id', verifyToken, checkContentPermission, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await execute('DELETE FROM banners WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Banner不存在'
        }
      });
    }

    res.json({ success: true, message: 'Banner删除成功' });
  } catch (error) {
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '删除Banner失败'
      }
    });
  }
});

// 5. PUT /api/v1/content/banners/reorder - 调整Banner顺序
router.put('/banners/reorder', verifyToken, checkContentPermission, async (req, res) => {
  try {
    const { orders } = req.body;

    if (!Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '请提供有效的排序数据'
        }
      });
    }

    for (const item of orders) {
      if (item.id === undefined || item.position === undefined) {
        continue;
      }
      await execute('UPDATE banners SET position = ? WHERE id = ?', [item.position, item.id]);
    }

    res.json({ success: true, message: '排序更新成功' });
  } catch (error) {
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '调整排序失败'
      }
    });
  }
});

// ============================================================
// 首页配置API
// ============================================================

// 6. GET /api/v1/content/homepage/config - 获取所有首页配置
router.get('/homepage/config', async (req, res) => {
  try {
    const configs = await query('SELECT config_key, config_value, description FROM homepage_config');

    const configObj = {};
    configs.forEach(item => {
      configObj[item.config_key] = {
        value: item.config_value,
        description: item.description
      };
    });

    res.json({
      success: true,
      data: configObj
    });
  } catch (error) {
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取首页配置失败'
      }
    });
  }
});

// 7. PUT /api/v1/content/homepage/config - 批量更新配置
router.put('/homepage/config', async (req, res) => {
  try {
    const updates = req.body;

    if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '请提供需要更新的配置项'
        }
      });
    }

    for (const [key, value] of Object.entries(updates)) {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      const existing = await getOne('SELECT id FROM homepage_config WHERE config_key = ?', [key]);

      if (existing) {
        await execute(
          'UPDATE homepage_config SET config_value = ? WHERE config_key = ?',
          [stringValue, key]
        );
      } else {
        await execute(
          'INSERT INTO homepage_config (config_key, config_value, description) VALUES (?, ?, ?)',
          [key, stringValue, '']
        );
      }
    }

    res.json({ success: true, message: '配置更新成功' });
  } catch (error) {
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '更新首页配置失败'
      }
    });
  }
});

// 8. GET /api/v1/content/homepage/preview - 预览首页配置效果
router.get('/homepage/preview', async (req, res) => {
  try {
    const banners = await query('SELECT * FROM banners WHERE status = ? ORDER BY position ASC', ['active']);
    const configs = await query('SELECT config_key, config_value FROM homepage_config');

    const configObj = {};
    configs.forEach(item => {
      configObj[item.config_key] = item.config_value;
    });

    let recommendedProducts = [];
    let hotProducts = [];

    try {
      const recommendedIds = JSON.parse(configObj.recommended_products || '[]');
      if (recommendedIds.length > 0 && Array.isArray(recommendedIds)) {
        const validRecommendedIds = recommendedIds.filter(id => typeof id === 'number' || (typeof id === 'string' && /^\d+$/.test(id)));
        if (validRecommendedIds.length > 0) {
          const placeholders = validRecommendedIds.map(() => '?').join(',');
          recommendedProducts = await query(
            `SELECT id, name, price, image, stock FROM products WHERE id IN (${placeholders}) AND status = ?`,
            [...validRecommendedIds.map(id => Number(id)), 'active']
          );
        }
      }
    } catch (e) {
      console.error('解析推荐商品配置失败:', e.message);
    }

    try {
      const hotIds = JSON.parse(configObj.hot_products || '[]');
      if (hotIds.length > 0 && Array.isArray(hotIds)) {
        const validHotIds = hotIds.filter(id => typeof id === 'number' || (typeof id === 'string' && /^\d+$/.test(id)));
        if (validHotIds.length > 0) {
          const placeholders = validHotIds.map(() => '?').join(',');
          hotProducts = await query(
            `SELECT id, name, price, image, stock FROM products WHERE id IN (${placeholders}) AND status = ?`,
            [...validHotIds.map(id => Number(id)), 'active']
          );
        }
      }
    } catch (e) {
      console.error('解析热门商品配置失败:', e.message);
    }

    res.json({
      success: true,
      data: {
        banners: banners.map(b => ({
          id: b.id,
          title: b.title,
          image_url: b.image_url,
          link_url: b.link_url,
          link_type: b.link_type
        })),
        config: configObj,
        recommended_products: recommendedProducts,
        hot_products: hotProducts,
        announcement: configObj.announcement || ''
      }
    });
  } catch (error) {
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取预览数据失败'
      }
    });
  }
});

// ============================================================
// 文件上传支持
// ============================================================

// 9. POST /api/v1/content/upload - 上传图片
if (upload) {
  router.post('/upload', verifyToken, checkContentPermission, upload.single('file'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NO_FILE',
            message: '请选择要上传的图片'
          }
        });
      }

      const fileUrl = `/uploads/banners/${req.file.filename}`;

      res.json({
        success: true,
        data: {
          url: fileUrl,
          filename: req.file.filename,
          originalname: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype
        }
      });
    } catch (error) {
      console.error('[Content] 文件上传失败:', error.message, error.stack);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'UPLOAD_ERROR',
          message: '文件上传失败'
        }
      });
    }
  });
} else {
  router.post('/upload', (req, res) => {
    res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: '文件上传服务不可用（未安装multer）'
      }
    });
  });
}

// 静态文件服务
router.use('/uploads', express.static(path.join(__dirname, '../uploads')));

module.exports = router;
