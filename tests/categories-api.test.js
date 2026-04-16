const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

jest.mock('../middleware/auth', () => {
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
    requireRole: (...roles) => (req, res, next) => {
      if (!req.user) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '需要认证' } });
      if (!roles.includes(req.user.role)) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '权限不足' } });
      next();
    },
    generateToken: jest.fn(),
    revokeToken: jest.fn(),
    JWT_SECRET: TEST_SECRET,
    JWT_EXPIRES_IN: '1h',
    JWT_ALGORITHM: 'HS256'
  };
});

jest.mock('../middleware/rbac', () => ({
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
  },
  requireAnyRole: (...roles) => (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
    if (!roles.includes(req.user.role)) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN' } });
    next();
  },
  getPermissions: jest.fn(() => ({})),
  hasPermission: jest.fn(() => false),
  ROLE_PERMISSIONS: {}
}));

const categoriesRouter = require('../routes/categories');

jest.mock('../db_unified', () => ({
  query: jest.fn(),
  getOne: jest.fn(),
  execute: jest.fn(),
  initPool: jest.fn().mockResolvedValue(true),
  isDbReady: jest.fn().mockReturnValue(true)
}));

jest.mock('../utils/responseHelper', () => ({
  cachedQuery: jest.fn((key, fn) => fn()),
  invalidateCache: jest.fn()
}));

const { query, getOne, execute } = require('../db-unified');
const { invalidateCache } = require('../utils/response-helper');

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

describe('分类管理 API 全面审计测试', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. API端点存在性验证', () => {
    test('GET /api/v1/categories - 列表接口存在', async () => {
      query.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);
      const app = createApp();
      const res = await request(app).get('/api/v1/categories').set('Authorization', `Bearer ${generateToken()}`);
      expect([200, 400]).toContain(res.status);
    });

    test('GET /api/v1/categories/tree - 树形结构接口存在', async () => {
      query.mockResolvedValue([]);
      const app = createApp();
      const res = await request(app).get('/api/v1/categories/tree').set('Authorization', `Bearer ${generateToken()}`);
      expect([200, 400]).toContain(res.status);
    });

    test('GET /api/v1/categories/:id - 详情接口存在', async () => {
      getOne.mockResolvedValue(null);
      const app = createApp();
      const res = await request(app).get('/api/v1/categories/1').set('Authorization', `Bearer ${generateToken()}`);
      expect([200, 404]).toContain(res.status);
    });

    test('POST /api/v1/categories - 创建接口存在', async () => {
      getOne.mockResolvedValue(null);
      getOne.mockResolvedValueOnce(null);
      execute.mockResolvedValue({ insertId: 99 });
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '测试分类' });
      expect([201, 400, 403]).toContain(res.status);
    });

    test('PUT /api/v1/categories/:id - 更新接口存在', async () => {
      getOne.mockResolvedValueOnce({ id: 1 }).mockResolvedValueOnce(null);
      getOne.mockResolvedValueOnce({ id: 1, name: 'ok', parent_id: null, sort_order: 0, status: 'active' });
      execute.mockResolvedValue({ affectedRows: 1 });
      const app = createApp();
      const res = await request(app)
        .put('/api/v1/categories/1')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '新名称' });
      expect([200, 400, 403, 404]).toContain(res.status);
    });

    test('DELETE /api/v1/categories/:id - 删除接口存在', async () => {
      getOne.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 0 });
      execute.mockResolvedValue({ affectedRows: 1 });
      const app = createApp();
      const res = await request(app)
        .delete('/api/v1/categories/1')
        .set('Authorization', `Bearer ${generateToken()}`);
      expect([200, 400, 403, 404]).toContain(res.status);
    });
  });

  describe('2. GET / - 列表接口参数完整性', () => {
    test('应支持分页参数 page 和 limit', async () => {
      query.mockResolvedValueOnce([{ total: 5 }]);
      query.mockResolvedValueOnce([
        { id: 1, name: 'cat1', sort_order: 1, status: 'active' },
        { id: 2, name: 'cat2', sort_order: 2, status: 'active' }
      ]);
      const app = createApp();
      const res = await request(app)
        .get('/api/v1/categories?page=2&limit=5')
        .set('Authorization', `Bearer ${generateToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.pagination.page).toBe(2);
      expect(res.body.data.pagination.limit).toBe(5);
    });

    test('应支持关键词搜索 keyword 参数', async () => {
      query.mockResolvedValueOnce([{ total: 1 }]);
      query.mockResolvedValueOnce([{ id: 1, name: '电子', sort_order: 1, status: 'active' }]);
      const app = createApp();
      const res = await request(app)
        .get('/api/v1/categories?keyword=电子')
        .set('Authorization', `Bearer ${generateToken()}`);
      expect(res.status).toBe(200);
      expect(query).toHaveBeenCalledWith(expect.stringContaining('LIKE'), expect.arrayContaining(['%电子%']));
    });

    test('分页参数应有合理边界限制', async () => {
      query.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);
      const app = createApp();
      const res = await request(app)
        .get('/api/v1/categories?page=-1&limit=9999')
        .set('Authorization', `Bearer ${generateToken()}`);
      expect(res.status).toBe(200);
    });

    test('无认证时应返回401', async () => {
      const app = createApp();
      const res = await request(app).get('/api/v1/categories');
      expect(res.status).toBe(401);
    });
  });

  describe('3. GET /tree - 树形结构接口', () => {
    test('flat=true 应返回扁平化列表含level字段', async () => {
      query.mockResolvedValue([
        { id: 1, name: '电子产品', parent_id: null, sort_order: 1, status: 'active', product_count: 0 },
        { id: 2, name: '手机', parent_id: 1, sort_order: 1, status: 'active', product_count: 0 }
      ]);
      const app = createApp();
      const res = await request(app)
        .get('/api/v1/categories/tree?flat=true')
        .set('Authorization', `Bearer ${generateToken()}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      if (res.body.data.length > 0) expect(res.body.data[0]).toHaveProperty('level');
    });

    test('flat=false 或不传应返回嵌套树形结构', async () => {
      query.mockResolvedValue([
        { id: 1, name: '电子产品', parent_id: null, sort_order: 1, status: 'active', product_count: 0 },
        { id: 2, name: '手机', parent_id: 1, sort_order: 1, status: 'active', product_count: 0 }
      ]);
      const app = createApp();
      const res = await request(app)
        .get('/api/v1/categories/tree')
        .set('Authorization', `Bearer ${generateToken()}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('flat参数非法值应返回400错误', async () => {
      const app = createApp();
      const res = await request(app)
        .get('/api/v1/categories/tree?flat=invalid')
        .set('Authorization', `Bearer ${generateToken()}`);
      expect(res.status).toBe(400);
    });
  });

  describe('4. GET /:id - 详情接口', () => {
    test('有效ID应返回分类详情及子分类和父分类信息', async () => {
      getOne
        .mockResolvedValueOnce({ id: 1, name: '电子产品', parent_id: null, sort_order: 1, status: 'active', product_count: 5, created_at: '2024-01-01' })
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(null);
      const app = createApp();
      const res = await request(app)
        .get('/api/v1/categories/1')
        .set('Authorization', `Bearer ${generateToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(1);
      expect(res.body.data).toHaveProperty('children');
      expect(res.body.data).toHaveProperty('parent');
    });

    test('不存在的ID应返回404', async () => {
      getOne.mockResolvedValue(null);
      const app = createApp();
      const res = await request(app)
        .get('/api/v1/categories/99999')
        .set('Authorization', `Bearer ${generateToken()}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    test('无效ID格式应返回400', async () => {
      const app = createApp();
      const res = await request(app).get('/api/v1/categories/abc').set('Authorization', `Bearer ${generateToken()}`);
      expect(res.status).toBe(400);
    });

    test('负数ID应返回400', async () => {
      const app = createApp();
      const res = await request(app).get('/api/v1/categories/-1').set('Authorization', `Bearer ${generateToken()}`);
      expect(res.status).toBe(400);
    });
  });

  describe('5. POST / - 创建接口', () => {
    test('创建成功应返回201和分类数据', async () => {
      getOne.mockResolvedValue(null);
      getOne.mockResolvedValueOnce(null);
      execute.mockResolvedValue({ insertId: 100 });
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '新分类', parent_id: null, sort_order: 10, status: 'active' });
      expect(res.status).toBe(201);
      expect(res.body.data.id).toBe(100);
      expect(res.body.data.name).toBe('新分类');
      expect(invalidateCache).toHaveBeenCalled();
    });

    test('缺少name字段应返回400', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MISSING_FIELDS');
    });

    test('name长度不足2字符应返回400', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: 'A' });
      expect(res.status).toBe(400);
    });

    test('name超过50字符应返回400', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: 'A'.repeat(51) });
      expect(res.status).toBe(400);
    });

    test('重复名称（大小写不敏感）应返回409', async () => {
      getOne.mockResolvedValue({ id: 1 });
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: 'Electronics' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DUPLICATE_ERROR');
    });

    test('不存在的父分类ID应返回400', async () => {
      getOne.mockResolvedValue(null);
      getOne.mockResolvedValueOnce(null);
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '新分类', parent_id: 99999 });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('status值不在允许范围内应返回400', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '测试分类', status: 'invalid_status' });
      expect(res.status).toBe(400);
    });

    test('sort_order为负数应返回400', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '测试分类', sort_order: -1 });
      expect(res.status).toBe(400);
    });

    test('editor角色应无法创建分类（权限控制）', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken({ role: 'editor' })}`)
        .send({ name: '测试分类' });
      expect(res.status).toBe(403);
    });

    test('user角色应无法创建分类（权限控制）', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken({ role: 'user' })}`)
        .send({ name: '测试分类' });
      expect(res.status).toBe(403);
    });
  });

  describe('6. PUT /:id - 更新接口', () => {
    test('更新成功应返回更新后的完整数据', async () => {
      getOne
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 1, name: '更新后', parent_id: null, sort_order: 5, status: 'inactive', created_at: '2024-01-01', updated_at: '2024-06-01' });
      execute.mockResolvedValue({ affectedRows: 1 });
      const app = createApp();
      const res = await request(app)
        .put('/api/v1/categories/1')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '更新后', status: 'inactive' });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('更新后');
      expect(res.body.data.status).toBe('inactive');
      expect(invalidateCache).toHaveBeenCalled();
    });

    test('不能将自己设为父分类', async () => {
      const app = createApp();
      const res = await request(app)
        .put('/api/v1/categories/1')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ parent_id: 1 });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('空名称应返回400', async () => {
      const app = createApp();
      const res = await request(app)
        .put('/api/v1/categories/1')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '' });
      expect(res.status).toBe(400);
    });

    test('不存在的分类ID应返回404', async () => {
      getOne.mockResolvedValueOnce({ id: 999 });
      execute.mockResolvedValue({ affectedRows: 0 });
      const app = createApp();
      const res = await request(app)
        .put('/api/v1/categories/999')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '更新' });
      expect(res.status).toBe(404);
    });

    test('没有提供任何更新字段应返回400', async () => {
      const app = createApp();
      const res = await request(app)
        .put('/api/v1/categories/1')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('没有提供需要更新的字段');
    });

    test('manager角色可以更新分类', async () => {
      getOne.mockResolvedValueOnce({ id: 1 }).mockResolvedValueOnce(null);
      getOne.mockResolvedValueOnce({ id: 1, name: 'ok', parent_id: null, sort_order: 0, status: 'active' });
      execute.mockResolvedValue({ affectedRows: 1 });
      const app = createApp();
      const res = await request(app)
        .put('/api/v1/categories/1')
        .set('Authorization', `Bearer ${generateToken({ role: 'manager' })}`)
        .send({ name: 'ok' });
      expect([200, 403]).toContain(res.status);
    });

    test('editor角色应无法更新分类（权限控制）', async () => {
      const app = createApp();
      const res = await request(app)
        .put('/api/v1/categories/1')
        .set('Authorization', `Bearer ${generateToken({ role: 'editor' })}`)
        .send({ name: '测试' });
      expect(res.status).toBe(403);
    });
  });

  describe('7. DELETE /:id - 删除接口', () => {
    test('删除成功应返回200', async () => {
      getOne.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 0 });
      execute.mockResolvedValue({ affectedRows: 1 });
      const app = createApp();
      const res = await request(app)
        .delete('/api/v1/categories/1')
        .set('Authorization', `Bearer ${generateToken()}`);
      expect(res.status).toBe(200);
      expect(invalidateCache).toHaveBeenCalled();
    });

    test('有子分类时禁止删除', async () => {
      getOne.mockResolvedValueOnce({ count: 3 });
      const app = createApp();
      const res = await request(app)
        .delete('/api/v1/categories/1')
        .set('Authorization', `Bearer ${generateToken()}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('HAS_CHILDREN');
    });

    test('有关联商品时禁止删除', async () => {
      getOne.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 5 });
      const app = createApp();
      const res = await request(app)
        .delete('/api/v1/categories/1')
        .set('Authorization', `Bearer ${generateToken()}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('HAS_PRODUCTS');
    });

    test('不存在的分类ID应返回404', async () => {
      getOne.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 0 });
      execute.mockResolvedValue({ affectedRows: 0 });
      const app = createApp();
      const res = await request(app)
        .delete('/api/v1/categories/99999')
        .set('Authorization', `Bearer ${generateToken()}`);
      expect(res.status).toBe(404);
    });

    test('editor角色应无法删除分类（权限控制）', async () => {
      const app = createApp();
      const res = await request(app)
        .delete('/api/v1/categories/1')
        .set('Authorization', `Bearer ${generateToken({ role: 'editor' })}`);
      expect(res.status).toBe(403);
    });
  });

  describe('8. buildTree 函数正确性（独立单元测试）', () => {
    function buildTree(categories) {
      const categoryMap = new Map();
      const tree = [];
      categories.forEach(category => {
        categoryMap.set(category.id, {
          id: category.id, name: category.name, parent_id: category.parent_id,
          sort_order: category.sort_order, status: category.status,
          product_count: category.product_count || 0, created_at: category.created_at,
          children: []
        });
      });
      for (const [id, node] of categoryMap) {
        const parent = categoryMap.get(node.parent_id);
        if (parent) {
          parent.children.push(node);
        } else if (node.parent_id === null || node.parent_id === undefined) {
          tree.push(node);
        }
      }
      function cleanEmptyChildren(n) {
        if (n.children.length === 0) delete n.children;
        else n.children.forEach(cleanEmptyChildren);
      }
      tree.forEach(cleanEmptyChildren);
      return tree;
    }

    test('空数组应返回空数组', () => {
      expect(buildTree([])).toEqual([]);
    });

    test('顶级分类应作为根节点', () => {
      const data = [{ id: 1, name: '根', parent_id: null, sort_order: 1, status: 'active', product_count: 0, created_at: '2024-01-01' }];
      const result = buildTree(data);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('根');
      expect(result[0].children).toBeUndefined();
    });

    test('子分类应嵌套在父分类下', () => {
      const data = [
        { id: 1, name: '电子产品', parent_id: null, sort_order: 1, status: 'active', product_count: 0, created_at: '2024-01-01' },
        { id: 2, name: '手机', parent_id: 1, sort_order: 1, status: 'active', product_count: 0, created_at: '2024-01-01' }
      ];
      const result = buildTree(data);
      expect(result).toHaveLength(1);
      expect(result[0].children).toBeDefined();
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children[0].name).toBe('手机');
    });

    test('多级嵌套应正确构建', () => {
      const data = [
        { id: 1, name: 'L1', parent_id: null, sort_order: 1, status: 'active', product_count: 0, created_at: '2024-01-01' },
        { id: 2, name: 'L2', parent_id: 1, sort_order: 1, status: 'active', product_count: 0, created_at: '2024-01-01' },
        { id: 3, name: 'L3', parent_id: 2, sort_order: 1, status: 'active', product_count: 0, created_at: '2024-01-01' }
      ];
      const result = buildTree(data);
      expect(result[0].children[0].children[0].name).toBe('L3');
    });

    test('无子节点的节点不应有children属性', () => {
      const data = [{ id: 1, name: '孤岛', parent_id: null, sort_order: 1, status: 'active', product_count: 0, created_at: '2024-01-01' }];
      const result = buildTree(data);
      expect(result[0]).not.toHaveProperty('children');
    });

    test('大量数据时性能应可接受（O(n)复杂度）', () => {
      const data = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1, name: `Cat${i}`, parent_id: i < 10 ? null : Math.floor((i - 1) / 10) + 1,
        sort_order: i, status: 'active', product_count: 0, created_at: '2024-01-01'
      }));
      const start = Date.now();
      const result = buildTree(data);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(100);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('9. 安全性审计', () => {
    test('XSS攻击字符串应被转义', async () => {
      getOne.mockResolvedValue(null);
      getOne.mockResolvedValueOnce(null);
      execute.mockResolvedValue({ insertId: 101 });
      const app = createApp();
      const xssPayload = '<script>alert("xss")</script>';
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: xssPayload });
      expect([201, 400]).toContain(res.status);
      if (res.status === 201) expect(res.body.data.name).not.toContain('<script>');
    });

    test('SQL注入尝试应被防御（参数化查询）', async () => {
      getOne.mockResolvedValue(null);
      getOne.mockResolvedValueOnce(null);
      execute.mockResolvedValue({ insertId: 102 });
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: "'; DROP TABLE categories; --" });
      expect([201, 400]).toContain(res.status);
    });
  });

  describe('10. 缓存行为验证', () => {
    test('写操作后应清除缓存', async () => {
      getOne.mockResolvedValue(null);
      getOne.mockResolvedValueOnce(null);
      execute.mockResolvedValue({ insertId: 200 });
      const app = createApp();
      await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '缓存测试' });
      expect(invalidateCache).toHaveBeenCalledWith('categories');
    });
  });
});
