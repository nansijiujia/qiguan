require('dotenv').config();

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { log } = console;

const dbPath = path.resolve(process.env.DB_PATH || './data/ecommerce.db');
const dbDir = path.dirname(dbPath);

async function initDatabase() {
  return new Promise((resolve, reject) => {
    log('\n🚀 开始初始化 SQLite 数据库...\n');

    if (!require('fs').existsSync(dbDir)) {
      require('fs').mkdirSync(dbDir, { recursive: true });
      log(`📁 创建数据目录: ${dbDir}\n`);
    }

    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        log(`❌ 数据库连接失败: ${err.message}\n`, 'error');
        reject(err);
        return;
      }

      log(`✅ 已连接到 SQLite 数据库: ${dbPath}\n`);

      db.serialize(() => {
        log('📝 开始创建表结构...\n');

        // 1. 分类表
        db.run(`
          CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            parent_id INTEGER DEFAULT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'active',
            description TEXT DEFAULT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(name),
            FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
          )
        `, (err) => {
          if (err) log(`❌ categories表创建失败: ${err.message}\n`, 'error');
          else log('✅ categories 表创建成功');
        });

        // 2. 用户表
        db.run(`
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            email TEXT UNIQUE DEFAULT NULL,
            avatar TEXT DEFAULT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            status TEXT NOT NULL DEFAULT 'active',
            last_login DATETIME DEFAULT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) log(`❌ users表创建失败: ${err.message}\n`, 'error');
          else log('✅ users 表创建成功');
        });

        // 3. 商品表
        db.run(`
          CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT DEFAULT NULL,
            price REAL NOT NULL DEFAULT 0.00,
            stock INTEGER NOT NULL DEFAULT 0,
            category_id INTEGER DEFAULT NULL,
            image TEXT DEFAULT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
          )
        `, (err) => {
          if (err) log(`❌ products表创建失败: ${err.message}\n`, 'error');
          else log('✅ products 表创建成功');
        });

        // 4. 订单表
        db.run(`
          CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_no TEXT NOT NULL UNIQUE,
            user_id INTEGER DEFAULT NULL,
            total_amount REAL NOT NULL DEFAULT 0.00,
            status TEXT NOT NULL DEFAULT 'pending',
            shipping_address TEXT DEFAULT NULL,
            remark TEXT DEFAULT '',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
          )
        `, (err) => {
          if (err) log(`❌ orders表创建失败: ${err.message}\n`, 'error');
          else log('✅ orders 表创建成功');
        });

        // 5. 订单项表
        db.run(`
          CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            product_name TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            price REAL NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
          )
        `, (err) => {
          if (err) log(`❌ order_items表创建失败: ${err.message}\n`, 'error');
          else log('✅ order_items 表创建成功');
        });

        // 6. 优惠券模板表 (coupons)
        db.run(`
          CREATE TABLE IF NOT EXISTS coupons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            code TEXT UNIQUE,
            type TEXT NOT NULL CHECK(type IN ('fixed', 'percent')),
            value REAL NOT NULL,
            max_discount REAL DEFAULT NULL,
            min_order_amount REAL DEFAULT 0,
            stock INTEGER NOT NULL,
            used_count INTEGER DEFAULT 0,
            per_user_limit INTEGER DEFAULT 1,
            start_time DATETIME NOT NULL,
            end_time DATETIME NOT NULL,
            description TEXT DEFAULT NULL,
            status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'expired')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) log(`❌ coupons表创建失败: ${err.message}\n`, 'error');
          else log('✅ coupons 表创建成功');
        });

        // 7. 用户优惠券关联表 (user_coupons)
        db.run(`
          CREATE TABLE IF NOT EXISTS user_coupons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            coupon_id INTEGER NOT NULL,
            status TEXT DEFAULT 'unused' CHECK(status IN ('unused', 'used', 'expired')),
            received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            used_at DATETIME DEFAULT NULL,
            order_id INTEGER DEFAULT NULL,
            FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
            UNIQUE(user_id, coupon_id)
          )
        `, (err) => {
          if (err) log(`❌ user_coupons表创建失败: ${err.message}\n`, 'error');
          else log('✅ user_coupons 表创建成功');
        });

        // 8. 优惠券领取日志表 (coupon_receive_logs)
        db.run(`
          CREATE TABLE IF NOT EXISTS coupon_receive_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            coupon_id INTEGER NOT NULL,
            ip TEXT DEFAULT NULL,
            user_agent TEXT DEFAULT NULL,
            receive_type TEXT DEFAULT 'self_claim' CHECK(receive_type IN ('self_claim', 'admin_assign')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) log(`❌ coupon_receive_logs表创建失败: ${err.message}\n`, 'error');
          else log('✅ coupon_receive_logs 表创建成功');
        });

        // 创建索引
        db.run(`CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_products_status ON products(status)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_coupons_status ON coupons(status)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_coupons_time ON coupons(start_time, end_time)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_user_coupons_user ON user_coupons(user_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_user_coupons_coupon ON user_coupons(coupon_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_coupon_logs_created ON coupon_receive_logs(created_at)`);

        log('\n✅ 所有表结构及索引创建成功\n');

        // 插入初始数据
        log('📝 开始插入初始数据...\n');

        // 检查是否已有数据
        db.get("SELECT COUNT(*) as count FROM categories", (err, row) => {
          if (err) {
            log(`❌ 检查数据失败: ${err.message}\n`, 'error');
            db.close();
            reject(err);
            return;
          }

          if (row.count > 0) {
            log('✅ 数据库已包含数据，跳过初始数据插入\n');

            // 显示当前数据统计
            db.all(`
              SELECT 
                (SELECT COUNT(*) FROM categories) as categories,
                (SELECT COUNT(*) FROM products) as products,
                (SELECT COUNT(*) FROM users) as users,
                (SELECT COUNT(*) FROM orders) as orders,
                (SELECT COUNT(*) FROM coupons) as coupons
            `, (err, counts) => {
              if (!err && counts[0]) {
                log('📊 当前数据统计:');
                log(`   分类: ${counts[0].categories}`);
                log(`   商品: ${counts[0].products}`);
                log(`   用户: ${counts[0].users}`);
                log(`   订单: ${counts[0].orders}`);
                log(`   优惠券: ${counts[0].coupons}\n`);
              }

              log('✅✅✅ SQLite 数据库初始化完成! ✅✅✅\n');
              db.close();
              resolve(true);
            });
          } else {
            // 插入分类数据
            db.run(`
              INSERT INTO categories (name, parent_id, sort_order, description, status) VALUES
              ('电子产品', NULL, 1, '电子设备类目', 'active'),
              ('服装鞋帽', NULL, 2, '服饰配件类目', 'active'),
              ('食品饮料', NULL, 3, '食品饮品类目', 'active'),
              ('家居用品', NULL, 4, '家居生活类目', 'active'),
              ('美妆个护', NULL, 5, '美容护理类目', 'active'),
              ('运动户外', NULL, 6, '运动健身类目', 'active')
            `);

            // 插入管理员用户
            const bcrypt = require('bcryptjs');
            const adminPassword = bcrypt.hashSync('admin123', 10);

            db.run(
              "INSERT INTO users (username, password, email, role, status) VALUES (?, ?, ?, ?, ?)",
              ['admin', adminPassword, 'admin@qiguan.com', 'admin', 'active']
            );

            // 插入商品数据
            db.run(`
              INSERT INTO products (name, description, price, stock, category_id, status) VALUES
              ('智能手机 Pro Max', '旗舰级智能手机，搭载最新处理器', 6999.00, 150, 1, 'active'),
              ('无线蓝牙耳机', '降噪蓝牙耳机，续航30小时', 299.00, 500, 1, 'active'),
              ('纯棉T恤', '100%纯棉面料，舒适透气', 89.00, 1000, 2, 'active'),
              ('有机绿茶 250g', '高山有机绿茶，清香回甘', 128.00, 300, 3, 'active'),
              ('智能手表 运动版', '心率监测、GPS定位、50米防水', 1599.00, 200, 1, 'active')
            `);

            // 插入优惠券数据
            db.run(`
              INSERT INTO coupons (name, code, type, value, min_order_amount, stock, per_user_limit, start_time, end_time, status, description, max_discount) VALUES
              ('新用户专享券', 'NEWUSER2026', 'fixed', 50.00, 100.00, 1000, 1, '2026-01-01 00:00:00', '2026-12-31 23:59:59', 'active', '新用户注册即送，满100可用', NULL),
              ('满减大促券', 'SALE100', 'fixed', 100.00, 500.00, 500, 1, '2026-04-01 00:00:00', '2026-04-30 23:59:59', 'active', '全场通用，满500减100', NULL),
              ('折扣特惠券', 'DISCOUNT20', 'percent', 20.00, 200.00, 300, 1, '2026-04-10 00:00:00', '2026-05-10 23:59:59', 'active', '全场8折，最高减免200元', 200.00),
              ('限时秒杀券', 'FLASHSALE', 'fixed', 30.00, 99.00, 100, 1, '2026-04-15 00:00:00', '2026-04-15 23:59:59', 'active', '限时秒杀，满99减30', NULL)
            `);

            log('✅ 初始数据插入成功\n');

            // 显示最终统计
            db.all(`
              SELECT 
                (SELECT COUNT(*) FROM categories) as categories,
                (SELECT COUNT(*) FROM products) as products,
                (SELECT COUNT(*) FROM users) as users,
                (SELECT COUNT(*) FROM coupons) as coupons
            `, (err, finalCounts) => {
              if (!err && finalCounts[0]) {
                log('📊 初始化完成统计:');
                log(`   分类: ${finalCounts[0].categories} 个`);
                log(`   商品: ${finalCounts[0].products} 个`);
                log(`   用户: ${finalCounts[0].users} 个 (含管理员账户)`);
                log(`   优惠券: ${finalCounts[0].coupons} 张`);
                log('   管理员账号: admin / admin123\n');
              }

              log('✅✅✅ SQLite 数据库初始化完成! ✅✅✅\n');
              db.close();
              resolve(true);
            });
          }
        });
      });
    });
  });
}

if (require.main === module) {
  initDatabase()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(err => {
      log(`❌ 脚本执行错误: ${err.message}`, 'error');
      process.exit(1);
    });
}

module.exports = { initDatabase };
