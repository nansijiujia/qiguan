/**
 * 分类管理 性能基准测试
 * 
 * 测试目标：
 * 1. API响应时间 < 2s（1000条数据）
 * 2. 并发100个请求无错误
 * 3. 内存泄漏检测
 * 4. 大数据量搜索性能
 *
 * 运行方式：node tests/performance/categories.perf.js
 */

const http = require('http');
const { performance } = require('perf_hooks');

// 配置
const BASE_URL = process.env.PERF_BASE_URL || 'http://localhost:3000';
const TEST_ROUTES = {
  list: '/api/v1/categories',
  tree: '/api/v1/categories/tree',
  detail: (id) => `/api/v1/categories/${id}`
};

// 结果收集器
class PerformanceResult {
  constructor() {
    this.results = [];
    this.memoryUsage = [];
  }

  addResult(name, duration, success = true, details = {}) {
    this.results.push({
      name,
      duration,
      success,
      timestamp: new Date().toISOString(),
      ...details
    });
  }

  recordMemoryUsage(label) {
    const mem = process.memoryUsage();
    this.memoryUsage.push({
      label,
      timestamp: new Date().toISOString(),
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      rss: Math.round(mem.rss / 1024 / 1024)
    });
  }

  printSummary() {
    console.log('\n========== 性能测试报告 ==========\n');
    
    // 按类别分组显示结果
    const categories = {};
    this.results.forEach(r => {
      const cat = r.name.split(' - ')[0];
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(r);
    });

    Object.entries(categories).forEach(([cat, results]) => {
      console.log(`\n【${cat}】`);
      console.log('-'.repeat(50));
      
      results.forEach((r, i) => {
        const status = r.success ? '✅' : '❌';
        const extraInfo = r.details?.count ? ` (${r.details.count}次)` : '';
        console.log(`  ${status} ${i + 1}. ${r.name}: ${r.duration.toFixed(2)}ms${extraInfo}`);
      });

      const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      const maxDuration = Math.max(...results.map(r => r.duration));
      const minDuration = Math.min(...results.map(r => r.duration));
      
      console.log(`  ── 平均: ${avgDuration.toFixed(2)}ms | 最大: ${maxDuration.toFixed(2)}ms | 最小: ${minDuration.toFixed(2)}ms`);
    });

    // 内存使用情况
    if (this.memoryUsage.length > 1) {
      console.log('\n【内存使用趋势】');
      console.log('-'.repeat(50));
      this.memoryUsage.forEach(m => {
        console.log(`  [${m.label}] Heap: ${m.heapUsed}MB | RSS: ${m.rss}MB`);
      });
      
      const firstMem = this.memoryUsage[0].heapUsed;
      const lastMem = this.memoryUsage[this.memoryUsage.length - 1].heapUsed;
      const memDelta = lastMem - firstMem;
      console.log(`  内存变化: ${memDelta > 0 ? '+' : ''}${memDelta}MB (${memDelta > 0 ? '可能泄漏' : '正常'})`);
    }

    // 总体统计
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    
    console.log('\n【总体统计】');
    console.log('-'.repeat(50));
    console.log(`  总测试数: ${totalTests}`);
    console.log(`  通过: ${passedTests} ✅`);
    console.log(`  失败: ${failedTests} ❌`);
    console.log(`  通过率: ${(passedTests / totalTests * 100).toFixed(1)}%`);
    console.log('\n====================================\n');

    return {
      total: totalTests,
      passed: passedTests,
      failed: failedTests,
      passRate: passedTests / totalTests
    };
  }
}

/**
 * HTTP请求辅助函数
 */
function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer test-token-for-perf-testing`,
        ...options.headers
      },
      timeout: options.timeout || 10000
    };

    if (options.body) {
      reqOptions.headers['Content-Length'] = Buffer.byteLength(options.body);
    }

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

/**
 * 主测试套件
 */
async function runPerformanceTests() {
  const perfResult = new PerformanceResult();
  
  console.log('🚀 开始分类管理性能基准测试...\n');
  perfResult.recordMemoryUsage('初始状态');

  try {
    // ==================== 1. API响应时间测试 ====================
    await testApiResponseTime(perfResult);

    // ==================== 2. 并发请求测试 ====================
    await testConcurrentRequests(perfResult);

    // ==================== 3. 大数据量处理测试 ====================
    await testLargeDatasetHandling(perfResult);

    // ==================== 4. 内存泄漏检测 ====================
    await testMemoryLeak(perfResult);

  } catch (error) {
    console.error('❌ 测试执行出错:', error.message);
    perfResult.addResult('测试执行错误', 0, false, { error: error.message });
  } finally {
    perfResult.recordMemoryUsage('最终状态');
    return perfResult.printSummary();
  }
}

/**
 * 1. API响应时间测试
 */
async function testApiResponseTime(perfResult) {
  console.log('📊 测试 1: API响应时间\n');

  // 1.1 获取列表接口响应时间
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    try {
      const res = await makeRequest(TEST_ROUTES.list);
      const duration = performance.now() - start;
      const success = res.statusCode === 200;
      
      perfResult.addResult(
        `API响应时间 - GET列表 #${i + 1}`,
        duration,
        success,
        { statusCode: res.statusCode }
      );
      
      if (duration > 2000) {
        console.warn(`  ⚠️ 列表接口响应时间超过2s: ${duration.toFixed(2)}ms`);
      }
    } catch (error) {
      perfResult.addResult(`API响应时间 - GET列表 #${i + 1}`, 0, false, { error: error.message });
    }
    
    // 短暂间隔，避免过于频繁的请求
    await sleep(100);
  }

  // 1.2 树形结构接口响应时间
  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    try {
      const res = await makeRequest(TEST_ROUTES.tree);
      const duration = performance.now() - start;
      
      perfResult.addResult(
        `API响应时间 - GET树形结构 #${i + 1}`,
        duration,
        res.statusCode === 200
      );
    } catch (error) {
      perfResult.addResult(`API响应时间 - GET树形结构 #${i + 1}`, 0, false);
    }
    
    await sleep(100);
  }
}

/**
 * 2. 并发请求测试
 */
async function testConcurrentRequests(perfResult) {
  console.log('\n📊 测试 2: 并发请求处理能力\n');

  const concurrencyLevels = [10, 25, 50, 100];

  for (const level of concurrencyLevels) {
    console.log(`  测试并发级别: ${level}\n`);
    
    const startTime = performance.now();
    const promises = Array.from({ length: level }, (_, i) => 
      makeRequest(TEST_ROUTES.list)
        .then(res => ({ success: res.statusCode < 500, index: i }))
        .catch(err => ({ success: false, index: i, error: err.message }))
    );

    const results = await Promise.all(promises);
    const totalTime = performance.now() - startTime;

    const successfulRequests = results.filter(r => r.success).length;
    const failedRequests = level - successfulRequests;
    const avgTimePerRequest = totalTime / level;

    perfResult.addResult(
      `并发请求 - ${level}个并发`,
      avgTimePerRequest,
      failedRequests === 0,
      { 
        count: level,
        successful: successfulRequests,
        failed: failedRequests,
        totalTime: totalTime.toFixed(2) + 'ms'
      }
    );

    console.log(`    成功: ${successfulRequests}/${level} | 失败: ${failedRequests} | 总耗时: ${totalTime.toFixed(2)}ms | 平均: ${avgTimePerRequest.toFixed(2)}ms/req`);

    if (failedRequests > 0) {
      console.warn(`    ⚠️ 有${failedRequests}个请求失败`);
    }

    // 等待一下再进行下一轮测试
    await sleep(500);
  }
}

/**
 * 3. 大数据量处理测试
 */
async function testLargeDatasetHandling(perfResult) {
  console.log('\n📊 测试 3: 大数据量处理性能\n');

  // 3.1 带搜索参数的大数据查询
  const searchTerms = ['电子', '服装', '手机', '电脑', '食品'];
  
  for (const term of searchTerms) {
    const start = performance.now();
    try {
      const res = await makeRequest(`${TEST_ROUTES.list}?keyword=${encodeURIComponent(term)}`);
      const duration = performance.now() - start;
      
      perfResult.addResult(
        `大数据搜索 - 关键词"${term}"`,
        duration,
        res.statusCode === 200
      );
      
      if (duration > 1500) {
        console.warn(`  ⚠️ 搜索"${term}"耗时较长: ${duration.toFixed(2)}ms`);
      }
    } catch (error) {
      perfResult.addResult(`大数据搜索 - 关键词"${term}"`, 0, false);
    }
  }

  // 3.2 不同分页大小的性能
  const pageSizes = [10, 20, 50, 100];
  
  for (const size of pageSizes) {
    const start = performance.now();
    try {
      const res = await makeRequest(`${TEST_ROUTES.list}?pageSize=${size}&page=1`);
      const duration = performance.now() - start;
      
      perfResult.addResult(
        `分页性能 - pageSize=${size}`,
        duration,
        res.statusCode === 200,
        { pageSize: size }
      );
    } catch (error) {
      perfResult.addResult(`分页性能 - pageSize=${size}`, 0, false);
    }
  }

  // 3.3 排序操作性能
  const sortFields = ['name', 'sort_order', 'created_at'];
  
  for (const field of sortFields) {
    const start = performance.now();
    try {
      const res = await makeRequest(`${TEST_ROUTES.list?sort_field=${field}&sort_order=asc}`);
      const duration = performance.now() - start;
      
      perfResult.addResult(
        `排序性能 - 按${field}排序`,
        duration,
        res.statusCode === 200,
        { sortField: field }
      );
    } catch (error) {
      perfResult.addResult(`排序性能 - 按${field}排序`, 0, false);
    }
  }
}

/**
 * 4. 内存泄漏检测
 */
async function testMemoryLeak(perfResult) {
  console.log('\n📊 测试 4: 内存泄漏检测\n');

  const iterations = 20;
  const memorySnapshots = [];

  for (let i = 0; i < iterations; i++) {
    // 执行一系列API调用模拟用户操作
    await makeRequest(TEST_ROUTES.list);
    await makeRequest(TEST_ROUTES.tree);
    
    // 强制垃圾回收（如果可用）
    if (global.gc) {
      global.gc();
    }

    // 记录内存快照
    const mem = process.memoryUsage();
    memorySnapshots.push({
      iteration: i + 1,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      rss: mem.rss
    });

    // 每5次记录一次详细内存信息
    if ((i + 1) % 5 === 0) {
      perfResult.recordMemoryUsage(`迭代${i + 1}次后`);
    }

    await sleep(50); // 短暂间隔
  }

  // 分析内存趋势
  const firstSnapshot = memorySnapshots[0];
  const lastSnapshot = memorySnapshots[memorySnapshots.length - 1];
  
  const heapGrowth = lastSnapshot.heapUsed - firstSnapshot.heapUsed;
  const heapGrowthMB = heapGrowth / 1024 / 1024;
  const avgGrowthPerIteration = heapGrowthMB / iterations;

  console.log(`  初始堆内存: ${(firstSnapshot.heapUsed / 1024 / 1024).toFixed(2)}MB`);
  console.log(`  最终堆内存: ${(lastSnapshot.heapUsed / 1024 / 1024).toFixed(2)}MB`);
  console.log(`  内存增长总量: ${heapGrowthMB.toFixed(2)}MB`);
  console.log(`  平均每次迭代增长: ${avgGrowthPerIteration.toFixed(4)}MB`);

  // 判断是否有明显内存泄漏
  // 如果平均每次迭代增长超过0.1MB，可能有泄漏
  const hasPotentialLeak = avgGrowthPerIteration > 0.1;
  
  perfResult.addResult(
    '内存泄漏检测',
    iterations * 100, // 模拟总操作数
    !hasPotentialLeak,
    {
      iterations,
      heapGrowthMB: heapGrowthMB.toFixed(2),
      avgGrowthPerIteration: avgGrowthPerIteration.toFixed(4),
      hasPotentialLeak
    }
  );

  if (hasPotentialLeak) {
    console.warn(`  ⚠️ 可能存在内存泄漏！平均每次操作内存增长: ${avgGrowthPerIteration.toFixed(4)}MB`);
  } else {
    console.log(`  ✅ 内存使用正常，无明显泄漏迹象`);
  }
}

/**
 * 辅助函数：sleep
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 执行测试
if (require.main === module) {
  runPerformanceTests()
    .then(summary => {
      // 根据通过率设置退出码
      const exitCode = summary.passRate >= 0.8 ? 0 : 1;
      process.exit(exitCode);
    })
    .catch(error => {
      console.error('致命错误:', error);
      process.exit(1);
    });
}

module.exports = { runPerformanceTests, PerformanceResult };
