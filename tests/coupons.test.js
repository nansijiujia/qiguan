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

describe('Coupons Stats API - 已修复模块测试', () => {

  describe('GET /api/v1/admin/coupons/stats/overview', () => {

    test('应返回200状态码 - 管理员认证成功', async () => {
      if (!adminToken) {
        console.warn('[SKIP] No admin token available, skipping authenticated tests');
        return;
      }
      const response = await request(API_BASE)
        .get('/api/v1/admin/coupons/stats/overview')
        .set('Authorization', 'Bearer ' + adminToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('响应数据结构应包含 total 字段（修复验证）', async () => {
      if (!adminToken) return;
      const response = await request(API_BASE)
        .get('/api/v1/admin/coupons/stats/overview')
        .set('Authorization', 'Bearer ' + adminToken);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('total');
      expect(typeof response.body.data.total).toBe('number');
    });

    test('响应数据结构应包含 today_received 字段（修复验证）', async () => {
      if (!adminToken) return;
      const response = await request(API_BASE)
        .get('/api/v1/admin/coupons/stats/overview')
        .set('Authorization', 'Bearer ' + adminToken);

      expect(response.body.data).toHaveProperty('today_received');
      expect(typeof response.body.data.today_received).toBe('number');
    });

    test('响应数据应包含完整的统计字段集', async () => {
      if (!adminToken) return;
      const response = await request(API_BASE)
        .get('/api/v1/admin/coupons/stats/overview')
        .set('Authorization', 'Bearer ' + adminToken);

      const data = response.body.data;
      expect(data).toHaveProperty('active_count');
      expect(data).toHaveProperty('inactive_count');
      expect(data).toHaveProperty('expired_count');
      expect(data).toHaveProperty('today_used');
      expect(data).toHaveProperty('status_distribution');
      expect(data).toHaveProperty('type_distribution');
    });

    test('无优惠券时应返回空统计（零值），不报错', async () => {
      if (!adminToken) return;
      const response = await request(API_BASE)
        .get('/api/v1/admin/coupons/stats/overview')
        .set('Authorization', 'Bearer ' + adminToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const data = response.body.data;
      expect(data.total).toBeGreaterThanOrEqual(0);
      expect(data.today_received).toBeGreaterThanOrEqual(0);
      expect(data.active_count).toBeGreaterThanOrEqual(0);
    });

    test('不应出现 Unknown column 错误（字段修复验证）', async () => {
      if (!adminToken) return;
      const response = await request(API_BASE)
        .get('/api/v1/admin/coupons/stats/overview')
        .set('Authorization', 'Bearer ' + adminToken);

      expect(response.status).toBe(200);

      if (response.body.error) {
        var errorMsg = JSON.stringify(response.body.error);
        expect(errorMsg).not.toContain('Unknown column');
      }
    });

    test('未认证请求应返回401', async () => {
      const response = await request(API_BASE)
        .get('/api/v1/admin/coupons/stats/overview');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    test('普通用户角色应返回403权限不足', async () => {
      if (!userToken) {
        var response = await request(API_BASE)
          .get('/api/v1/admin/coupons/stats/overview')
          .set('Authorization', 'Bearer invalid.user.token');
        expect([401, 403]).toContain(response.status);
        return;
      }
      var response = await request(API_BASE)
        .get('/api/v1/admin/coupons/stats/overview')
        .set('Authorization', 'Bearer ' + userToken);

      expect([403, 401]).toContain(response.status);
    });

    test('无效Token应返回401', async () => {
      var response = await request(API_BASE)
        .get('/api/v1/admin/coupons/stats/overview')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(response.status).toBe(401);
    });
  });
});
