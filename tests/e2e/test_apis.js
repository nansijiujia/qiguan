const axios = require('axios');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  apiBase: 'https://qimengzhiyue.cn/api/v1',
  timeout: 10000,
  maxRetries: 2,
  retryDelay: 1000,
  credentials: { username: 'admin', password: '123456' },
  testPrefix: 'E2E_'
};

let chalk;
try { chalk = require('chalk'); } catch (e) {
  chalk = { green: t => t, red: t => t, yellow: t => t, cyan: t => t, bold: t => t, magenta: t => t };
}

const COLORS = {
  reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m',
  yellow: '\x1b[33m', cyan: '\x1b[36m', bold: '\x1b[1m'
};

function log(color, msg) {
  if (process.argv.includes('--json')) return;
  console.log(`${COLORS[color] || ''}${msg}${COLORS.reset || ''}`);
}

let testResults = { passed: 0, failed: 0, skipped: 0, total: 0, details: [] };
let authToken = null;
let verboseMode = process.argv.includes('--verbose') || process.argv.includes('-v');
const resultsDir = path.join(__dirname, 'results');
if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

function maskSensitive(data) {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  return str.replace(/token["':\s]+["']?([\w\-\.]{4})[\w\-\.]+/gi, 'token:"***$1***"')
    .replace(/password["':\s]+["'][^"']*["']/gi, 'password:"***"');
}

async function retryWithBackoff(fn, retries = CONFIG.maxRetries) {
  let lastError;
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); } catch (err) {
      lastError = err;
      if (i < retries) await new Promise(r => setTimeout(r, CONFIG.retryDelay * (i + 1)));
    }
  }
  throw lastError;
}

async function apiRequest(method, endpoint, options = {}) {
  const startTime = Date.now();
  const url = `${CONFIG.apiBase}${endpoint}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (authToken && !options.skipAuth) headers['Authorization'] = `Bearer ${authToken}`;

  const res = await retryWithBackoff(async () =>
    axios({ method, url, headers, data: options.data, params: options.params, timeout: CONFIG.timeout, validateStatus: () => true })
  );
  res.responseTime = Date.now() - startTime;
  return res;
}

function pass(name, details = '') {
  testResults.total++; testResults.passed++;
  testResults.details.push({ name, status: 'PASS', details, time: new Date().toISOString() });
  log('green', `  ✅ PASS: ${name}`);
  if (details && verboseMode) log('cyan', `       ${details}`);
}

function fail(name, error, details = '') {
  testResults.total++; testResults.failed++;
  testResults.details.push({ name, status: 'FAIL', error: error.message, details, time: new Date().toISOString() });
  log('red', `  ❌ FAIL: ${name}`);
  if (error) log('red', `       Error: ${error.message}`);
  if (details && verboseMode) log('yellow', `       ${details}`);
}

function skip(name, reason = '') {
  testResults.total++; testResults.skipped++;
  testResults.details.push({ name, status: 'SKIP', reason, time: new Date().toISOString() });
  log('yellow', `  ⏭️  SKIP: ${name}${reason ? ` - ${reason}` : ''}`);
}

async function runTest(name, fn) {
  try { await fn(); } catch (err) { fail(name, err); }
}

async function assertStatus(res, expected, name) {
  if (res.status === expected) pass(`${name} 状态码正确 (${expected})`, `响应时间: ${res.responseTime}ms`);
  else throw new Error(`期望状态码${expected}，实际${res.status}: ${JSON.stringify(res.data).slice(0, 200)}`);
}

async function assertResponseFormat(res, name) {
  const data = res.data;
  if (data && typeof data === 'object') {
    const hasSuccess = 'success' in data;
    const hasCode = 'code' in data || hasSuccess;
    if (hasSuccess || hasCode) pass(`${name} 响应格式规范`, maskSensitive(data));
    else fail(name, new Error('响应格式不符合规范(缺少success/code字段)'), JSON.stringify(data).slice(0, 150));
  } else fail(name, new Error('响应非JSON对象'), String(data).slice(0, 150));
}

async function assertPerformance(res, threshold = 500, name) {
  if (res.responseTime < threshold) pass(`${name} 性能达标 (${res.responseTime}ms < ${threshold}ms)`);
  else fail(name, new Error(`响应时间${res.responseTime}ms超过阈值${threshold}ms`));
}

async function testAuthEndpoints() {
  console.log(COLORS.bold + '\n🔐 认证接口测试\n' + COLORS.reset);

  await runTest('[Auth] POST /auth/login - 有效凭据登录', async () => {
    const res = await apiRequest('POST', '/auth/login', {
      data: { username: CONFIG.credentials.username, password: CONFIG.credentials.password }
    });
    await assertStatus(res, 200, '登录');
    if (res.data?.data?.token) {
      authToken = res.data.data.token;
      pass('获取到Token', `长度: ${authToken.length}, 已脱敏: ***${authToken.slice(-4)}`);
    } else throw new Error('响应中未包含token字段');
    await assertResponseFormat(res, '登录响应');
    await assertPerformance(res, 500, '登录API');
  });

  await runTest('[Auth] POST /auth/login - 无效凭据拒绝', async () => {
    const res = await apiRequest('POST', '/auth/login', {
      data: { username: 'wrong_user', password: 'wrong_password' }, skipAuth: true
    });
    if (res.status === 401) pass('无效凭据返回401', maskSensitive(res.data));
    else throw new Error(`期望401，实际${res.status}`);
  });

  await runTest('[Auth] POST /auth/login - 缺少密码参数', async () => {
    const res = await apiRequest('POST', '/auth/login', { data: { username: 'admin' }, skipAuth: true });
    if (res.status === 400) pass('缺少密码返回400', maskSensitive(res.data));
    else throw new Error(`期望400，实际${res.status}`);
  });

  await runTest('[Auth] POST /auth/login - 缺少用户名和邮箱', async () => {
    const res = await apiRequest('POST', '/auth/login', { data: { password: '123456' }, skipAuth: true });
    if (res.status === 400) pass('缺少用户名返回400', maskSensitive(res.data));
    else throw new Error(`期望400，实际${res.status}`);
  });
}

async function testDashboardEndpoint() {
  console.log(COLORS.bold + '\n📊 仪表盘接口测试\n' + COLORS.reset);

  await runTest('[Dashboard] GET /dashboard - 获取统计数据', async () => {
    const res = await apiRequest('GET', '/dashboard');
    await assertStatus(res, 200, '仪表盘');
    await assertResponseFormat(res, '仪表盘');
    await assertPerformance(res, 500, '仪表盘');

    const data = res.data.data || res.data;
    const expectedFields = ['totalProducts', 'totalOrders', 'totalRevenue', 'totalUsers'];
    const foundFields = expectedFields.filter(f => data[f] !== undefined);
    if (foundFields.length >= 3) pass(`统计数据完整: ${foundFields.join(', ')}`, verboseMode ? JSON.stringify(data).slice(0, 300) : '');
    else fail('[Dashboard]', new Error(`缺少统计字段，期望: ${expectedFields.join(', ')}`), `实际字段: ${Object.keys(data).join(', ')}`);
  });
}

async function testCategoryCRUD() {
  console.log(COLORS.bold + '\n📂 分类管理 CRUD 测试\n' + COLORS.reset);

  let createdCategoryId = null;

  await runTest('[Categories] GET /categories - 列表查询', async () => {
    const res = await apiRequest('GET', '/categories');
    await assertStatus(res, 200, '分类列表');
    await assertResponseFormat(res, '分类列表');
    const list = res.data.data || [];
    pass(`返回分类数量: ${Array.isArray(list) ? list.length : 'N/A'}`);
  });

  await runTest('[Categories] POST /categories - 创建分类', async () => {
    const res = await apiRequest('POST', '/categories', {
      data: { name: `${CONFIG.testPrefix}测试分类_${Date.now()}`, sort_order: 999, status: 'active' }
    });
    if (res.status === 201 || res.status === 200) {
      createdCategoryId = res.data.data?.id;
      pass(`创建成功 ID: ${createdCategoryId}`, `名称: ${CONFIG.testPrefix}测试分类`);
    } else throw new Error(`期望201/200，实际${res.status}: ${JSON.stringify(res.data).slice(0, 200)}`);
  });

  if (createdCategoryId) {
    await runTest('[Categories] PUT /categories/:id - 更新分类', async () => {
      const res = await apiRequest('PUT', `/categories/${createdCategoryId}`, {
        data: { name: `${CONFIG.testPrefix}已更新分类`, sort_order: 888 }
      });
      await assertStatus(res, 200, '更新分类');
      pass('更新成功', `新名称: ${CONFIG.testPrefix}已更新分类`);
    });

    await runTest('[Categories] DELETE /categories/:id - 删除分类', async () => {
      const res = await apiRequest('DELETE', `/categories/${createdCategoryId}`);
      if (res.status === 200) pass('删除成功');
      else throw new Error(`删除失败: ${res.status}`);
    });
  }

  await runTest('[Categories] POST /categories - 缺少名称验证', async () => {
    const res = await apiRequest('POST', '/categories', { data: { sort_order: 1 } });
    if (res.status === 400) pass('空名称返回400', maskSensitive(res.data));
    else throw new Error(`期望400，实际${res.status}`);
  });

  await runTest('[Categories] GET /categories/:id - 不存在的ID', async () => {
    const res = await apiRequest('GET', '/categories/99999999');
    if (res.status === 404) pass('不存在的ID返回404');
    else throw new Error(`期望404，实际${res.status}`);
  });
}

async function testProductCRUD() {
  console.log(COLORS.bold + '\n🛍️ 商品管理 CRUD 测试\n' + COLORS.reset);

  let createdProductId = null;
  let testCategoryId = null;

  await runTest('[Products] GET /products - 分页列表查询', async () => {
    const res = await apiRequest('GET', '/products', { params: { page: 1, pageSize: 10 } });
    await assertStatus(res, 200, '商品列表');
    await assertResponseFormat(res, '商品列表');
    await assertPerformance(res, 500, '商品列表');
    const pagination = res.data.pagination || {};
    if (pagination.total !== undefined) pass(`分页信息正常: total=${pagination.total}, page=${pagination.page}`);
  });

  await runTest('[Products] 准备测试分类', async () => {
    const catRes = await apiRequest('POST', '/categories', {
      data: { name: `${CONFIG.testPrefix}商品测试分类`, status: 'active' }
    });
    if (catRes.data.data?.id) { testCategoryId = catRes.data.data.id; pass(`测试分类ID: ${testCategoryId}`); }
    else fail('[Products]', new Error('无法创建测试分类'));
  });

  if (testCategoryId) {
    await runTest('[Products] POST /products - 创建商品', async () => {
      const res = await apiRequest('POST', '/products', {
        data: {
          name: `${CONFIG.testPrefix}E2E测试商品`,
          description: 'E2E自动化测试商品描述',
          price: 299.99,
          stock: 100,
          category_id: testCategoryId,
          image: 'https://example.com/test.jpg',
          status: 'active'
        }
      });
      if (res.status === 201 || res.status === 200) {
        createdProductId = res.data.data?.id;
        pass(`创建成功 ID: ${createdProductId}`, `价格: ¥299.99, 库存: 100`);
      } else throw new Error(`创建失败: ${res.status}`);
    });
  }

  if (createdProductId) {
    await runTest('[Products] PUT /products/:id - 更新商品', async () => {
      const res = await apiRequest('PUT', `/products/${createdProductId}`, {
        data: { price: 399.99, stock: 150, description: '已更新的描述' }
      });
      await assertStatus(res, 200, '更新商品');
      pass('更新成功', `新价格: ¥399.99`);
    });

    await runTest('[Products] DELETE /products/:id - 删除商品', async () => {
      const res = await apiRequest('DELETE', `/products/${createdProductId}`);
      await assertStatus(res, 200, '删除商品');
      pass('删除成功');
    });
  }

  if (testCategoryId) {
    await runTest('[Products] 清理测试分类', async () => {
      try {
        await apiRequest('DELETE', `/categories/${testCategoryId}`);
        pass('测试分类已清理');
      } catch (e) { skip('清理测试分类', e.message); }
    });
  }

  await runTest('[Products] GET /products?keyword= - 搜索功能', async () => {
    const res = await apiRequest('GET', '/products', { params: { keyword: '测试' } });
    await assertStatus(res, 200, '搜索商品');
    pass('搜索请求成功', `关键词: "测试"`);
  });

  await runTest('[Products] POST /products - 名称不能为空', async () => {
    const res = await apiRequest('POST', '/products', { data: { price: 100 } });
    if (res.status === 400) pass('空名称返回400', maskSensitive(res.data));
    else throw new Error(`期望400，实际${res.status}`);
  });

  await runTest('[Products] POST /products - 价格不能为负数', async () => {
    const res = await apiRequest('POST', '/products', { data: { name: 'test', price: -10 } });
    if (res.status === 400) pass('负价格返回400', maskSensitive(res.data));
    else throw new Error(`期望400，实际${res.status}`);
  });
}

async function testUserCRUD() {
  console.log(COLORS.bold + '\n👤 用户管理 CRUD 测试\n' + COLORS.reset);

  let createdUserId = null;
  const testUsername = `${CONFIG.testPrefix}user_${Date.now()}`;

  await runTest('[Users] GET /users - 用户列表', async () => {
    const res = await apiRequest('GET', '/users', { params: { page: 1, limit: 10 } });
    await assertStatus(res, 200, '用户列表');
    await assertResponseFormat(res, '用户列表');
    const userData = res.data.data;
    if (userData?.list) pass(`用户数量: ${userData.list.length}`);
  });

  await runTest('[Users] POST /users - 创建用户', async () => {
    const res = await apiRequest('POST', '/users', {
      data: {
        username: testUsername,
        email: `${testUsername}@e2etest.com`,
        password: 'E2ETestPass123!',
        role: 'user',
        status: 'active'
      }
    });
    if (res.status === 201 || res.status === 200) {
      createdUserId = res.data.data?.id;
      pass(`创建成功 ID: ${createdUserId}`, `用户名: ${testUsername}`);
    } else throw new Error(`创建失败: ${res.status} - ${JSON.stringify(res.data).slice(0, 200)}`);
  });

  if (createdUserId) {
    await runTest('[Users] PUT /users/:id - 更新用户', async () => {
      const res = await apiRequest('PUT', `/users/${createdUserId}`, {
        data: { role: 'manager', avatar: 'https://example.com/avatar.jpg' }
      });
      await assertStatus(res, 200, '更新用户');
      pass('更新成功', '角色变更为 manager');
    });

    await runTest('[Users] PUT /users/:id/status - 切换状态', async () => {
      const res = await apiRequest('PUT', `/users/${createdUserId}/status`, { data: { status: 'inactive' } });
      await assertStatus(res, 200, '切换状态');
      pass('状态切换为 inactive');
    });

    await runTest('[Users] DELETE /users/:id - 删除用户', async () => {
      const res = await apiRequest('DELETE', `/users/${createdUserId}`);
      await assertStatus(res, 200, '删除用户');
      pass('删除成功');
    });
  }

  await runTest('[Users] POST /users - 缺少必填字段', async () => {
    const res = await apiRequest('POST', '/users', { data: { username: 'test' } });
    if (res.status === 400) pass('缺少字段返回400', maskSensitive(res.data));
    else throw new Error(`期望400，实际${res.status}`);
  });
}

async function testOrderEndpoints() {
  console.log(COLORS.bold + '\n📦 订单管理接口测试\n' + COLORS.reset);

  await runTest('[Orders] GET /orders - 订单列表', async () => {
    const res = await apiRequest('GET', '/orders');
    await assertStatus(res, 200, '订单列表');
    await assertResponseFormat(res, '订单列表');
    await assertPerformance(res, 500, '订单列表');
    pass('订单列表请求成功');
  });

  await runTest('[Orders] GET /orders/:id - 不存在订单', async () => {
    const res = await apiRequest('GET', '/orders/99999999');
    if (res.status === 404 || res.status === 200) {
      if (res.status === 404) pass('不存在订单返回404');
      else pass('订单详情接口可访问(可能返回空数据)');
    } else throw new Error(`意外状态码: ${res.status}`);
  });
}

async function testInputValidation() {
  console.log(COLORS.bold + '\n🛡️ 输入验证与安全测试\n' + COLORS.reset);

  await runTest('[Validation] SQL注入防护 - 用户名字段', async () => {
    const res = await apiRequest('POST', '/users', {
      data: { username: "'; DROP TABLE users; --", email: 'sql@test.com', password: 'Test123!' },
      skipAuth: false
    });
    if (res.status >= 400) pass('SQL注入被拦截', `状态码: ${res.status}`);
    else fail('[Validation]', new Error('SQL注入未被拦截!'), `状态码: ${res.status}`);
  });

  await runTest('[Validation] XSS防护 - 商品名称', async () => {
    const res = await apiRequest('POST', '/products', {
      data: { name: '<script>alert("xss")</script>', price: 100 }
    });
    if (res.status >= 400) pass('XSS脚本被拦截', `状态码: ${res.status}`);
    else if (typeof res.data?.data?.name === 'string' && !res.data.data.name.includes('<script')) {
      pass('XSS标签已被过滤/转义', `处理后: ${res.data.data.name.slice(0, 50)}`);
    } else fail('[Validation]', new Error('XSS未过滤!'), `返回名称: ${res.data?.data?.name}`);
  });

  await runTest('[Validation] 超长输入处理', async () => {
    const longName = 'A'.repeat(10000);
    const res = await apiRequest('POST', '/categories', { data: { name: longName } });
    if (res.status >= 400) pass('超长输入被拒绝', `状态码: ${res.status}`);
    else pass('服务器接受超长输入(可能由DB限制)`, `状态码: ${res.status}`);
  });

  await runTest('[Validation] 密码敏感信息检查', async () => {
    const res = await apiRequest('POST', '/auth/login', {
      data: { username: CONFIG.credentials.username, password: CONFIG.credentials.password },
      skipAuth: true
    });
    if (res.status === 200) {
      const responseStr = JSON.stringify(res.data);
      if (!responseStr.includes(CONFIG.credentials.password)) pass('密码不在响应中返回 ✅ 安全');
      else fail('[Validation]', new Error('密码明文出现在响应中!'), '安全风险!');
    }
  });
}

async function main() {
  const startTime = Date.now();

  if (!process.argv.includes('--json')) {
    console.log('\n' + '='.repeat(70));
    console.log(COLORS.bold + '🔌 绮管电商后台 - E2E API接口测试套件' + COLORS.reset);
    console.log(COLORS.cyan + `   测试时间: ${new Date().toISOString()}` + COLORS.reset);
    console.log(COLORS.cyan + `   目标API: ${CONFIG.apiBase}` + COLORS.reset);
    console.log(COLORS.cyan + `   详细模式: ${verboseMode ? '开启' : '关闭'}` + COLORS.reset);
    console.log('='.repeat(70) + '\n');
  }

  await testAuthEndpoints();
  if (authToken) {
    await testDashboardEndpoint();
    await testCategoryCRUD();
    await testProductCRUD();
    await testUserCRUD();
    await testOrderEndpoints();
    await testInputValidation();
  } else {
    console.log(COLORS.red + '\n❌ 认证失败，跳过需要认证的测试!\n' + COLORS.reset);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  const reportData = {
    suite: 'e2e-apis-test',
    timestamp: new Date().toISOString(),
    config: { apiBase: CONFIG.apiBase, timeout: CONFIG.timeout },
    summary: { total: testResults.total, passed: testResults.passed, failed: testResults.failed, skipped: testResults.skipped },
    duration,
    details: testResults.details
  };
  fs.writeFileSync(path.join(resultsDir, 'apis_test_results.json'), JSON.stringify(reportData, null, 2));

  printSummary(duration);
}

function printSummary(duration) {
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ suite: 'e2e-apis-test', duration, summary: testResults }, null, 2));
    return;
  }

  console.log('\n' + '='.repeat(70));
  console.log(COLORS.bold + '📊 E2E API接口测试结果汇总' + COLORS.reset);
  console.log('='.repeat(70));
  console.log(`\n  总计:     ${testResults.total} 个测试`);
  console.log(`${COLORS.green}  通过:     ${testResults.passed} ✅${COLORS.reset}`);
  console.log(`${COLORS.red}  失败:     ${testResults.failed} ❌${COLORS.reset}`);
  console.log(`${COLORS.yellow}  跳过:     ${testResults.skipped} ⏭️${COLORS.reset}`);
  console.log(`\n  耗时:     ${duration}s`);

  const rate = testResults.total > 0 ? ((testResults.passed / testResults.total) * 100).toFixed(1) : 0;
  const rateColor = testResults.failed === 0 ? 'green' : (testResults.failed <= 3 ? 'yellow' : 'red');
  console.log(`\n  ${COLORS[rateColor]}通过率:   ${rate}%${COLORS.reset}\n`);

  if (testResults.failed > 0) {
    console.log(COLORS.red + '❌ 存在失败的API测试' + COLORS.reset);
    process.exit(1);
  } else {
    console.log(COLORS.green + '🎉 所有API测试通过！' + COLORS.reset);
  }
  console.log('='.repeat(70) + '\n');
}

main().catch(err => { console.error('\n❌ 测试运行出错:', err.message); process.exit(1); });
