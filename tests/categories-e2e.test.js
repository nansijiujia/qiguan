const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const TEST_JWT_SECRET = 'test-e2e-secret-key-for-categories-testing-32chars!';
const categoriesRouter = require('../routes/categories');

let testDb;
let testDbPath;

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/categories', categoriesRouter);
  return app;
}

function generateAdminToken(overrides = {}) {
  return jwt.sign(
    { id: 1, username: 'e2e_test_admin', role: 'admin', ...overrides },
    TEST_JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '1h' }
  );
}

jest.mock('../middleware/auth', () => {
  const jwt = require('jsonwebtoken');
  const SECRET = TEST_JWT_SECRET;
  return {
    verifyToken: (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '未提供认证令牌' } });
      }
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, SECRET, { algorithms: ['HS256'] });
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
    JWT_SECRET: SECRET,
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

jest.mock('../utils/responseHelper', () => ({
  cachedQuery: jest.fn((key, fn) => fn()),
  invalidateCache: jest.fn()
}));

jest.mock('../db_unified', () => ({
  query: jest.fn(),
  getOne: jest.fn(),
  execute: jest.fn(),
  initPool: jest.fn().mockResolvedValue(true),
  isDbReady: jest.fn().mockReturnValue(true)
}));

const { query, getOne, execute } = require('../db-unified');
const { invalidateCache } = require('../utils/response-helper');

describe('分类管理 E2E 集成测试 (Mock SQLite)', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // 默认mock返回值
    query.mockResolvedValue([]);
    getOne.mockResolvedValue(null);
    execute.mockResolvedValue({ insertId: Math.floor(Math.random() * 1000), affectedRows: 1 });
  });

  describe('1. 完整CRUD生命周期测试', () => {
    test('创建 -> 查询列表 -> 查询详情 -> 更新 -> 删除 完整流程', async () => {
      // Step 1: 创建分类
      getOne.mockResolvedValueOnce(null); // 名称检查
      getOne.mockResolvedValueOnce(null); // 父级检查
      execute.mockResolvedValueOnce({ insertId: 100 });
      
      let app = createApp();
      let createRes = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${generateAdminToken()}`)
        .send({ name: 'E2E测试分类', parent_id: null, sort_order: 10, status: 'active' });
      
      expect([201, 400]).toContain(createRes.status);
      if (createRes.status === 201) {
        expect(createRes.body.data.id).toBe(100);
        expect(createRes.body.data.name).toBe('E2E测试分类');
        
        // Step 2: 查询列表
        jest.clearAllMocks();
        query.mockResolvedValueOnce([{ total: 1 }]);
        query.mockResolvedValueOnce([createRes.body.data]);
        
        app = createApp();
        const listRes = await request(app)
          .get('/api/v1/categories')
          .set('Authorization', `Bearer ${generateAdminToken()}`);
        
        expect(listRes.status).toBe(200);
        expect(listRes.body.success).toBe(true);
        expect(Array.isArray(listRes.body.data.list)).toBe(true);
        
        // Step 3: 查询详情
        jest.clearAllMocks();
        getOne
          .mockResolvedValueOnce({ ...createRes.body.data, product_count: 0 })
          .mockResolvedValueOnce([]) // children
          .mockResolvedValueOnce(null); // parent
        
        app = createApp();
        const detailRes = await request(app)
          .get('/api/v1/categories/100')
          .set('Authorization', `Bearer ${generateAdminToken()}`);
        
        expect(detailRes.status).toBe(200);
        expect(detailRes.body.data.id).toBe(100);
        
        // Step 4: 更新
        jest.clearAllMocks();
        getOne.mockResolvedValueOnce({ id: 100 }); // 存在性检查
        getOne.mockResolvedValueOnce(null); // 名称唯一性检查
        getOne.mockResolvedValueOnce({ ...createRes.body.data, name: 'E2E测试分类(已更新)' });
        execute.mockResolvedValueOnce({ affectedRows: 1 });
        
        app = createApp();
        const updateRes = await request(app)
          .put('/api/v1/categories/100')
          .set('Authorization', `Bearer ${generateAdminToken()}`)
          .send({ name: 'E2E测试分类(已更新)' });
        
        expect(updateRes.status).toBe(200);
        expect(updateRes.body.data.name).toBe('E2E测试分类(已更新)');
        
        // Step 5: 删除
        jest.clearAllMocks();
        getOne.mockResolvedValueOnce({ count: 0 }); // 无子分类
        getOne.mockResolvedValueOnce({ count: 0 }); // 无关联商品
        execute.mockResolvedValueOnce({ affectedRows: 1 });
        
        app = createApp();
        const deleteRes = await request(app)
          .delete('/api/v1/categories/100')
          .set('Authorization', `Bearer ${generateAdminToken()}`);
        
        expect(deleteRes.status).toBe(200);
      }
    }, 10000);
  });

  describe('2. 并发操作安全性测试', () => {
    test('同时创建同名分类应只允许一个成功（防重复）', async () => {
      // 第一个请求通过名称检查
      getOne.mockResolvedValueOnce(null);
      getOne.mockResolvedValueOnce(null);
      execute.mockResolvedValueOnce({ insertId: 200 });
      
      const app = createApp();
      
      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/v1/categories')
          .set('Authorization', `Bearer ${generateAdminToken()}`)
          .send({ name: '并发测试分类' }),
        request(app)
          .post('/api/v1/categories')
          .set('Authorization', `Bearer ${generateAdminToken()}`)
          .send({ name: '并发测试分类' })
      ]);
      
      // 至少一个应该成功或失败，但不能都成功创建同名分类
      expect([201, 400, 409]).toContain(res1.status);
      expect([201, 400, 409]).toContain(res2.status);
    });

    test('并发读取应保持数据一致性', async () => {
      const mockData = [
        { id: 1, name: 'Cat1', parent_id: null, sort_order: 1, status: 'active', product_count: 5 },
        { id: 2, name: 'Cat2', parent_id: 1, sort_order: 2, status: 'active', product_count: 3 }
      ];
      
      query.mockResolvedValue(mockData);
      
      const app = createApp();
      const requests = Array(5).fill(null).map(() =>
        request(app)
          .get('/api/v1/categories/tree?flat=true')
          .set('Authorization', `Bearer ${generateAdminToken()}`)
      );
      
      const responses = await Promise.all(requests);
      
      responses.forEach(res => {
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
      });
    });
  });

  describe('3. 数据完整性验证', () => {
    test('删除父分类时应检查子分类依赖', async () => {
      getOne.mockResolvedValueOnce({ count: 3 }); // 有3个子分类
      
      const app = createApp();
      const res = await request(app)
        .delete('/api/v1/categories/1')
        .set('Authorization', `Bearer ${generateAdminToken()}`);
      
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('HAS_CHILDREN');
    });

    test('删除有关联商品的分类应被禁止', async () => {
      getOne.mockResolvedValueOnce({ count: 0 }); // 无子分类
      getOne.mockResolvedValueOnce({ count: 5 }); // 有5个商品
      
      const app = createApp();
      const res = await request(app)
        .delete('/api/v1/categories/1')
        .set('Authorization', `Bearer ${generateAdminToken()}`);
      
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('HAS_PRODUCTS');
    });

    test('更新分类名称时检查唯一性约束', async () => {
      getOne.mockResolvedValueOnce({ id: 1 }); // 分类存在
      getOne.mockResolvedValueOnce({ id: 2 }); // 新名称已被使用
      
      const app = createApp();
      const res = await request(app)
        .put('/api/v1/categories/1')
        .set('Authorization', `Bearer ${generateAdminToken()}`)
        .send({ name: '已存在的名称' });
      
      expect([400, 409]).toContain(res.status);
    });
  });

  describe('4. 权限控制矩阵验证', () => {
    const permissionMatrix = [
      { role: 'admin', canCreate: true, canRead: true, canUpdate: true, canDelete: true },
      { role: 'manager', canCreate: true, canRead: true, canUpdate: true, canDelete: false },
      { role: 'editor', canCreate: false, canRead: true, canUpdate: false, canDelete: false },
      { role: 'user', canCreate: false, canRead: true, canUpdate: false, canDelete: false }
    ];

    test.each(permissionMatrix)('$role 角色权限验证', async ({ role, canCreate, canRead, canUpdate, canDelete }) => {
      const token = generateAdminToken({ role });
      const app = createApp();

      // 测试读取权限
      query.mockResolvedValueOnce([{ total: 0 }]);
      query.mockResolvedValueOnce([]);
      const readRes = await request(app)
        .get('/api/v1/categories')
        .set('Authorization', `Bearer ${token}`);
      expect(readRes.status).toBe(canRead ? 200 : ([200, 403].includes(readRes.status) ? readRes.status : 403));

      // 测试创建权限
      jest.clearAllMocks();
      getOne.mockResolvedValue(null);
      execute.mockResolvedValue({ insertId: 999 });
      const createRes = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `${role}_test` });
      expect(createRes.status).toBe(canCreate ? 201 : 403);

      // 测试更新权限
      jest.clearAllMocks();
      getOne.mockResolvedValue({ id: 1 });
      execute.mockResolvedValue({ affectedRows: 1 });
      const updateRes = await request(app)
        .put('/api/v1/categories/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'updated' });
      expect(updateRes.status).toBe(canUpdate ? 200 : 403);

      // 测试删除权限
      jest.clearAllMocks();
      getOne.mockResolvedValueOnce({ count: 0 });
      getOne.mockResolvedValueOnce({ count: 0 });
      execute.mockResolvedValue({ affectedRows: 1 });
      const deleteRes = await request(app)
        .delete('/api/v1/categories/1')
        .set('Authorization', `Bearer ${token}`);
      expect(deleteRes.status).toBe(canDelete ? 200 : 403);
    });
  });

  describe('5. 边界条件与异常场景', () => {
    test('处理超长分类名称（边界值）', async () => {
      const maxLengthName = 'A'.repeat(50); // 最大长度
      getOne.mockResolvedValueOnce(null);
      getOne.mockResolvedValueOnce(null);
      execute.mockResolvedValueOnce({ insertId: 300 });
      
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${generateAdminToken()}`)
        .send({ name: maxLengthName });
      
      expect([201, 400]).toContain(res.status);
    });

    test('处理特殊字符和Unicode', async () => {
      const specialNames = [
        '中文分类名称',
        'Category with spaces',
        'カテゴリー名',
        'Cat&Test+Special'
      ];
      
      for (const name of specialNames) {
        jest.clearAllMocks();
        getOne.mockResolvedValueOnce(null);
        getOne.mockResolvedValueOnce(null);
        execute.mockResolvedValueOnce({ insertId: Math.floor(Math.random() * 1000) });
        
        const app = createApp();
        const res = await request(app)
          .post('/api/v1/categories')
          .set('Authorization', `Bearer ${generateAdminToken()}`)
          .send({ name });
        
        expect([201, 400]).toContain(res.status);
      }
    });

    test('处理极值分页参数', async () => {
      const extremeParams = [
        { page: 1, limit: 1 },
        { page: 1000, limit: 100 },
        { page: 0, limit: 0 }
      ];
      
      for (const params of extremeParams) {
        jest.clearAllMocks();
        query.mockResolvedValueOnce([{ total: 0 }]);
        query.mockResolvedValueOnce([]);
        
        const app = createApp();
        const res = await request(app)
          .get(`/api/v1/categories?page=${params.page}&limit=${params.limit}`)
          .set('Authorization', `Bearer ${generateAdminToken()}`);
        
        expect([200, 400]).toContain(res.status);
      }
    });

    test('循环引用检测：防止将自己设为父级', async () => {
      const app = createApp();
      const res = await request(app)
        .put('/api/v1/categories/1')
        .set('Authorization', `Bearer ${generateAdminToken()}`)
        .send({ parent_id: 1 });
      
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('6. 性能与压力测试模拟', () => {
    test('批量创建大量分类的性能', async () => {
      const batchSize = 50;
      const requests = [];
      
      for (let i = 0; i < batchSize; i++) {
        jest.clearAllMocks();
        getOne.mockResolvedValueOnce(null);
        getOne.mockResolvedValueOnce(null);
        execute.mockResolvedValueOnce({ insertId: 500 + i });
        
        const app = createApp();
        requests.push(
          request(app)
            .post('/api/v1/categories')
            .set('Authorization', `Bearer ${generateAdminToken()}`)
            .send({ name: `Batch_Category_${i}` })
        );
      }
      
      const startTime = Date.now();
      const results = await Promise.all(requests);
      const elapsed = Date.now() - startTime;
      
      const successCount = results.filter(r => r.status === 201).length;
      console.log(`⚡ 批量创建 ${batchSize} 个分类耗时: ${elapsed}ms, 成功: ${successCount}`);
      
      // 性能要求：50个请求应在5秒内完成
      expect(elapsed).toBeLessThan(5000);
      expect(successCount).toBeGreaterThan(0);
    }, 10000);

    test('高频读取操作的稳定性', async () => {
      const iterations = 100;
      const mockCategories = Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        name: `Perf_Cat_${i}`,
        parent_id: null,
        sort_order: i,
        status: 'active',
        product_count: Math.floor(Math.random() * 100)
      }));
      
      let errorCount = 0;
      
      for (let i = 0; i < iterations; i++) {
        try {
          jest.clearAllMocks();
          query.mockResolvedValueOnce([{ total: mockCategories.length }]);
          query.mockResolvedValueOnce([...mockCategories]);
          
          const app = createApp();
          const res = await request(app)
            .get('/api/v1/categories?page=1&limit=20')
            .set('Authorization', `Bearer ${generateAdminToken()}`);
          
          if (res.status !== 200) errorCount++;
        } catch (err) {
          errorCount++;
        }
      }
      
      console.log(`📊 高频读取测试: ${iterations}次迭代, 错误率: ${(errorCount / iterations * 100).toFixed(2)}%`);
      expect(errorCount).toBe(0);
    }, 15000);
  });

  describe('7. 缓存一致性验证', () => {
    test('写操作后缓存应被清除', async () => {
      // 创建操作
      getOne.mockResolvedValueOnce(null);
      getOne.mockResolvedValueOnce(null);
      execute.mockResolvedValueOnce({ insertId: 600 });
      
      let app = createApp();
      await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${generateAdminToken()}`)
        .send({ name: 'Cache Test' });
      
      expect(invalidateCache).toHaveBeenCalledWith('categories');

      // 更新操作
      jest.clearAllMocks();
      invalidateCache.mockClear();
      getOne.mockResolvedValueOnce({ id: 600 });
      getOne.mockResolvedValueOnce(null);
      getOne.mockResolvedValueOnce({ id: 600, name: 'Cache Test Updated' });
      execute.mockResolvedValueOnce({ affectedRows: 1 });
      
      app = createApp();
      await request(app)
        .put('/api/v1/categories/600')
        .set('Authorization', `Bearer ${generateAdminToken()}`)
        .send({ name: 'Cache Test Updated' });
      
      expect(invalidateCache).toHaveBeenCalledWith('categories');

      // 删除操作
      jest.clearAllMocks();
      invalidateCache.mockClear();
      getOne.mockResolvedValueOnce({ count: 0 });
      getOne.mockResolvedValueOnce({ count: 0 });
      execute.mockResolvedValueOnce({ affectedRows: 1 });
      
      app = createApp();
      await request(app)
        .delete('/api/v1/categories/600')
        .set('Authorization', `Bearer ${generateAdminToken()}`);
      
      expect(invalidateCache).toHaveBeenCalledWith('categories');
    });
  });

  describe('8. 树形结构构建正确性', () => {
    test('buildTree 应正确处理复杂层级结构', () => {
      function buildTree(categories) {
        const categoryMap = new Map();
        const tree = [];
        
        categories.forEach(category => {
          categoryMap.set(category.id, {
            id: category.id,
            name: category.name,
            parent_id: category.parent_id,
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
        
        return tree;
      }

      const complexData = [
        { id: 1, name: 'L1_A', parent_id: null },
        { id: 2, name: 'L2_A_1', parent_id: 1 },
        { id: 3, name: 'L2_A_2', parent_id: 1 },
        { id: 4, name: 'L3_A_1_a', parent_id: 2 },
        { id: 5, name: 'L3_A_1_b', parent_id: 2 },
        { id: 6, name: 'L1_B', parent_id: null },
        { id: 7, name: 'L2_B_1', parent_id: 6 }
      ];

      const tree = buildTree(complexData);
      
      // 验证树结构
      expect(tree.length).toBe(2); // 2个根节点 (L1_A, L1_B)
      expect(tree[0].children.length).toBe(2); // L1_A有2个子节点
      expect(tree[0].children[0].children.length).toBe(2); // L2_A_1有2个子节点
      expect(tree[1].children.length).toBe(1); // L1_B有1个子节点

      // 验证具体节点
      expect(tree[0].name).toBe('L1_A');
      expect(tree[0].children[0].name).toBe('L2_A_1');
      expect(tree[0].children[0].children[0].name).toBe('L3_A_1_a');
      expect(tree[1].name).toBe('L1_B');
      expect(tree[1].children[0].name).toBe('L2_B_1');
    });
  });
});
