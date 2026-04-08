require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');

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
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          role TEXT DEFAULT 'user',
          status TEXT DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          total_amount REAL NOT NULL,
          status TEXT DEFAULT 'pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      const insertProduct = db.prepare(`INSERT INTO products (name, price, stock, category_id, description, status) VALUES (?, ?, ?, ?, ?, ?)`);
      const insertCategory = db.prepare(`INSERT INTO categories (name, description) VALUES (?, ?)`);
      const insertUser = db.prepare(`INSERT INTO users (username, password, role, status) VALUES (?, ?, ?, ?)`);

      const transaction = db.transaction(() => {
        insertCategory.run('电子产品', '电子设备类目');
        insertCategory.run('服装鞋帽', '服饰配件类目');
        insertCategory.run('食品饮料', '食品饮品类目');
        insertCategory.run('家居用品', '家居生活类目');
        insertCategory.run('美妆个护', '美容护理类目');
        insertCategory.run('运动户外', '运动健身类目');
        insertCategory.run('图书文具', '图书文具类目');
        insertCategory.run('母婴用品', '母婴儿童类目');
        insertCategory.run('虚拟商品', '虚拟服务类目');

        insertProduct.run('智能手机 Pro Max', 6999.00, 150, 1, '旗舰级智能手机，搭载最新处理器', 'active');
        insertProduct.run('无线蓝牙耳机', 299.00, 500, 1, '降噪蓝牙耳机，续航30小时', 'active');
        insertProduct.run('纯棉T恤', 89.00, 1000, 2, '100%纯棉面料，舒适透气', 'active');
        insertProduct.run('有机绿茶 250g', 128.00, 300, 3, '高山有机绿茶，清香回甘', 'active');
        insertProduct.run('智能手表 运动版', 1599.00, 200, 1, '心率监测、GPS定位、50米防水', 'active');
      });

      transaction();
      console.log('[DB] Database initialized with sample data');
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
    console.error('[DB] Query error:', error.message);
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
  initDatabase,
  getDb: () => db
};
