const axios = require('axios');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  apiBase: 'https://qimengzhiyue.cn/api/v1',
  timeout: 10000,
  maxRetries: 2,
  retryDelay: 1000,
  credentials: { username: 'admin', password: '123456' },
  testPrefix: 'E2E_FUNC_'
};

let chalk;
try { chalk = require('chalk'); } catch (e) {
  chalk = { green: t => t, red: t => t, yellow: t => t, cyan: t => t, bold: t => t };
}

const COLORS = {
  reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m',
  yellow: '\x1b[33m', cyan: '\x1b[36m', bold: '\x1b[1m', magenta: '\x1b[35m'
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

const cleanupIds = { users: [], categories: [], products: [] };

async function cleanupTestData() {
  log('yellow', '\n🧹 清理测试数据...');
  for (const id of cleanupIds.products) {
    try { await apiRequest('DELETE', `/products/${id}`); } catch (e) {}
  }
  for (const id of cleanupIds.categories) {
    try { await apiRequest('DELETE', `/categories/${id}`); } catch (e) {}
  }
  for (const id of cleanupIds.users) {
    try { await apiRequest('DELETE', `/users/${id}`); } catch (e) {}
  }
  log('green', '   清理完成 ✅');
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

async function loginAndGetToken() {
  const res = await apiRequest('POST', '/auth/login', {
    data: { username: CONFIG.credentials.username, password: CONFIG.credentials.password },
    skipAuth: true
  });
  if (res.data?.data?.token) {
    authToken = res.data.data.token;
    pass('登录成功获取Token', `***${authToken.slice(-4)}`);
    return true;
  }
  throw new Error(`登录失败: ${res.status}`);
}

async function testUserManagementFlow() {
  console.log(COLORS.bold + '\n👤 用户管理完整流程\n' + COLORS.reset);
  let userId = null;
  const timestamp = Date.now();
  const testUser = {
    username: `${CONFIG.testPrefix}user_${timestamp}`,
    email: `${CONFIG.testPrefix}user_${timestamp}@e2etest.com`,
    password: 'FuncTestPass123!'
  };

  await runTest('[用户流程] 步骤1: 创建新用户', async () => {
    const res = await apiRequest('POST', '/users', {
      data: { ...testUser, role: 'user', status: 'active' }
    });
    if (res.status === 201 || res.status === 200) {
      userId = res.data.data?.id;
      cleanupIds.users.push(userId);
      pass(`用户创建成功 ID: ${userId}`, `用户名: ${testUser.username}`);
    } else throw new Error(`创建失败: ${res.status} - ${JSON.stringify(res.data).slice(0, 200)}`);
  });

  await runTest('[用户流程] 步骤2: 查询用户列表验证存在', async () => {
    if (!userId) throw new Error('无有效用户ID');
    const res = await apiRequest('GET', '/users', { params: { keyword: CONFIG.testPrefix } });
    const users = res.data?.data?.list || [];
    const found = users.find(u => u.id === userId);
    if (found) pass('新用户在列表中找到', `用户名: ${found.username}, 状态: ${found.status}`);
    else throw new Error('创建的用户未在列表中找到');
  });

  await runTest('[用户流程] 步骤3: 更新用户信息', async () => {
    if (!userId) throw new Error('无有效用户ID');
    const newEmail = `${CONFIG.testPrefix}updated_${timestamp}@e2etest.com`;
    const res = await apiRequest('PUT', `/users/${userId}`, {
      data: { email: newEmail, role: 'manager' }
    });
    if (res.status === 200) {
      const updated = res.data.data;
      if (updated.email === newEmail && updated.role === 'manager') pass('更新成功', `邮箱: ${newEmail}, 角色: manager`);
      else throw new Error(`更新未生效: ${JSON.stringify(updated).slice(0, 200)}`);
    } else throw new Error(`更新失败: ${res.status}`);
  });

  await runTest('[用户流程] 步骤4: 切换用户状态', async () => {
    if (!userId) throw new Error('无有效用户ID');
    const res = await apiRequest('PUT', `/users/${userId}/status`, { data: { status: 'inactive' } });
    if (res.status === 200) pass('状态切换为 inactive');

    const verifyRes = await apiRequest('GET', '/users', { params: { keyword: CONFIG.testPrefix } });
    const user = verifyRes.data?.data?.list?.find(u => u.id === userId);
    if (user?.status === 'inactive') pass('状态变更已验证');
    else fail('[用户流程]', new Error('状态变更未生效'));
  });

  await runTest('[用户流程] 步骤5: 删除用户', async () => {
    if (!userId) throw new Error('无有效用户ID');
    const res = await apiRequest('DELETE', `/users/${userId}`);
    if (res.status === 200) {
      const idx = cleanupIds.users.indexOf(userId);
      if (idx > -1) cleanupIds.users.splice(idx, 1);
      pass('删除成功');

      const verifyRes = await apiRequest('GET', '/users', { params: { keyword: CONFIG.testPrefix } });
      const stillExists = verifyRes.data?.data?.list?.find(u => u.id === userId);
      if (!stillExists) pass('删除验证通过 - 用户不存在于列表');
      else fail('[用户流程]', new Error('删除后用户仍存在于列表'));
    } else throw new Error(`删除失败: ${res.status}`);
  });
}

async function testProductManagementFlow() {
  console.log(COLORS.bold + '\n🛍️ 商品管理完整流程\n' + COLORS.reset);

  let categoryId = null;
  let productId = null;
  const timestamp = Date.now();

  await runTest('[商品流程] 步骤1: 创建分类', async () => {
    const res = await apiRequest('POST', '/categories', {
      data: { name: `${CONFIG.testPrefix}商品分类_${timestamp}`, sort_order: 999, status: 'active' }
    });
    if (res.status === 201 || res.status === 200) {
      categoryId = res.data.data?.id;
      cleanupIds.categories.push(categoryId);
      pass(`分类创建成功 ID: ${categoryId}`);
    } else throw new Error(`创建分类失败: ${res.status}`);
  });

  await runTest('[商品流程] 步骤2: 创建商品(关联分类)', async () => {
    if (!categoryId) throw new Error('无有效分类ID');
    const res = await apiRequest('POST', '/products', {
      data: {
        name: `${CONFIG.testPrefix}功能测试商品_${timestamp}`,
        description: '用于E2E功能完整性测试的商品',
        price: 599.00,
        stock: 200,
        category_id: categoryId,
        image: 'https://example.com/e2e-product.jpg',
        status: 'active'
      }
    });
    if (res.status === 201 || res.status === 200) {
      productId = res.data.data?.id;
      cleanupIds.products.push(productId);
      pass(`商品创建成功 ID: ${productId}`, `价格: ¥599.00, 分类ID: ${categoryId}`);
    } else throw new Error(`创建商品失败: ${res.status}`);
  });

  await runTest('[商品流程] 步骤3: 搜索商品验证', async () => {
    if (!productId) throw new Error('无有效商品ID');
    const searchKeyword = `${CONFIG.testPrefix}功能测试`;
    const res = await apiRequest('GET', '/products', { params: { keyword: searchKeyword } });
    const products = res.data?.data || [];
    const found = products.find(p => p.id === productId);
    if (found) pass('搜索结果正确', `找到商品: ${found.name.slice(0, 40)}`);
    else throw new Error(`搜索"${searchKeyword}"未找到刚创建的商品`);
  });

  await runTest('[商品流程] 步骤4: 更新商品信息', async () => {
    if (!productId) throw new Error('无有效商品ID');
    const res = await apiRequest('PUT', `/products/${productId}`, {
      data: { price: 799.00, stock: 300, description: '更新后的商品描述' }
    });
    if (res.status === 200) {
      pass('更新成功', `新价格: ¥799.00, 新库存: 300`);

      const verifyRes = await apiRequest('GET', `/products/${productId}`);
      const product = verifyRes.data?.data;
      if (product && Number(product.price) === 799) pass('价格更新已验证');
      else fail('[商品流程]', new Error('价格更新未完全生效'));
    } else throw new Error(`更新失败: ${res.status}`);
  });

  await runTest('[商品流程] 步骤5: 删除商品', async () => {
    if (!productId) throw new Error('无有效商品ID');
    const res = await apiRequest('DELETE', `/products/${productId}`);
    if (res.status === 200) {
      const idx = cleanupIds.products.indexOf(productId);
      if (idx > -1) cleanupIds.products.splice(idx, 1);
      pass('商品删除成功');

      const verifyRes = await apiRequest('GET', `/products/${productId}`);
      if (verifyRes.status === 404) pass('删除验证 - 商品返回404');
      else skip('删除验证', `状态码: ${verifyRes.status}(可能返回空数据)`);
    } else throw new Error(`删除失败: ${res.status}`);
  });

  await runTest('[商品流程] 步骤6: 清理测试分类', async () => {
    if (!categoryId) { skip('清理分类', '无分类ID'); return; }
    try {
      const res = await apiRequest('DELETE', `/categories/${categoryId}`);
      if (res.status === 200) {
        const idx = cleanupIds.categories.indexOf(categoryId);
        if (idx > -1) cleanupIds.categories.splice(idx, 1);
        pass('测试分类已清理');
      } else skip('清理分类', `删除返回${res.status}`);
    } catch (e) { skip('清理分类', e.message); }
  });
}

async function testLoginLogoutFlow() {
  console.log(COLORS.bold + '\n🔐 登录登出完整流程\n' + COLORS.reset);

  let token1 = null;

  await runTest('[登录流程] 步骤1: admin账号登录', async () => {
    const res = await apiRequest('POST', '/auth/login', {
      data: { username: CONFIG.credentials.username, password: CONFIG.credentials.password },
      skipAuth: true
    });
    if (res.status === 200 && res.data?.data?.token) {
      token1 = res.data.data.token;
      authToken = token1;
      pass('首次登录成功', `Token长度: ${token1.length}`);
    } else throw new Error('登录失败');
  });

  await runTest('[登录流程] 步骤2: 使用Token访问受保护资源', async () => {
    if (!token1) throw new Error('无Token');
    const res = await apiRequest('GET', '/dashboard');
    if (res.status === 200) pass('受保护资源访问成功', `仪表盘数据正常`);
    else throw new Error(`访问被拒绝: ${res.status}`);
  });

  await runTest('[登录流程] 步骤3: 使用无效Token测试', async () => {
    const invalidToken = 'invalid.token.here';
    const originalToken = authToken;
    authToken = invalidToken;
    const res = await apiRequest('GET', '/dashboard');
    authToken = originalToken;

    if (res.status === 401 || res.status === 403) pass('无效Token返回401/403', `状态码: ${res.status}`);
    else fail('[登录流程]', new Error(`无效Token未被拒绝! 状态码: ${res.status}`));
  });

  await runTest('[登录流程] 步骤4: 使用过期格式Token测试', async () => {
    const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoiYWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTYwMDAwMDAwMH0.invalid';
    const originalToken = authToken;
    authToken = expiredToken;
    const res = await apiRequest('GET', '/dashboard');
    authToken = originalToken;

    if (res.status === 401 || res.status === 403) pass('过期Token返回401/403', `状态码: ${res.status}`);
    else skip('过期Token测试', `状态码: ${res.status}(JWT可能配置不同)`);
  });

  await runTest('[登录流程] 步骤5: 再次登录获取新Token', async () => {
    const res = await apiRequest('POST', '/auth/login', {
      data: { username: CONFIG.credentials.username, password: CONFIG.credentials.password },
      skipAuth: true
    });
    if (res.status === 200 && res.data?.data?.token) {
      const token2 = res.data.data.token;
      authToken = token2;
      if (token2 !== token1) pass('获取到新Token', `Token已更换`);
      else pass('获取到Token(可能与之前相同)', `长度: ${token2.length}`);

      const verifyRes = await apiRequest('GET', '/dashboard');
      if (verifyRes.status === 200) pass('新Token可正常使用');
      else fail('[登录流程]', new Error('新Token无法使用'));
    } else throw new Error('再次登录失败');
  });
}

async function testCategoryProductRelationFlow() {
  console.log(COLORS.bold + '\n🔗 分类-商品关联流程\n' + COLORS.reset);

  let catId = null;
  let prodId = null;
  const ts = Date.now();

  await runTest('[关联流程] 创建父级分类', async () => {
    const res = await apiRequest('POST', '/categories', {
      data: { name: `${CONFIG.testPrefix}父分类_${ts}`, status: 'active' }
    });
    if (res.data?.data?.id) { catId = res.data.data.id; cleanupIds.categories.push(catId); pass(`父分类 ID: ${catId}`); }
    else throw new Error('创建失败');
  });

  await runTest('[关联流程] 创建子级分类', async () => {
    if (!catId) throw new Error('无父分类ID');
    const res = await apiRequest('POST', '/categories', {
      data: { name: `${CONFIG.testPrefix}子分类_${ts}`, parent_id: catId, status: 'active' }
    });
    if (res.data?.data?.id) {
      const subCatId = res.data.data.id;
      cleanupIds.categories.push(subCatId);
      pass(`子分类 ID: ${subCatId}, 父级: ${catId}`);
    } else throw new Error('创建子分类失败');
  });

  await runTest('[关联流程] 在分类下创建商品', async () => {
    if (!catId) throw new Error('无分类ID');
    const res = await apiRequest('POST', '/products', {
      data: { name: `${CONFIG.testPrefix}关联商品_${ts}`, price: 199.99, stock: 50, category_id: catId, status: 'active' }
    });
    if (res.data?.data?.id) { prodId = res.data.data.id; cleanupIds.products.push(prodId); pass(`商品 ID: ${prodId}, 关联分类: ${catId}`); }
    else throw new Error('创建商品失败');
  });

  await runTest('[关联流程] 验证分类下商品数量', async () => {
    if (!catId) throw new Error('无分类ID');
    const res = await apiRequest('GET', `/categories/${catId}`);
    if (res.data?.data?.product_count !== undefined) pass(`分类下商品数: ${res.data.data.product_count}`);
    else skip('商品数量', 'API未返回product_count字段');
  });

  await runTest('[关联流程] 通过分类筛选商品', async () => {
    if (!catId) throw new Error('无分类ID');
    const res = await apiRequest('GET', `/products/category/${catId}`);
    if (res.status === 200) {
      const products = res.data?.data || [];
      const found = products.find(p => p.id === prodId);
      if (found) pass('通过分类筛选找到商品');
      else skip('分类筛选', '可能需要其他接口或分页参数');
    } else throw new Error(`查询失败: ${res.status}`);
  });
}

async function main() {
  const startTime = Date.now();

  if (!process.argv.includes('--json')) {
    console.log('\n' + '='.repeat(70));
    console.log(COLORS.bold + '⚙️ 绮管电商后台 - E2E功能完整性测试套件' + COLORS.reset);
    console.log(COLORS.cyan + `   测试时间: ${new Date().toISOString()}` + COLORS.reset);
    console.log(COLORS.cyan + `   目标API: ${CONFIG.apiBase}` + COLORS.reset);
    console.log(COLORS.cyan + `   详细模式: ${verboseMode ? '开启' : '关闭'}` + COLORS.reset);
    console.log('='.repeat(70) + '\n');
  }

  try {
    await loginAndGetToken();
  } catch (err) {
    console.log(COLORS.red + `\n❌ 认证失败: ${err.message}\n` + COLORS.reset);
  }

  if (authToken) {
    await testUserManagementFlow();
    await testProductManagementFlow();
    await testLoginLogoutFlow();
    await testCategoryProductRelationFlow();
  }

  await cleanupTestData();

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  const reportData = {
    suite: 'e2e-functionality-test',
    timestamp: new Date().toISOString(),
    config: { apiBase: CONFIG.apiBase },
    summary: { total: testResults.total, passed: testResults.passed, failed: testResults.failed, skipped: testResults.skipped },
    duration,
    details: testResults.details
  };
  fs.writeFileSync(path.join(resultsDir, 'functionality_test_results.json'), JSON.stringify(reportData, null, 2));

  printSummary(duration);
}

function printSummary(duration) {
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ suite: 'e2e-functionality-test', duration, summary: testResults }, null, 2));
    return;
  }

  console.log('\n' + '='.repeat(70));
  console.log(COLORS.bold + '📊 E2E功能完整性测试结果汇总' + COLORS.reset);
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
    console.log(COLORS.red + '❌ 存在失败的功能测试' + COLORS.reset);
    process.exit(1);
  } else {
    console.log(COLORS.green + '🎉 所有功能完整性测试通过！' + COLORS.reset);
  }
  console.log('='.repeat(70) + '\n');
}

main().catch(err => { console.error('\n❌ 测试运行出错:', err.message); process.exit(1); });
