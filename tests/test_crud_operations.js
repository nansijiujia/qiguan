require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const path = require('path');

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
  connectTimeout: 60000
};

let pool = null;
let conn = null;

async function getConnection() {
  if (!conn) {
    conn = await pool.getConnection();
  }
  return conn;
}

async function cleanupTestData() {
  try {
    const c = await getConnection();
    await c.execute("DELETE FROM order_items WHERE product_name LIKE '_CRUD_TEST_%'");
    await c.execute("DELETE FROM orders WHERE customer_name LIKE '_CRUD_TEST_%'");
    await c.execute("DELETE FROM products WHERE name LIKE '_CRUD_TEST_%'");
    await c.execute("DELETE FROM categories WHERE name LIKE '_CRUD_TEST_%'");
    await c.execute("DELETE FROM users WHERE username LIKE '_CRUD_TEST_%'");
  } catch (err) {
    warn('清理数据', err.message);
  }
}

async function main() {
  parseArgs();

  if (!outputJson) {
    console.log('\n' + '='.repeat(70));
    console.log(COLORS.bold + '📝 CRUD操作集成测试套件' + COLORS.reset);
    console.log(COLORS.cyan + `   测试时间: ${new Date().toISOString()}` + COLORS.reset);
    if (targetTable) console.log(COLORS.yellow + `   目标表: ${targetTable}` + COLORS.reset);
    console.log('='.repeat(70) + '\n');
  }

  pool = mysql.createPool(dbConfig);

  try {
    await runTest('数据库连接初始化', async () => {
      conn = await pool.getConnection();
      const [rows] = await conn.execute('SELECT 1 AS test');
      pass('连接建立成功');
    });

    await cleanupTestData();

    if (!targetTable || targetTable === 'categories') {
      console.log('\n' + COLORS.bold + '📂 Categories（分类）表 CRUD 测试' + COLORS.reset + '\n');

      await runTest('[Categories] CREATE - 插入新分类', async () => {
        const c = await getConnection();
        const [result] = await c.execute(
          "INSERT INTO categories (name, parent_id, sort_order, status) VALUES (?, NULL, ?, ?)",
          ['_CRUD_TEST_电子产品分类', 100, 'active']
        );

        if (result.insertId > 0) {
          pass('插入分类成功', `ID: ${result.insertId}, 影响行数: ${result.affectedRows}`);
        } else {
          throw new Error('未返回有效的insertId');
        }
      });

      await runTest('[Categories] READ - 查询单个分类', async () => {
        const c = await getConnection();
        const [rows] = await c.execute(
          "SELECT * FROM categories WHERE name = ?",
          ['_CRUD_TEST_电子产品分类']
        );

        if (rows.length === 1) {
          const cat = rows[0];
          pass('查询单条成功', `ID: ${cat.id}, 名称: ${cat.name}, 状态: ${cat.status}`);

          if (cat.parent_id === null) pass('父级字段验证', '顶级分类 parent_id 为 null');
          if (cat.sort_order === 100) pass('排序字段验证', `sort_order: ${cat.sort_order}`);
        } else {
          throw new Error(`期望1条记录，实际${rows.length}条`);
        }
      });

      await runTest('[Categories] READ - 查询列表', async () => {
        const c = await getConnection();
        const [rows] = await c.execute(
          "SELECT * FROM categories ORDER BY sort_order ASC LIMIT 10"
        );

        pass('列表查询成功', `返回 ${rows.length} 条记录`);
        if (rows.length > 0 && verboseMode) {
          log('cyan', `       首条: ID=${rows[0].id}, 名称=${rows[0].name}`);
        }
      });

      await runTest('[Categories] READ - 模糊搜索', async () => {
        const c = await getConnection();
        const [rows] = await c.execute(
          "SELECT * FROM categories WHERE name LIKE ?",
          ['%_CRUD_TEST_%']
        );

        if (rows.length > 0) {
          pass('模糊搜索成功', `找到 ${rows.length} 条匹配记录`);
        } else {
          throw new Error('未找到测试数据');
        }
      });

      await runTest('[Categories] UPDATE - 更新分类信息', async () => {
        const c = await getConnection();
        const [updateResult] = await c.execute(
          "UPDATE categories SET name = ?, sort_order = ?, updated_at = NOW() WHERE name = ?",
          ['_CRUD_TEST_电子产品分类_已更新', 200, '_CRUD_TEST_电子产品分类']
        );

        if (updateResult.affectedRows > 0) {
          pass('更新成功', `影响行数: ${updateResult.affectedRows}`);

          const [verify] = await c.execute(
            "SELECT name, sort_order FROM categories WHERE name = ?",
            ['_CRUD_TEST_电子产品分类_已更新']
          );
          if (verify.length === 1 && verify[0].sort_order === 200) {
            pass('更新验证', `名称和排序值已更新`);
          }
        } else {
          throw new Error('未更新任何行');
        }
      });

      await runTest('[Categories] DELETE - 删除分类', async () => {
        const c = await getConnection();
        const [deleteResult] = await c.execute(
          "DELETE FROM categories WHERE name LIKE '_CRUD_TEST_%'"
        );

        if (deleteResult.affectedRows > 0) {
          pass('删除成功', `删除行数: ${deleteResult.affectedRows}`);

          const [verify] = await c.execute(
            "SELECT COUNT(*) AS count FROM categories WHERE name LIKE '_CRUD_TEST_%'"
          );
          if (verify[0].count === 0) {
            pass('删除验证', '数据已完全清除');
          }
        } else {
          throw new Error('未删除任何行');
        }
      });
    }

    if (!targetTable || targetTable === 'products') {
      console.log('\n' + COLORS.bold + '🛍️  Products（商品）表 CRUD 测试' + COLORS.reset + '\n');

      let testCategoryId = null;

      await runTest('[Products] 准备测试分类', async () => {
        const c = await getConnection();
        const [result] = await c.execute(
          "INSERT INTO categories (name, sort_order, status) VALUES (?, 999, ?)",
          ['_CRUD_TEST_测试分类', 'active']
        );
        testCategoryId = result.insertId;
        pass('创建测试分类', `ID: ${testCategoryId}`);
      });

      await runTest('[Products] CREATE - 插入新商品（完整字段）', async () => {
        const c = await getConnection();
        const [result] = await c.execute(
          `INSERT INTO products (name, description, price, original_price, stock, category_id, image, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            '_CRUD_TEST_测试商品',
            '这是一个用于CRUD测试的商品描述，包含完整的商品信息',
            299.99,
            499.99,
            50,
            testCategoryId,
            'https://example.com/test-product.jpg',
            'active'
          ]
        );

        if (result.insertId > 0) {
          pass('插入商品成功', `ID: ${result.insertId}, 价格: ¥299.99, 库存: 50`);
        } else {
          throw new Error('未返回有效的insertId');
        }
      });

      await runTest('[Products] READ - 分页查询', async () => {
        const c = await getConnection();
        const page = 1;
        const pageSize = 5;
        const offset = (page - 1) * pageSize;

        const [rows] = await c.execute(
          "SELECT * FROM products ORDER BY id DESC LIMIT ? OFFSET ?",
          [pageSize, offset]
        );

        pass('分页查询成功', `第${page}页, 返回 ${rows.length}/${pageSize} 条`);

        const [countResult] = await c.execute("SELECT COUNT(*) AS total FROM products");
        const total = countResult[0].total;
        const totalPages = Math.ceil(total / pageSize);
        pass('分页统计', `总计 ${total} 条, 共 ${totalPages} 页`);
      });

      await runTest('[Products] READ - 条件筛选', async () => {
        const c = await getConnection();
        const [activeProducts] = await c.execute(
          "SELECT * FROM products WHERE status = ? AND price >= ? AND stock > ?",
          ['active', 100, 10]
        );

        pass('条件筛选成功', `状态=active, 价格>=100, 库存>10: ${activeProducts.length} 条`);
      });

      await runTest('[Products] READ - 模糊搜索', async () => {
        const c = await getConnection();
        const [rows] = await c.execute(
          "SELECT * FROM products WHERE name LIKE ? OR description LIKE ?",
          ['%_CRUD_TEST_%', '%CRUD测试%']
        );

        if (rows.length > 0) {
          pass('模糊搜索成功', `找到 ${rows.length} 条匹配商品`);
        } else {
          warn('模糊搜索', '未找到匹配的测试商品');
        }
      });

      await runTest('[Products] READ - 排序查询', async () => {
        const c = await getConnection();
        const [byPriceAsc] = await c.execute(
          "SELECT id, name, price FROM products WHERE status = ? ORDER BY price ASC LIMIT 3",
          ['active']
        );
        pass('价格升序', `${byPriceAsc.length} 条结果`);

        const [byPriceDesc] = await c.execute(
          "SELECT id, name, price FROM products WHERE status = ? ORDER BY price DESC LIMIT 3",
          ['active']
        );
        pass('价格降序', `${byPriceDesc.length} 条结果`);

        if (verboseMode && byPriceAsc.length > 0) {
          log('cyan', `       最低价: ¥${byPriceAsc[0].price}, 最高价: ¥${byPriceDesc[0]?.price}`);
        }
      });

      await runTest('[Products] UPDATE - 更新商品信息', async () => {
        const c = await getConnection();
        const [result] = await c.execute(
          "UPDATE products SET name = ?, description = ?, price = ?, updated_at = NOW() WHERE name LIKE '_CRUD_TEST_%'",
          ['_CRUD_TEST_更新后的商品', '描述已更新', 399.99]
        );

        if (result.affectedRows > 0) {
          pass('基本信息更新', `影响行数: ${result.affectedRows}, 新价格: ¥399.99`);
        }
      });

      await runTest('[Products] UPDATE - 更新库存', async () => {
        const c = await getConnection();
        const [result] = await c.execute(
          "UPDATE products SET stock = stock + ? WHERE name LIKE '_CRUD_TEST_%'",
          [20]
        );

        if (result.affectedRows > 0) {
          pass('库存更新', `库存增加20件`);

          const [verify] = await c.execute(
            "SELECT stock FROM products WHERE name LIKE '_CRUD_TEST_%'"
          );
          if (verify.length > 0) {
            pass('库存验证', `当前库存: ${verify[0].stock}`);
          }
        }
      });

      await runTest('[Products] DELETE - 删除商品', async () => {
        const c = await getConnection();
        const [result] = await c.execute(
          "DELETE FROM products WHERE name LIKE '_CRUD_TEST_%'"
        );

        if (result.affectedRows > 0) {
          pass('删除商品成功', `删除 ${result.affectedRows} 条记录`);
        } else {
          warn('删除商品', '没有可删除的测试商品');
        }
      });
    }

    if (!targetTable || targetTable === 'users') {
      console.log('\n' + COLORS.bold + '👤 Users（用户）表 CRUD 测试' + COLORS.reset + '\n');

      const testPassword = 'TestPass123!';
      let hashedPassword = null;
      let testUserId = null;

      await runTest('[Users] CREATE - 注册新用户（密码哈希）', async () => {
        const c = await getConnection();
        hashedPassword = await bcrypt.hash(testPassword, 10);

        const [result] = await c.execute(
          `INSERT INTO users (username, email, password_hash, role, status)
           VALUES (?, ?, ?, ?, ?)`,
          [`_CRUD_TEST_testuser`, `_CRUD_TEST_test@example.com`, hashedPassword, 'user', 'active']
        );

        testUserId = result.insertId;
        if (testUserId > 0) {
          pass('用户注册成功', `ID: ${testUserId}, 用户名: _CRUD_TEST_testuser`);
          pass('密码哈希', `bcrypt哈希长度: ${hashedPassword.length} 字符`);
        }
      });

      await runTest('[Users] READ - 查询用户信息（不含明文密码）', async () => {
        const c = await getConnection();
        const [users] = await c.execute(
          "SELECT id, username, email, role, status, created_at FROM users WHERE username = ?",
          ['_CRUD_TEST_testuser']
        );

        if (users.length === 1) {
          const user = users[0];
          pass('用户查询成功', `用户名: ${user.username}, 邮箱: ${user.email}, 角色: ${user.role}`);

          if (!user.password_hash) {
            pass('安全性检查', '查询结果不包含password_hash字段');
          }

          const [withHash] = await c.execute(
            "SELECT password_hash FROM users WHERE id = ?",
            [testUserId]
          );
          if (withHash.length === 1 && withHash[0].password_hash !== testPassword) {
            pass('密码存储安全', '密码以哈希形式存储，非明文');
          }
        } else {
          throw new Error('未找到测试用户');
        }
      });

      await runTest('[Users] 密码验证测试', async () => {
        const c = await getConnection();
        const [users] = await c.execute(
          "SELECT password_hash FROM users WHERE id = ?",
          [testUserId]
        );

        if (users.length > 0) {
          const isValid = await bcrypt.compare(testPassword, users[0].password_hash);
          if (isValid) {
            pass('密码验证', '正确密码验证通过');
          } else {
            throw new Error('正确密码验证失败');
          }

          const isWrongInvalid = !(await bcrypt.compare('wrongpassword', users[0].password_hash));
          if (isWrongInvalid) {
            pass('错误密码拒绝', '错误密码被正确拒绝');
          }
        }
      });

      await runTest('[Users] UPDATE - 更新用户资料', async () => {
        const c = await getConnection();
        const [result] = await c.execute(
          "UPDATE users SET email = ?, avatar = ?, updated_at = NOW() WHERE username = ?",
          ['_CRUD_TEST_newemail@test.com', 'https://example.com/avatar.jpg', '_CRUD_TEST_testuser']
        );

        if (result.affectedRows > 0) {
          pass('资料更新成功', `邮箱已更新为: _CRUD_TEST_newemail@test.com`);
        }
      });

      await runTest('[Users] UPDATE - 修改密码', async () => {
        const c = await getConnection();
        const newPassword = 'NewSecurePass456!';
        const newHashedPassword = await bcrypt.hash(newPassword, 10);

        const [result] = await c.execute(
          "UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?",
          [newHashedPassword, testUserId]
        );

        if (result.affectedRows > 0) {
          pass('密码修改成功', '密码哈希已更新');

          const [verify] = await c.execute(
            "SELECT password_hash FROM users WHERE id = ?",
            [testUserId]
          );
          const isNewValid = await bcrypt.compare(newPassword, verify[0].password_hash);
          const isOldInvalid = !(await bcrypt.compare(testPassword, verify[0].password_hash));

          if (isNewValid && isOldInvalid) {
            pass('新旧密码验证', '新密码可用，旧密码已失效');
          }
        }
      });

      await runTest('[Users] UPDATE - 角色变更', async () => {
        const c = await getConnection();
        const [result] = await c.execute(
          "UPDATE users SET role = ? WHERE username = ?",
          ['manager', '_CRUD_TEST_testuser']
        );

        if (result.affectedRows > 0) {
          pass('角色变更', '角色从 user 变更为 manager');
        }
      });

      await runTest('[Users] DELETE - 删除用户', async () => {
        const c = await getConnection();
        const [result] = await c.execute(
          "DELETE FROM users WHERE username LIKE '_CRUD_TEST_%'"
        );

        if (result.affectedRows > 0) {
          pass('用户删除成功', `删除 ${result.affectedRows} 个用户`);

          const [verify] = await c.execute(
            "SELECT COUNT(*) AS count FROM users WHERE username LIKE '_CRUD_TEST_%'"
          );
          if (verify[0].count === 0) {
            pass('删除验证', '用户数据已清除');
          }
        }
      });
    }

    if (!targetTable || targetTable === 'orders') {
      console.log('\n' + COLORS.bold + '📦 Orders（订单）表 CRUD 测试' + COLORS.reset + '\n');

      let testOrderId = null;
      let testProductId = null;
      let testUserId_forOrder = null;

      await runTest('[Orders] 准备测试数据', async () => {
        const c = awaitgetConnection();

        const [userResult] = await c.execute(
          "INSERT INTO users (username, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)",
          ['_CRUD_TEST_orderuser', '_CRUD_TEST_order@test.com', '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'user', 'active']
        );
        testUserId_forOrder = userResult.insertId;

        const [productResult] = await c.execute(
          "INSERT INTO products (name, description, price, stock, status) VALUES (?, ?, ?, ?, ?)",
          ['_CRUD_TEST_订单测试商品', '用于订单CRUD测试', 199.99, 100, 'active']
        );
        testProductId = productResult.insertId;

        pass('测试数据准备完成', `用户ID: ${testUserId_forOrder}, 商品ID: ${testProductId}`);
      });

      await runTest('[Orders] CREATE - 创建订单', async () => {
        const c = await getConnection();
        const orderNo = `ORD${Date.now()}`;

        const [result] = await c.execute(
          `INSERT INTO orders (order_no, user_id, customer_name, customer_phone, total_amount, status, shipping_address)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [orderNo, testUserId_forOrder, '_CRUD_TEST_测试客户', '13800138000', 199.99, 'pending', '{"address":"测试地址123"}']
        );

        testOrderId = result.insertId;
        if (testOrderId > 0) {
          pass('订单创建成功', `订单号: ${orderNo}, 订单ID: ${testOrderId}, 金额: ¥199.99`);
        }
      });

      await runTest('[Orders] CREATE - 创建订单项', async () => {
        const c = await getConnection();
        const [result] = await c.execute(
          "INSERT INTO order_items (order_id, product_id, product_name, quantity, price) VALUES (?, ?, ?, ?, ?)",
          [testOrderId, testProductId, '_CRUD_TEST_订单测试商品', 2, 199.99]
        );

        if (result.insertId > 0) {
          pass('订单项创建成功', `订单项ID: ${result.insertId}, 数量: 2, 单价: ¥199.99`);
        }
      });

      await runTest('[Orders] READ - 查询订单详情（JOIN订单项）', async () => {
        const c = await getConnection();
        const [orders] = await c.execute(
          `SELECT o.*, 
                  JSON_ARRAYAGG(
                    JSON_OBJECT(
                      'item_id', oi.id,
                      'product_name', oi.product_name,
                      'quantity', oi.quantity,
                      'price', oi.price
                    )
                  ) AS items
           FROM orders o
           LEFT JOIN order_items oi ON o.id = oi.order_id
           WHERE o.id = ?
           GROUP BY o.id`,
          [testOrderId]
        );

        if (orders.length === 1) {
          const order = orders[0];
          pass('订单详情查询', `订单号: ${order.order_no}, 状态: ${order.status}, 客户: ${order.customer_name}`);

          if (order.items) {
            pass('关联订单项', `包含订单项数据`);
            if (verboseMode) {
              log('cyan', `       订单项: ${order.items}`);
            }
          }
        } else {
          throw new Error('未找到订单');
        }
      });

      await runTest('[Orders] READ - 按用户查询订单', async () => {
        const c = await getConnection();
        const [orders] = await c.execute(
          "SELECT id, order_no, total_amount, status, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC",
          [testUserId_forOrder]
        );

        pass('用户订单查询', `用户 ${testUserId_forOrder} 有 ${orders.length} 个订单`);
      });

      await runTest('[Orders] UPDATE - 更新订单状态', async () => {
        const c = await getConnection();

        const statuses = ['pending', 'paid', 'shipped'];
        for (const status of statuses) {
          await c.execute(
            "UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?",
            [status, testOrderId]
          );
        }

        const [current] = await c.execute(
          "SELECT status FROM orders WHERE id = ?",
          [testOrderId]
        );

        if (current[0].status === 'shipped') {
          pass('状态流转', 'pending → paid → shipped');
        }
      });

      await runTest('[Orders] DELETE - 取消/删除订单', async () => {
        const c = await getConnection();

        const [itemsBefore] = await c.execute(
          "SELECT COUNT(*) AS count FROM order_items WHERE order_id = ?",
          [testOrderId]
        );

        const [result] = await c.execute(
          "DELETE FROM orders WHERE id = ?",
          [testOrderId]
        );

        if (result.affectedRows > 0) {
          pass('订单删除成功', `删除订单: ${testOrderId}`);

          const [itemsAfter] = await c.execute(
            "SELECT COUNT(*) AS count FROM order_items WHERE order_id = ?",
            [testOrderId]
          );

          if (itemsAfter[0].count < itemsBefore[0].count) {
            pass('级联删除验证', '订单项随订单一起删除（CASCADE生效）');
          }
        }
      });
    }

    if (!outputJson) {
      console.log('\n' + COLORS.green + '✅ CRUD 测试完成' + COLORS.reset);
    }

  } catch (error) {
    if (!outputJson) console.error('\n❌ 测试出错:', error.message);
    if (verboseMode) console.error(error.stack);
  } finally {
    await cleanupTestData();
    if (conn) {
      conn.release();
      conn = null;
    }
    if (pool) {
      await pool.end();
      if (!outputJson) log('green', '✅ 连接池已关闭');
    }
  }

  printSummary();
}

function printSummary() {
  if (outputJson) {
    console.log(JSON.stringify({
      suite: 'crud-operations-test',
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
  console.log(COLORS.bold + '📊 CRUD操作测试结果汇总' + COLORS.reset);
  console.log('='.repeat(70));
  console.log(`\n  总计:     ${testResults.total} 个测试`);
  console.log(`${COLORS.green}  通过:     ${testResults.passed} ✅${COLORS.reset}`);
  console.log(`${COLORS.red}  失败:     ${testResults.failed} ❌${COLORS.reset}`);
  console.log(`${COLORS.yellow}  警告:     ${testResults.warnings} ⚠️${COLORS.reset}`);

  const passRate = ((testResults.passed / testResults.total) * 100).toFixed(1);
  const rateColor = testResults.failed === 0 ? 'green' : (testResults.failed <= 3 ? 'yellow' : 'red');
  console.log(`\n  ${COLORS[rateColor]}通过率:   ${passRate}%${COLORS.reset}\n`);

  if (testResults.failed > 0) {
    console.log(COLORS.red + '❌ 存在失败的CRUD操作测试' + COLORS.reset);
    process.exit(1);
  } else {
    console.log(COLORS.green + '🎉 所有CRUD操作测试通过！' + COLORS.reset);
  }

  console.log('='.repeat(70) + '\n');
}

main().catch(error => {
  console.error('\n❌ 测试运行出错:', error.message);
  process.exit(1);
});
