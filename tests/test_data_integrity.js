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
  charset: 'utf8mb4',
  timezone: '+08:00',
  connectTimeout: 60000
};

let pool = null;

let integrityReport = {
  foreignKeyIssues: [],
  orphanRecords: [],
  uniquenessViolations: [],
  dataTypeIssues: [],
  nullConstraintViolations: [],
  totalRecordsChecked: 0
};

async function main() {
  parseArgs();

  if (!outputJson) {
    console.log('\n' + '='.repeat(70));
    console.log(COLORS.bold + '🔐 数据完整性验证测试套件' + COLORS.reset);
    console.log(COLORS.cyan + `   测试时间: ${new Date().toISOString()}` + COLORS.reset);
    console.log(`   数据库: ${dbConfig.database}@${dbConfig.host}:${dbConfig.port}`);
    console.log('='.repeat(70) + '\n');
  }

  try {
    pool = mysql.createPool(dbConfig);

    await runTest('数据库连接验证', async () => {
      const conn = await pool.getConnection();
      const [rows] = await conn.execute('SELECT 1 AS test');
      pass('连接成功');
      conn.release();
    });

    if (!outputJson) {
      console.log('\n' + COLORS.bold + '🔗 测试 1: 外键关系完整性检查' + COLORS.reset + '\n');
    }

    await runTest('Products → Categories 外键', async () => {
      const conn = await pool.getConnection();

      const [orphans] = await conn.execute(`
        SELECT p.id AS product_id, p.name AS product_name, p.category_id
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.category_id IS NOT NULL AND c.id IS NULL
      `);

      integrityReport.totalRecordsChecked += (await conn.execute("SELECT COUNT(*) AS count FROM products"))[0].count;

      if (orphans.length === 0) {
        pass('外键完整性', '所有商品的分类ID都指向有效的分类记录');
      } else {
        fail('孤立商品发现', new Error(`${orphans.length} 个商品引用了不存在的分类`));
        integrityReport.foreignKeyIssues.push({
          table: 'products',
          field: 'category_id',
          reference: 'categories.id',
          orphanCount: orphans.length,
          examples: orphans.slice(0, 5)
        });
        if (verboseMode) {
          orphans.forEach(o => log('yellow', `       商品ID:${o.product_id}, 名称:${o.product_name}, 无效category_id:${o.category_id}`));
        }
      }

      conn.release();
    });

    await runTest('Orders → Users 外键', async () => {
      const conn = await pool.getConnection();

      const [orphans] = await conn.execute(`
        SELECT o.id AS order_id, o.order_no, o.user_id
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        WHERE o.user_id IS NOT NULL AND u.id IS NULL
      `);

      integrityReport.totalRecordsChecked += (await conn.execute("SELECT COUNT(*) AS count FROM orders"))[0].count;

      if (orphans.length === 0) {
        pass('外键完整性', '所有订单的用户ID都指向有效的用户记录');
      } else {
        warn('孤立订单', `${orphans.length} 个订单引用了不存在的用户（可能为历史数据或游客订单）`);
        integrityReport.orphanRecords.push({
          table: 'orders',
          field: 'user_id',
          reference: 'users.id',
          orphanCount: orphans.length
        });
      }

      conn.release();
    });

    await runTest('Order_Items → Orders 外键', async () => {
      const conn = await pool.getConnection();

      const [orphans] = await conn.execute(`
        SELECT oi.id AS item_id, oi.order_id, oi.product_name
        FROM order_items oi
        LEFT JOIN orders o ON oi.order_id = o.id
        WHERE o.id IS NULL
      `);

      integrityReport.totalRecordsChecked += (await conn.execute("SELECT COUNT(*) AS count FROM order_items"))[0].count;

      if (orphans.length === 0) {
        pass('外键完整性', '所有订单项都关联到有效的订单');
      } else {
        fail('孤立订单项', new Error(`${orphans.length} 个订单项引用了不存在的订单`));
        integrityReport.foreignKeyIssues.push({
          table: 'order_items',
          field: 'order_id',
          reference: 'orders.id',
          orphanCount: orphans.length
        });
      }

      conn.release();
    });

    await runTest('Order_Items → Products 外键', async () => {
      const conn = await pool.getConnection();

      const [orphans] = await conn.execute(`
        SELECT oi.id AS item_id, oi.order_id, oi.product_id, oi.product_name
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE p.id IS NULL
      `);

      if (orphans.length === 0) {
        pass('外键完整性', '所有订单项的商品ID都指向有效商品（快照数据完整）');
      } else {
        warn('商品快照问题', `${orphans.length} 个订单项引用了已删除的商品（快照保留）`);
        integrityReport.orphanRecords.push({
          table: 'order_items',
          field: 'product_id',
          reference: 'products.id',
          note: '这是正常的，因为order_items存储的是下单时的快照'
        });
      }

      conn.release();
    });

    await runTest('Categories 自引用外键（parent_id）', async () => {
      const conn = await pool.getConnection();

      const [orphans] = await conn.execute(`
        SELECT c.id, c.name, c.parent_id
        FROM categories c
        LEFT JOIN categories parent ON c.parent_id = parent.id
        WHERE c.parent_id IS NOT NULL AND parent.id IS NULL
      `);

      if (orphans.length === 0) {
        pass('自引用完整性', '所有子分类的parent_id都指向有效的父分类');
      } else {
        fail('无效父分类', new Error(`${orphans.length} 个分类引用了不存在的父分类`));
        integrityReport.foreignKeyIssues.push({
          table: 'categories',
          field: 'parent_id',
          reference: 'categories.id (self-ref)',
          orphanCount: orphans.length
        });
      }

      const [cycles] = await conn.execute(`
        WITH RECURSIVE category_path AS (
          SELECT id, name, parent_id, CAST(id AS CHAR(1000)) AS path
          FROM categories WHERE parent_id IS NOT NULL
          UNION ALL
          SELECT c.id, c.name, c.parent_id, CONCAT(cp.path, '->', c.id)
          FROM categories c
          JOIN category_path cp ON c.parent_id = cp.id
          WHERE LENGTH(cp.path) < 1000
        )
        SELECT * FROM category_path WHERE FIND_IN_SET(id, path) > 0 LIMIT 10
      `);

      if (cycles.length === 0) {
        pass('循环引用检测', '未发现分类循环引用');
      } else {
        fail('循环引用', new Error(`发现 ${cycles.length} 个循环引用的分类关系`));
      }

      conn.release();
    });

    if (!outputJson) {
      console.log('\n' + COLORS.bold + '🔍 测试 2: 唯一性约束验证' + COLORS.reset + '\n');
    }

    await runTest('Categories.name 唯一性', async () => {
      const conn = await pool.getConnection();

      const [duplicates] = await conn.execute(`
        SELECT name, COUNT(*) AS count
        FROM categories
        GROUP BY name
        HAVING count > 1
      `);

      if (duplicates.length === 0) {
        pass('唯一性约束', '所有分类名称都是唯一的');
      } else {
        fail('重复名称', new Error(`${duplicates.length} 组重复的分类名称`));
        integrityReport.uniquenessViolations.push({
          table: 'categories',
          column: 'name',
          duplicateGroups: duplicates.length,
          examples: duplicates.slice(0, 3)
        });
      }

      conn.release();
    });

    await runTest('Users.username 唯一性', async () => {
      const conn = await pool.getConnection();

      const [duplicates] = await conn.execute(`
        SELECT username, COUNT(*) AS count
        FROM users
        GROUP BY username
        HAVING count > 1
      `);

      if (duplicates.length === 0) {
        pass('唯一性约束', '所有用户名都是唯一的');
      } else {
        fail('重复用户名', new Error(`${duplicates.length} 组重复的用户名`));
        integrityReport.uniquenessViolations.push({
          table: 'users',
          column: 'username',
          duplicateGroups: duplicates.length
        });
      }

      conn.release();
    });

    await runTest('Users.email 唯一性', async () => {
      const conn = await pool.getConnection();

      const [duplicates] = await conn.execute(`
        SELECT email, COUNT(*) AS count
        FROM users
        GROUP BY email
        HAVING count > 1
      `);

      if (duplicates.length === 0) {
        pass('唯一性约束', '所有邮箱地址都是唯一的');
      } else {
        fail('重复邮箱', new Error(`${duplicates.length} 组重复的邮箱地址`));
        integrityReport.uniquenessViolations.push({
          table: 'users',
          column: 'email',
          duplicateGroups: duplicates.length
        });
      }

      conn.release();
    });

    await runTest('Orders.order_no 唯一性', async () => {
      const conn = await pool.getConnection();

      const [duplicates] = await conn.execute(`
        SELECT order_no, COUNT(*) AS count
        FROM orders
        GROUP BY order_no
        HAVING count > 1
      `);

      if (duplicates.length === 0) {
        pass('唯一性约束', '所有订单编号都是唯一的');
      } else {
        fail('重复订单号', new Error(`${duplicates.length} 组重复的订单号 - 严重问题！`));
        integrityReport.uniquenessViolations.push({
          table: 'orders',
          column: 'order_no',
          duplicateGroups: duplicates.length,
          severity: 'critical'
        });
      }

      conn.release();
    });

    await runTest('Order_Items 复合唯一性 (order_id, product_id)', async () => {
      const conn = await pool.getConnection();

      const [duplicates] = await conn.execute(`
        SELECT order_id, product_id, COUNT(*) AS count
        FROM order_items
        GROUP BY order_id, product_id
        HAVING count > 1
      `);

      if (duplicates.length === 0) {
        pass('复合唯一性', '同一订单中没有重复的商品');
      } else {
        fail('重复订单项', new Error(`${duplicates.length} 个订单包含重复商品`));
        integrityReport.uniquenessViolations.push({
          table: 'order_items',
          columns: ['order_id', 'product_id'],
          duplicateGroups: duplicates.length
        });
      }

      conn.release();
    });

    if (!outputJson) {
      console.log('\n' + COLORS.bold + '📋 测试 3: 数据类型一致性检查' + COLORS.reset + '\n');
    }

    await runTest('Products.price 数据类型验证（DECIMAL）', async () => {
      const conn = await pool.getConnection();

      const [invalidPrices] = await conn.execute(`
        SELECT id, name, price
        FROM products
        WHERE price < 0 OR price IS NULL
      `);

      if (invalidPrices.length === 0) {
        pass('价格有效性', '所有商品价格都 >= 0 且不为空');
      } else {
        fail('无效价格', new Error(`${invalidPrices.length} 个商品价格无效`));
        integrityReport.dataTypeIssues.push({
          table: 'products',
          column: 'price',
          issue: 'negative_or_null',
          count: invalidPrices.length
        });
      }

      const [precisionCheck] = await conn.execute(`
        SELECT id, name, price
        FROM products
        WHERE price != ROUND(price, 2)
        LIMIT 10
      `);

      if (precisionCheck.length === 0) {
        pass('精度验证', '所有价格精度正确（最多2位小数）');
      } else {
        warn('精度警告', `${precisionCheck.length} 个商品价格超过2位小数`);
      }

      conn.release();
    });

    await runTest('Products.stock 非负整数验证', async () => {
      const conn = await pool.getConnection();

      const [invalidStock] = await conn.execute(`
        SELECT id, name, stock
        FROM products
        WHERE stock < 0 OR stock IS NULL
      `);

      if (invalidStock.length === 0) {
        pass('库存有效性', '所有商品库存都 >= 0');
      } else {
        fail('无效库存', new Error(`${invalidStock.length} 个商品库存为负数或空`));
        integrityReport.dataTypeIssues.push({
          table: 'products',
          column: 'stock',
          issue: 'negative_or_null',
          count: invalidStock.length
        });
      }

      conn.release();
    });

    await runTest('Orders.total_amount 非负验证', async () => {
      const conn = await pool.getConnection();

      const [invalidAmounts] = await conn.execute(`
        SELECT id, order_no, total_amount
        FROM orders
        WHERE total_amount < 0 OR total_amount IS NULL
      `);

      if (invalidAmounts.length === 0) {
        pass('金额有效性', '所有订单金额都 >= 0');
      } else {
        fail('无效金额', new Error(`${invalidAmounts.length} 个订单金额无效`));
        integrityReport.dataTypeIssues.push({
          table: 'orders',
          column: 'total_amount',
          issue: 'negative_or_null',
          count: invalidAmounts.length
        });
      }

      conn.release();
    });

    await runTest('Order_Items.quantity 正整数验证', async () => {
      const conn = await pool.getConnection();

      const [invalidQty] = await conn.execute(`
        SELECT id, order_id, quantity
        FROM order_items
        WHERE quantity <= 0 OR quantity IS NULL
      `);

      if (invalidQty.length === 0) {
        pass('数量有效性', '所有订单项数量都 > 0');
      } else {
        fail('无效数量', new Error(`${invalidQty.length} 个订单项数量无效（必须 > 0）`));
        integrityReport.dataTypeIssues.push({
          table: 'order_items',
          column: 'quantity',
          issue: 'not_positive',
          count: invalidQty.length
        });
      }

      conn.release();
    });

    if (!outputJson) {
      console.log('\n' + COLORS.bold + '✅ 测试 4: 必填字段非空检查' + COLORS.reset + '\n');
    }

    await runTest('Categories 必填字段非空检查', async () => {
      const conn = await pool.getConnection();

      const checks = [
        { col: 'name', desc: '分类名称' },
        { col: 'status', desc: '状态' },
        { col: 'created_at', desc: '创建时间' }
      ];

      let allValid = true;
      for (const check of checks) {
        const [nulls] = await conn.execute(
          `SELECT id FROM categories WHERE \`${check.col}\` IS NULL`
        );
        if (nulls.length > 0) {
          allValid = false;
          fail(`${check.desc}`, new Error(`${nulls.length} 条记录的 ${check.col} 为空`));
          integrityReport.nullConstraintViolations.push({
            table: 'categories',
            column: check.col,
            nullCount: nulls.length
          });
        } else {
          pass(`${check.desc} 非空`, `所有记录的 ${check.col} 字段都有值`);
        }
      }

      conn.release();
    });

    await runTest('Users 必填字段非空检查', async () => {
      const conn = await pool.getConnection();

      const checks = [
        { col: 'username', desc: '用户名' },
        { col: 'email', desc: '邮箱' },
        { col: 'password_hash', desc: '密码哈希' },
        { col: 'role', desc: '角色' },
        { col: 'status', desc: '状态' }
      ];

      for (const check of checks) {
        const [nulls] = await conn.execute(
          `SELECT id FROM users WHERE \`${check.col}\` IS NULL`
        );
        if (nulls.length > 0) {
          fail(`${check.desc}`, new Error(`${nulls.length} 条记录的 ${check.col} 为空`));
          integrityReport.nullConstraintViolations.push({
            table: 'users',
            column: check.col,
            nullCount: nulls.length
          });
        } else {
          pass(`${check.desc} 非空`, `所有用户的 ${check.col} 字段都有值`);
        }
      }

      conn.release();
    });

    await runTest('Orders 必填字段非空检查', async () => {
      const conn = await pool.getConnection();

      const checks = [
        { col: 'order_no', desc: '订单编号' },
        { col: 'total_amount', desc: '总金额' },
        { col: 'status', desc: '状态' },
        { col: 'created_at', desc: '创建时间' }
      ];

      for (const check of checks) {
        const [nulls] = await conn.execute(
          `SELECT id FROM orders WHERE \`${check.col}\` IS NULL`
        );
        if (nulls.length > 0) {
          fail(`${check.desc}`, new Error(`${nulls.length} 条订单的 ${check.col} 为空`));
          integrityReport.nullConstraintViolations.push({
            table: 'orders',
            column: check.col,
            nullCount: nulls.length
          });
        } else {
          pass(`${check.desc} 非空`, `所有订单的 ${check.col} 字段都有值`);
        }
      }

      conn.release();
    });

    await runTest('Order_Items 必填字段非空检查', async () => {
      const conn = await pool.getConnection();

      const checks = [
        { col: 'order_id', desc: '订单ID' },
        { col: 'product_id', desc: '商品ID' },
        { col: 'product_name', desc: '商品名称' },
        { col: 'quantity', desc: '数量' },
        { col: 'price', desc: '单价' }
      ];

      for (const check of checks) {
        const [nulls] = await conn.execute(
          `SELECT id FROM order_items WHERE \`${check.col}\` IS NULL`
        );
        if (nulls.length > 0) {
          fail(`${check.desc}`, new Error(`${nulls.length} 条订单项的 ${check.col} 为空`));
          integrityReport.nullConstraintViolations.push({
            table: 'order_items',
            column: check.col,
            nullCount: nulls.length
          });
        } else {
          pass(`${check.desc} 非空`, `所有订单项的 ${check.col} 都有值`);
        }
      }

      conn.release();
    });

    if (!outputJson) {
      console.log('\n' + COLORS.bold + '📊 数据质量报告生成' + COLORS.reset + '\n');
    }

    await runTest('生成数据质量汇总报告', async () => {
      const totalIssues =
        integrityReport.foreignKeyIssues.length +
        integrityReport.orphanRecords.length +
        integrityReport.uniquenessViolations.length +
        integrityReport.dataTypeIssues.length +
        integrityReport.nullConstraintViolations.length;

      pass('检查完成', `共检查 ${integrityReport.totalRecordsChecked} 条记录`);

      if (totalIssues === 0) {
        pass('数据质量评级', '✅ 优秀 - 未发现任何数据完整性问题');
      } else if (totalIssues <= 3) {
        warn('数据质量评级', `⚠️ 良好 - 发现 ${totalIssues} 个轻微问题`);
      } else if (totalIssues <= 10) {
        warn('数据质量评级', `⚠️ 一般 - 发现 ${totalItems} 个问题需要关注`);
      } else {
        fail('数据质量评级', new Error(`❌ 较差 - 发现 ${totalIssues} 个严重问题需要立即处理`));
      }

      if (!outputJson && totalIssues > 0) {
        console.log('\n       问题摘要:');
        if (integrityReport.foreignKeyIssues.length > 0) {
          console.log(`         🔴 外键问题: ${integrityReport.foreignKeyIssues.length} 项`);
        }
        if (integrityReport.orphanRecords.length > 0) {
          console.log(`         🟡 孤立记录: ${integrityReport.orphanRecords.length} 项`);
        }
        if (integrityReport.uniquenessViolations.length > 0) {
          console.log(`         🟠 唯一性冲突: ${integrityReport.uniquenessViolations.length} 项`);
        }
        if (integrityReport.dataTypeIssues.length > 0) {
          console.log(`         🟣 数据类型异常: ${integrityReport.dataTypeIssues.length} 项`);
        }
        if (integrityReport.nullConstraintViolations.length > 0) {
          console.log(`         ⚫ 空值违规: ${integrityReport.nullConstraintViolations.length} 项`);
        }
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
      suite: 'data-integrity-test',
      timestamp: new Date().toISOString(),
      summary: testResults,
      config: {
        host: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.database
      },
      integrityReport
    }, null, 2));
    return;
  }

  console.log('\n' + '='.repeat(70));
  console.log(COLORS.bold + '📊 数据完整性验证结果汇总' + COLORS.reset);
  console.log('='.repeat(70));
  console.log(`\n  总计:     ${testResults.total} 个测试`);
  console.log(`${COLORS.green}  通过:     ${testResults.passed} ✅${COLORS.reset}`);
  console.log(`${COLORS.red}  失败:     ${testResults.failed} ❌${COLORS.reset}`);
  console.log(`${COLORS.yellow}  警告:     ${testResults.warnings} ⚠️${COLORS.reset}`);

  const passRate = ((testResults.passed / testResults.total) * 100).toFixed(1);
  const rateColor = testResults.failed === 0 ? 'green' : (testResults.failed <= 3 ? 'yellow' : 'red');
  console.log(`\n  ${COLORS[rateColor]}通过率:   ${passRate}%${COLORS.reset}\n`);

  if (testResults.failed > 0) {
    console.log(COLORS.red + '❌ 存在数据完整性问题，建议修复后再部署到生产环境' + COLORS.reset);
    process.exit(1);
  } else {
    console.log(COLORS.green + '✅ 数据完整性验证通过！数据库数据质量良好。' + COLORS.reset);
  }

  console.log('='.repeat(70) + '\n');
}

main().catch(error => {
  console.error('\n❌ 测试运行出错:', error.message);
  process.exit(1);
});
