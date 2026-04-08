require('dotenv').config({ path: '.env.production' });

const mysql = require('mysql2/promise');
const { log } = console;

const dbConfig = {
  host: process.env.DB_HOST || '10.0.0.16',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'QMZYXCX',
  password: process.env.DB_PASSWORD || 'LJN040821.',
  database: process.env.DB_NAME || 'qmzyxcx',
  charset: 'utf8mb4',
  timezone: '+08:00',
  multipleStatements: true
};

async function initDatabase() {
  let connection;
  try {
    log('\n🚀 开始初始化 MySQL 数据库...\n');

    connection = await mysql.createConnection(dbConfig);
    log(`✅ 已连接到数据库: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}\n`);

    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'products'
    `, [dbConfig.database]);

    if (tables.length > 0) {
      log('✅ 数据库表已存在，跳过初始化\n');
      
      const [counts] = await connection.execute(`
        SELECT 
          (SELECT COUNT(*) FROM categories) as categories,
          (SELECT COUNT(*) FROM products) as products,
          (SELECT COUNT(*) FROM users) as users,
          (SELECT COUNT(*) FROM orders) as orders
      `);

      log('📊 当前数据统计:');
      log(`   分类: ${counts[0].categories}`);
      log(`   商品: ${counts[0].products}`);
      log(`   用户: ${counts[0].users}`);
      log(`   订单: ${counts[0].orders}\n`);

      await connection.end();
      return true;
    }

    log('📝 首次运行，开始创建表结构...\n');

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        parent_id INT UNSIGNED DEFAULT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        description TEXT DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_name (name),
        KEY idx_parent (parent_id),
        CONSTRAINT fk_parent FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      CREATE TABLE IF NOT EXISTS users (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        email VARCHAR(100) UNIQUE DEFAULT NULL,
        avatar VARCHAR(500) DEFAULT NULL,
        role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
        status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        last_login DATETIME DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      CREATE TABLE IF NOT EXISTS products (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        name VARCHAR(200) NOT NULL,
        description TEXT DEFAULT NULL,
        price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        stock INT NOT NULL DEFAULT 0,
        category_id INT UNSIGNED DEFAULT NULL,
        image VARCHAR(500) DEFAULT NULL,
        status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_category (category_id),
        KEY idx_status (status),
        CONSTRAINT fk_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      CREATE TABLE IF NOT EXISTS orders (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        order_no VARCHAR(50) NOT NULL UNIQUE,
        user_id INT UNSIGNED DEFAULT NULL,
        total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        status ENUM('pending', 'paid', 'shipped', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
        shipping_address TEXT DEFAULT NULL,
        remark TEXT DEFAULT '',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_user (user_id),
        KEY idx_status (status),
        CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      CREATE TABLE IF NOT EXISTS order_items (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        order_id INT UNSIGNED NOT NULL,
        product_id INT UNSIGNED NOT NULL,
        product_name VARCHAR(200) NOT NULL,
        quantity INT NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_order (order_id),
        KEY idx_product (product_id),
        CONSTRAINT fk_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        CONSTRAINT fk_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    log('✅ 表结构创建成功\n');

    const bcrypt = require('bcryptjs');
    const adminPassword = bcrypt.hashSync('admin123', 10);

    await connection.execute(`
      INSERT INTO categories (name, parent_id, sort_order, description, status) VALUES
      ('电子产品', NULL, 1, '电子设备类目', 'active'),
      ('服装鞋帽', NULL, 2, '服饰配件类目', 'active'),
      ('食品饮料', NULL, 3, '食品饮品类目', 'active'),
      ('家居用品', NULL, 4, '家居生活类目', 'active'),
      ('美妆个护', NULL, 5, '美容护理类目', 'active'),
      ('运动户外', NULL, 6, '运动健身类目', 'active');

      INSERT INTO users (username, password, email, role, status) VALUES
      ('admin', ?, 'admin@qiguan.com', 'admin', 'active');

      INSERT INTO products (name, description, price, stock, category_id, status) VALUES
      ('智能手机 Pro Max', '旗舰级智能手机，搭载最新处理器', 6999.00, 150, 1, 'active'),
      ('无线蓝牙耳机', '降噪蓝牙耳机，续航30小时', 299.00, 500, 1, 'active'),
      ('纯棉T恤', '100%纯棉面料，舒适透气', 89.00, 1000, 2, 'active'),
      ('有机绿茶 250g', '高山有机绿茶，清香回甘', 128.00, 300, 3, 'active'),
      ('智能手表 运动版', '心率监测、GPS定位、50米防水', 1599.00, 200, 1, 'active');
    `, [adminPassword]);

    log('✅ 初始数据插入成功\n');

    const [finalCounts] = await connection.execute(`
      SELECT 
        (SELECT COUNT(*) FROM categories) as categories,
        (SELECT COUNT(*) FROM products) as products,
        (SELECT COUNT(*) FROM users) as users
    `);

    log('📊 初始化完成统计:');
    log(`   分类: ${finalCounts[0].categories}`);
    log(`   商品: ${finalCounts[0].products}`);
    log(`   用户: ${finalCounts[0].users} (含管理员账户)`);
    log('   管理员账号: admin / admin123\n');

    log('✅✅✅ 数据库初始化完成! ✅✅✅\n');

    await connection.end();
    return true;

  } catch (error) {
    log(`\n❌ 数据库初始化失败: ${error.message}\n`, 'error');
    if (connection) await connection.end().catch(() => {});
    return false;
  }
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
