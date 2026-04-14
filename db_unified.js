const mysql = require('mysql2/promise');

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT) || 3306;
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'ecommerce';

let mysqlPool;

async function initDatabase() {
  try {
    mysqlPool = mysql.createPool({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      maxIdle: 5,
      idleTimeout: 60000,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    });

    const connection = await mysqlPool.getConnection();
    await connection.ping();
    connection.release();

    console.log('[DB] ✅ TDSQL-C 云数据库 (MySQL) 连接成功');
    console.log(`[DB] 📍 ${DB_HOST}:${DB_PORT}/${DB_NAME}`);

    await initMysqlSchema();

    return true;
  } catch (error) {
    console.error('[DB] ❌ TDSQL-C 数据库初始化失败:', error.message);
    throw error;
  }
}

async function initMysqlSchema() {
  try {
    const connection = await mysqlPool.getConnection();

    const [result] = await connection.execute("SHOW TABLES LIKE 'users'");

    if (result.length === 0) {
      console.log('[DB] 🔧 初始化数据库表结构...');

      await connection.execute(`
        CREATE TABLE IF NOT EXISTS users (
          id INT PRIMARY KEY AUTO_INCREMENT,
          username VARCHAR(50) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          email VARCHAR(100) UNIQUE,
          avatar VARCHAR(255),
          role VARCHAR(20) DEFAULT 'user',
          status VARCHAR(20) DEFAULT 'active',
          last_login DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      await connection.execute(`
        CREATE TABLE IF NOT EXISTS products (
          id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(255) NOT NULL,
          price DECIMAL(10,2) NOT NULL,
          stock INT DEFAULT 0,
          category_id INT,
          description TEXT,
          image VARCHAR(255),
          status VARCHAR(20) DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_category_id (category_id),
          INDEX idx_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      await connection.execute(`
        CREATE TABLE IF NOT EXISTS categories (
          id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(100) NOT NULL UNIQUE,
          parent_id INT DEFAULT NULL,
          sort_order INT DEFAULT 0,
          description TEXT,
          status VARCHAR(20) DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      await connection.execute(`
        CREATE TABLE IF NOT EXISTS customers (
          id INT PRIMARY KEY AUTO_INCREMENT,
          openid VARCHAR(100) UNIQUE,
          nickname VARCHAR(100),
          avatar_url VARCHAR(500),
          real_name VARCHAR(50),
          phone VARCHAR(20),
          gender VARCHAR(10),
          province VARCHAR(50),
          city VARCHAR(50),
          district VARCHAR(50),
          detail_address VARCHAR(200),
          full_address VARCHAR(300),
          status VARCHAR(20) DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_phone (phone),
          INDEX idx_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      await connection.execute(`
        CREATE TABLE IF NOT EXISTS orders (
          id INT PRIMARY KEY AUTO_INCREMENT,
          order_no VARCHAR(50) UNIQUE,
          user_id INT,
          total_amount DECIMAL(10,2) NOT NULL,
          status VARCHAR(20) DEFAULT 'pending',
          shipping_address TEXT,
          remark TEXT,
          coupon_id INT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          shipped_at DATETIME,
          delivered_at DATETIME,
          INDEX idx_user_id (user_id),
          INDEX idx_status (status),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      await connection.execute(`
        CREATE TABLE IF NOT EXISTS order_items (
          id INT PRIMARY KEY AUTO_INCREMENT,
          order_id INT NOT NULL,
          product_id INT NOT NULL,
          product_name VARCHAR(255),
          quantity INT NOT NULL,
          price DECIMAL(10,2) NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_order_id (order_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      const bcrypt = require('bcryptjs');
      const adminPassword = bcrypt.hashSync('admin123', 10);

      await connection.execute(
        `INSERT INTO users (username, password, email, role, status) VALUES (?, ?, ?, ?, ?)`,
        ['admin', adminPassword, 'admin@qiguan.com', 'admin', 'active']
      );

      console.log('[DB] ✅ 数据库表结构初始化完成（含管理员账号）');
    }

    connection.release();
  } catch (error) {
    console.error('[DB] ❌ 表结构初始化失败:', error.message);
    throw error;
  }
}

async function query(sql, params = []) {
  try {
    if (!mysqlPool) await initDatabase();

    const [rows] = await mysqlPool.execute(sql, params);

    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      return rows;
    } else {
      return {
        affectedRows: rows.affectedRows,
        insertId: rows.insertId
      };
    }
  } catch (error) {
    console.error('[DB] ❌ Query error:', error.message, '| SQL:', sql.substring(0, 150));
    throw error;
  }
}

async function getOne(sql, params = []) {
  try {
    if (!mysqlPool) await initDatabase();

    const [rows] = await mysqlPool.execute(sql, params);
    return rows[0] || null;
  } catch (error) {
    console.error('[DB] ❌ getOne error:', error.message);
    throw error;
  }
}

async function execute(sql, params = []) {
  try {
    if (!mysqlPool) await initDatabase();

    const [result] = await mysqlPool.execute(sql, params);
    return {
      affectedRows: result.affectedRows,
      insertId: result.insertId
    };
  } catch (error) {
    console.error('[DB] ❌ Execute error:', error.message, '| SQL:', sql.substring(0, 150));
    throw error;
  }
}

async function initPool() {
  console.log('[DB] 🚀 初始化 TDSQL-C 云数据库连接池...');
  return initDatabase();
}

async function closePool() {
  if (mysqlPool) {
    await mysqlPool.end();
    console.log('[DB] ✅ 数据库连接池已关闭');
  }
}

module.exports = {
  query,
  getOne,
  execute,
  initPool,
  initDatabase,
  closePool
};