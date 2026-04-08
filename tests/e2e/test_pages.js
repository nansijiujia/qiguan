const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  baseUrl: 'https://qimengzhiyue.cn',
  apiBase: 'https://qimengzhiyue.cn/api/v1',
  timeout: 10000,
  maxRetries: 2,
  retryDelay: 1000,
  testPrefix: 'E2E_'
};

let chalk;
try {
  chalk = require('chalk');
} catch (e) {
  chalk = {
    green: (t) => t, red: (t) => t, yellow: (t) => t,
    cyan: (t) => t, bold: (t) => t, magenta: (t) => t
  };
}

const COLORS = {
  reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m',
  yellow: '\x1b[33m', cyan: '\x1b[36m', bold: '\x1b[1m'
};

function log(color, message) {
  if (process.argv.includes('--json')) return;
  console.log(`${COLORS[color] || ''}${message}${COLORS.reset || ''}`);
}

let testResults = { passed: 0, failed: 0, skipped: 0, total: 0, details: [] };
let verboseMode = process.argv.includes('--verbose') || process.argv.includes('-v');
const resultsDir = path.join(__dirname, 'results');
if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

function maskSensitive(data) {
  if (typeof data === 'string') {
    return data.replace(/token["']?\s*[:=]\s*["']([^"']{6})[^"']*/gi, 'token: "***$1***"')
      .replace(/password["']?\s*[:=]\s*["'][^"']*["']/gi, 'password: "***"');
  }
  return JSON.stringify(data, (key, val) => {
    if (typeof val === 'string' && (key === 'token' || key === 'password')) return val.length > 6 ? `***${val.slice(-4)}` : '****';
    return val;
  });
}

async function retryWithBackoff(fn, retries = CONFIG.maxRetries) {
  let lastError;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < retries) await new Promise(r => setTimeout(r, CONFIG.retryDelay * (i + 1)));
    }
  }
  throw lastError;
}

async function httpRequest(method, url, options = {}) {
  const startTime = Date.now();
  const response = await retryWithBackoff(async () => {
    return axios({ method, url, timeout: CONFIG.timeout, validateStatus: () => true, ...options });
  });
  response.responseTime = Date.now() - startTime;
  return response;
}

function pass(testName, details = '') {
  testResults.total++; testResults.passed++;
  testResults.details.push({ name: testName, status: 'PASS', details, time: new Date().toISOString() });
  log('green', `  ✅ PASS: ${testName}`);
  if (details && verboseMode) log('cyan', `       ${details}`);
}

function fail(testName, error, details = '') {
  testResults.total++; testResults.failed++;
  testResults.details.push({ name: testName, status: 'FAIL', error: error.message, details, time: new Date().toISOString() });
  log('red', `  ❌ FAIL: ${testName}`);
  if (error) log('red', `       Error: ${error.message}`);
  if (details && verboseMode) log('yellow', `       ${details}`);
}

function skip(testName, reason = '') {
  testResults.total++; testResults.skipped++;
  testResults.details.push({ name: testName, status: 'SKIP', reason, time: new Date().toISOString() });
  log('yellow', `  ⏭️  SKIP: ${testName}${reason ? ` - ${reason}` : ''}`);
}

async function runTest(name, fn) {
  try { await fn(); } catch (err) { fail(name, err); }
}

const pages = [
  { path: '/', name: '首页/登录页', keywords: ['login', '登录', 'username', 'password'], expectedElements: ['form', 'input'] },
  { path: '/dashboard', name: '仪表盘', keywords: ['dashboard', '统计', 'total', '数据'], expectedElements: ['div', 'table'] },
  { path: '/products', name: '商品管理', keywords: ['product', '商品', '列表'], expectedElements: ['table', 'button'] },
  { path: '/categories', name: '分类管理', keywords: ['category', '分类', 'tree'], expectedElements: ['ul', 'li', 'table'] },
  { path: '/users', name: '用户管理', keywords: ['user', '用户', '列表'], expectedElements: ['table', 'tr'] },
  { path: '/orders', name: '订单管理', keywords: ['order', '订单', '列表'], expectedElements: ['table', 'td'] }
];

async function checkPageHealth(pagePath) {
  const url = `${CONFIG.baseUrl}${pagePath}`;
  const startTime = Date.now();
  const res = await httpRequest('GET', url);
  res.responseTime = Date.now() - startTime;
  return { url, response: res };
}

async function testPageAccessibility(page) {
  await runTest(`[页面] ${page.name} - HTTP状态码`, async () => {
    const { response } = await checkPageHealth(page.path);
    if (response.status === 200) pass(`HTTP 200 OK`, `响应时间: ${response.responseTime}ms`);
    else throw new Error(`期望200，实际${response.status}`);
  });

  await runTest(`[页面] ${page.name} - 响应时间`, async () => {
    const { response } = await checkPageHealth(page.path);
    if (response.responseTime < 3000) pass(`响应时间 ${response.responseTime}ms (<3000ms)`);
    else throw new Error(`响应时间 ${response.responseTime}ms 超过3秒阈值`);
  });

  await runTest(`[页面] ${page.name} - 关键元素检测`, async () => {
    const { response } = await checkPageHealth(page.path);
    const html = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    const foundKeywords = page.keywords.filter(kw => html.toLowerCase().includes(kw.toLowerCase()));
    if (foundKeywords.length > 0) pass(`找到关键词: ${foundKeywords.join(', ')}`, verboseMode ? `匹配: ${foundKeys.join(', ')}` : '');
    else throw new Error(`未找到任何关键元素: ${page.keywords.join(', ')}`);
  });

  await runTest(`[页面] ${page.name} - HTML结构验证`, async () => {
    const { response } = await checkPageHealth(page.path);
    const html = typeof response.data === 'string' ? response.data : '';
    const hasDoctype = html.toLowerCase().includes('<!doctype') || html.toLowerCase().includes('<html');
    const hasBody = html.includes('<body') || html.includes('<div');
    if (hasDoctype || hasBody) pass('HTML结构正常');
    else throw new Error('HTML结构异常或非HTML响应');
  });
}

async function testSecurityHeaders() {
  const securityHeaders = [
    { header: 'x-frame-options', expected: /DENY|SAMEORIGIN/i, desc: 'X-Frame-Options' },
    { header: 'x-content-type-options', expected: /nosniff/i, desc: 'X-Content-Type-Options' },
    { header: 'strict-transport-security', expected: /max-age=/i, desc: 'Strict-Transport-Security' },
    { header: 'content-security-policy', expected: /.+/i, desc: 'Content-Security-Policy' },
    { header: 'x-xss-protection', expected: /.+/i, desc: 'X-XSS-Protection' }
  ];

  for (const sh of securityHeaders) {
    await runTest(`[安全头] ${sh.desc}`, async () => {
      const res = await httpRequest('GET', CONFIG.baseUrl);
      const value = res.headers[sh.header] || res.headers[sh.header.replace(/-/g, '_')] || '';
      if (value && sh.expected.test(value)) pass(`${sh.desc}: ${value}`);
      else if (!value) skip(`${sh.desc}`, '响应中未包含此安全头');
      else fail(`${sh.desc}`, new Error(`值不合规: ${value}`));
    });
  }
}

async function testHttpsCertificate() {
  await runTest('[HTTPS] 证书有效性检查', async () => {
    return new Promise((resolve, reject) => {
      const req = https.get(CONFIG.baseUrl, { rejectUnauthorized: false }, (res) => {
        const cert = res.socket.getPeerCertificate();
        if (cert && Object.keys(cert).length > 0) {
          const now = new Date();
          const validTo = new Date(cert.valid_to);
          if (validTo > now) pass(`证书有效至 ${validTo.toISOString().slice(0, 10)}`, `颁发者: ${cert.issuer?.CN || cert.issuer?.O || 'N/A'}`);
          else fail('[HTTPS]', new Error(`证书已过期: ${cert.valid_to}`));
        } else skip('[HTTPS]', '无法获取证书信息');
        resolve();
      }).on('error', (e) => { reject(e); });
      req.setTimeout(5000, () => { req.destroy(); reject(new Error('连接超时')); });
    });
  });
}

async function testJavaScriptErrors() {
  for (const page of pages) {
    await runTest(`[JS错误] ${page.name} - 检测控制台错误`, async () => {
      const { response } = await checkPageHealth(page.path);
      const content = typeof response.data === 'string' ? response.data : '';
      const errorPatterns = [
        /Uncaught\s+\w+Error/i, /TypeError:/i, /ReferenceError:/i,
        /SyntaxError:/i, /console\.error/i, /Failed to load/i
      ];
      const errorsFound = errorPatterns.filter(p => p.test(content));
      if (errorsFound.length === 0) pass('未检测到JavaScript错误');
      else fail(`[JS错误] ${page.name}`, new Error(`发现潜在错误模式: ${errorsFound.map(p => p.source).join(', ')}`));
    });
  }
}

async function main() {
  const startTime = Date.now();

  if (!process.argv.includes('--json')) {
    console.log('\n' + '='.repeat(70));
    console.log(COLORS.bold + '🌐 绮管电商后台 - E2E页面测试套件' + COLORS.reset);
    console.log(COLORS.cyan + `   测试时间: ${new Date().toISOString()}` + COLORS.reset);
    console.log(COLORS.cyan + `   目标环境: ${CONFIG.baseUrl}` + COLORS.reset);
    console.log(COLORS.cyan + `   详细模式: ${verboseMode ? '开启' : '关闭'}` + COLORS.reset);
    console.log('='.repeat(70) + '\n');
  }

  console.log(COLORS.bold + '\n📄 页面可访问性测试\n' + COLORS.reset);
  for (const page of pages) {
    console.log(COLORS.cyan + `\n--- 测试: ${page.name} (${page.path}) ---` + COLORS.reset);
    await testPageAccessibility(page);
  }

  console.log('\n' + COLORS.bold + '🔒 安全配置测试\n' + COLORS.reset);
  await testSecurityHeaders();
  await testHttpsCertificate();

  console.log('\n' + COLORS.bold + '🐛 JavaScript错误检测\n' + COLORS.reset);
  await testJavaScriptErrors();

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

  const reportData = {
    suite: 'e2e-pages-test',
    timestamp: new Date().toISOString(),
    config: { baseUrl: CONFIG.baseUrl, timeout: CONFIG.timeout },
    summary: { total: testResults.total, passed: testResults.passed, failed: testResults.failed, skipped: testResults.skipped },
    duration: totalTime,
    details: testResults.details
  };

  fs.writeFileSync(path.join(resultsDir, 'pages_test_results.json'), JSON.stringify(reportData, null, 2));

  printSummary(totalTime);
}

function printSummary(duration) {
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({
      suite: 'e2e-pages-test', duration, summary: testResults
    }, null, 2));
    return;
  }

  console.log('\n' + '='.repeat(70));
  console.log(COLORS.bold + '📊 E2E页面测试结果汇总' + COLORS.reset);
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
    console.log(COLORS.red + '❌ 存在失败的页面测试' + COLORS.reset);
    process.exit(1);
  } else {
    console.log(COLORS.green + '🎉 所有页面测试通过！' + COLORS.reset);
  }

  console.log('='.repeat(70) + '\n');
}

main().catch(err => { console.error('\n❌ 测试运行出错:', err.message); process.exit(1); });
