require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mysql = require('mysql2/promise');

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

let testResults = { passed: 0, failed: 0, warnings: 0, total: 0 };
let verboseMode = false;
let outputJson = false;

function parseArgs() {
  const args = process.argv.slice(2);
  verboseMode = args.includes('--verbose') || args.includes('-v');
  outputJson = args.includes('--json') || args.includes('-j');
}

function log(color, message) {
  if (outputJson) return;
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function pass(testName, details = '') {
  testResults.total++;
  testResults.passed++;
  if (outputJson) {
    console.log(JSON.stringify({ status: 'PASS', test: testName, details }));
    return;
  }
  log('green', `  ✅ PASS: ${testName}`);
  if (details && verboseMode) log('cyan', `       ${details}`);
}

function fail(testName, error, details = '') {
  testResults.total++;
  testResults.failed++;
  if (outputJson) {
    console.log(JSON.stringify({ status: 'FAIL', test: testName, error: error.message, stack: error.stack, details }));
    return;
  }
  log('red', `  ❌ FAIL: ${testName}`);
  if (error) log('red', `       错误: ${error.message}`);
  if (details && verboseMode) log('yellow', `       ${details}`);
}

function warn(testName, message) {
  testResults.warnings++;
  if (outputJson) return;
  log('yellow', `  ⚠️  WARN: ${testName} - ${message}`);
}

async function runTest(name, testFn) {
  try {
    await testFn();
  } catch (error) {
    fail(name, error);
  }
}

const dbConfig = {
  host: process.env.DB_HOST || '10.0.0.16',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'QMZYXCX',
  password: process.env.DB_PASSWORD || 'LJN040821.',
  database: process.env.DB_NAME || 'qmzyxcx',
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
  queueLimit: parseInt(process.env.DB_QUEUE_LIMIT) || 0,
  waitForConnections: true,
  charset: 'utf8mb4',
  timezone: '+08:00',
  connectTimeout: 60000,
  acquireTimeout: 60000
};

let pool = null;

async function main() {
  parseArgs();

  if (!outputJson) {
    console.log('\n' + '='.repeat(70));
    console.log(COLORS.bold + '🔥 连接池压力测试套件' + COLORS.reset);
    console.log(COLORS.cyan + `   测试时间: ${new Date().toISOString()}` + COLORS.reset);
    console.log(`   连接池配置: 最大连接数=${dbConfig.connectionLimit}, 队列限制=${dbConfig.queueLimit === 0 ? '无限制' : dbConfig.queueLimit}`);
    console.log('='.repeat(70) + '\n');
  }

  const stressTestResults = [];

  try {
    pool = mysql.createPool(dbConfig);

    await runTest('连接池初始化验证', async () => {
      const conn = await pool.getConnection();
      const [rows] = await conn.execute('SELECT 1 AS test');
      pass('连接池就绪');
      conn.release();
    });

    if (!outputJson) {
      console.log('\n' + COLORS.bold + '📊 压力测试场景 1: 20个并发连接' + COLORS.reset + '\n');
    }

    await runTest('20个并发连接获取和释放', async () => {
      const concurrentCount = 20;
      const startTime = Date.now();
      let successCount = 0;
      let failCount = 0;
      const errors = [];
      const connectionIds = new Set();

      const tasks = Array.from({ length: concurrentCount }, async (_, index) => {
        const taskStart = Date.now();
        let conn;

        try {
          conn = await pool.getConnection();

          const [result] = await conn.execute(
            'SELECT ? AS task_id, CONNECTION_ID() AS conn_id, NOW() AS time',
            [index + 1]
          );

          connectionIds.add(result[0].conn_id);

          await new Promise(r => setTimeout(r, Math.random() * 50));

          conn.release();
          successCount++;

          return { taskId: index + 1, success: true, duration: Date.now() - taskStart };
        } catch (error) {
          failCount++;
          errors.push(error.message);
          if (conn) conn.release();
          return { taskId: index + 1, success: false, error: error.message, duration: Date.now() - taskStart };
        }
      });

      const results = await Promise.all(tasks);
      const totalDuration = Date.now() - startTime;

      pass(`${concurrentCount}并发连接`, `成功: ${successCount}/${concurrentCount}, 总耗时: ${totalDuration}ms`);

      if (failCount > 0) {
        fail('并发失败率', new Error(`${failCount} 个请求失败`), errors.slice(0, 3).join('; '));
      }

      pass('独立连接数', `使用了 ${connectionIds.size} 个不同的数据库连接`);

      const durations = results.filter(r => r.success).map(r => r.duration);
      if (durations.length > 0) {
        const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
        const maxDuration = Math.max(...durations);
        pass('响应时间统计', `平均: ${avgDuration.toFixed(1)}ms, 最大: ${maxDuration}ms`);
      }

      stressTestResults.push({
        name: '20-concurrent-connections',
        total: concurrentCount,
        success: successCount,
        failed: failCount,
        durationMs: totalDuration
      });
    });

    if (!outputJson) {
      console.log('\n' + COLORS.bold + '📊 压力测试场景 2: 100个并发请求' + COLORS.reset + '\n');
    }

    await runTest('100个并发请求处理能力', async () => {
      const requestCount = 100;
      const startTime = Date.now();
      let successCount = 0;
      let failCount = 0;
      const responseTimes = [];

      const tasks = Array.from({ length: requestCount }, async (_, index) => {
        const taskStart = Date.now();
        let conn;

        try {
          conn = await pool.getConnection();

          await conn.execute(
            'SELECT ? AS req_id, COUNT(*) AS dummy FROM categories WHERE id <= 10',
            [index + 1]
          );

          conn.release();
          successCount++;
          const duration = Date.now() - taskStart;
          responseTimes.push(duration);

          return { reqId: index + 1, success: true, duration };
        } catch (error) {
          failCount++;
          if (conn) conn.release();
          return { reqId: index + 1, success: false, error: error.message, duration: Date.now() - taskStart };
        }
      });

      const results = await Promise.all(tasks);
      const totalDuration = Date.now() - startTime;

      pass(`${requestCount}并发请求`, `成功: ${successCount}/${requestCount}, 总耗时: ${totalDuration}ms`);

      if (responseTimes.length > 0) {
        responseTimes.sort((a, b) => a - b);
        const p50 = responseTimes[Math.floor(responseTimes.length * 0.5)];
        const p90 = responseTimes[Math.floor(responseTimes.length * 0.9)];
        const p95 = responseTimes[Math.floor(responseTimes.length * 0.95)];
        const p99 = responseTimes[Math.floor(responseTimes.length * 0.99)];
        const avg = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;

        pass('延迟百分位', `P50: ${p50}ms, P90: ${p90}ms, P95: ${p95}ms, P99: ${p99}ms`);
        pass('平均响应时间', `${avg.toFixed(2)}ms`);

        if (p95 > 500) {
          warn('性能警告', `P95延迟较高(${p95}ms)，可能需要优化连接池或查询`);
        }
      }

      const throughput = (requestCount / (totalDuration / 1000)).toFixed(1);
      pass('吞吐量', `${throughput} 请求/秒`);

      stressTestResults.push({
        name: '100-concurrent-requests',
        total: requestCount,
        success: successCount,
        failed: failCount,
        durationMs: totalDuration,
        throughput: parseFloat(throughput)
      });
    });

    if (!outputJson) {
      console.log('\n' + COLORS.bold + '📊 压力测试场景 3: 连接泄漏检测' + COLORS.reset + '\n');
    }

    await runTest('连接泄漏检测（确保所有连接正确释放）', async () => {
      const iterations = 5;
      const connectionsPerIteration = 10;
      const allConnectionIds = new Set();

      for (let iter = 0; iter < iterations; iter++) {
        const iterationIds = new Set();

        const tasks = Array.from({ length: connectionsPerIteration }, async () => {
          const conn = await pool.getConnection();
          const [result] = await conn.execute('SELECT CONNECTION_ID() AS id');
          iterationIds.add(result[0].conn_id);
          allConnectionIds.add(result[0].conn_id);
          conn.release();
          return true;
        });

        await Promise.all(tasks);

        if (verboseMode) {
          log('cyan', `       迭代 ${iter + 1}: 获取了 ${iterationIds.size} 个唯一连接`);
        }
      }

      pass('连接复用验证', `${iterations} 次迭代 × ${connectionsPerIteration} 连接，共使用 ${allConnectionIds.size} 个唯一连接`);

      if (allConnectionIds.size <= dbConfig.connectionLimit) {
        pass('无连接泄漏', `使用的连接数(${allConnectionIds.size}) ≤ 连接池上限(${dbConfig.connectionLimit})`);
      } else {
        warn('连接使用', `使用的连接数(${allConnectionIds.size}) > 连接池上限(${dbConfig.connectionLimit})，可能存在泄漏`);
      }

      await new Promise(r => setTimeout(r, 200));

      const checkConn = await pool.getConnection();
      try {
        const [status] = await checkConn.execute(
          "SHOW STATUS LIKE 'Threads_connected'"
        );
        const threadsConnected = status[0]?.Value || 0;
        pass('当前连接状态', `Threads_connected: ${threadsConnected}`);

        if (threadsConnected > dbConfig.connectionLimit * 2) {
          warn('连接数量', `当前连接数偏高: ${threadsConnected}`);
        }
      } finally {
        checkConn.release();
      }
    });

    if (!outputJson) {
      console.log('\n' + COLORS.bold + '📊 压力测试场景 4: 长时间运行稳定性' + COLORS.reset + '\n');
    }

    await runTest('长时间运行连接稳定性（30秒持续查询）', async () => {
      const durationSeconds = 30;
      const intervalMs = 200;
      const iterations = Math.floor((durationSeconds * 1000) / intervalMs);
      const startTime = Date.now();
      let successCount = 0;
      let failCount = 0;
      const latencies = [];

      const runQuery = async (iteration) => {
        const queryStart = Date.now();
        let conn;

        try {
          conn = await pool.getConnection();
          await conn.execute(
            'SELECT ? AS iter, NOW() AS ts, SLEEP(0.01) AS delay',
            [iteration]
          );
          conn.release();
          successCount++;
          latencies.push(Date.now() - queryStart);
        } catch (error) {
          failCount++;
          if (conn) conn.release();
        }
      };

      const promises = [];
      for (let i = 0; i < iterations; i++) {
        promises.push(runQuery(i));
        if (i % 10 === 0 && i > 0) {
          await new Promise(r => setTimeout(r, intervalMs));
        }
      }

      await Promise.all(promises);

      const actualDuration = Date.now() - startTime;
      pass('稳定性测试完成', `运行 ${actualDuration}ms, 成功: ${successCount}/${iterations}, 失败: ${failCount}`);

      if (latencies.length > 0) {
        latencies.sort((a, b) => a - b);
        const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        const maxLatency = latencies[latencies.length - 1];
        const p95 = latencies[Math.floor(latencies.length * 0.95)];

        pass('延迟分析', `平均: ${avgLatency.toFixed(1)}ms, 最大: ${maxLatency}ms, P95: ${p95}ms`);

        if (failCount === 0) {
          pass('零失败率', '长时间运行期间所有查询均成功');
        }
      }

      stressTestResults.push({
        name: 'long-running-stability',
        duration: actualDuration,
        totalQueries: iterations,
        success: successCount,
        failed: failCount
      });
    });

    if (!outputJson) {
      console.log('\n' + COLORS.bold + '📊 压力测试场景 5: 连接池指标监控' + COLORS.reset + '\n');
    }

    await runTest('连接池指标详细监控', async () => {
      const monitorConn = await pool.getConnection();

      try {
        const metrics = {};

        const getStatus = async (variable) => {
          const [rows] = await monitorConn.execute("SHOW STATUS LIKE ?", [variable]);
          return rows[0]?.Value || '0';
        };

        metrics.threadsConnected = await getStatus('Threads_connected');
        metrics.threadsRunning = await getStatus('Threads_running');
        metrics.maxUsedConnections = await getStatus('Max_used_connections');
        metrics.connections = await getStatus('Connections');
        metrics.abortedConnects = await getStatus('Aborted_connects');
        metrics.abortedClients = await getStatus('Aborted_clients');

        pass('活跃线程数', `Threads_running: ${metrics.threadsRunning}`);
        pass('已用最大连接', `Max_used_connections: ${metrics.maxUsedConnections}`);
        pass('总连接次数', `Connections: ${metrics.connections}`);
        pass('中止的连接', `Aborted_connects: ${metrics.abortedConnects}`);
        pass('中止的客户端', `Aborted_clients: ${metrics.abortedClients}`);

        if (parseInt(metrics.abortedConnects) > 10) {
          warn('连接质量', `存在较多中止连接: ${metrics.abortedConnects}`);
        }

        if (parseInt(metrics.abortedClients) > 10) {
          warn('客户端异常', `存在较多客户端中止: ${metrics.abortedClients}`);
        }

        if (verboseMode) {
          log('cyan', '\n       详细指标:');
          Object.entries(metrics).forEach(([key, value]) => {
            console.log(`         ${key}: ${value}`);
          });
        }
      } finally {
        monitorConn.release();
      }
    });

    await runTest('获取连接耗时分析', async () => {
      const samples = 50;
      const acquireTimes = [];

      for (let i = 0; i < samples; i++) {
        const start = Date.now();
        const conn = await pool.getConnection();
        acquireTimes.push(Date.now() - start);
        conn.release();
      }

      acquireTimes.sort((a, b) => a - b);
      const avgAcquire = acquireTimes.reduce((a, b) => a + b, 0) / acquireTimes.length;
      const maxAcquire = acquireTimes[samples - 1];
      const p95Acquire = acquireTimes[Math.floor(samples * 0.95)];

      pass('连接获取统计', `采样${samples}次, 平均: ${avgAcquire.toFixed(2)}ms, 最大: ${maxAcquire}ms, P95: ${p95Acquire}ms`);

      if (avgAcquire > 50) {
        warn('获取延迟', `平均连接获取时间较长: ${avgAcquire.toFixed(2)}ms`);
      }

      if (p95Acquire > 200) {
        warn('P95警告', `P95连接获取时间过长: ${p95Acquire}ms，可能存在连接池争用`);
      }
    });

    if (!outputJson) {
      console.log('\n' + COLORS.bold + '📋 压力测试报告' + COLORS.reset + '\n');
    }

    await runTest('生成压力测试汇总报告', async () => {
      const totalTests = stressTestResults.reduce((sum, t) => sum + t.total || t.totalQueries || 0, 0);
      const totalSuccess = stressTestResults.reduce((sum, t) => sum + t.success, 0);
      const totalFailed = stressTestResults.reduce((sum, t) => sum + (t.failed || 0), 0);
      const overallSuccessRate = ((totalSuccess / totalTests) * 100).toFixed(1);

      pass('总体成功率', `${totalSuccess}/${totalTests} (${overallSuccessRate}%)`);

      if (!outputJson) {
        console.log('\n       测试场景详情:');
        stressTestResults.forEach(test => {
          const rate = (((test.success || 0) / (test.total || test.totalQueries)) * 100).toFixed(1);
          console.log(`         • ${test.name}: 成功率 ${rate}%`);
          if (test.durationMs) console.log(`           耗时: ${test.durationMs}ms`);
          if (test.throughput) console.log(`           吞吐量: ${test.throughput} req/s`);
        });
      }

      if (totalFailed === 0) {
        pass('压力测试结论', '✅ 所有压力测试通过，连接池工作正常');
      } else if (totalFailed < totalTests * 0.05) {
        warn('压力测试结论', `少量失败 (${totalFailed}/${totalTests})，在可接受范围内`);
      } else {
        fail('压力测试结论', new Error(`失败率过高: ${totalFailed}/${totalTests}`));
      }
    });

    await pool.end();
    if (!outputJson) log('green', '\n✅ 连接池已关闭');

  } catch (error) {
    if (!outputJson) console.error('\n❌ 测试出错:', error.message);
    if (verboseMode) console.error(error.stack);
    if (pool) await pool.end().catch(() => {});
    printSummary();
    process.exit(1);
  }

  printSummary();
}

function printSummary() {
  if (outputJson) {
    console.log(JSON.stringify({
      suite: 'connection-pool-stress-test',
      timestamp: new Date().toISOString(),
      summary: testResults,
      config: {
        host: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.database,
        connectionLimit: dbConfig.connectionLimit
      },
      stressTests: stressTestResults
    }, null, 2));
    return;
  }

  console.log('\n' + '='.repeat(70));
  console.log(COLORS.bold + '📊 连接池压力测试结果汇总' + COLORS.reset);
  console.log('='.repeat(70));
  console.log(`\n  总计:     ${testResults.total} 个测试`);
  console.log(`${COLORS.green}  通过:     ${testResults.passed} ✅${COLORS.reset}`);
  console.log(`${COLORS.red}  失败:     ${testResults.failed} ❌${COLORS.reset}`);
  console.log(`${COLORS.yellow}  警告:     ${testResults.warnings} ⚠️${COLORS.reset}`);

  const passRate = ((testResults.passed / testResults.total) * 100).toFixed(1);
  const rateColor = testResults.failed === 0 ? 'green' : (testResults.failed <= 2 ? 'yellow' : 'red');
  console.log(`\n  ${COLORS[rateColor]}通过率:   ${passRate}%${COLORS.reset}\n`);

  if (testResults.failed > 0) {
    console.log(COLORS.red + '❌ 存在失败的连接池压力测试' + COLORS.reset);
    process.exit(1);
  } else {
    console.log(COLORS.green + '🎉 所有连接池压力测试通过！系统可承受高并发负载。' + COLORS.reset);
  }

  console.log('='.repeat(70) + '\n');
}

main().catch(error => {
  console.error('\n❌ 测试运行出错:', error.message);
  process.exit(1);
});
