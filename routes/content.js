// [TIMEOUT] 建议: 为长时间运行的数据库操作添加超时设置
// [PERFORMANCE] 建议: 考虑使用批量查询替代循环内单条查询以提高性能
// [PERFORMANCE] Example: 使用 IN (?) 和批量参数代替循环

const { 
  validateRequired, 
  validateString, 
  validateNumber, 
  validateId,
  validateEnum,
  validateArray,
  validateUrl,
  sanitizeString,
  AppError 
} = require('../utils/validation');


const express = require('express');
const path = require('path');
const fs = require('fs');
const { query, getOne, execute } = require('../db-unified');
const { verifyToken, requireRole } = require('../middleware/auth');
const { sendErrorResponse } = require('../utils/error-handler');
const router = express.Router();

// 权限验证中间件
function checkContentPermission(req, res, next) {
  const user = req.user;
  if (!user) {
    return sendErrorResponse(res, 401, 'UNAUTHORIZED', '需要登录才能访问此接口');
  }
  
  // 检查用户角色是否具有内容管理权限
  if (user.role !== 'admin' && user.role !== 'manager') {
    return sendErrorResponse(res, 403, 'FORBIDDEN', '权限不足，无法执行此操作');
  }
  
  next();
}

let multer;
try {
  multer = require('multer');
} catch (e) {
  console.warn('[Content] ⚠️ multer未安装，文件上传功能不可用:', e.message);
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
  try {
    const { status: statusFilter } = req.query;
    let whereSql = '';
    let params = [];

    // 验证状态参数（如果提供）
    if (statusFilter === 'active' || statusFilter === 'inactive') {
      whereSql = 'WHERE status = ?';
      params.push(statusFilter);
    }

    const sql = `SELECT * FROM banners ${whereSql} ORDER BY id ASC`;
    const banners = await query(sql, params);

    res.json({
      success: true,
      data: banners
    });
  } catch (error) {
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', '获取Banner列表失败', error);
  }
});

// 1.1 GET /api/v1/content/homepage/banners - 兼容小程序调用路径
router.get('/homepage/banners', async (req, res) => {
  try {
    const { status: statusFilter } = req.query;
    let whereSql = '';
    let params = [];

    // 验证状态参数（如果提供）
    if (statusFilter === 'active' || statusFilter === 'inactive') {
      whereSql = 'WHERE status = ?';
      params.push(statusFilter);
    }

    const sql = `SELECT * FROM banners ${whereSql} ORDER BY id ASC`;
    const banners = await query(sql, params);

    res.json({
      success: true,
      data: banners
    });
  } catch (error) {
    console.error('[Content/HomepageBanners] ❌ 获取Banner列表失败:', error.message);
    return sendErrorResponse(res, error, 'Content/HomepageBanners');
  }
});

// 2. POST /api/v1/content/banners - 新建Banner
router.post('/banners', verifyToken, checkContentPermission, async (req, res) => {
  try {
    const { title, image_url, link_url, link_type, position, start_time, end_time } = req.body;

    // 输入验证
    validateRequired(['image_url'], req.body);
    
    // 验证图片URL
    if (image_url) {
      validateString(image_url, '图片URL', { min: 5, max: 500 });
    }
    
    // 验证标题（如果提供）
    if (title) {
      validateString(title, '标题', { max: 100, required: false });
    }
    
    // 验证链接URL（如果提供）
    if (link_url) {
      validateUrl(link_url);
    }
    
    // 验证链接类型（如果提供）
    if (link_type) {
      const validLinkTypes = ['product', 'category', 'url', 'none'];
      validateEnum(link_type, validLinkTypes, '链接类型');
    }
    
    // 验证位置（如果提供）
    if (position !== undefined) {
      validateNumber(position, '排序位置', { min: 0, integer: true });
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
      title ? sanitizeString(title) : '',
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
    console.error('[Content/CreateBanner] ❌ 创建Banner失败:', error.message);
    return sendErrorResponse(res, error, 'Content/CreateBanner');
  }
});

// 3. PUT /api/v1/content/banners/:id - 更新Banner
router.put('/banners/:id', verifyToken, checkContentPermission, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, image_url, link_url, link_type, position, status, start_time, end_time } = req.body;

    // 验证ID
    const bannerId = validateId(id, 'Banner ID');

    const fields = [];
    const params = [];

    // 字段级别验证
    if (title !== undefined) {
      validateString(title, '标题', { max: 100 });
      fields.push('title = ?');
      params.push(sanitizeString(title));
    }
    if (image_url !== undefined) {
      validateString(image_url, '图片URL', { min: 5, max: 500 });
      fields.push('image_url = ?');
      params.push(image_url);
    }
    if (link_url !== undefined) {
      if (link_url) {
        validateUrl(link_url);
      }
      fields.push('link_url = ?');
      params.push(link_url);
    }
    if (link_type !== undefined) {
      const validLinkTypes = ['product', 'category', 'url', 'none'];
      if (validLinkTypes.includes(link_type)) {
        fields.push('link_type = ?');
        params.push(link_type);
      } else {
        throw new AppError('链接类型必须是以下值之一: product, category, url, none', 400, 'INVALID_ENUM');
      }
    }
    if (position !== undefined) {
      validateNumber(position, '排序位置', { min: 0, integer: true });
      fields.push('position = ?');
      params.push(position);
    }
    if (status !== undefined) {
      const validStatuses = ['active', 'inactive'];
      validateEnum(status, validStatuses, '状态');
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
      throw new AppError('没有提供需要更新的字段', 400, 'VALIDATION_ERROR');
    }

    params.push(bannerId);
    const sql = `UPDATE banners SET ${fields.join(', ')} WHERE id = ?`;
    const result = await execute(sql, params);

    if (result.affectedRows === 0) {
      throw new AppError('Banner不存在', 404, 'NOT_FOUND');
    }

    res.json({
      success: true,
      message: 'Banner更新成功',
      data: { id: bannerId }
    });
  } catch (error) {
    console.error('[Content/UpdateBanner] ❌ 更新Banner失败:', error.message);
    return sendErrorResponse(res, error, 'Content/UpdateBanner');
  }
});

// 4. DELETE /api/v1/content/banners/:id - 删除Banner
router.delete('/banners/:id', verifyToken, checkContentPermission, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 验证ID
    const bannerId = validateId(id, 'Banner ID');

    const result = await execute('DELETE FROM banners WHERE id = ?', [bannerId]);

    if (result.affectedRows === 0) {
      throw new AppError('Banner不存在', 404, 'NOT_FOUND');
    }

    res.json({ success: true, message: 'Banner删除成功' });
  } catch (error) {
    console.error('[Content/DeleteBanner] ❌ 删除Banner失败:', error.message);
    return sendErrorResponse(res, error, 'Content/DeleteBanner');
  }
});

// 5. PUT /api/v1/content/banners/reorder - 调整Banner顺序
router.put('/banners/reorder', verifyToken, checkContentPermission, async (req, res) => {
  try {
    const { orders } = req.body;

    // 验证订单数组
    validateArray(orders, '排序数据', { required: true, minLength: 1 });

    for (let i = 0; i < orders.length; i++) {
      const item = orders[i];
      
      if (item.id === undefined || item.position === undefined) {
        continue;
      }
      
      // 验证每项的ID和位置
      validateId(item.id, `排序项${i + 1}的ID`);
      validateNumber(item.position, `排序项${i + 1}的位置`, { min: 0, integer: true });
      
      await execute('UPDATE banners SET position = ? WHERE id = ?', [item.position, item.id]);
    }

    res.json({ success: true, message: '排序更新成功' });
  } catch (error) {
    console.error('[Content/ReorderBanners] ❌ 调整排序失败:', error.message);
    return sendErrorResponse(res, error, 'Content/ReorderBanners');
  }
});

// ============================================================
// 首页配置API
// ============================================================

// 6. GET /api/v1/content/homepage/config - 获取所有首页配置
router.get('/homepage/config', async (req, res) => {
  try {
    console.log('[Content/GetHomepageConfig] 📋 开始获取首页配置...');

    let configs;
    let hasDescriptionField = true;

    try {
      configs = await query('SELECT config_key, config_value, description FROM homepage_config');
      console.log('[Content/GetHomepageConfig] ✅ 使用完整字段查询成功（含description）');
    } catch (e) {
      hasDescriptionField = false;
      console.warn('[Content/GetHomepageConfig] ⚠️ description字段不存在，使用基本查询:', e.message);
      try {
        configs = await query('SELECT config_key, config_value FROM homepage_config');
        console.log('[Content/GetHomepageConfig] ✅ 使用基本字段查询成功');
      } catch (innerError) {
        console.error('[Content/GetHomepageConfig] ❌ 基本查询也失败:', innerError.message);
        throw innerError;
      }
    }

    const configObj = {};
    if (configs && Array.isArray(configs)) {
      configs.forEach(item => {
        if (item && item.config_key !== undefined) {
          configObj[item.config_key] = {
            value: item.config_value,
            description: hasDescriptionField ? (item.description || '') : ''
          };
        }
      });
    }

    console.log(`[Content/GetHomepageConfig] 📊 成功加载 ${Object.keys(configObj).length} 个配置项`);

    res.json({
      success: true,
      data: configObj
    });
  } catch (error) {
    console.error('[Content/GetHomepageConfig] ❌ 获取首页配置失败:', error.message);
    return sendErrorResponse(res, error, 'Content/GetHomepageConfig');
  }
});

// 7. PUT /api/v1/content/homepage/config - 批量更新配置
router.put('/homepage/config', async (req, res) => {
  try {
    const updates = req.body;

    console.log('[Content/UpdateHomepageConfig] 📝 开始更新首页配置...');

    // 验证输入
    if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
      throw new AppError('请提供需要更新的配置项', 400, 'VALIDATION_ERROR');
    }

    // 验证每个配置键的长度
    for (const key of Object.keys(updates)) {
      validateString(key, '配置键', { min: 1, max: 50 });
    }

    let hasDescriptionField = true;
    let updateCount = 0;

    for (const [key, value] of Object.entries(updates)) {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

      // 验证配置值的长度
      if (stringValue.length > 2000) {
        throw new AppError(`配置项"${key}"的值过长`, 400, 'INVALID_LENGTH');
      }

      const existing = await getOne('SELECT id FROM homepage_config WHERE config_key = ?', [key]);

      if (existing) {
        await execute(
          'UPDATE homepage_config SET config_value = ? WHERE config_key = ?',
          [stringValue, key]
        );
        updateCount++;
      } else {
        // 尝试带description字段的插入
        try {
          await execute(
            'INSERT INTO homepage_config (config_key, config_value, description) VALUES (?, ?, ?)',
            [key, stringValue, '']
          );
          updateCount++;
        } catch (insertError) {
          // 如果失败（字段不存在），尝试基本插入
          if (insertError.message && insertError.message.includes('description')) {
            hasDescriptionField = false;
            console.warn('[Content/UpdateHomepageConfig] ⚠️ description字段不存在，使用基本INSERT:', insertError.message);
            try {
              await execute(
                'INSERT INTO homepage_config (config_key, config_value) VALUES (?, ?)',
                [key, stringValue]
              );
              updateCount++;
            } catch (basicInsertError) {
              console.error(`[Content/UpdateHomepageConfig] ❌ 插入配置项"${key}"失败:`, basicInsertError.message);
              throw basicInsertError;
            }
          } else {
            console.error(`[Content/UpdateHomepageConfig] ❌ 插入配置项"${key}"失败:`, insertError.message);
            throw insertError;
          }
        }
      }
    }

    console.log(`[Content/UpdateHomepageConfig] ✅ 成功更新 ${updateCount} 个配置项`);

    res.json({ success: true, message: `配置更新成功，共更新 ${updateCount} 个配置项` });
  } catch (error) {
    console.error('[Content/UpdateHomepageConfig] ❌ 更新首页配置失败:', error.message);
    return sendErrorResponse(res, error, 'Content/UpdateHomepageConfig');
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
    console.error('[Content/Preview] ❌ 获取预览数据失败:', error.message);
    return sendErrorResponse(res, error, 'Content/Preview');
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
        return sendErrorResponse(res, 400, 'NO_FILE', '请选择要上传的图片');
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
      return sendErrorResponse(res, 500, 'UPLOAD_ERROR', '文件上传失败', error);
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
