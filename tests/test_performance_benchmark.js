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

function calculatePercentiles(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  return {
    p50: sorted[Math.floor(sorted.length * 0.5)] || 0,
    p90: sorted[Math.floor(sorted.length * 0.9)] || 0,
    p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
    p99: sorted[Math.floor(sorted.length * 0.99)] || 0,
    min: sorted[0] || 0,
    max: sorted[sorted.length - 1] || 0,
    avg: sorted.reduce((a, b) => a + b, 0) / sorted.length || 0
  };
}

const dbConfig = {
  host: process.env.DB_HOST || '10.0.0.16',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'QMZYXCX',
  password: process.env.DB_PASSWORD || 'LJN040821.',
  database: process.env.DB_NAME || 'qmzyxcx',
  charset: 'utf8mb4',
  timezone: '+08:00',
  connectTimeout: 60000
};

let pool = null;

const PERFORMANCE_BASELINES = {
  simpleSelect: { target: 50, warning: 100 },
  complexJoin: { target: 200, warning: 500 },
  insert: { target: 100, warning: 200 },
  batchInsert: { targetPerRecord: 10, warningPerRecord: 20 },
  update: { target: 100, warning: 200 },
  delete: { target: 100, warning: 200 }
};

let benchmarkResults = [];

async function main() {
  parseArgs();

  if (!outputJson) {
    console.log('\n' + '='.repeat(70));
    console.log(COLORS.bold + '⚡ 性能基准测试套件' + COLORS.reset);
    console.log(COLORS.cyan + `   测试时间: ${new Date().toISOString()}` + COLORS.reset);
    console.log(`   目标数据库: TDSQL-C MySQL @ ${dbConfig.host}:${dbConfig.port}`);
    console.log('='.repeat(70) + '\n');

    console.log(COLORS.cyan + '📏 性能基线目标:' + COLORS.reset);
    console.log(`   简单SELECT查询: < ${PERFORMANCE_BASELINES.simpleSelect.target}ms`);
    console.log(`   复杂JOIN查询:  < ${PERFORMANCE_BASELINES.complexJoin.target}ms`);
    console.log(`   INSERT操作:     < ${PERFORMANCE_BASELINES.insert.target}ms`);
    console.log(`   UPDATE操作:     < ${PERFORMANCE_BASELINES.update.target}ms`);
    console.log(`   DELETE操作:     < ${PERFORMANCE_BASELINES.delete.target}ms\n`);
  }

  try {
    pool = mysql.createPool(dbConfig);

    await runTest('连接初始化', async () => {
      const conn = await pool.getConnection();
      const [rows] = await conn.execute('SELECT 1 AS test');
      pass('数据库连接就绪');
      conn.release();
    });

    if (!outputJson) {
      console.log('\n' + COLORS.bold + '🔍 测试 1: 简单SELECT查询性能' + COLORS.reset + '\n');
    }

    await runTest('简单主键查询（目标 < 50ms）', async () => {
      const conn = await pool.getConnection();
      const iterations = 100;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await conn.execute('SELECT * FROM categories WHERE id = ?', [1]);
        times.push(Date.now() - start);
      }

      conn.release();

      const stats = calculatePercentiles(times);

      pass('简单查询性能', `P50: ${stats.p50}ms, P95: ${stats.p95}ms, 平均: ${stats.avg.toFixed(1)}ms`);

      if (stats.p95 <= PERFORMANCE_BASELINES.simpleSelect.target) {
        pass('性能达标', `P95(${stats.p95}ms) ≤ 目标(${PERFORMANCE_BASELINES.simpleSelect.target}ms) ✅`);
      } else if (stats.p95 <= PERFORMANCE_BASELINES.simpleSelect.warning) {
        warn('性能警告', `P95(${stats.p95}ms) 超过目标但可接受`);
      } else {
        fail('性能不达标', new Error(`P95(${stats.p95}ms) > 警告阈值(${PERFORMANCE_BASELINES.simpleSelect.warning}ms)`));
      }

      benchmarkResults.push({
        name: 'simple-select-by-primary-key',
        iterations,
        ...stats,
        target: PERFORMANCE_BASELINES.simpleSelect.target,
        passed: stats.p95 <= PERFORMANCE_BASELINES.simpleSelect.target
      });
    });

    await runTest('条件筛选查询（目标 < 50ms）', async () => {
      const conn = await pool.getConnection();
      const iterations = 100;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await conn.execute(
          "SELECT id, name, price, status FROM products WHERE status = ? AND price BETWEEN ? AND ? ORDER BY created_at DESC LIMIT 20",
          ['active', 100, 10000]
        );
        times.push(Date.now() - start);
      }

      conn.release();

      const stats = calculatePercentiles(times);

      pass('条件查询性能', `P50: ${stats.p50}ms, P95: ${stats.p95}ms`);

      benchmarkResults.push({
        name: 'conditional-select-with-filter',
        iterations,
        ...stats,
        target: PERFORMANCE_BASELINES.simpleSelect.target,
        passed: stats.p95 <= PERFORMANCE_BASELINES.simpleSelect.target
      });
    });

    if (!outputJson) {
      console.log('\n' + COLORS.bold + '🔍 测试 2: 复杂JOIN查询性能' + COLORS.reset + '\n');
    }

    await runTest('多表JOIN查询（目标 < 200ms）', async () => {
      const conn = await pool.getConnection();
      const iterations = 50;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await conn.execute(`
          SELECT 
            o.id AS order_id,
            o.order_no,
            o.customer_name,
            o.total_amount,
            o.status,
            u.username,
            COUNT(oi.id) AS item_count,
            SUM(oi.quantity * oi.price) AS calculated_total
          FROM orders o
          LEFT JOIN users u ON o.user_id = u.id
          LEFT JOIN order_items oi ON o.id = oi.order_id
          WHERE o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
          GROUP BY o.id
          ORDER BY o.created_at DESC
          LIMIT 30
        `);
        times.push(Date.now() - start);
      }

      conn.release();

      const stats = calculatePercentiles(times);

      pass('JOIN查询性能', `P50: ${stats.p50}ms, P95: ${stats.p95}ms, 平均: ${stats.avg.toFixed(1)}ms`);

      if (stats.p95 <= PERFORMANCE_BASELINES.complexJoin.target) {
        pass('性能达标', `P95(${stats.p95}ms) ≤ 目标(${PERFORMANCE_BASELINES.complexJoin.target}ms) ✅`);
      } else if (stats.p95 <= PERFORMANCE_BASELINES.complexJoin.warning) {
        warn('性能警告', `P95(${stats.p95}ms) 超过目标但可接受`);
      } else {
        fail('性能不达标', new Error(`P95(${stats.p95}ms) > 警告阈值(${PERFORMANCE_BASELINES.complexJoin.warning}ms)`));
      }

      benchmarkResults.push({
        name: 'complex-join-query',
        iterations,
        ...stats,
        target: PERFORMANCE_BASELINES.complexJoin.target,
        passed: stats.p95 <= PERFORMANCE_BASELINES.complexJoin.target
      });
    });

    await runTest('聚合统计查询（目标 < 200ms）', async () => {
      const conn = await pool.getConnection();
      const iterations = 50;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await conn.execute(`
          SELECT 
            c.name AS category_name,
            COUNT(p.id) AS product_count,
            AVG(p.price) AS avg_price,
            MIN(p.price) AS min_price,
            MAX(p.price) AS max_price,
            SUM(p.stock) AS total_stock
          FROM categories c
          LEFT JOIN products p ON c.id = p.category_id AND p.status = 'active'
          GROUP BY c.id, c.name
          HAVING product_count > 0
          ORDER BY product_count DESC
        `);
        times.push(Date.now() - start);
      }

      conn.release();

      const stats = calculatePercentiles(times);

      pass('聚合查询性能', `P50: ${stats.p50}ms, P95: ${stats.p95}ms`);

      benchmarkResults.push({
        name: 'aggregation-query',
        iterations,
        ...stats,
        target: PERFORMANCE_BASELINES.complexJoin.target,
        passed: stats.p95 <= PERFORMANCE_BASELINES.complexJoin.target
      });
    });

    if (!outputJson) {
      console.log('\n' + COLORS.bold + '✏️  测试 3: INSERT操作性能' + COLORS.reset + '\n');
    }

    await runTest('单条INSERT操作（目标 < 100ms）', async () => {
      const conn = await pool.getConnection();
      const iterations = 50;
      const times = [];
      let lastInsertId = null;

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        const [result] = await conn.execute(
          "INSERT INTO categories (name, sort_order, status) VALUES (?, ?, ?)",
          [`_BENCH_TEST_cat_${Date.now()}_${i}`, i, 'active']
        );
        times.push(Date.now() - start);
        lastInsertId = result.insertId;
      }

      if (lastInsertId) {
        await conn.execute("DELETE FROM categories WHERE name LIKE '_BENCH_TEST_%'");
      }

      conn.release();

      const stats = calculatePercentiles(times);

      pass('INSERT性能', `P50: ${stats.p50}ms, P95: ${stats.p95}ms, 平均: ${stats.avg.toFixed(1)}ms`);

      if (stats.p95 <= PERFORMANCE_BASELINES.insert.target) {
        pass('性能达标', `P95(${stats.p95}ms) ≤ 目标(${PERFORMANCE_BASELINES.insert.target}ms) ✅`);
      } else if (stats.p95 <= PERFORMANCE_BASELINES.insert.warning) {
        warn('性能警告', `P95(${stats.p95}ms) 超过目标但可接受`);
      } else {
        fail('性能不达标', new Error(`P95(${stats.p95}ms) > 警告阈值(${PERFORMANCE_BASELINES.insert.warning}ms)`));
      }

      benchmarkResults.push({
        name: 'single-insert',
        iterations,
        ...stats,
        target: PERFORMANCE_BASELINES.insert.target,
        passed: stats.p95 <= PERFORMANCE_BASELINES.insert.target
      });
    });

    if (!outputJson) {
      console.log('\n' + COLORS.bold + '📦 测试 4: 批量INSERT操作（1000条记录）' + COLORS.reset + '\n');
    }

    await runTest('批量INSERT（1000条记录）', async () => {
      const conn = await pool.getConnection();
      const batchSize = 1000;

      const values = Array.from({ length: batchSize }, (_, i) =>
        [`_BENCH_TEST_batch_${i}`, i % 5 === 0 ? null : Math.floor(i / 100), i, 'active']
      );

      const startTotal = Date.now();
      let insertedCount = 0;

      for (let i = 0; i < values.length; i += 100) {
        const batch = values.slice(i, i + 100);
        const placeholders = batch.map(() => '(?, ?, ?, ?)').join(', ');
        const params = batch.flat();

        const [result] = await conn.execute(
          `INSERT INTO categories (name, parent_id, sort_order, status) VALUES ${placeholders}`,
          params
        );
        insertedCount += result.affectedRows;
      }

      const totalTime = Date.now() - startTotal;

      await conn.execute("DELETE FROM categories WHERE name LIKE '_BENCH_TEST_batch_%'");

      conn.release();

      const timePerRecord = totalTime / batchSize;
      pass('批量INSERT结果', `${batchSize} 条记录, 总耗时: ${totalTime}ms, 每条: ${timePerRecord.toFixed(2)}ms`);

      if (timePerRecord <= PERFORMANCE_BASELINES.batchInsert.targetPerRecord) {
        pass('批量性能达标', `每条记录 ${timePerRecord.toFixed(2)}ms ≤ 目标 ${PERFORMANCE_BASELINES.batchInsert.targetPerRecord}ms ✅`);
      } else if (timePerRecord <= PERFORMANCE_BASELINES.batchInsert.warningPerRecord) {
        warn('批量性能警告', `每条记录 ${timePerRecord.toFixed(2)}ms，略高于目标`);
      } else {
        fail('批量性能不达标', new Error(`每条记录 ${timePerRecord.toFixed(2)}ms > 警告阈值`));
      }

      const throughput = ((batchSize / totalTime) * 1000).toFixed(0);
      pass('吞吐量', `${throughput} 条/秒`);

      benchmarkResults.push({
        name: 'batch-insert-1000',
        recordsInserted: insertedCount,
        totalTimeMs: totalTime,
        timePerRecordMs: timePerRecord,
        throughputPerSec: parseFloat(throughput),
        target: PERFORMANCE_BASELINES.batchInsert.targetPerRecord,
        passed: timePerRecord <= PERFORMANCE_BASELINES.batchInsert.targetPerRecord
      });
    });

    if (!outputJson) {
      console.log('\n' + COLORS.bold + '🔄 测试 5: UPDATE操作性能' + COLORS.reset + '\n');
    }

    await runTest('UPDATE操作（目标 < 100ms）', async () => {
      const conn = await pool.getConnection();

      const [setupResult] = await conn.execute(
        "INSERT INTO categories (name, sort_order, status) VALUES (?, 999, ?)",
        ['_BENCH_TEST_update_target', 'active']
      );
      const testId = setupResult.insertId;

      const iterations = 50;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await conn.execute(
          "UPDATE categories SET sort_order = ?, updated_at = NOW() WHERE id = ?",
          [i, testId]
        );
        times.push(Date.now() - start);
      }

      await conn.execute("DELETE FROM categories WHERE id = ?", [testId]);

      conn.release();

      const stats = calculatePercentiles(times);

      pass('UPDATE性能', `P50: ${stats.p50}ms, P95: ${stats.p95}ms, 平均: ${stats.avg.toFixed(1)}ms`);

      if (stats.p95 <= PERFORMANCE_BASELINES.update.target) {
        pass('性能达标', `P95(${stats.p95}ms) ≤ 目标(${PERFORMANCE_BASELINES.update.target}ms) ✅`);
      } else if (stats.p95 <= PERFORMANCE_BASELINES.update.warning) {
        warn('性能警告', `P95(${stats.p95}ms) 超过目标但可接受`);
      } else {
        fail('性能不达标', new Error(`P95(${stats.p95}ms) > 警告阈值(${PERFORMANCE_BASELINES.update.warning}ms)`));
      }

      benchmarkResults.push({
        name: 'update-operation',
        iterations,
        ...stats,
        target: PERFORMANCE_BASELINES.update.target,
        passed: stats.p95 <= PERFORMANCE_BASELINES.update.target
      });
    });

    if (!outputJson) {
      console.log('\n' + COLORS.bold + '🗑️  测试 6: DELETE操作性能' + COLORS.reset + '\n');
    }

    await runTest('DELETE操作（目标 < 100ms）', async () => {
      const conn = await pool.getConnection();

      const insertIds = [];
      for (let i = 0; i < 50; i++) {
        const [result] = await conn.execute(
          "INSERT INTO categories (name, sort_order, status) VALUES (?, ?, ?)",
          [`_BENCH_TEST_del_${i}`, i, 'active']
        );
        insertIds.push(result.insertId);
      }

      const times = [];

      for (const id of insertIds) {
        const start = Date.now();
        await conn.execute("DELETE FROM categories WHERE id = ?", [id]);
        times.push(Date.now() - start);
      }

      conn.release();

      const stats = calculatePercentiles(times);

      pass('DELETE性能', `P50: ${stats.p50}ms, P95: ${stats.p95}ms, 平均: ${stats.avg.toFixed(1)}ms`);

      if (stats.p95 <= PERFORMANCE_BASELINES.delete.target) {
        pass('性能达标', `P95(${stats.p95}ms) ≤ 目标(${PERFORMANCE_BASELINES.delete.target}ms) ✅`);
      } else if (stats.p95 <= PERFORMANCE_BASELINES.delete.warning) {
        warn('性能警告', `P95(${stats.p95}ms) 超过目标但可接受`);
      } else {
        fail('性能不达标', new Error(`P95(${stats.p95}ms) > 警告阈值(${PERFORMANCE_BASELINES.delete.warning}ms)`));
      }

      benchmarkResults.push({
        name: 'delete-operation',
        iterations: insertIds.length,
        ...stats,
        target: PERFORMANCE_BASELINES.delete.target,
        passed: stats.p95 <= PERFORMANCE_BASELINES.delete.target
      });
    });

    if (!outputJson) {
      console.log('\n' + COLORS.bold + '📊 性能基准测试报告' + COLORS.reset + '\n');
    }

    await runTest('生成性能报告和优化建议', async () => {
      const allPassed = benchmarkResults.every(r => r.passed);
      const passedCount = benchmarkResults.filter(r => r.passed).length;
      const totalCount = benchmarkResults.length;

      pass('总体通过率', `${passedCount}/${totalCount} (${((passedCount / totalCount) * 100).toFixed(0)}%)`);

      if (!outputJson) {
        console.log('\n       详细基准数据:');
        benchmarkResults.forEach(result => {
          const status = result.passed ? '✅' : '⚠️';
          const statusColor = result.passed ? 'green' : 'yellow';
          console.log(`         ${COLORS[statusColor]}${status} ${result.name}${COLORS.reset}`);
          if (result.avg !== undefined) {
            console.log(`            平均: ${result.avg.toFixed(1)}ms | P95: ${result.p95}ms | 目标: ${result.target}ms`);
          }
          if (result.throughputPerSec !== undefined) {
            console.log(`            吞吐量: ${result.throughputPerSec} 条/秒 | 每条耗时: ${result.timePerRecordMs?.toFixed(2)}ms`);
          }
        });

        console.log('\n       💡 优化建议:');
        const slowTests = benchmarkResults.filter(r => !r.passed);
        if (slowTests.length === 0) {
          console.log('         所有性能指标均达标！当前配置适合生产环境。');
        } else {
          slowTests.forEach(test => {
            console.log(`         • ${test.name}: 考虑添加索引或优化查询语句`);
          });
          console.log('         • 建议定期运行 EXPLAIN 分析慢查询');
          console.log('         • 监控 TDSQL-C 实例的 CPU 和内存使用率');
        }
      }

      if (allPassed) {
        pass('性能结论', '✅ 所有性能指标达到或超过基线要求');
      } else {
        warn('性能结论', `有 ${totalCount - passedCount} 个测试未达基线，请关注优化`);
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
      suite: 'performance-benchmark-test',
      timestamp: new Date().toISOString(),
      summary: testResults,
      config: {
        host: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.database
      },
      baselines: PERFORMANCE_BASELINES,
      benchmarks: benchmarkResults
    }, null, 2));
    return;
  }

  console.log('\n' + '='.repeat(70));
  console.log(COLORS.bold + '📊 性能基准测试结果汇总' + COLORS.reset);
  console.log('='.repeat(70));
  console.log(`\n  总计:     ${testResults.total} 个测试`);
  console.log(`${COLORS.green}  通过:     ${testResults.passed} ✅${COLORS.reset}`);
  console.log(`${COLORS.red}  失败:     ${testResults.failed} ❌${COLORS.reset}`);
  console.log(`${COLORS.yellow}  警告:     ${testResults.warnings} ⚠️${COLORS.reset}`);

  const passRate = ((testResults.passed / testResults.total) * 100).toFixed(1);
  const rateColor = testResults.failed === 0 ? 'green' : (testResults.failed <= 2 ? 'yellow' : 'red');
  console.log(`\n  ${COLORS[rateColor]}通过率:   ${passRate}%${COLORS.reset}\n`);

  if (testResults.failed > 0) {
    console.log(COLORS.red + '❌ 存在未达标的性能指标' + COLORS.reset);
    process.exit(1);
  } else {
    console.log(COLORS.green + '⚡ 所有性能基准测试完成！系统性能表现良好。' + COLORS.reset);
  }

  console.log('='.repeat(70) + '\n');
}

main().catch(error => {
  console.error('\n❌ 测试运行出错:', error.message);
  process.exit(1);
});
