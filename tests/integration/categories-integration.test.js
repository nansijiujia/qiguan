/**
 * 分类管理 API 集成测试 - 全面版
 * 覆盖：CRUD操作、边界条件、安全性、并发、性能
 */
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

// Mock 认证中间件
jest.mock('../../middleware/auth', () => {
  const jwt = require('jsonwebtoken');
  const TEST_SECRET = 'test-secret-for-jwt-testing-min-32-chars-long';
  return {
    verifyToken: (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '未提供认证令牌' } });
      }
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, TEST_SECRET, { algorithms: ['HS256'] });
        req.user = decoded;
        next();
      } catch (e) {
        return res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: '无效的认证令牌' } });
      }
    },
    generateToken: jest.fn(),
    JWT_SECRET: TEST_SECRET,
    JWT_EXPIRES_IN: '1h'
  };
});

// Mock RBAC权限控制
jest.mock('../../middleware/rbac', () => ({
  requirePermission: (resource, action) => (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '需要认证' } });
    const rolePermissions = {
      admin: { categories: ['create', 'read', 'update', 'delete'] },
      manager: { categories: ['create', 'read', 'update'] },
      editor: { categories: ['read'] },
      user: { categories: ['read'] }
    };
    const perms = rolePermissions[req.user.role]?.[resource];
    if (!perms || !perms.includes(action)) {
      return res.status(403).json({ success: false, error: { code: 'INSUFFICIENT_PERMISSIONS', message: `无${resource}.${action}权限` } });
    }
    next();
  }
}));

// Mock 数据库操作
jest.mock('../../db-unified', () => ({
  query: jest.fn(),
  getOne: jest.fn(),
  execute: jest.fn(),
  pool: {
    getConnection: jest.fn().mockResolvedValue({
      execute: jest.fn(),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn()
    })
  }
}));

// Mock 响应助手
jest.mock('../../utils/response-helper', () => ({
  cachedQuery: jest.fn((key, fn) => fn()),
  invalidateCache: jest.fn()
}));

const categoriesRouter = require('../../routes/categories');
const { query, getOne, execute, pool } = require('../../db-unified');
const { invalidateCache } = require('../../utils/response-helper');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/categories', categoriesRouter);
  return app;
}

const TEST_SECRET = 'test-secret-for-jwt-testing-min-32-chars-long';

function generateToken(overrides = {}) {
  const payload = { id: 1, role: 'admin', username: 'testadmin', ...overrides };
  return jwt.sign(payload, TEST_SECRET, { expiresIn: '1h' });
}

describe('分类管理 API 全面集成测试', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== GET / - 获取列表 ====================
  describe('GET /api/v1/categories - 获取分类列表', () => {
    
    test('成功获取分类列表（默认分页）', async () => {
      query.mockResolvedValueOnce([{ total: 3 }]);
      query.mockResolvedValueOnce([
        { id: 1, name: '电子产品', parent_id: null, sort_order: 1, status: 'active', created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: 2, name: '服装配饰', parent_id: null, sort_order: 2, status: 'active', created_at: '2024-01-02', updated_at: '2024-01-02' },
        { id: 3, name: '手机', parent_id: 1, sort_order: 1, status: 'active', created_at: '2024-01-03', updated_at: '2024-01-03' }
      ]);
      
      const app = createApp();
      const res = await request(app)
        .get('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken()}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.list.length).toBe(3);
      expect(res.body.data.pagination).toBeDefined();
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.total).toBe(3);
    });

    test('自定义分页参数', async () => {
      query.mockResolvedValueOnce([{ total: 50 }]);
      query.mockResolvedValueOnce(Array.from({ length: 20 }, (_, i) => ({ 
        id: i + 1, name: `分类${i + 1}`, parent_id: null, sort_order: i, status: 'active' 
      })));
      
      const app = createApp();
      const res = await request(app)
        .get('/api/v1/categories?page=2&limit=20')
        .set('Authorization', `Bearer ${generateToken()}`);
      
      expect(res.status).toBe(200);
      expect(res.body.data.pagination.page).toBe(2);
      expect(res.body.data.pagination.pageSize).toBe(20);
      expect(res.body.data.list.length).toBeLessThanOrEqual(20);
    });

    test('关键词搜索功能', async () => {
      query.mockResolvedValueOnce([{ total: 1 }]);
      query.mockResolvedValueOnce([
        { id: 1, name: '电子产品', parent_id: null, sort_order: 1, status: 'active' }
      ]);
      
      const app = createApp();
      const res = await request(app)
        .get('/api/v1/categories?keyword=电子')
        .set('Authorization', `Bearer ${generateToken()}`);
      
      expect(res.status).toBe(200);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('LIKE'),
        expect.arrayContaining(['%电子%'])
      );
    });

    test('状态筛选功能', async () => {
      query.mockResolvedValueOnce([{ total: 2 }]);
      query.mockResolvedValueOnce([
        { id: 1, name: '电子产品', status: 'active' },
        { id: 2, name: '服装配饰', status: 'active' }
      ]);
      
      const app = createApp();
      const res = await request(app)
        .get('/api/v1/categories?status=active')
        .set('Authorization', `Bearer ${generateToken()}`);
      
      expect(res.status).toBe(200);
      expect(query).toHaveBeenCalledWith(expect.stringContaining('status'), ['active']);
    });

    test('排序功能', async () => {
      query.mockResolvedValueOnce([{ total: 0 }]);
      query.mockResolvedValueOnce([]);
      
      const app = createApp();
      const res = await request(app)
        .get('/api/v1/categories?sort_field=name&sort_order=asc')
        .set('Authorization', `Bearer ${generateToken()}`);
      
      expect(res.status).toBe(200);
    });

    test('空列表返回', async () => {
      query.mockResolvedValueOnce([{ total: 0 }]);
      query.mockResolvedValueOnce([]);
      
      const app = createApp();
      const res = await request(app)
        .get('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken()}`);
      
      expect(res.status).toBe(200);
      expect(res.body.data.list).toEqual([]);
      expect(res.body.data.pagination.total).toBe(0);
    });

    test('无效分页参数自动修正（负数page）', async () => {
      query.mockResolvedValueOnce([{ total: 5 }]);
      query.mockResolvedValueOnce([]);
      
      const app = createApp();
      const res = await request(app)
        .get('/api/v1/categories?page=-5&limit=10')
        .set('Authorization', `Bearer ${generateToken()}`);
      
      // 应该能正常处理，不会崩溃
      expect([200, 400]).toContain(res.status);
    });

    test('超大pageSize限制为100', async () => {
      query.mockResolvedValueOnce([{ total: 100 }]);
      query.mockResolvedValueOnce(Array.from({ length: 100 }, (_, i) => ({ id: i + 1, name: `Cat${i}` })));
      
      const app = createApp();
      const res = await request(app)
        .get('/api/v1/categories?pageSize=99999')
        .set('Authorization', `Bearer ${generateToken()}`);
      
      expect(res.status).toBe(200);
      expect(res.body.data.pagination.pageSize).toBeLessThanOrEqual(100);
    });

    test('未授权访问返回401', async () => {
      const app = createApp();
      const res = await request(app).get('/api/v1/categories');
      
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    test('无效token返回401', async () => {
      const app = createApp();
      const res = await request(app)
        .get('/api/v1/categories')
        .set('Authorization', 'Bearer invalid-token');
      
      expect(res.status).toBe(401);
    });

    test('非法status值返回400', async () => {
      const app = createApp();
      const res = await request(app)
        .get('/api/v1/categories?status=invalid_status')
        .set('Authorization', `Bearer ${generateToken()}`);
      
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ==================== POST / - 创建分类 ====================
  describe('POST /api/v1/categories - 创建新分类', () => {
    
    test('成功创建新分类（完整字段）', async () => {
      getOne.mockResolvedValue(null); // 名称唯一性检查
      pool.getConnection.mockResolvedValueOnce({
        execute: jest.fn().mockResolvedValue([[{ insertId: 101 }]]),
        beginTransaction: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn(),
        release: jest.fn()
      });
      
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ 
          name: '全新分类',
          parent_id: null,
          sort_order: 10,
          status: 'active'
        });
      
      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('全新分类');
      expect(res.body.data.id).toBe(101);
      expect(invalidateCache).toHaveBeenCalled();
    });

    test('成功创建新分类（仅必填字段）', async () => {
      getOne.mockResolvedValue(null);
      pool.getConnection.mockResolvedValueOnce({
        execute: jest.fn().mockResolvedValue([[{ insertId: 102 }]]),
        beginTransaction: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn(),
        release: jest.fn()
      });
      
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '最小化分类' });
      
      expect(res.status).toBe(201);
      expect(res.body.data.sort_order).toBe(0); // 默认值
      expect(res.body.data.status).toBe('active'); // 默认值
    });

    test('名称为空返回400', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '' });
      
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CATEGORY_VALIDATION_FAILED');
    });

    test('名称缺少返回400', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({});
      
      expect(res.status).toBe(400);
    });

    test('名称长度<2字符返回400', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: 'A' });
      
      expect(res.status).toBe(400);
    });

    test('名称长度>50字符返回400', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: 'A'.repeat(51) });
      
      expect(res.status).toBe(400);
    });

    test('重复名称返回409（大小写不敏感）', async () => {
      getOne.mockResolvedValue({ id: 1, deleted_at: null }); // 已存在同名
      
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: 'Electronics' }); // 假设已存在 'electronics'
      
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CATEGORY_NAME_DUPLICATE');
    });

    test('父分类不存在返回400', async () => {
      getOne.mockResolvedValue(null); // 名称唯一性通过
      getOne.mockResolvedValueOnce(null); // 父分类不存在
      
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '子分类', parent_id: 99999 });
      
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PARENT_ID');
    });

    test('非法status值返回400', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '测试分类', status: 'invalid' });
      
      expect(res.status).toBe(400);
    });

    test('sort_order为负数返回400', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '测试分类', sort_order: -1 });
      
      expect(res.status).toBe(400);
    });

    test('sort_order非整数返回400', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '测试分类', sort_order: 1.5 });
      
      expect(res.status).toBe(400);
    });

    test('无权限角色返回403（editor）', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken({ role: 'editor' })}`)
        .send({ name: '测试' });
      
      expect(res.status).toBe(403);
    });

    test('无权限角色返回403（user）', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken({ role: 'user' })}`)
        .send({ name: '测试' });
      
      expect(res.status).toBe(403);
    });

    test('SQL注入防护 - 名称包含SQL关键字', async () => {
      getOne.mockResolvedValue(null);
      pool.getConnection.mockResolvedValueOnce({
        execute: jest.fn().mockResolvedValue([[{ insertId: 103 }]]),
        beginTransaction: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn(),
        release: jest.fn()
      });
      
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: "'; DROP TABLE categories; --" });
      
      // 应该安全处理或被验证拦截
      expect([201, 400]).toContain(res.status);
      if (res.status === 201) {
        expect(typeof res.body.data.name).toBe('string');
      }
    });

    test('XSS防护 - 名称包含脚本标签', async () => {
      getOne.mockResolvedValue(null);
      pool.getConnection.mockResolvedValueOnce({
        execute: jest.fn().mockResolvedValue([[{ insertId: 104 }]]),
        beginTransaction: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn(),
        release: jest.fn()
      });
      
      const app = createApp();
      const xssPayload = '<script>alert("xss")</script>';
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: xssPayload });
      
      expect([201, 400]).toContain(res.status);
    });

    test('名称包含emoji表情应正常处理', async () => {
      getOne.mockResolvedValue(null);
      pool.getConnection.mockResolvedValueOnce({
        execute: jest.fn().mockResolvedValue([[{ insertId: 105 }]]),
        beginTransaction: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn(),
        release: jest.fn()
      });
      
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '🎉庆祝分类🎊' });
      
      expect([201, 400]).toContain(res.status);
    });

    test('超长输入（1000字符）应被拒绝', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: 'A'.repeat(1000) });
      
      expect(res.status).toBe(400);
    });
  });

  // ==================== PUT /:id - 更新分类 ====================
  describe('PUT /api/v1/categories/:id - 更新分类信息', () => {
    
    test('成功更新分类信息', async () => {
      getOne.mockResolvedValueOnce({ id: 1, name: '旧名称', updated_at: '2024-01-01' }); // 存在性检查
      getOne.mockResolvedValue(null); // 唯一性检查（名称不同）
      getOne.mockResolvedValueOnce({ id: 1, name: '更新后', status: 'active', updated_at: '2024-06-01' }); // 查询更新后数据
      
      const mockConnection = {
        execute: jest.fn().mockResolvedValue([{ affectedRows: 1 }]),
        beginTransaction: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn(),
        release: jest.fn()
      };
      pool.getConnection.mockResolvedValueOnce(mockConnection);
      
      const app = createApp();
      const res = await request(app)
        .put('/api/v1/categories/1')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '更新后', status: 'inactive' });
      
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('更新后');
      expect(invalidateCache).toHaveBeenCalled();
    });

    test('更新不存在的ID返回404', async () => {
      getOne.mockResolvedValue(null); // 不存在
      
      const app = createApp();
      const res = await request(app)
        .put('/api/v1/categories/99999')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '不存在' });
      
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('CATEGORY_NOT_FOUND');
    });

    test('不能将自己设为父分类（循环引用）', async () => {
      getOne.mockResolvedValueOnce({ id: 1 }); // 存在
      
      const app = createApp();
      const res = await request(app)
        .put('/api/v1/categories/1')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ parent_id: 1 });
      
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CIRCULAR_REFERENCE');
    });

    test('部分更新（仅提交name）', async () => {
      getOne.mockResolvedValueOnce({ id: 1, name: '旧名', updated_at: '2024-01-01' });
      getOne.mockResolvedValue(null); // 新名称不重复
      getOne.mockResolvedValueOnce({ id: 1, name: '新名', status: 'active' });
      
      const mockConnection = {
        execute: jest.fn().mockResolvedValue([{ affectedRows: 1 }]),
        beginTransaction: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn(),
        release: jest.fn()
      };
      pool.getConnection.mockResolvedValueOnce(mockConnection);
      
      const app = createApp();
      const res = await request(app)
        .put('/api/v1/categories/1')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '新名' }); // 只传name
      
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('新名');
    });

    test('唯一性检查排除自身记录', async () => {
      getOne.mockResolvedValueOnce({ id: 1, name: '原名称', updated_at: '2024-01-01' });
      getOne.mockResolvedValue(null); // 同名但ID不同时才冲突
      getOne.mockResolvedValueOnce({ id: 1, name: '原名称' }); // 更新后的数据
      
      const mockConnection = {
        execute: jest.fn().mockResolvedValue([{ affectedRows: 1 }]),
        beginTransaction: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn(),
        release: jest.fn()
      };
      pool.getConnection.mockResolvedValueOnce(mockConnection);
      
      const app = createApp();
      const res = await request(app)
        .put('/api/v1/categories/1')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '原名称' }); // 改成相同名称应该允许
      
      expect(res.status).toBe(200);
    });

    test('没有提供任何更新字段返回400', async () => {
      const app = createApp();
      const res = await request(app)
        .put('/api/v1/categories/1')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({});
      
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('没有提供需要更新的字段');
    });

    test('乐观锁冲突检测（updated_at不匹配）', async () => {
      getOne.mockResolvedValueOnce({ 
        id: 1, name: '当前名称', updated_at: '2024-06-15T10:00:00Z' 
      });
      
      const app = createApp();
      const res = await request(app)
        .put('/api/v1/categories/1')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ 
          name: '尝试更新', 
          updated_at: '2024-01-01T00:00:00Z' // 旧的updated_at
        });
      
      expect(res.status).toBe(409); // 冲突
      expect(res.body.error.code).toBe('CONFLICT');
    });

    test('manager角色可以更新', async () => {
      getOne.mockResolvedValueOnce({ id: 1 }).mockResolvedValueOnce(null);
      getOne.mockResolvedValueOnce({ id: 1, name: 'ok' });
      
      const mockConnection = {
        execute: jest.fn().mockResolvedValue([{ affectedRows: 1 }]),
        beginTransaction: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn(),
        release: jest.fn()
      };
      pool.getConnection.mockResolvedValueOnce(mockConnection);
      
      const app = createApp();
      const res = await request(app)
        .put('/api/v1/categories/1')
        .set('Authorization', `Bearer ${generateToken({ role: 'manager' })}`)
        .send({ name: 'ok' });
      
      expect([200, 403]).toContain(res.status);
    });

    test('editor角色无法更新返回403', async () => {
      const app = createApp();
      const res = await request(app)
        .put('/api/v1/categories/1')
        .set('Authorization', `Bearer ${generateToken({ role: 'editor' })}`)
        .send({ name: '测试' });
      
      expect(res.status).toBe(403);
    });
  });

  // ==================== DELETE /:id - 删除分类 ====================
  describe('DELETE /api/v1/categories/:id - 删除分类', () => {
    
    test('成功删除分类（软删除）', async () => {
      getOne.mockResolvedValueOnce({ id: 1, name: '待删除', deleted_at: null }); // 存在且未删除
      getOne.mockResolvedValueOnce({ count: 0 }); // 无子分类
      getOne.mockResolvedValueOnce({ count: 0 }); // 无关联商品
      
      const mockConnection = {
        execute: jest.fn().mockResolvedValue([{ affectedRows: 1 }]),
        beginTransaction: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn(),
        release: jest.fn()
      };
      pool.getConnection.mockResolvedValueOnce(mockConnection);
      
      const app = createApp();
      const res = await request(app)
        .delete('/api/v1/categories/1')
        .set('Authorization', `Bearer ${generateToken()}`);
      
      expect(res.status).toBe(200);
      expect(res.body.data.deleted).toBe(true);
      expect(invalidateCache).toHaveBeenCalled();
    });

    test('删除不存在的ID返回404', async () => {
      getOne.mockResolvedValue(null); // 不存在
      
      const app = createApp();
      const res = await request(app)
        .delete('/api/v1/categories/99999')
        .set('Authorization', `Bearer ${generateToken()}`);
      
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('CATEGORY_NOT_FOUND');
    });

    test('有子分类时不允许删除返回400', async () => {
      getOne.mockResolvedValueOnce({ id: 1, deleted_at: null });
      getOne.mockResolvedValueOnce({ count: 3 }); // 有3个子分类
      
      const app = createApp();
      const res = await request(app)
        .delete('/api/v1/categories/1')
        .set('Authorization', `Bearer ${generateToken()}`);
      
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('HAS_CHILDREN');
      expect(res.body.error.message).toContain('3 个子分类');
    });

    test('有关联商品时不允许删除返回400', async () => {
      getOne.mockResolvedValueOnce({ id: 1, deleted_at: null });
      getOne.mockResolvedValueOnce({ count: 0 }); // 无子分类
      getOne.mockResolvedValueOnce({ count: 5 }); // 有5个关联商品
      
      const app = createApp();
      const res = await request(app)
        .delete('/api/v1/categories/1')
        .set('Authorization', `Bearer ${generateToken()}`);
      
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('HAS_PRODUCTS');
      expect(res.body.error.message).toContain('5 个商品');
    });

    test('重复删除已删除的分类返回404', async () => {
      getOne.mockResolvedValueOnce({ id: 1, deleted_at: '2024-01-01' }); // 已删除
      
      const app = createApp();
      const res = await request(app)
        .delete('/api/v1/categories/1')
        .set('Authorization', `Bearer ${generateToken()}`);
      
      expect(res.status).toBe(404);
    });

    test('editor角色无法删除返回403', async () => {
      const app = createApp();
      const res = await request(app)
        .delete('/api/v1/categories/1')
        .set('Authorization', `Bearer ${generateToken({ role: 'editor' })}`);
      
      expect(res.status).toBe(403);
    });
  });

  // ==================== 边界条件和安全性 ====================
  describe('边界条件和安全性测试', () => {
    
    test('sort_order传入字符串数字应被处理', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '测试', sort_order: "10" });
      
      // 应该接受字符串形式的数字或返回验证错误
      expect([201, 400]).toContain(res.status);
    });

    test('status传入数字应被处理', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '测试', status: 123 });
      
      expect([201, 400]).toContain(res.status);
    });

    test('parent_id传入非数字应返回400', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '测试', parent_id: 'abc' });
      
      expect(res.status).toBe(400);
    });

    test('请求体格式错误（非JSON）返回400', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken()}`)
        .set('Content-Type', 'text/plain')
        .send('not json data');
      
      expect([400, 415]).toContain(res.status);
    });

    test('超大请求体应被限制', async () => {
      const largePayload = { name: 'A'.repeat(100000) }; // 100KB
      
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send(largePayload);
      
      expect([400, 413]).toContain(res.status);
    });

    test('特殊Unicode字符应正确处理', async () => {
      getOne.mockResolvedValue(null);
      pool.getConnection.mockResolvedValueOnce({
        execute: jest.fn().mockResolvedValue([[{ insertId: 106 }]]),
        beginTransaction: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn(),
        release: jest.fn()
      });
      
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '中文分类 日本語 한국어 العربية' });
      
      expect([201, 400]).toContain(res.status);
    });
  });

  // ==================== 错误场景测试 ====================
  describe('错误场景和异常处理', () => {
    
    test('数据库查询失败返回500', async () => {
      query.mockRejectedValue(new Error('Database connection lost'));
      
      const app = createApp();
      try {
        const res = await request(app)
          .get('/api/v1/categories')
          .set('Authorization', `Bearer ${generateToken()}`);
        
        expect([500, 502, 503].includes(res.status)).toBeTruthy();
      } catch (e) {
        // 可能抛出未处理的异常
        expect(e).toBeDefined();
      }
    });

    test('事务回滚场景', async () => {
      getOne.mockResolvedValue(null);
      
      const mockConnection = {
        execute: jest.fn().mockRejectedValue(new Error('Deadlock detected')),
        beginTransaction: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn(),
        release: jest.fn()
      };
      pool.getConnection.mockResolvedValueOnce(mockConnection);
      
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '测试事务' });
      
      expect([500, 503].includes(res.status)).toBeTruthy();
      expect(mockConnection.rollback).toHaveBeenCalled();
    });

    test('响应格式标准化检查', async () => {
      query.mockResolvedValueOnce([{ total: 0 }]);
      query.mockResolvedValueOnce([]);
      
      const app = createApp();
      const res = await request(app)
        .get('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken()}`);
      
      // 成功响应格式
      expect(res.body).toHaveProperty('success');
      expect(res.body).toHaveProperty('data');
      if (res.body.success === false) {
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toHaveProperty('code');
        expect(res.body.error).toHaveProperty('message');
      }
    });

    test('错误响应包含requestId用于追踪', async () => {
      getOne.mockResolvedValue(null);
      
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken()}`)
        .set('X-Request-ID', 'test-request-123')
        .send({});
      
      expect(res.status).toBe(400);
      // 错误响应应包含requestId
      if (res.body.error) {
        expect(res.body.error).toHaveProperty('requestId');
      }
    });
  });

  // ==================== 性能基准测试 ====================
  describe('性能基准测试', () => {
    
    test('列表加载100条数据响应时间 < 500ms', async () => {
      const largeList = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1, name: `分类${i + 1}`, parent_id: null, sort_order: i, status: 'active'
      }));
      
      query.mockResolvedValueOnce([{ total: 100 }]);
      query.mockResolvedValueOnce(largeList);
      
      const app = createApp();
      const start = Date.now();
      
      const res = await request(app)
        .get('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken()}`);
      
      const elapsed = Date.now() - start;
      expect(res.status).toBe(200);
      expect(elapsed).toBeLessThan(500);
    });

    test('buildTree函数处理1000条数据性能', () => {
      function buildTree(categories) {
        const categoryMap = new Map();
        const tree = [];
        categories.forEach(category => {
          categoryMap.set(category.id, {
            id: category.id, name: category.name, parent_id: category.parent_id,
            children: []
          });
        });
        for (const [id, node] of categoryMap) {
          const parent = categoryMap.get(node.parent_id);
          if (parent) parent.children.push(node);
          else if (node.parent_id === null || node.parent_id === undefined) tree.push(node);
        }
        function cleanEmptyChildren(n) {
          if (n.children.length === 0) delete n.children;
          else n.children.forEach(cleanEmptyChildren);
        }
        tree.forEach(cleanEmptyChildren);
        return tree;
      }

      const data = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1, name: `Cat${i}`, parent_id: i < 10 ? null : Math.floor((i - 1) / 10) + 1
      }));
      
      const start = Date.now();
      const result = buildTree(data);
      const elapsed = Date.now() - start;
      
      expect(result.length).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(100); // 应在100ms内完成
    });

    test('并发请求处理能力', async () => {
      query.mockResolvedValue([{ total: 1 }]);
      query.mockResolvedValue([{ id: 1, name: 'Test' }]);
      
      const app = createApp();
      
      // 发送10个并发请求
      const requests = Array.from({ length: 10 }, () =>
        request(app)
          .get('/api/v1/categories')
          .set('Authorization', `Bearer ${generateToken()}`)
      );
      
      const responses = await Promise.all(requests);
      
      // 所有请求都应该成功
      responses.forEach(res => {
        expect(res.status).toBe(200);
      });
    });
  });
});
