/**
 * ============================================================
 * 绮管后台 - API紧急修复回归测试脚本
 * 
 * 测试目标: 验证4个500错误接口修复后的状态
 * 1. GET /api/v1/products (商品列表)
 * 2. GET /api/v1/orders (订单列表)
 * 3. GET /api/v1/users (用户列表)
 * 4. GET /api/v1/coupons (优惠券列表)
 * 
 * 使用方法: node test_api_fix.js
 * 创建时间: 2026-04-12
 * ============================================================
 */

const http = require('http');

const BASE_URL = 'http://127.0.0.1:3000';
let authToken = '';

// 测试结果统计
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  details: []
};

/**
 * 发送HTTP请求
 */
function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ statusCode: res.statusCode, data: jsonData, raw: data });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: null, raw: data });
        }
      });
    });
    
    req.on('error', reject);
    
    if (postData) {
      req.write(JSON.stringify(postData));
    }
    req.end();
  });
}

/**
 * 记录测试结果
 */
function recordTest(name, api, passed, details) {
  testResults.total++;
  if (passed) {
    testResults.passed++;
    console.log(`✅ ${name} - ${api}`);
  } else {
    testResults.failed++;
    console.log(`❌ ${name} - ${api}`);
    console.log(`   详情: ${details}`);
  }
  
  testResults.details.push({
    name,
    api,
    status: passed ? 'PASS' : 'FAIL',
    details
  });
}

/**
 * 登录获取Token
 */
async function login() {
  console.log('\n🔐 正在登录获取Token...');
  
  const result = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    username: 'admin',
    password: 'admin123'
  });
  
  if (result.statusCode === 200 && result.data && result.data.success && result.data.data && result.data.data.token) {
    authToken = result.data.data.token;
    console.log(`✅ 登录成功，Token已获取`);
    return true;
  } else {
    console.log(`❌ 登录失败: ${result.raw}`);
    return false;
  }
}

/**
 * 测试单个API
 */
async function testApi(name, path, expectedStatus = 200) {
  const result = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: path,
    method: 'GET',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  });
  
  const passed = result.statusCode === expectedStatus || 
                 (result.statusCode >= 200 && result.statusCode < 300);
  
  let details = '';
  if (!passed) {
    details = `期望状态码 ${expectedStatus}，实际 ${result.statusCode}`;
    if (result.data && result.data.error) {
      details += ` | 错误: ${result.data.error.message}`;
    }
  } else if (result.data && result.data.success) {
    details = `返回 ${result.data.data && result.data.data.list ? result.data.data.list.length + '条记录' : '成功'}`;
  }
  
  recordTest(name, path, passed, details);
  return passed;
}

/**
 * 主测试流程
 */
async function runTests() {
  console.log('='.repeat(70));
  console.log('🧪 绮管后台 - API紧急修复回归测试');
  console.log('='.repeat(70));
  console.log(`📅 测试时间: ${new Date().toLocaleString()}`);
  console.log(`🔗 目标服务器: ${BASE_URL}\n`);
  
  // Step 1: 登录
  const loginSuccess = await login();
  if (!loginSuccess) {
    console.log('\n❌ 无法登录，终止测试');
    return;
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('📋 开始执行API测试...');
  console.log('='.repeat(70) + '\n');
  
  // Step 2: 测试健康检查（应该一直正常）
  await testApi('健康检查', '/api/v1/health', 200);
  
  // Step 3: 测试4个修复的接口
  console.log('\n--- 🎯 核心修复接口测试 ---\n');
  await testApi('商品列表(修复#1)', '/api/v1/products?page=1&limit=5', 200);
  await testApi('订单列表(修复#2)', '/api/v1/orders?page=1&limit=5', 200);
  await testApi('用户列表(修复#3)', '/api/v1/users?page=1&limit=5', 200);
  await testApi('优惠券列表(修复#4)', '/api/v1/coupons', 200);
  
  // Step 4: 测试其他核心接口（回归测试）
  console.log('\n--- 🔍 回归测试 - 其他核心接口 ---\n');
  await testApi('轮播图列表', '/api/v1/content/banners', 200);
  await testApi('首页轮播图', '/api/v1/content/homepage/banners', 200);
  await testApi('分类列表', '/api/v1/categories', 200);
  await testApi('仪表盘概览', '/api/v1/dashboard/overview', 200);
  
  // 输出最终结果
  console.log('\n' + '='.repeat(70));
  console.log('📊 测试结果汇总');
  console.log('='.repeat(70));
  console.log(`总测试数: ${testResults.total}`);
  console.log(`通过: ${testResults.passed} ✅`);
  console.log(`失败: ${testResults.failed} ❌`);
  console.log(`通过率: ${(testResults.passed / testResults.total * 100).toFixed(2)}%`);
  
  if (testResults.failed > 0) {
    console.log('\n❌ 失败的测试:');
    testResults.details.filter(t => t.status === 'FAIL').forEach(t => {
      console.log(`   - ${t.name}: ${t.details}`);
    });
  } else {
    console.log('\n🎉 所有测试通过！修复成功！');
  }
  
  console.log('\n' + '='.repeat(70));
  
  // 返回退出码
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// 执行测试
runTests().catch(error => {
  console.error('❌ 测试脚本执行失败:', error.message);
  process.exit(1);
});
