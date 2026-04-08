const axios = require('axios');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  baseUrl: 'https://qimengzhiyue.cn',
  apiBase: 'https://qimengzhiyue.cn/api/v1',
  timeout: 10000,
  concurrentUsers: 10,
  roundsPerUser: 3,
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

let authToken = null;
let verboseMode = process.argv.includes('--verbose') || process.argv.includes('-v');
const resultsDir = path.join(__dirname, 'results');
if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

const pages = [
  { path: '/', name: '/ (首页)' },
  { path: '/dashboard', name: '/dashboard' },
  { path: '/products', name: '/products' },
  { path: '/categories', name: '/categories' },
  { path: '/users', name: '/users' },
  { path: '/orders', name: '/orders' }
];

const apis = [
  { method: 'GET', path: '/dashboard', name: 'GET /dashboard' },
  { method: 'GET', path: '/products?page=1&pageSize=10', name: 'GET /products (列表)' },
  { method: 'GET', path: '/categories', name: 'GET /categories' },
  { method: 'GET', path: '/users?page=1&limit=10', name: 'GET /users' },
  { method: 'GET', path: '/orders', name: 'GET /orders' }
];

async function login() {
  const res = await axios.post(`${CONFIG.apiBase}/auth/login`, CONFIG.credentials, { timeout: CONFIG.timeout, validateStatus: () => true });
  if (res.data?.data?.token) { authToken = res.data.data.token; return true; }
  throw new Error(`登录失败: ${res.status}`);
}

async function measurePageLoad(pagePath) {
  const start = Date.now();
  try {
    const res = await axios.get(`${CONFIG.baseUrl}${pagePath}`, { timeout: CONFIG.timeout, validateStatus: () => true });
    return { time: Date.now() - start, status: res.status, size: JSON.stringify(res.data).length };
  } catch (err) {
    return { time: Date.now() - start, status: 'ERROR', error: err.message };
  }
}

async function measureApiCall(method, apiPath) {
  const start = Date.now();
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  try {
    const res = await axios({ method, url: `${CONFIG.apiBase}${apiPath}`, headers, timeout: CONFIG.timeout, validateStatus: () => true });
    return { time: Date.now() - start, status: res.status, size: JSON.stringify(res.data).length };
  } catch (err) {
    return { time: Date.now() - start, status: 'ERROR', error: err.message };
  }
}

async function runConcurrentTest(taskFn, label, count = CONFIG.concurrentUsers) {
  const results = [];
  const workers = Array.from({ length: count }, (_, i) =>
    taskFn(i).then(r => { results.push(...r); return r; }).catch(e => results.push({ time: -1, status: 'ERROR', error: e.message }))
  );
  await Promise.all(workers);
  return results;
}

function calculateStats(times) {
  const validTimes = times.filter(t => t > 0).sort((a, b) => a - b);
  if (validTimes.length === 0) return { avg: 0, min: 0, max: 0, p95: 0, p99: 0, median: 0, count: 0 };

  const sum = validTimes.reduce((a, b) => a + b, 0);
  const avg = sum / validTimes.length;
  const min = validTimes[0];
  const max = validTimes[validTimes.length - 1];
  const mid = Math.floor(validTimes.length / 2);
  const median = validTimes.length % 2 ? validTimes[mid] : (validTimes[mid - 1] + validTimes[mid]) / 2;
  const p95Idx = Math.ceil(validTimes.length * 0.95) - 1;
  const p99Idx = Math.ceil(validTimes.length * 0.99) - 1;

  return {
    avg: Math.round(avg), min, max,
    median: Math.round(median),
    p95: validTimes[p95Idx] || max,
    p99: validTimes[p99Idx] || max,
    count: validTimes.length,
    errors: times.filter(t => t < 0).length
  };
}

function formatTime(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function getPerformanceIcon(avg, threshold) {
  if (avg <= threshold * 0.5) return '✅';
  if (avg <= threshold) return '✅';
  if (avg <= threshold * 1.5) return '⚠️ ';
  return '❌';
}

function printProgressBar(current, total, width = 30) {
  const pct = Math.round((current / total) * 100);
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  process.stdout.write(`\r${COLORS.cyan}[${'█'.repeat(filled)}${'░'.repeat(empty)}]${COLORS.reset} ${pct}% (${current}/${total})`);
}

async function testPagesPerformance() {
  console.log(COLORS.bold + '\n📄 页面性能测试\n' + COLORS.reset);

  const pageResults = {};
  const totalTests = pages.length * CONFIG.concurrentUsers * CONFIG.roundsPerUser;
  let completedTests = 0;

  for (const page of pages) {
    log('cyan', `\n  测试页面: ${page.name}`);

    const allTimes = [];
    for (let round = 0; round < CONFIG.roundsPerUser; round++) {
      const results = await runConcurrentTest(async (userIdx) => {
        const userResults = [];
        for (let i = 0; i < Math.ceil(CONFIG.concurrentUsers / CONFIG.concurrentUsers); i++) {
          const r = await measurePageLoad(page.path);
          userResults.push(r.time);
          completedTests++;
          if (!process.argv.includes('--json')) printProgressBar(completedTests, totalTests);
        }
        return userResults;
      }, page.name, CONFIG.concurrentUsers);
      allTimes.push(...results.map(r => typeof r === 'number' ? r : r.time));
    }

    pageResults[page.name] = calculateStats(allTimes.flat());
    const stats = pageResults[page.name];

    const icon = getPerformanceIcon(stats.avg, 3000);
    log(icon === '✅' ? 'green' : (icon === '⚠️ ' ? 'yellow' : 'red'),
      `  ├─ ${page.name.padEnd(25)} 平均: ${formatTime(stats.avg).padStart(8)}  P95: ${formatTime(stats.p95).padStart(8)}  ${icon} ${stats.avg <= 3000 ? 'PASS' : 'SLOW'}`);
    if (verboseMode) {
      log('cyan', `  │   Min: ${formatTime(stats.min)} | Max: ${formatTime(stats.max)} | Median: ${formatTime(stats.median)} | P99: ${formatTime(stats.p99)} | 错误: ${stats.errors}`);
    }
  }

  console.log('');
  return pageResults;
}

async function testApisPerformance() {
  console.log(COLORS.bold + '\n🔌 API性能测试\n' + COLORS.reset);

  const apiResults = {};
  const totalTests = apis.length * CONFIG.concurrentUsers * CONFIG.roundsPerUser;
  let completedTests = 0;

  for (const api of apis) {
    log('cyan', `\n  测试API: ${api.name}`);

    const allTimes = [];
    for (let round = 0; round < CONFIG.roundsPerUser; round++) {
      const results = await runConcurrentTest(async () => {
        const userResults = [];
        for (let i = 0; i < CONFIG.concurrentUsers; i++) {
          const r = await measureApiCall(api.method, api.path);
          userResults.push(r.time);
          completedTests++;
          if (!process.argv.includes('--json')) printProgressBar(completedTests, totalTests);
        }
        return userResults;
      }, api.name, 1);
      allTimes.push(...results.flat());
    }

    apiResults[api.name] = calculateStats(allTimes);
    const stats = apiResults[api.name];

    const icon = getPerformanceIcon(stats.avg, 500);
    log(icon === '✅' ? 'green' : (icon === '⚠️ ' ? 'yellow' : 'red'),
      `  ├─ ${api.name.padEnd(30)} 平均: ${formatTime(stats.avg).padStart(8)}  P95: ${formatTime(stats.p95).padStart(8)}  ${icon} ${stats.avg <= 500 ? 'PASS' : 'SLOW'}`);
    if (verboseMode) {
      log('cyan', `  │   Min: ${formatTime(stats.min)} | Max: ${formatTime(stats.max)} | Median: ${formatTime(stats.median)} | P99: ${formatTime(stats.p99)} | 错误: ${stats.errors}`);
    }
  }

  console.log('');
  return apiResults;
}

async function monitorSystemResources() {
  console.log(COLORS.bold + '💾 系统资源监控\n' + COLORS.reset);

  const resourceData = { memoryUsage: process.memoryUsage(), timestamp: new Date().toISOString() };

  log('cyan', `  ├─ Node.js 内存使用:`);
  log('cyan', `  │   RSS:       ${(resourceData.memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`);
  log('cyan', `  │   Heap Used: ${(resourceData.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  log('cyan', `  │   Heap Total:${(resourceData.memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  log('cyan', `  │   External:  ${(resourceData.memoryUsage.external / 1024 / 1024).toFixed(2)} MB`);

  try {
    const start = Date.now();
    await axios.get(`${CONFIG.apiBase}/health`, { timeout: 5000 });
    const healthTime = Date.now() - start;
    log('green', `  ├─ Health Check: ${healthTime}ms ✅`);
    resourceData.healthCheckTime = healthTime;
  } catch (e) {
    log('red', `  ├─ Health Check: 失败 ❌ (${e.message})`);
    resourceData.healthCheckError = e.message;
  }

  console.log('');
  return resourceData;
}

function generatePerformanceReport(pageStats, apiStats, resources, duration) {
  const now = new Date();
  let report = '';
  report += '\n' + '='.repeat(60) + '\n';
  report += '           性能测试报告\n';
  report += '='.repeat(60) + '\n';
  report += `  测试时间: ${now.toISOString().slice(0, 19).replace('T', ' ')}\n`;
  report += `  并发用户数: ${CONFIG.concurrentUsers}\n`;
  report += `  每用户轮数: ${CONFIG.roundsPerUser}\n`;
  report += `  总耗时: ${(duration / 1000).toFixed(1)}s\n`;

  report += '\n  页面性能:\n';
  let pagePass = 0, pageTotal = Object.keys(pageStats).length;
  for (const [name, stats] of Object.entries(pageStats)) {
    const icon = getPerformanceIcon(stats.avg, 3000);
    const status = stats.avg <= 3000 ? 'PASS' : 'SLOW';
    if (stats.avg <= 3000) pagePass++;
    report += `  ├─ ${name.padEnd(22)} 平均: ${String(formatTime(stats.avg)).padStart(7)}  P95: ${String(formatTime(stats.p95)).padStart(7)}  ${icon} ${status}\n`;
  }

  report += '\n  API性能:\n';
  let apiPass = 0, apiTotal = Object.keys(apiStats).length;
  for (const [name, stats] of Object.entries(apiStats)) {
    const icon = getPerformanceIcon(stats.avg, 500);
    const status = stats.avg <= 500 ? 'PASS' : 'SLOW';
    if (stats.avg <= 500) apiPass++;
    report += `  ├─ ${name.padEnd(27)} 平均: ${String(formatTime(stats.avg)).padStart(7)}  P95: ${String(formatTime(stats.p95)).padStart(7)}  ${icon} ${status}\n`;
  }

  const allPageAvg = Object.values(pageStats).reduce((a, s) => a + s.avg, 0) / (pageTotal || 1);
  const allApiAvg = Object.values(apiStats).reduce((a, s) => a + s.avg, 0) / (apiTotal || 1);
  const overallPass = allPageAvg <= 3000 && allApiAvg <= 500;

  report += '\n' + '-'.repeat(60) + '\n';
  report += `  总体评估: ${overallPass ? '✅ 通过' : '⚠️  需关注'} (页面平均: ${formatTime(allPageAvg)}, API平均: ${formatTime(allApiAvg)})\n`;
  report += '='.return + '\n';

  console.log(report);

  const reportData = {
    suite: 'e2e-performance-test',
    timestamp: now.toISOString(),
    config: { concurrentUsers: CONFIG.concurrentUsers, roundsPerUser: CONFIG.roundsPerUser, timeout: CONFIG.timeout },
    duration: (duration / 1000).toFixed(1),
    pages: pageStats,
    apis: apiStats,
    resources,
    summary: {
      pageAverage: Math.round(allPageAvg),
      apiAverage: Math.round(allApiAvg),
      pagePassRate: `${pagePass}/${pageTotal}`,
      apiPassRate: `${apiPass}/${apiTotal}`,
      overall: overallPass ? 'PASS' : 'NEEDS_ATTENTION'
    }
  };

  fs.writeFileSync(path.join(resultsDir, 'performance_test_results.json'), JSON.stringify(reportData, null, 2));
  return { overallPass, reportData };
}

async function main() {
  const startTime = Date.now();

  if (!process.argv.includes('--json')) {
    console.log('\n' + '='.repeat(70));
    console.log(COLORS.bold + '⚡ 绮管电商后台 - E2E性能监控套件' + COLORS.reset);
    console.log(COLORS.cyan + `   测试时间: ${new Date().toISOString()}` + COLORS.reset);
    console.log(COLORS.cyan + `   并发用户: ${CONFIG.concurrentUsers}` + COLORS.reset);
    console.log(COLORS.cyan + `   每用户轮数: ${CONFIG.roundsPerUser}` + COLORS.reset);
    console.log(COLORS.cyan + `   详细模式: ${verboseMode ? '开启' : '关闭'}` + COLORS.reset);
    console.log('='.repeat(70) + '\n');
  }

  try { await login(); log('green', '✅ 认证成功'); } catch (err) {
    log('yellow', '⚠️  认证失败，部分API测试可能受限');
  }

  const pageStats = await testPagesPerformance();
  const apiStats = await testApisPerformance();
  const resources = await monitorSystemResources();

  const duration = Date.now() - startTime;
  const { overallPass, reportData } = generatePerformanceReport(pageStats, apiStats, resources, duration);

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(reportData, null, 2));
  }

  if (!overallPass && !process.argv.includes('--json')) {
    process.exit(1);
  }
}

main().catch(err => { console.error('\n❌ 性能测试出错:', err.message); process.exit(1); });
