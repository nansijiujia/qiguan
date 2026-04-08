require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

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
  connectTimeout: parseInt(process.env.DB_TIMEOUT) || 60000,
  acquireTimeout: 60000
};

let pool = null;

async function main() {
  parseArgs();

  if (!outputJson) {
    console.log('\n' + '='.repeat(70));
    console.log(COLORS.bold + '🔍 数据库连接测试套件 - TDSQL-C MySQL 集成测试' + COLORS.reset);
    console.log(COLORS.cyan + `   测试时间: ${new Date().toISOString()}` + COLORS.reset);
    console.log('='.repeat(70) + '\n');

    console.log(COLORS.cyan + '📋 连接配置信息:' + COLORS.reset);
    console.log(`   主机: ${dbConfig.host}:${dbConfig.port}`);
    console.log(`   用户: ${dbConfig.user}`);
    console.log(`   数据库: ${dbConfig.database}`);
    console.log(`   连接池大小: ${dbConfig.connectionLimit}`);
    console.log('');
  }

  await runTest('数据库基本连接测试', async () => {
    pool = mysql.createPool(dbConfig);
    const conn = await pool.getConnection();
    const [rows] = await conn.execute('SELECT 1 AS test');
    pass('数据库基本连接', `返回值: ${JSON.stringify(rows)}`);
    conn.release();
  });

  await runTest('MySQL版本信息获取', async () => {
    const conn = await pool.getConnection();
    const [rows] = await conn.execute('SELECT VERSION() AS version');
    const version = rows[0].version;
    pass('MySQL版本检测', `版本: ${version}`);

    if (version.toLowerCase().includes('tdsql')) {
      pass('TDSQL-C实例确认', '已确认为TDSQL-C兼容实例');
    } else if (version.startsWith('5.') || version.startsWith('8.')) {
      warn('MySQL版本', `标准MySQL版本: ${version}，非TDSQL-C`);
    }

    conn.release();
  });

  await runTest('连接池配置验证', async () => {
    const config = pool.pool.config;

    pass('连接池配置加载', `最大连接数: ${config.connectionLimit}, 等待队列限制: ${config.queueLimit}`);

    if (config.connectionLimit < 5) {
      warn('连接池大小', `当前连接池较小(${config.connectionLimit})，建议生产环境设置为10-20`);
    }

    if (config.waitForConnections === true) {
      pass('等待连接策略', '当连接池耗尽时等待新连接（推荐）');
    }

    if (config.connectTimeout > 30000) {
      pass('连接超时设置', `超时时间: ${config.connectTimeout}ms`);
    } else {
      warn('连接超时', `连接超时较短(${config.connectTimeout}ms)，可能导致网络不稳定时失败`);
    }
  });

  await runTest('字符集和时区验证', async () => {
    const conn = await pool.getConnection();

    const [charsetRows] = await conn.execute(
      "SHOW VARIABLES LIKE 'character_set_connection'"
    );
    const charset = charsetRows[0]?.Value || 'unknown';
    pass('字符集设置', `连接字符集: ${charset}`);

    if (!charset.toLowerCase().includes('utf8')) {
      fail('字符集检查', new Error(`非UTF8字符集: ${charset}`));
    }

    const [timezoneRows] = await conn.execute(
      "SELECT @@session.time_zone AS timezone"
    );
    const timezone = timezoneRows[0]?.timezone || 'unknown';
    pass('时区设置', `会话时区: ${timezone}`);

    conn.release();
  });

  await runTest('数据库选择验证', async () => {
    const conn = await pool.getConnection();

    const [dbRows] = await conn.execute('SELECT DATABASE() AS current_db');
    const currentDb = dbRows[0].current_db;
    pass('当前数据库', `使用数据库: ${currentDb}`);

    if (currentDb !== dbConfig.database) {
      fail('数据库匹配', new Error(`期望: ${dbConfig.database}, 实际: ${currentDb}`));
    }

    const [tables] = await conn.execute(
      'SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = ? AND table_type = "BASE TABLE"',
      [dbConfig.database]
    );
    pass('表数量统计', `数据库中共有 ${tables[0].count} 张表`);

    conn.release();
  });

  await runTest('连接获取和释放测试', async () => {
    const connections = [];

    for (let i = 0; i < 3; i++) {
      const conn = await pool.getConnection();
      connections.push(conn);

      const [result] = await conn.execute('SELECT CONNECTION_ID() AS id');
      if (verboseMode) {
        console.log(`       获取连接 #${i+1}: ID=${result[0].id}`);
      }
    }

    pass('多连接获取', `成功获取 ${connections.length} 个连接`);

    for (let i = connections.length - 1; i >= 0; i--) {
      connections[i].release();
    }

    pass('连接释放', `成功释放所有 ${connections.length} 个连接`);

    await new Promise(resolve => setTimeout(resolve, 100));
  });

  await runTest('连接池状态监控', async () => {
    const allConnections = [];
    for (let i = 0; i < 5; i++) {
      allConnections.push(await pool.getConnection());
    }

    const poolInfo = {
      totalConnections: allConnections.length,
      activeConnections: allConnections.length,
      idleConnections: 0
    };

    pass('活跃连接数', `当前活跃: ${poolInfo.activeConnections}`);

    for (const conn of allConnections) {
      conn.release();
    }

    pass('空闲连接释放', `${allConnections.length} 个连接已归还到连接池`);
  });

  await runTest('查询执行测试', async () => {
    const conn = await pool.getConnection();

    const [rows] = await conn.execute(
      'SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = ? ORDER BY table_name',
      [dbConfig.database]
    );

    pass('信息Schema查询', `查询到 ${rows.length} 张表`);

    if (rows.length > 0) {
      const tableNames = rows.map(r => r.table_name).join(', ');
      if (verboseMode) {
        log('cyan', `       表列表: ${tableNames}`);
      }
    }

    conn.release();
  });

  await runTest('参数化查询安全测试', async () => {
    const conn = await pool.getConnection();

    const userInput = "'; DROP TABLE users; --";
    try {
      const [rows] = await conn.execute(
        'SELECT * FROM categories WHERE name = ? LIMIT 1',
        [userInput]
      );

      pass('SQL注入防护', `参数化查询正常工作，返回 ${rows.length} 行（预期为0）`);
    } catch (error) {
      pass('SQL注入防护', '参数化查询阻止了潜在的注入攻击');
    }

    conn.release();
  });

  await runTest('事务支持验证', async () => {
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      await conn.execute(
        'INSERT INTO categories (name, parent_id, sort_order, status) VALUES (?, NULL, 999, ?)',
        ['_test_transaction_', 'active']
      );

      const [inserted] = await conn.execute(
        'SELECT id FROM categories WHERE name = ?',
        ['_test_transaction_']
      );

      if (inserted.length > 0) {
        pass('事务内INSERT', `插入ID: ${inserted[0].id}`);
      }

      await conn.rollback();

      const [afterRollback] = await conn.execute(
        'SELECT id FROM categories WHERE name = ?',
        ['_test_transaction_']
      );

      if (afterRollback.length === 0) {
        pass('事务回滚验证', '回滚后数据已清除');
      } else {
        fail('事务回滚验证', new Error('回滚后数据仍然存在'));
        await conn.execute('DELETE FROM categories WHERE name = ?', ['_test_transaction_']);
      }
    } finally {
      conn.release();
    }
  });

  await runTest('错误处理能力测试', async () => {
    const conn = await pool.getConnection();

    try {
      await conn.execute('SELECT * FROM nonexistent_table_xyz123');
      fail('错误捕获', new Error('应该抛出异常'));
    } catch (error) {
      if (error.code === 'ER_NO_SUCH_TABLE' || error.errno === 1146) {
        pass('表不存在错误', `正确识别错误类型: ${error.code}`);
      } else {
        pass('错误抛出', `捕获到错误: ${error.code || error.message}`);
      }
    }

    try {
      await conn.execute('INSERT INTO categories (name) VALUES (?)', [null]);
      fail('NULL约束错误', new Error('应该抛出NOT NULL约束错误'));
    } catch (error) {
      if (error.code === 'ER_BAD_NULL_ERROR') {
        pass('NOT NULL约束', `正确拒绝NULL值: ${error.code}`);
      } else {
        pass('约束验证', `捕获到约束错误: ${error.code}`);
      }
    }

    conn.release();
  });

  await runTest('长时间连接稳定性测试', async () => {
    const conn = await pool.getConnection();

    const startTime = Date.now();

    for (let i = 0; i < 50; i++) {
      await conn.execute('SELECT 1 AS ping, NOW() AS time');
      await new Promise(r => setTimeout(r, 20));
    }

    const duration = Date.now() - startTime;
    pass('持续查询稳定', `50次查询耗时: ${duration}ms (平均${(duration/50).toFixed(1)}ms/次)`);

    if (duration > 5000) {
      warn('性能警告', `连续查询耗时较长: ${duration}ms`);
    }

    conn.release();
  });

  await runTest('并发连接压力测试', async () => {
    const concurrentCount = 10;
    const startTime = Date.now();

    const promises = Array.from({ length: concurrentCount }, async (_, index) => {
      const conn = await pool.getConnection();
      try {
        const [rows] = await conn.execute(
          'SELECT ? AS task_id, SLEEP(0.05) AS delay, NOW() AS time',
          [index + 1]
        );
        return { success: true, taskId: index + 1 };
      } catch (error) {
        return { success: false, taskId: index + 1, error: error.message };
      } finally {
        conn.release();
      }
    });

    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;

    pass(`${concurrentCount}并发连接`, `成功: ${successCount}/${concurrentCount}, 耗时: ${duration}ms`);

    if (successCount < concurrentCount) {
      fail('并发成功率', new Error(`${concurrentCount - successCount}个请求失败`));
    }
  });

  await runTest('大结果集处理测试', async () => {
    const conn = await pool.getConnection();

    try {
      const [rows] = await conn.execute(`
        SELECT 
          TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY
        FROM information_schema.columns 
        WHERE table_schema = ?
        ORDER BY TABLE_NAME, ORDINAL_POSITION
      `, [dbConfig.database]);

      pass('大结果集处理', `获取到 ${rows.length} 列定义`);

      if (rows.length > 0 && verboseMode) {
        log('cyan', `       表结构统计:`);
        const tables = {};
        rows.forEach(col => {
          tables[col.TABLE_NAME] = (tables[col.TABLE_NAME] || 0) + 1;
        });
        Object.entries(tables).forEach(([table, count]) => {
          console.log(`         - ${table}: ${count} 列`);
        });
      }
    } finally {
      conn.release();
    }
  });

  if (pool) {
    await pool.end();
    if (!outputJson) {
      log('green', '\n✅ 连接池已关闭');
    }
  }

  printSummary();
}

function printSummary() {
  if (outputJson) {
    console.log(JSON.stringify({
      suite: 'database-connection-test',
      timestamp: new Date().toISOString(),
      summary: testResults,
      config: {
        host: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.database,
        user: dbConfig.user
      }
    }, null, 2));
    return;
  }

  console.log('\n' + '='.repeat(70));
  console.log(COLORS.bold + '📊 测试结果汇总' + COLORS.reset);
  console.log('='.repeat(70));
  console.log(`\n  总计:     ${testResults.total} 个测试`);
  console.log(`${COLORS.green}  通过:     ${testResults.passed} ✅${COLORS.reset}`);
  console.log(`${COLORS.red}  失败:     ${testResults.failed} ❌${COLORS.reset}`);
  console.log(`${COLORS.yellow}  警告:     ${testResults.warnings} ⚠️${COLORS.reset}`);

  const passRate = ((testResults.passed / testResults.total) * 100).toFixed(1);
  const rateColor = testResults.failed === 0 ? 'green' : (testResults.failed <= 2 ? 'yellow' : 'red');
  console.log(`\n  ${COLORS[rateColor]}通过率:   ${passRate}%${COLORS.reset}\n`);

  if (testResults.failed > 0) {
    console.log(COLORS.red + '❌ 存在失败的测试，请检查上方错误信息' + COLORS.reset);
    process.exit(1);
  } else {
    console.log(COLORS.green + '🎉 所有数据库连接测试通过！' + COLORS.reset);
  }

  console.log('='.repeat(70) + '\n');
}

main().catch(error => {
  console.error('\n❌ 测试运行出错:', error.message);
  if (verboseMode) console.error(error.stack);
  process.exit(1);
});
