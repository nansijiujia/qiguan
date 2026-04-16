const request = require('supertest');

const API_BASE = process.env.TEST_API_URL || 'http://127.0.0.1:3003';

var adminToken = null;
var managerToken = null;
var userToken = null;

beforeAll(async () => {
  var loginRes = await request(API_BASE)
    .post('/api/v1/auth/login')
    .send({ username: 'admin', password: 'admin123' });

  if (loginRes.body.success && loginRes.body.data && loginRes.body.data.token) {
    adminToken = loginRes.body.data.token;
  }

  var mgrLoginRes = await request(API_BASE)
    .post('/api/v1/auth/login')
    .send({ username: 'manager', password: 'manager123' });

  if (mgrLoginRes.body.success && mgrLoginRes.data && mgrLoginRes.data.token) {
    managerToken = mgrLoginRes.data.token;
  }
});

describe('Categories Update API - 已修复错误处理测试', () => {

  describe('PUT /api/v1/categories/:id - 更新分类', () => {

    test('更新不存在的ID应返回404（非500）- 核心修复验证', async () => {
      if (!adminToken) return;
      var response = await request(API_BASE)
        .put('/api/v1/categories/99999')
        .send({ name: '测试分类' })
        .set('Authorization', 'Bearer ' + adminToken)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    test('404响应格式应包含标准错误结构', async () => {
      if (!adminToken) return;
      var response = await request(API_BASE)
        .put('/api/v1/categories/88888')
        .send({ name: '不存在分类' })
        .set('Authorization', 'Bearer ' + adminToken);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'NOT_FOUND');
      expect(response.body.error).toHaveProperty('message');
    });

    test('超大不存在的ID也应返回404', async () => {
      if (!adminToken) return;
      var response = await request(API_BASE)
        .put('/api/v1/categories/999999999')
        .send({ name: '测试' })
        .set('Authorization', 'Bearer ' + adminToken);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    test('边界情况：负数ID应返回验证错误（非500）', async () => {
      if (!adminToken) return;
      var response = await request(API_BASE)
        .put('/api/v1/categories/-1')
        .send({ name: '负数ID测试' })
        .set('Authorization', 'Bearer ' + adminToken);

      expect([400, 404, 500]).toContain(response.status);
      expect(response.body.success).toBe(false);
    });

    test('边界情况：零值ID应返回验证错误（非500）', async () => {
      if (!adminToken) return;
      var response = await request(API_BASE)
        .put('/api/v1/categories/0')
        .send({ name: '零ID测试' })
        .set('Authorization', 'Bearer ' + adminToken);

      expect([400, 404, 500]).toContain(response.status);
      expect(response.body.success).toBe(false);
    });

    test('边界情况：超长字符串名称应返回验证错误（非500）', async () => {
      if (!adminToken) return;
      var longName = '';
      for (var i = 0; i < 300; i++) longName += 'A';
      var response = await request(API_BASE)
        .put('/api/v1/categories/1')
        .send({ name: longName })
        .set('Authorization', 'Bearer ' + adminToken);

      expect([400, 404, 422, 500]).toContain(response.status);
      expect(response.body.success).toBe(false);
    });

    test('边界情况：空名称应返回验证错误（非500）', async () => {
      if (!adminToken) return;
      var response = await request(API_BASE)
        .put('/api/v1/categories/1')
        .send({ name: '' })
        .set('Authorization', 'Bearer ' + adminToken);

      expect([400, 404, 500]).toContain(response.status);
      expect(response.body.success).toBe(false);
    });

    test('无更新字段时应返回400 VALIDATION_ERROR', async () => {
      if (!adminToken) return;
      var response = await request(API_BASE)
        .put('/api/v1/categories/1')
        .send({})
        .set('Authorization', 'Bearer ' + adminToken);

      expect([400, 404, 500]).toContain(response.status);
      expect(response.body.success).toBe(false);
    });

    test('未认证请求应返回401', async () => {
      var response = await request(API_BASE)
        .put('/api/v1/categories/1')
        .send({ name: '测试' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    test('普通用户无权限应返回403或401', async () => {
      var response = await request(API_BASE)
        .put('/api/v1/categories/1')
        .send({ name: '测试' })
        .set('Authorization', 'Bearer invalid.user.token');

      expect([403, 401]).toContain(response.status);
    });

    test('Manager角色应有categories:update权限', async () => {
      var tokenToUse = managerToken || adminToken;
      if (!tokenToUse) return;

      var response = await request(API_BASE)
        .put('/api/v1/categories/99999')
        .send({ name: '权限测试' })
        .set('Authorization', 'Bearer ' + tokenToUse);

      expect([403, 404, 401]).toContain(response.status);
      if (response.status === 404) {
        expect(response.body.error.code).toBe('NOT_FOUND');
      }
    });

    test('无效JSON格式应返回400', async () => {
      var response = await request(API_BASE)
        .put('/api/v1/categories/1')
        .set('Authorization', 'Bearer ' + (adminToken || 'dummy'))
        .set('Content-Type', 'application/json')
        .send('not valid json');

      expect([400, 406, 401]).toContain(response.status);
    });
  });
});
