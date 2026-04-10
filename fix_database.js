require('dotenv').config({path:'.env.production'});

const db = require('./db_mysql');

console.log('=== 🔧 数据库结构修复工具 ===\n');

async function fixDatabase() {
  try {
    await db.initPool();
    console.log('✅ 数据库连接成功\n');

    // 1. 创建coupons表
    console.log('1️⃣ 创建 coupons 表...');
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS coupons (
          id INT AUTO_INCREMENT PRIMARY KEY,
          code VARCHAR(50) NOT NULL UNIQUE,
          type ENUM('percentage','fixed') NOT NULL DEFAULT 'percentage',
          value DECIMAL(10,2) NOT NULL,
          min_order_amount DECIMAL(10,2) DEFAULT 0,
          max_discount DECIMAL(10,2) NULL,
          usage_limit INT DEFAULT 100,
          used_count INT DEFAULT 0,
          start_date DATETIME NOT NULL,
          end_date DATETIME NOT NULL,
          status ENUM('active','inactive','expired') DEFAULT 'active',
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_code (code),
          INDEX idx_status (status),
          INDEX idx_dates (start_date, end_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('   ✅ coupons 表创建成功');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('   ⚠️ coupons 表已存在');
      } else {
        throw e;
      }
    }

    // 2. 检查并添加users表的status字段
    console.log('\n2️⃣ 检查 users 表字段...');
    try {
      const columns = await db.query(`DESCRIBE users`);
      const columnNames = columns.map(c => c.Field);

      if (!columnNames.includes('status')) {
        console.log('   ➕ 添加 status 字段...');
        await db.query(`
          ALTER TABLE users
          ADD COLUMN status ENUM('active','inactive','banned') NOT NULL DEFAULT 'active' AFTER role
        `);
        console.log('   ✅ status 字段添加成功');

        // 更新现有用户状态
        await db.query("UPDATE users SET status = 'active' WHERE status IS NULL OR status = ''");
        console.log('   ✅ 现有用户状态已更新为 active');
      } else {
        console.log('   ✅ status 字段已存在');
      }

      // 检查其他可能缺失的字段
      const requiredFields = [
        { name: 'avatar', sql: "ALTER TABLE users ADD COLUMN avatar VARCHAR(255) DEFAULT NULL AFTER email" },
        { name: 'phone', sql: "ALTER TABLE users ADD COLUMN phone VARCHAR(20) DEFAULT NULL AFTER avatar" },
        { name: 'last_login', sql: "ALTER TABLE users ADD COLUMN last_login DATETIME DEFAULT NULL AFTER phone" }
      ];

      for (const field of requiredFields) {
        if (!columnNames.includes(field.name)) {
          console.log(`   ➕ 添加 ${field.name} 字段...`);
          try {
            await db.query(field.sql);
            console.log(`   ✅ ${field.name} 字段添加成功`);
          } catch (e) {
            console.log(`   ⚠️ ${field.name} 字段添加失败: ${e.message}`);
          }
        }
      }

    } catch (e) {
      console.error('   ❌ 检查失败:', e.message);
    }

    // 3. 插入示例优惠券数据
    console.log('\n3️⃣ 插入测试优惠券数据...');
    try {
      const [existing] = await db.query("SELECT COUNT(*) AS count FROM coupons");
      if (existing.count === 0) {
        const now = new Date();
        const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        await db.query(`
          INSERT INTO coupons (code, type, value, min_order_amount, usage_limit, start_date, end_date, status, description)
          VALUES 
            ('WELCOME10', 'percentage', 10.00, 50.00, 100, ?, ?, 'active', '新用户专享9折优惠'),
            ('SAVE20', 'fixed', 20.00, 100.00, 50, ?, ?, 'active', '满100减20元'),
            ('VIP15', 'percentage', 15.00, 200.00, 30, ?, ?, 'active', 'VIP用户8.5折')
        `, [now, nextMonth, now, nextMonth, now, nextMonth]);
        console.log('   ✅ 已插入3张测试优惠券');
      } else {
        console.log(`   ℹ️ 已有 ${existing.count} 张优惠券`);
      }
    } catch (e) {
      console.error('   ❌ 插入失败:', e.message);
    }

    // 4. 验证管理员账户
    console.log('\n4️⃣ 检查管理员账户...');
    try {
      const admins = await db.query(
        "SELECT id, username, email, role, status FROM users WHERE role = 'admin'"
      );

      if (admins.length > 0) {
        console.log(`   ✅ 找到 ${admins.length} 个管理员:`);
        admins.forEach(admin => {
          console.log(`     👤 ${admin.username} (${admin.email}) - 状态: ${admin.status}`);
        });
      } else {
        console.log('   ⚠️ 未找到管理员账户');
        console.log('   💡 提示: 可通过API /api/v1/auth/register 创建 (role=admin)');
      }
    } catch (e) {
      console.error('   ❌ 查询失败:', e.message);
    }

    // 5. 最终验证
    console.log('\n5️⃣ 最终验证...');
    const tables = await db.query('SHOW TABLES');
    const tableList = tables.map(t => Object.values(t)[0]);

    console.log('\n' + '='.repeat(60));
    console.log('📊 数据库最终状态报告');
    console.log('='.repeat(60));

    const requiredTables = ['users', 'products', 'categories', 'orders', 'cart_items', 'coupons'];
    
    console.log('\n📦 数据库表:');
    for (const table of requiredTables) {
      if (tableList.includes(table)) {
        const [count] = await db.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
        console.log(`  ✅ ${table.padEnd(15)} (${String(count[0].count).padStart(3)} 条记录)`);
      } else {
        console.log(`  ❌ ${table.padEnd(15)} (不存在!)`);
      }
    }

    console.log('\n🎯 就绪状态评估:');
    const allTablesExist = requiredTables.every(t => tableList.includes(t));
    
    if (allTablesExist) {
      console.log('  ✅ 所有必需表已存在 - 数据库就绪!');
    } else {
      console.log('  ⚠️ 部分表缺失 - 请检查上方报告');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ 数据库修复完成!\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ 修复失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

fixDatabase();
