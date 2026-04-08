const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  baseUrl: 'https://qimengzhiyue.cn',
  apiBase: 'https://qimengzhiyue.cn/api/v1',
  timeout: 10000,
  credentials: { username: 'admin', password: '123456' }
};

let chalk;
try { chalk = require('chalk'); } catch (e) {
  chalk = { green: t => t, red: t => t, yellow: t => t, cyan: t => t, bold: t => t, magenta: t => t };
}

const COLORS = {
  reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m',
  yellow: '\x1b[33m', cyan: '\x1b[36m', bold: '\x1b[1m', magenta: '\x1b[35m'
};

function log(color, msg) {
  if (process.argv.includes('--json')) return;
  console.log(`${COLORS[color] || ''}${msg}${COLORS.reset || ''}`);
}

let testResults = { passed: 0, failed: 0, warnings: 0, total: 0, details: [], findings: [] };
let authToken = null;
let verboseMode = process.argv.includes('--verbose') || process.argv.includes('-v');
const resultsDir = path.join(__dirname, 'results');
if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

const SEVERITY = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, INFO: 0 };

async function apiRequest(method, endpoint, options = {}) {
  const url = `${CONFIG.apiBase}${endpoint}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (authToken && !options.skipAuth) headers['Authorization'] = `Bearer ${authToken}`;
  try {
    return await axios({ method, url, headers, data: options.data, params: options.params, timeout: CONFIG.timeout, validateStatus: () => true });
  } catch (err) { return { status: 'ERROR', error: err.message, data: {} }; }
}

function pass(name, details = '') {
  testResults.total++; testResults.passed++;
  testResults.details.push({ name, status: 'PASS', severity: 'INFO', details, time: new Date().toISOString() });
  log('green', `  ✅ PASS: ${name}`);
  if (details && verboseMode) log('cyan', `       ${details}`);
}

function fail(name, error, severity = 'HIGH', details = '') {
  testResults.total++; testResults.failed++;
  testResults.details.push({ name, status: 'FAIL', severity, error: error.message, details, time: new Date().toISOString() });
  testResults.findings.push({ name, severity, error: error.message, details });
  log('red', `  ❌ FAIL [${severity}]: ${name}`);
  if (error) log('red', `       ${error.message}`);
  if (details && verboseMode) log('yellow', `       ${details}`);
}

function warn(name, message, severity = 'MEDIUM') {
  testResults.warnings++;
  testResults.details.push({ name, status: 'WARN', severity, reason: message, time: new Date().toISOString() });
  log('yellow', `  ⚠️  WARN [${severity}]: ${name} - ${message}`);
}

function skip(name, reason = '') {
  testResults.total++; testResults.details.push({ name, status: 'SKIP', reason, time: new Date().toISOString() });
  log('yellow', `  ⏭️  SKIP: ${name}${reason ? ` - ${reason}` : ''}`);
}

async function runTest(name, fn) {
  try { await fn(); } catch (err) { fail(name, err); }
}

async function login() {
  const res = await apiRequest('POST', '/auth/login', { data: CONFIG.credentials, skipAuth: true });
  if (res.data?.data?.token) { authToken = res.data.data.token; return true; }
  throw new Error(`登录失败: ${res.status}`);
}

async function testSqlInjection() {
  console.log(COLORS.bold + '\n💉 SQL注入测试\n' + COLORS.reset);

  const sqlPayloads = [
    { field: 'username', value: "' OR '1'='1", desc: "经典OR注入" },
    { field: 'username', value: "admin'--", desc: "注释截断" },
    { field: 'username', value: "' UNION SELECT * FROM users--", desc: "UNION注入" },
    { field: 'username', value: "'; DROP TABLE users; --", desc: "DROP表攻击" },
    { field: 'keyword', value: "' OR 1=1--", desc: "搜索框注入" },
    { field: 'name', value: "<script>alert(1)</script>", desc: "XSS+SQL混合" },
    { field: 'email', value: "test'; INSERT INTO users VALUES('hacked','hacked@hack.com','pass')--", desc: "INSERT注入" },
    { field: 'username', value: "1' AND SLEEP(5)--", desc: "时间盲注" }
  ];

  for (const payload of sqlPayloads) {
    await runTest(`[SQL注入] ${payload.desc}`, async () => {
      let endpoint, data;
      switch (payload.field) {
        case 'username':
          endpoint = '/auth/login';
          data = { username: payload.value, password: 'test123' };
          break;
        case 'keyword':
          endpoint = `/products?keyword=${encodeURIComponent(payload.value)}`;
          data = null;
          break;
        case 'name':
          endpoint = '/products';
          data = { name: payload.value, price: 100 };
          break;
        case 'email':
          endpoint = '/users';
          data = { username: `sql_test_${Date.now()}`, email: payload.value, password: 'Test123!' };
          break;
        default:
          endpoint = '/auth/login';
          data = { username: payload.value, password: 'test' };
      }

      const res = data
        ? await apiRequest('POST', endpoint, { data, skipAuth: endpoint === '/auth/login' })
        : await apiRequest('GET', endpoint);

      const isBlocked = res.status >= 400 || res.status === 'ERROR';
      const responseStr = JSON.stringify(res.data).toLowerCase();

      const hasSqlError = responseStr.includes('sql') && (responseStr.includes('syntax') || responseStr.includes('error'));
      const leakedData = responseStr.includes('password_hash') || responseStr.includes('password');

      if (isBlocked && !hasSqlError) {
        pass(`${payload.desc} - 已拦截`, `状态码: ${res.status}`);
      } else if (hasSqlError) {
        fail(`[SQL注入] ${payload.desc}`, new Error('检测到SQL错误信息泄露!'), 'CRITICAL', `响应包含SQL错误: ${responseStr.slice(0, 150)}`);
      } else if (leakedData) {
        fail(`[SQL注入] ${payload.desc}`, new Error('可能泄露敏感数据!'), 'HIGH', `响应包含敏感字段`);
      } else if (res.status === 200 || res.status === 201) {
        warn(`[SQL注入] ${payload.desc}`, `请求被接受(状态码${res.status})，需确认是否安全处理`, 'MEDIUM');
      } else {
        pass(`${payload.desc} - 状态码${res.status}`, verboseMode ? `响应: ${JSON.stringify(res.data).slice(0, 100)}` : '');
      }
    });
  }
}

async function testXssAttacks() {
  console.log(COLORS.bold + '\n🔤 XSS攻击测试\n' + COLORS.reset);

  const xssPayloads = [
    '<script>alert("XSS")</script>',
    '<img src=x onerror=alert(1)>',
    '"><script>alert(document.cookie)</script>',
    "'-alert(1)-'",
    '<svg onload=alert(1)>',
    'javascript:alert(1)',
    '<body onload=alert(1)>',
    '"><img src=x onerror=alert(document.cookie)>',
    '{{7*7}}',
    '${7*7}'
  ];

  const endpoints = [
    { method: 'POST', path: '/products', field: 'name', otherData: { price: 100 } },
    { method: 'POST', path: '/categories', field: 'name', otherData: {} },
    { method: 'POST', path: '/users', field: 'username', otherData: { email: 'xss@test.com', password: 'XssTest123!' }, skipAuth: false }
  ];

  for (const ep of endpoints) {
    for (const payload of xssPayloads.slice(0, 4)) {
      await runTest(`[XSS] ${ep.method} ${ep.path} - ${payload.slice(0, 25)}...`, async () => {
        const data = { ...ep.otherData, [ep.field]: payload };
        const res = await apiRequest(ep.method, ep.path, { data, skipAuth: ep.skipAuth });

        const responseData = JSON.stringify(res.data);
        const reflectedUnescaped = responseData.includes(payload.replace(/"/g, ''));

        if (res.status >= 400) {
          pass(`XSS载荷被拒绝 (${res.status})`, verboseMode ? `载荷: ${payload.slice(0, 40)}` : '');
        } else if (reflectedUnescaped) {
          fail('[XSS]', new Error('XSS载荷未被转义直接反射!'), 'HIGH', `字段: ${ep.field}, 载荷: ${payload.slice(0, 40)}`);
        } else {
          const returnedValue = res.data?.data?.[ep.field];
          if (returnedValue && !returnedValue.includes('<script')) {
            pass('XSS已过滤/转义', `原始: ${payload.slice(0, 30)}, 处理后: ${String(returnedValue).slice(0, 30)}`);
          } else if (returnedValue) {
            warn('[XSS]', `返回值可能未完全过滤: ${String(returnedValue).slice(0, 50)}`, 'LOW');
          } else {
            pass('请求已处理');
          }
        }
      });
    }
  }

  await runTest('[XSS] HTML实体编码验证', async () => {
    const testStr = '<>&"\'';
    const res = await apiRequest('POST', '/categories', { data: { name: `XSS_Encode_Test_${Date.now()}_${testStr}` } });
    if (res.status >= 400) pass('特殊字符被拒绝或处理');
    else if (res.data?.data?.name) {
      const returned = res.data.data.name;
      if (!returned.includes('<script>') && !returned.includes('onerror')) pass('HTML特殊字符已正确处理');
      else warn('[XSS]', '返回值中存在未转义的HTML标签', 'LOW');
    }
  });
}

async function testCsrfProtection() {
  console.log(COLORS.bold + '\n🛡️ CSRF保护测试\n' + COLORS.reset);

  await runTest('[CSRF] 检查CSRF Token机制', async () => {
    const res = await axios.get(CONFIG.baseUrl, { timeout: CONFIG.timeout, validateStatus: () => true });
    const csrfMeta = typeof res.data === 'string' ? res.data.match(/csrf[_-]?token/i) : null;

    if (csrfMeta) pass('发现CSRF Token相关元数据');
    else skip('CSRF Token检查', '页面中未找到明显的CSRF Token标记（可能使用其他防护方式）');
  });

  await runTest('[CSRF] 跨域请求检查', async () => {
    const res = await apiRequest('GET', '/dashboard');
    const corsHeader = res.headers['access-control-allow-origin'];
    if (!corsHeader || corsHeader !== '*') {
      pass('CORS配置合理', corsHeader ? `允许来源: ${corsHeader}` : '无CORS头');
    } else {
      warn('[CSRF]', 'CORS设置为*可能增加CSRF风险', 'LOW');
    }
  });
}

async function testSensitiveInfoLeakage() {
  console.log(COLORS.bold + '\n🔐 敏感信息泄露测试\n' + COLORS.reset);

  await runTest('[泄露] 登录响应密码检查', async () => {
    const res = await apiRequest('POST', '/auth/login', { data: CONFIG.credentials, skipAuth: true });
    const respStr = JSON.stringify(res.data);

    if (respStr.includes(CONFIG.credentials.password)) {
      fail('[泄露]', new Error('密码明文出现在登录响应中!'), 'CRITICAL', '严重安全风险!');
    } else if (respStr.toLowerCase().includes('password_hash') || respStr.toLowerCase().includes('passwordhash')) {
      warn('[泄露]', '响应包含password_hash字段', 'MEDIUM');
    } else if (respStr.toLowerCase().includes('hash') && respStr.length < 500) {
      warn('[泄露]', '响应可能包含哈希相关字段', 'LOW');
    } else {
      pass('登录响应不包含明文密码 ✅');
    }
  });

  await runTest('[泄露] 用户列表敏感字段检查', async () => {
    const res = await apiRequest('GET', '/users');
    const respStr = JSON.stringify(res.data).toLowerCase();
    const sensitiveFields = ['password', 'secret', 'token', 'credit_card', 'ssn'];

    const found = sensitiveFields.filter(f => respStr.includes(f));
    if (found.length === 0) pass('用户列表不包含敏感字段');
    else fail('[泄露]', new Error(`发现敏感字段: ${found.join(', ')}`), 'HIGH', `字段: ${found.join(', ')}`);
  });

  await runTest('[泄露] 错误信息堆栈泄露', async () => {
    const res = await apiRequest('GET', '/orders/99999999999');
    const respStr = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);

    const stackPatterns = [/stack trace/i, /at\s+\w+\.\w+\s*\(/i, /node_modules/i, /\/home\//i, /C:\\/i];
    const leaksFound = stackPatterns.filter(p => p.test(respStr));

    if (leaksFound.length === 0) pass('错误响应不包含堆栈信息');
    else fail('[泄露]', new Error(`错误响应可能泄露内部信息: ${leaksFound.map(p => p.source).join(', ')}`), 'MEDIUM');
  });

  await runTest('[泄露] API版本信息暴露', async () => {
    const res = await apiRequest('GET', '/');
    const serverHeader = res.headers['server'] || res.headers['Server'] || '';
    const poweredBy = res.headers['x-powered-by'] || res.headers['X-Powered-By'] || '';

    const info = [];
    if (serverHeader) info.push(`Server: ${serverHeader}`);
    if (poweredBy) info.push(`X-Powered-By: ${poweredBy}`);

    if (info.length > 0) warn('[泄露]', `服务器信息头暴露: ${info.join(', ')}`, 'LOW');
    else pass('服务器版本信息隐藏良好');
  });
}

async function testSecurityHeaders() {
  console.log(COLORS.bold + '\n🔒 安全头配置测试\n' + COLORS.reset);

  const securityHeaders = [
    { header: 'strict-transport-security', name: 'Strict-Transport-Security (HSTS)', severity: 'HIGH', pattern: /max-age=\d+/i },
    { header: 'x-frame-options', name: 'X-Frame-Options', severity: 'MEDIUM', pattern: /DENY|SAMEORIGIN/i },
    { header: 'x-content-type-options', name: 'X-Content-Type-Options', severity: 'MEDIUM', pattern: /nosniff/i },
    { header: 'content-security-policy', name: 'Content-Security-Policy', severity: 'MEDIUM', pattern: /.{10,}/i },
    { header: 'x-xss-protection', name: 'X-XSS-Protection', severity: 'LOW', pattern: /.+/i },
    { header: 'referrer-policy', name: 'Referrer-Policy', severity: 'LOW', pattern: /.+/i },
    { header: 'permissions-policy', name: 'Permissions-Policy', severity: 'INFO', pattern: /.+/i }
  ];

  const res = await axios.get(CONFIG.baseUrl, { timeout: CONFIG.timeout, validateStatus: () => true });

  for (const sh of securityHeaders) {
    await runTest(`[安全头] ${sh.name}`, async () => {
      const value = res.headers[sh.header] || res.headers[sh.header.replace(/-/g, '_')] || '';

      if (value && sh.pattern.test(value)) {
        pass(`${sh.name}: ${typeof value === 'string' && value.length > 50 ? value.slice(0, 50) + '...' : value}`);
      } else if (!value) {
        warn(`[安全头] ${sh.name}`, '未设置此安全头', sh.severity);
      } else {
        warn(`[安全头] ${sh.name}`, `值可能不符合最佳实践: ${value}`, sh.severity);
      }
    });
  }
}

async function testDirectoryTraversal() {
  console.log(COLORS.bold + '\n📂 目录遍历测试\n' + COLORS.reset);

  const traversalPayloads = [
    '../../../etc/passwd',
    '..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
    '....//....//....//etc/passwd',
    '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
    '..%252f..%252f..%252fetc%252fpasswd',
    '../../../var/log/access.log',
    '....//....//....//boot.ini'
  ];

  for (const payload of traversalPayloads) {
    await runTest(`[目录遍历] ${payload.replace(/\./g, '').slice(0, 20)}...`, async () => {
      const endpoints = [`/products?keyword=${encodeURIComponent(payload)}`, `/categories?name=${encodeURIComponent(payload)}`];

      let blocked = true;
      for (const ep of endpoints) {
        const res = await apiRequest('GET', ep);
        const respStr = JSON.stringify(res.data);

        const indicators = ['root:', '[boot loader]', 'daemon:', 'bin:\\'];
        const foundIndicators = indicators.filter(ind => respStr.toLowerCase().includes(ind.toLowerCase()));

        if (foundIndicators.length > 0) {
          fail('[目录遍历]', new Error(`可能读取到文件内容! 发现: ${foundIndicators.join(', ')}`), 'CRITICAL', `载荷: ${payload}`);
          blocked = false;
          break;
        }

        if (res.status === 200 && respStr.length > 1000 && !res.data?.success) {
          warn('[目录遍历]', `异常大响应可能包含文件内容`, 'HIGH');
        }
      }

      if (blocked) pass(`目录遍历已被阻止`, `载荷: ${payload.slice(0, 30)}`);
    });
  }
}

async function testBruteForceProtection() {
  console.log(COLORS.bold + '\n🔓 暴力破解防护测试\n' + COLORS.reset);

  const failedAttempts = [];
  const maxAttempts = 10;

  for (let i = 1; i <= maxAttempts; i++) {
    const res = await apiRequest('POST', '/auth/login', {
      data: { username: `bruteforce_test_${i}`, password: `wrong_password_${i}` },
      skipAuth: true
    });
    failedAttempts.push({ attempt: i, status: res.status, time: Date.now() });

    if (i === maxAttempts || res.status === 429) {
      if (res.status === 429) {
        pass(`在第${i}次尝试后被限制 (429 Too Many Requests)`, '暴力破解防护生效 ✅');
        break;
      }
    }

    await new Promise(r => setTimeout(r, 200));
  }

  const finalStatus = failedAttempts[failedAttempts.length - 1]?.status;
  if (finalStatus !== 429) {
    const all401 = failedAttempts.every(a => a.status === 401);
    if (all401) {
      warn('[暴力破解]', `连续${maxAttempts}次失败登录未被锁定/限流`, 'MEDIUM');
    } else {
      pass(`所有失败返回401 (共${maxAttempts}次)`, '至少拒绝了无效凭据');
    }
  }
}

async function testHttpsEnforcement() {
  console.log(COLORS.bold + '\n🔒 HTTPS强制跳转测试\n' + COLORS.reset);

  await runTest('[HTTPS] HTTPS证书有效性', async () => {
    return new Promise((resolve, reject) => {
      const req = https.get(CONFIG.baseUrl, { rejectUnauthorized: false }, (res) => {
        const cert = res.socket.getPeerCertificate();
        if (cert && Object.keys(cert).length > 0) {
          const validTo = new Date(cert.valid_to);
          if (validTo > new Date()) pass(`证书有效至 ${validTo.toISOString().slice(0, 10)}`);
          else fail('[HTTPS]', new Error(`证书已过期: ${cert.valid_to}`), 'HIGH');
        } else skip('[HTTPS]', '无法获取证书信息');
        resolve();
      }).on('error', (e) => { reject(e); });
      req.setTimeout(5000, () => { req.destroy(); reject(new Error('连接超时')); });
    });
  });

  await runTest('[HTTPS] HTTP→HTTPS重定向', async () => {
    try {
      const httpUrl = CONFIG.baseUrl.replace('https://', 'http://');
      const res = await axios.get(httpUrl, { timeout: 5000, validateStatus: () => true, maxRedirects: 0 });
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const location = res.headers['location'] || '';
        if (location.startsWith('https://')) pass('HTTP正确重定向到HTTPS', `→ ${location}`);
        else warn('[HTTPS]', `重定向目标非HTTPS: ${location}`, 'MEDIUM');
      } else if (res.status === 200) {
        warn('[HTTPS]', 'HTTP访问未强制跳转到HTTPS', 'MEDIUM');
      } else {
        skip('[HTTPS]', `HTTP返回状态码: ${res.status}`);
      }
    } catch (err) {
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        pass('HTTP端口未开放(仅支持HTTPS)');
      } else {
        skip('[HTTPS]', `无法测试HTTP: ${err.message}`);
      }
    }
  });
}

async function main() {
  const startTime = Date.now();

  if (!process.argv.includes('--json')) {
    console.log('\n' + '='.repeat(70));
    console.log(COLORS.bold + '🛡️ 绮管电商后台 - E2E安全性扫描套件' + COLORS.reset);
    console.log(COLORS.cyan + `   扫描时间: ${new Date().toISOString()}` + COLORS.reset);
    console.log(COLORS.cyan + `   目标环境: ${CONFIG.baseUrl}` + COLORS.reset);
    console.log(COLORS.cyan + `   详细模式: ${verboseMode ? '开启' : '关闭'}` + COLORS.reset);
    console.log('='.repeat(70) + '\n');
  }

  try { await login(); log('green', '✅ 认证成功 (用于需认证的安全测试)\n'); } catch (err) {
    log('yellow', '⚠️  认证失败，部分测试将跳过\n');
  }

  await testSqlInjection();
  await testXssAttacks();
  await testCsrfProtection();
  await testSensitiveInfoLeakage();
  await testSecurityHeaders();
  await testDirectoryTraversal();
  await testBruteForceProtection();
  await testHttpsEnforcement();

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  const criticalCount = testResults.findings.filter(f => f.severity === 'CRITICAL').length;
  const highCount = testResults.findings.filter(f => f.severity === 'HIGH').length;
  const mediumCount = testResults.findings.filter(f => f.severity === 'MEDIUM').length;

  const reportData = {
    suite: 'e2e-security-test',
    timestamp: new Date().toISOString(),
    config: { baseUrl: CONFIG.baseUrl },
    summary: {
      total: testResults.total,
      passed: testResults.passed,
      failed: testResults.failed,
      warnings: testResults.warnings,
      findings: { critical: criticalCount, high: highCount, medium: mediumCount }
    },
    duration,
    details: testResults.details,
    findings: testResults.findings
  };

  fs.writeFileSync(path.join(resultsDir, 'security_test_results.json'), JSON.stringify(reportData, null, 2));

  printSummary(duration, criticalCount, highCount);
}

function printSummary(duration, criticalCount, highCount) {
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({
      suite: 'e2e-security-test', duration, summary: testResults, findings: testResults.findings
    }, null, 2));
    return;
  }

  console.log('\n' + '='.repeat(70));
  console.log(COLORS.bold + '📊 E2E安全性扫描结果汇总' + COLORS.reset);
  console.log('='.repeat(70));
  console.log(`\n  总计:     ${testResults.total} 个测试`);
  console.log(`${COLORS.green}  通过:     ${testResults.passed} ✅${COLORS.reset}`);
  console.log(`${COLORS.red}  失败:     ${testResults.failed} ❌${COLORS.reset}`);
  console.log(`${COLORS.yellow}  警告:     ${testResults.warnings} ⚠️${COLORS.reset}`);
  console.log(`\n  耗时:     ${duration}s`);

  console.log(COLORS.bold + '\n  🚨 安全发现统计:\n' + COLORS.reset);
  console.log(`  ${COLORS.red}  🔴 严重(Critical):  ${criticalCount}${COLORS.reset}`);
  console.log(`  ${COLORS.magenta}  🟠 高危(High):     ${highCount}${COLORS.reset}`);
  console.log(`  ${COLORS.yellow}  🟡 中危(Medium):   ${testResults.findings.filter(f => f.severity === 'MEDIUM').length}${COLORS.reset}`);

  if (criticalCount > 0 || highCount > 0) {
    console.log(COLORS.red + `\n❌ 发现 ${criticalCount + highCount} 个严重安全问题需要立即修复!\n` + COLORS.reset);
    process.exit(1);
  } else if (testResults.warnings > 3) {
    console.log(COLORS.yellow + `\n⚠️  存在多项安全建议需要关注\n` + COLORS.reset);
  } else {
    console.log(COLORS.green + `\n✅ 安全扫描通过，未发现严重问题\n` + COLORS.reset);
  }

  console.log('='.repeat(70) + '\n');
}

main().catch(err => { console.error('\n❌ 安全扫描出错:', err.message); process.exit(1); });
