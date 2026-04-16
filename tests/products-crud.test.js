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
      admin: { products: ['create', 'read', 'update', 'delete'] },
      manager: { products: ['create', 'read', 'update'] },
      editor: { products: ['read'] },
      user: { products: ['read'] }
    };
    const perms = rolePermissions[req.user.role]?.[resource];
    if (!perms || !perms.includes(action)) {
      return res.status(403).json({ success: false, error: { code: 'INSUFFICIENT_PERMISSIONS', message: `无${resource}.${action}权限` } });
    }
    next();
  },
  getPermissions: jest.fn(() => ({})),
  hasPermission: jest.fn(() => false),
  ROLE_PERMISSIONS: {}
}));

const productsRouter = require('../routes/products');

jest.mock('../db_unified', () => ({
  query: jest.fn(),
  getOne: jest.fn(),
  execute: jest.fn(),
  initPool: jest.fn().mockResolvedValue(true),
  isDbReady: jest.fn().mockReturnValue(true)
}));

const { query, getOne, execute } = require('../db-unified');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/products', productsRouter);
  return app;
}

const TEST_SECRET = 'test-secret-for-jwt-testing-min-32-chars-long';

function generateToken(overrides = {}) {
  const payload = { id: 1, role: 'admin', username: 'testadmin', ...overrides };
  return jwt.sign(payload, TEST_SECRET, { expiresIn: '1h' });
}

const mockProduct = {
  id: 1,
  name: '测试商品',
  description: '这是一个测试商品描述',
  price: 99.99,
  stock: 100,
  category_id: 1,
  image: 'https://example.com/image.jpg',
  status: 'active',
  created_at: '2024-01-01 00:00:00',
  updated_at: null,
  category_name: '电子产品'
};

describe('商品管理 CRUD 完整性测试', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. POST / - 商品创建流程验证', () => {
    test('1.1 创建成功应返回201和包含自增ID的完整数据', async () => {
      execute.mockResolvedValueOnce({ insertId: 100 });
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '新商品', price: 99.99, stock: 50, category_id: 1, description: '商品描述', status: 'active' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(100);
      expect(res.body.data.name).toBe('新商品');
      expect(res.body.data.price).toBe(99.99);
      expect(res.body.data.stock).toBe(50);
      expect(res.body.data.category_id).toBe(1);
      expect(res.body.data.description).toBeDefined();
      expect(res.body.data.status).toBeDefined();
    });

    test('1.2 缺少name字段应返回400错误', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ price: 99.99 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MISSING_FIELDS');
    });

    test('1.3 缺少price字段应返回400错误', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '测试商品' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MISSING_FIELDS');
    });

    test('1.4 价格为0（低于最小值0.01）应返回400', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '测试商品', price: 0 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_RANGE');
    });

    test('1.5 价格为负数应返回400', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '测试商品', price: -10 });

      expect(res.status).toBe(400);
    });

    test('1.6 价格超过最大值999999.99应返回400', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '测试商品', price: 1000000 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_RANGE');
    });

    test('1.7 商品名称长度不足2字符应返回400', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: 'A', price: 99.99 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_LENGTH');
    });

    test('1.8 商品名称超过100字符应返回400', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: 'A'.repeat(101), price: 99.99 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_LENGTH');
    });

    test('1.9 库存为负数应返回400', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '测试商品', price: 99.99, stock: -5 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_RANGE');
    });

    test('1.10 库存为小数（非整数）应返回400', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '测试商品', price: 99.99, stock: 10.5 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_TYPE');
    });

    test('1.11 库存为0（有效值）应创建成功', async () => {
      execute.mockResolvedValueOnce({ insertId: 101 });
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '零库存商品', price: 99.99, stock: 0 });

      expect(res.status).toBe(201);
      expect(res.body.data.stock).toBe(0);
    });

    test('1.12 不传stock字段时应默认为0', async () => {
      execute.mockResolvedValueOnce({ insertId: 102 });
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '默认库存商品', price: 99.99 });

      expect(res.status).toBe(201);
      expect(res.body.data.stock).toBe(0);
    });

    test('1.13 无效的category_id格式应返回400', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '测试商品', price: 99.99, category_id: 'invalid' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_ID');
    });

    test('1.14 category_id为null时应允许（未分类）', async () => {
      execute.mockResolvedValueOnce({ insertId: 103 });
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '未分类商品', price: 99.99, category_id: null });

      expect(res.status).toBe(201);
      expect(res.body.data.category_id).toBeNull();
    });

    test('1.15 status值不在允许范围内应返回400', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '测试商品', price: 99.99, status: 'invalid_status' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_ENUM');
    });

    test('1.16 不传status字段时应默认为active', async () => {
      execute.mockResolvedValueOnce({ insertId: 104 });
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '默认状态商品', price: 99.99 });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('active');
    });

    test('1.17 XSS攻击字符串在name中应被转义', async () => {
      execute.mockResolvedValueOnce({ insertId: 105 });
      const app = createApp();
      const xssPayload = '<script>alert("xss")</script>';
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: xssPayload, price: 99.99 });

      expect(res.status).toBe(201);
      expect(res.body.data.name).not.toContain('<script>');
      expect(res.body.data.name).toContain('&lt;script&gt;');
    });

    test('1.18 SQL注入尝试应被防御', async () => {
      execute.mockResolvedValueOnce({ insertId: 106 });
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: "'; DROP TABLE products; --", price: 99.99 });

      expect([201, 400]).toContain(res.status);
    });

    test('1.19 非管理员角色无法创建商品', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${generateToken({ role: 'editor' })}`)
        .send({ name: '测试商品', price: 99.99 });

      expect(res.status).toBe(403);
    });

    test('1.20 未认证请求应返回401', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/products')
        .send({ name: '测试商品', price: 99.99 });

      expect(res.status).toBe(401);
    });
  });

  describe('2. PUT /:id - 商品更新流程验证', () => {
    test('2.1 更新成功应返回200和更新后的数据', async () => {
      execute.mockResolvedValueOnce({ affectedRows: 1 });
      const app = createApp();
      const res = await request(app)
        .put('/api/v1/products/1')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '更新后的名称', price: 199.99 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('更新后的名称');
      expect(res.body.data.price).toBe(199.99);
    });

    test('2.2 支持部分更新（只更新name）', async () => {
      execute.mockResolvedValueOnce({ affectedRows: 1 });
      const app = createApp();
      const res = await request(app)
        .put('/api/v1/products/1')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '仅更新名称' });

      expect(res.status).toBe(200);
      expect(execute).toHaveBeenCalledWith(
        expect.stringContaining('name = ?'),
        expect.arrayContaining(['仅更新名称'])
      );
    });

    test('2.3 支持部分更新（只更新price）', async () => {
      execute.mockResolvedValueOnce({ affectedRows: 1 });
      const app = createApp();
      const res = await request(app)
        .put('/api/v1/products/1')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ price: 299.99 });

      expect(res.status).toBe(200);
    });

    test('2.4 updated_at应自动更新', async () => {
      execute.mockResolvedValueOnce({ affectedRows: 1 });
      const app = createApp();
      await request(app)
        .put('/api/v1/products/1')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '测试' });

      expect(execute).toHaveBeenCalledWith(
        expect.stringContaining('updated_at = NOW()'),
        expect.anything()
      );
    });

    test('2.5 商品不存在应返回404', async () => {
      execute.mockResolvedValueOnce({ affectedRows: 0 });
      const app = createApp();
      const res = await request(app)
        .put('/api/v1/products/99999')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '测试' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    test('2.6 无效ID格式应返回400', async () => {
      const app = createApp();
      const res = await request(app)
        .put('/api/v1/products/abc')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ name: '测试' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_ID');
    });

    test('2.7 没有提供任何更新字段应返回400', async () => {
      const app = createApp();
      const res = await request(app)
        .put('/api/v1/products/1')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('没有提供需要更新的字段');
    });

    test('2.8 更新时价格验证：负数价格应返回400', async () => {
      const app = createApp();
      const res = await request(app)
        .put('/api/v1/products/1')
        .set('Authorization', `Bearer ${generateToken()}`)
        .send({ price: -10 });

      expect(res.status).toBe(400);
    });

    test('2.9 更新时库存验证：小数应返回400', async () => {
      const app = createApp();
      const res = await request(app)
        .put('/api/v1/products/1')
        .set('Authorization', `Bear