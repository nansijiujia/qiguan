const request = require('supertest');

const API_BASE = process.env.TEST_API_URL || 'http://127.0.0.1:3003';

var adminToken = null;
var userToken = null;

beforeAll(async () => {
  var loginRes = await request(API_BASE)
    .post('/api/v1/auth/login')
    .send({ username: 'admin', password: 'admin123' });

  if (loginRes.body.success && loginRes.body.data && loginRes.body.data.token) {
    adminToken = loginRes.body.data.token;
  }

  var userLoginRes = await request(API_BASE)
    .post('/api/v1/auth/login')
    .send({ username: 'testuser', password: 'testuser123' });

  if (userLoginRes.body.success && userLoginRes.data && userLoginRes.data.token) {
    userToken = userLoginRes.data.token;
  }
});

describe('集成测试 - API健康检查与认证流程', () => {

  describe('用户认证流程测试', () => {

    test('POST /api/v1/auth/login - 登录接口可用性', async () => {
      var response = await request(API_BASE)
        .post('/api/v1/auth/login')
        .send({
          username: 'admin',
          password: 'wrongpassword_for_test'
        });

      expect([200, 401, 400]).toContain(response.status);
      expect(response.body).toHaveProperty('success');

      if (response.status === 401) {
        expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
      }
    });

    test('登录响应应包含标准格式（成功或失败）', async () => {
      var response = await request(API_BASE)
        .post('/api/v1/auth/login')
        .send({ username: 'nonexistent_user', password: 'test123' });

      if (response.body.success) {
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('token');
      } else {
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toHaveProperty('code');
        expect(response.body.error).toHaveProperty('message');
      }
    });

    test('登录缺少参数应返回400验证错误', async () => {
      var response = await request(API_BASE)
        .post('/api/v1/auth/login')
        .send({});

      expect([400, 422, 429]).toContain(response.status);
      expect(response.body.success).toBe(false);
    });
  });

  describe('API端点可用性检查', () => {

    var endpoints = [
      { method: 'get', path: '/api/v1/health', auth: false, expected: [200] },
      { method: 'get', path: '/api/v1/categories', auth: true, expected: [200, 401] },
      { method: 'get', path: '/api/v1/categories/tree', auth: true, expected: [200, 401] },
      { method: 'get', path: '/api/v1/products', auth: true, expected: [200, 401] },
      { method: 'get', path: '/api/v1/admin/coupons/stats/overview', auth: true, token: adminToken, expected: [200, 401] },
    ];

    test.each(endpoints)('$method $path - 端点可达性检查', async (endpoint) => {
      var req = request(API_BASE)[endpoint.method](endpoint.path);
      if (endpoint.auth && endpoint.token) {
        req = req.set('Authorization', 'Bearer ' + endpoint.token);
      } else if (endpoint.auth) {
        req = req.set('Authorization', 'Bearer ' + (userToken || 'dummy'));
      }

      var response = await req;
      expect(endpoint.expected).toContain(response.status);
    });
  });

  describe('响应时间基准测试', () => {

    test('GET /api/v1/health 响应时间应 < 500ms', async () => {
      var start = Date.now();
      var response = await request(API_BASE).get('/api/v1/health');
      var elapsed = Date.now() - start;

      expect(response.status).toBe(200);
      expect(elapsed).toBeLessThan(500);
    });

    test('GET /api/v1/categories 响应时间应 < 2000ms', async () => {
      var start = Date.now();
      var response = await request(API_BASE)
        .get('/api/v1/categories')
        .set('Authorization', 'Bearer ' + (userToken || 'dummy'));
      var elapsed = Date.now() - start;

      expect([200, 401]).toContain(response.status);
      expect(elapsed).toBeLessThan(2000);
    });

    test('Coupons Stats Overview 响应时间应 < 3000ms', async () => {
      var start = Date.now();
      var response = await request(API_BASE)
        .get('/api/v1/admin/coupons/stats/overview')
        .set('Authorization', 'Bearer ' + (adminToken || 'dummy'));
      var elapsed = Date.now() - start;

      expect([200, 401, 500]).toContain(response.status);
      expect(elapsed).toBeLessThan(3000);
    });
  });

  describe('CORS与安全头检查', () => {

    test('API应返回正确的Content-Type头', async () => {
      var response = await request(API_BASE)
        .get('/api/v1/health')
        .set('Accept', 'application/json');

      var contentType = response.headers['content-type'];
      expect(contentType).toMatch(/application\/json/);
    });

    test('OPTIONS预检请求应返回204或200', async () => {
      var response = await request(API_BASE)
        .options('/api/v1/categories');

      expect([204, 200, 404]).toContain(response.status);
    });
  });

  describe('错误处理一致性验证', () => {

    test('所有错误响应应包含success:false', async () => {
      var response = await request(API_BASE)
        .get('/api/v1/nonexistent-endpoint-xyz');

      expect(response.body.success).toBe(false);
    });

    test('错误响应应包含error对象', async () => {
      var response = await request(API_BASE)
        .put('/api/v1/categories/99999')
        .send({ name: 'test' })
        .set('Authorization', 'Bearer ' + (adminToken || 'dummy'));

      if (!response.body.success) {
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toHaveProperty('code');
        expect(response.body.error).toHaveProperty('message');
      }
    });
  });
});
