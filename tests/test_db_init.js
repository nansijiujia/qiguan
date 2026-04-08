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
let targetTable = null;

function parseArgs() {
  const args = process.argv.slice(2);
  verboseMode = args.includes('--verbose') || args.includes('-v');
  outputJson = args.includes('--json') || args.includes('-j');

  const tableIndex = args.indexOf('--table');
  if (tableIndex !== -1 && args[tableIndex + 1]) {
    targetTable = args[tableIndex + 1];
  }
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
  charset: 'utf8mb4',
  timezone: '+08:00',
  connectTimeout: 60000,
  multipleStatements: true
};

const EXPECTED_TABLES = [
  { name: 'categories', description: '分类表' },
  { name: 'products', description: '商品表' },
  { name: 'users', description: '用户表' },
  { name: 'orders', description: '订单表' },
  { name: 'order_items', description: '订单项表' },
  { name: 'content', description: '内容表（可选）' }
];

async function main() {
  parseArgs();

  if (!outputJson) {
    console.log('\n' + '='.repeat(70));
    console.log(COLORS.bold + '🗄️  数据库初始化验证测试套件' + COLORS.reset);
    console.log(COLORS.cyan + `   测试时间: ${new Date().toISOString()}` + COLORS.reset);
    if (targetTable) console.log(COLORS.yellow + `   目标表: ${targetTable}` + COLORS.reset);
    console.log('='.repeat(70) + '\n');
  }

  let pool;

  try {
    pool = mysql.createPool(dbConfig);

    await runTest('数据库连接验证', async () => {
      const conn = await pool.getConnection();
      const [rows] = await conn.execute('SELECT 1 AS test');
      pass('数据库连接成功');
      conn.release();
    });

    await runTest('执行初始化脚本', async () => {
      const initSqlPath = path.join(__dirname, '..', 'database', 'mysql_init.sql');

      if (!fs.existsSync(initSqlPath)) {
        warn('初始化脚本', `未找到文件: ${initSqlPath}`);
        return;
      }

      pass('找到初始化脚本', `路径: ${initSqlPath}`);

      const sqlContent = fs.readFileSync(initSqlPath, 'utf-8');

      const conn = await pool.getConnection();

      try {
        const statements = sqlContent
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

        let executedCount = 0;
        for (const stmt of statements) {
          if (
            stmt.toUpperCase().startsWith('CREATE DATABASE') ||
            stmt.toUpperCase().startsWith('USE ')
          ) {
            continue;
          }
          try {
            await conn.query(stmt);
            executedCount++;
          } catch (err) {
            if (err.code === 'ER_TABLE_EXISTS_ERROR' || err.code === 'ER_DB_CREATE_EXISTS') {
              continue;
            }
            throw err;
          }
        }

        pass('SQL语句执行', `成功执行 ${executedCount} 条语句`);
      } finally {
        conn.release();
      }
    });

    await runTest('核心表存在性检查', async () => {
      const conn = await pool.getConnection();

      for (const tableInfo of EXPECTED_TABLES) {
        if (targetTable && tableInfo.name !== targetTable) continue;

        const [rows] = await conn.execute(
          "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = ? AND table_name = ? AND table_type = 'BASE TABLE'",
          [dbConfig.database, tableInfo.name]
        );

        const exists = rows[0].count > 0;

        if (exists) {
          pass(`表 ${tableInfo.name} 存在`, tableInfo.description);
        } else if (tableInfo.name === 'content') {
          warn(`表 ${tableInfo.name}`, `${tableInfo.description} - 可选表，不存在不影响系统运行`);
        } else {
          fail(`表 ${tableInfo.name} 不存在`, new Error(`${tableInfo.description} 未创建`));
        }
      }

      conn.release();
    });

    await runTest('Categories表结构验证', async () => {
      if (targetTable && targetTable !== 'categories') return;

      const conn = await pool.getConnection();

      const [columns] = await conn.execute(
        "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_DEFAULT FROM information_schema.columns WHERE table_schema = ? AND table_name = ? ORDER BY ORDINAL_POSITION",
        [dbConfig.database, 'categories']
      );

      if (columns.length === 0) {
        fail('Categories表结构', new Error('表不存在或无列'));
        conn.release();
        return;
      }

      pass('Categories列数', `共 ${columns.length} 列`);

      const requiredColumns = ['id', 'name', 'parent_id', 'sort_order', 'status', 'created_at', 'updated_at'];
      const columnNames = columns.map(c => c.COLUMN_NAME);

      for (const col of requiredColumns) {
        if (columnNames.includes(col)) {
          pass(`列 ${col} 存在`);
        } else {
          fail(`缺少列 ${col}`, new Error('必需列缺失'));
        }
      }

      const idCol = columns.find(c => c.COLUMN_NAME === 'id');
      if (idCol && idCol.COLUMN_KEY === 'PRI') {
        pass('主键设置', 'id 列为主键');
      }

      const nameCol = columns.find(c => c.COLUMN_NAME === 'name');
      if (nameCol && nameCol.IS_NULLABLE === 'NO') {
        pass('NOT NULL约束', 'name 列不允许为空');
      }

      conn.release();
    });

    await runTest('Products表结构验证', async () => {
      if (targetTable && targetTable !== 'products') return;

      const conn = await pool.getConnection();

      const [columns] = await conn.execute(
        "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY FROM information_schema.columns WHERE table_schema = ? AND table_name = ? ORDER BY ORDINAL_POSITION",
        [dbConfig.database, 'products']
      );

      if (columns.length === 0) {
        fail('Products表结构', new Error('表不存在或无列'));
        conn.release();
        return;
      }

      pass('Products列数', `共 ${columns.length} 列`);

      const requiredColumns = ['id', 'name', 'description', 'price', 'original_price', 'stock', 'category_id', 'image', 'status', 'created_at', 'updated_at'];
      const columnNames = columns.map(c => c.COLUMN_NAME);

      for (const col of requiredColumns) {
        if (columnNames.includes(col)) {
          pass(`Products.${col} 存在`);
        } else {
          fail(`Products缺少列 ${col}`, new Error('必需列缺失'));
        }
      }

      const priceCol = columns.find(c => c.COLUMN_NAME === 'price');
      if (priceCol && priceCol.DATA_TYPE === 'decimal') {
        pass('价格字段类型', 'price 使用 DECIMAL 类型（精确计算）');
      }

      conn.release();
    });

    await runTest('Users表结构验证', async () => {
      if (targetTable && targetTable !== 'users') return;

      const conn = await pool.getConnection();

      const [columns] = await conn.execute(
        "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY FROM information_schema.columns WHERE table_schema = ? AND table_name = ? ORDER BY ORDINAL_POSITION",
        [dbConfig.database, 'users']
      );

      if (columns.length === 0) {
        fail('Users表结构', new Error('表不存在或无列'));
        conn.release();
        return;
      }

      pass('Users列数', `共 ${columns.length} 列`);

      const requiredColumns = ['id', 'username', 'email', 'password_hash', 'role', 'status', 'created_at', 'updated_at'];
      const columnNames = columns.map(c => c.COLUMN_NAME);

      for (const col of requiredColumns) {
        if (columnNames.includes(col)) {
          pass(`Users.${col} 存在`);
        } else {
          fail(`Users缺少列 ${col}`, new Error('必需列缺失'));
        }
      }

      const passwordCol = columns.find(c => c.COLUMN_NAME === 'password_hash');
      if (passwordCol) {
        pass('密码存储', '使用 password_hash 字段存储哈希密码（安全）');
      }

      conn.release();
    });

    await runTest('Orders表结构验证', async () => {
      if (targetTable && targetTable !== 'orders') return;

      const conn = await pool.getConnection();

      const [columns] = await conn.execute(
        "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY FROM information_schema.columns WHERE table_schema = ? AND table_name = ? ORDER BY ORDINAL_POSITION",
        [dbConfig.database, 'orders']
      );

      if (columns.length === 0) {
        fail('Orders表结构', new Error('表不存在或无列'));
        conn.release();
        return;
      }

      pass('Orders列数', `共 ${columns.length} 列`);

      const requiredColumns = ['id', 'order_no', 'user_id', 'total_amount', 'status', 'created_at', 'updated_at'];
      const columnNames = columns.map(c => c.COLUMN_NAME);

      for (const col of requiredColumns) {
        if (columnNames.includes(col)) {
          pass(`Orders.${col} 存在`);
        } else {
          fail(`Orders缺少列 ${col}`, new Error('必需列缺失'));
        }
      }

      conn.release();
    });

    await runTest('Order_Items表结构验证', async () => {
      if (targetTable && targetTable !== 'order_items') return;

      const conn = await pool.getConnection();

      const [columns] = await conn.execute(
        "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY FROM information_schema.columns WHERE table_schema = ? AND table_name = ? ORDER BY ORDINAL_POSITION",
        [dbConfig.database, 'order_items']
      );

      if (columns.length === 0) {
        fail('Order_Items表结构', new Error('表不存在或无列'));
        conn.release();
        return;
      }

      pass('Order_Items列数', `共 ${columns.length} 列`);

      const requiredColumns = ['id', 'order_id', 'product_id', 'product_name', 'quantity', 'price'];
      const columnNames = columns.map(c => c.COLUMN_NAME);

      for (const col of requiredColumns) {
        if (columnNames.includes(col)) {
          pass(`Order_Items.${col} 存在`);
        } else {
          fail(`Order_Items缺少列 ${col}`, new Error('必需列缺失'));
        }
      }

      conn.release();
    });

    await runTest('索引和外键约束检查', async () => {
      const conn = await pool.getConnection();

      const tablesToCheck = targetTable ? [targetTable] : EXPECTED_TABLES.filter(t => t.name !== 'content').map(t => t.name);

      for (const tableName of tablesToCheck) {
        const [indexes] = await conn.execute(
          "SELECT INDEX_NAME, COLUMN_NAME, CONSTRAINT_NAME FROM information_schema.statistics WHERE table_schema = ? AND table_name = ? AND INDEX_NAME != 'PRIMARY' ORDER BY INDEX_NAME, SEQ_IN_INDEX",
          [dbConfig.database, tableName]
        );

        if (indexes.length > 0) {
          const uniqueIndexes = [...new Set(indexes.filter(i => i.INDEX_NAME.startsWith('uk_')).map(i => i.INDEX_NAME))];
          const regularIndexes = [...new Set(indexes.filter(i => !i.INDEX_NAME.startsWith('uk_') && !i.INDEX_NAME.startsWith('fk_')).map(i => i.INDEX_NAME))];
          const foreignKeys = [...new Set(indexes.filter(i => i.CONSTRAINT_NAME && i.CONSTRAINT_NAME.startsWith('fk_')).map(i => i.CONSTRAINT_NAME))];

          pass(`${tableName} 索引`, `普通索引: ${regularIndexes.length}, 唯一索引: ${uniqueIndexes.length}, 外键: ${foreignKeys.length}`);

          if (foreignKeys.length > 0 && verboseMode) {
            log('cyan', `       外键: ${foreignKeys.join(', ')}`);
          }
        } else {
          warn(`${tableName} 索引`, '未发现索引，可能影响查询性能');
        }
      }

      conn.release();
    });

    await runTest('种子数据验证', async () => {
      const conn = await pool.getConnection();

      const tableCounts = {};

      for (const tableName of ['categories', 'products', 'users']) {
        if (targetTable && tableName !== targetTable) continue;

        try {
          const [rows] = await conn.execute(`SELECT COUNT(*) AS count FROM \`${tableName}\``);
          tableCounts[tableName] = rows[0].count;
          pass(`${tableName} 数据行数`, `${rows[0].count} 条记录`);
        } catch (error) {
          fail(`${tableName} 行数统计`, error);
        }
      }

      if (tableCounts.categories > 0) {
        const [sample] = await conn.execute('SELECT * FROM categories LIMIT 3');
        if (sample.length > 0 && verboseMode) {
          log('cyan', '       示例分类数据:');
          sample.forEach(row => {
            console.log(`         - ID:${row.id}, 名称:${row.name}, 状态:${row.status}`);
          });
        }
      }

      if (tableCounts.users > 0) {
        const [adminUser] = await conn.execute("SELECT username, role FROM users WHERE role = 'admin' LIMIT 1");
        if (adminUser.length > 0) {
          pass('管理员账户', `用户名: ${adminUser[0].username}, 角色: ${adminUser[0].role}`);
        } else {
          warn('管理员账户', '未找到管理员账户');
        }
      }

      conn.release();
    });

    await runTest('数据统计报告', async () => {
      const conn = await pool.getConnection();

      const stats = {};
      const tables = ['categories', 'products', 'users', 'orders', 'order_items'];

      for (const table of tables) {
        if (targetTable && table !== targetTable) continue;

        try {
          const [rows] = await conn.execute(`SELECT COUNT(*) AS count FROM \`${table}\``);
          stats[table] = rows[0].count;
        } catch {
          stats[table] = 0;
        }
      }

      if (!outputJson) {
        log('cyan', '\n  📊 数据库内容统计:');
        Object.entries(stats).forEach(([table, count]) => {
          console.log(`     ${table.padEnd(15)}: ${String(count).padStart(5)} 条记录`);
        });
      }

      const totalRecords = Object.values(stats).reduce((a, b) => a + b, 0);
      pass('总记录数', `所有表共计 ${totalRecords} 条记录`);

      conn.release();
    });

    await pool.end();
    if (!outputJson) log('green', '\n✅ 连接已关闭');

  } catch (error) {
    if (!outputJson) console.error('\n❌ 测试出错:', error.message);
    if (pool) await pool.end().catch(() => {});
    printSummary();
    process.exit(1);
  }

  printSummary();
}

function printSummary() {
  if (outputJson) {
    console.log(JSON.stringify({
      suite: 'database-init-test',
      timestamp: new Date().toISOString(),
      summary: testResults,
      config: {
        host: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.database,
        targetTable: targetTable
      }
    }, null, 2));
    return;
  }

  console.log('\n' + '='.repeat(70));
  console.log(COLORS.bold + '📊 初始化验证结果汇总' + COLORS.reset);
  console.log('='.repeat(70));
  console.log(`\n  总计:     ${testResults.total} 个测试`);
  console.log(`${COLORS.green}  通过:     ${testResults.passed} ✅${COLORS.reset}`);
  console.log(`${COLORS.red}  失败:     ${testResults.failed} ❌${COLORS.reset}`);
  console.log(`${COLORS.yellow}  警告:     ${testResults.warnings} ⚠️${COLORS.reset}`);

  const passRate = ((testResults.passed / testResults.total) * 100).toFixed(1);
  const rateColor = testResults.failed === 0 ? 'green' : (testResults.failed <= 2 ? 'yellow' : 'red');
  console.log(`\n  ${COLORS[rateColor]}通过率:   ${passRate}%${COLORS.reset}\n`);

  if (testResults.failed > 0) {
    console.log(COLORS.red + '❌ 存在失败的测试，数据库可能未正确初始化' + COLORS.reset);
    process.exit(1);
  } else {
    console.log(COLORS.green + '✅ 数据库初始化验证完成！' + COLORS.reset);
  }

  console.log('='.repeat(70) + '\n');
}

main().catch(error => {
  console.error('\n❌ 测试运行出错:', error.message);
  process.exit(1);
});
