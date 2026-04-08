require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.DB_PATH || './data/database.sqlite';

let db;

function initDatabase() {
  try {
    const dir = path.dirname(DB_PATH);
    require('fs').mkdirSync(dir, { recursive: true });

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');

    console.log('[DB] SQLite database connected:', DB_PATH);

    const table = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='products'
    `).get();

    if (!table) {
      console.log('[DB] Initializing database schema...');
      db.exec(`
        CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          price REAL NOT NULL,
          stock INTEGER DEFAULT 0,
          category_id INTEGER,
          description TEXT,
          image TEXT,
          status TEXT DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          parent_id INTEGER DEFAULT NULL,
          sort_order INTEGER DEFAULT 0,
          description TEXT,
          status TEXT DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          email TEXT UNIQUE,
          avatar TEXT,
          role TEXT DEFAULT 'user',
          status TEXT DEFAULT 'active',
          last_login DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_no TEXT UNIQUE,
          user_id INTEGER,
          total_amount REAL NOT NULL,
          status TEXT DEFAULT 'pending',
          shipping_address TEXT,
          remark TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS order_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id INTEGER NOT NULL,
          product_id INTEGER NOT NULL,
          product_name TEXT,
          quantity INTEGER NOT NULL,
          price REAL NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      const insertProduct = db.prepare(`INSERT INTO products (name, price, stock, category_id, description, status) VALUES (?, ?, ?, ?, ?, ?)`);
      const insertCategory = db.prepare(`INSERT INTO categories (name, parent_id, sort_order, description, status) VALUES (?, ?, ?, ?, ?)`);
      const insertUser = db.prepare(`INSERT INTO users (username, password, email, role, status) VALUES (?, ?, ?, ?, ?)`);

      const adminPassword = bcrypt.hashSync('admin123', 10);

      const transaction = db.transaction(() => {
        insertCategory.run('电子产品', null, 0, '电子设备类目', 'active');
        insertCategory.run('服装鞋帽', null, 1, '服饰配件类目', 'active');
        insertCategory.run('食品饮料', null, 2, '食品饮品类目', 'active');
        insertCategory.run('家居用品', null, 3, '家居生活类目', 'active');
        insertCategory.run('美妆个护', null, 4, '美容护理类目', 'active');
        insertCategory.run('运动户外', null, 5, '运动健身类目', 'active');
        insertCategory.run('图书文具', null, 6, '图书文具类目', 'active');
        insertCategory.run('母婴用品', null, 7, '母婴儿童类目', 'active');
        insertCategory.run('虚拟商品', null, 8, '虚拟服务类目', 'active');

        insertUser.run('admin', adminPassword, 'admin@qiguan.com', 'admin', 'active');

        insertProduct.run('智能手机 Pro Max', 6999.00, 150, 1, '旗舰级智能手机，搭载最新处理器', 'active');
        insertProduct.run('无线蓝牙耳机', 299.00, 500, 1, '降噪蓝牙耳机，续航30小时', 'active');
        insertProduct.run('纯棉T恤', 89.00, 1000, 2, '100%纯棉面料，舒适透气', 'active');
        insertProduct.run('有机绿茶 250g', 128.00, 300, 3, '高山有机绿茶，清香回甘', 'active');
        insertProduct.run('智能手表 运动版', 1599.00, 200, 1, '心率监测、GPS定位、50米防水', 'active');
      });

      transaction();
      console.log('[DB] Database initialized with sample data (including admin user)');
    }

    return true;
  } catch (error) {
    console.error('[DB] Database initialization failed:', error.message);
    throw error;
  }
}

function isSelect(sql) {
  const trimmed = sql.trim().toUpperCase();
  return trimmed.startsWith('SELECT');
}

function query(sql, params = []) {
  try {
    if (!db) initDatabase();

    if (isSelect(sql)) {
      const stmt = db.prepare(sql);
      const rows = stmt.all(...params);
      return rows;
    } else {
      const stmt = db.prepare(sql);
      const result = stmt.run(...params);
      return {
        affectedRows: result.changes,
        insertId: result.lastInsertRowid
      };
    }
  } catch (error) {
    console.error('[DB] Query error:', error.message, '| SQL:', sql.substring(0, 100));
    throw error;
  }
}

function getOne(sql, params = []) {
  try {
    if (!db) initDatabase();
    const stmt = db.prepare(sql);
    return stmt.get(...params) || null;
  } catch (error) {
    console.error('[DB] getOne error:', error.message);
    throw error;
  }
}

function all(sql, params = []) {
  try {
    if (!db) initDatabase();
    const stmt = db.prepare(sql);
    return stmt.all(...params);
  } catch (error) {
    console.error('[DB] all error:', error.message);
    throw error;
  }
}

async function queryAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      const result = query(sql, params);
      resolve(result);
    } catch (error) {
      reject(error);
    }
  });
}

async function getOneAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      const result = getOne(sql, params);
      resolve(result);
    } catch (error) {
      reject(error);
    }
  });
}

function run(sql, params = []) {
  return query(sql, params);
}

function execute(sql, params = []) {
  return query(sql, params);
}

function transaction(callback) {
  const t = db.transaction(callback);
  return t();
}

module.exports = {
  query,
  getOne,
  all,
  queryAsync,
  getOneAsync,
  transaction,
  run,
  execute,
  initDatabase,
  getDb: () => db
};
