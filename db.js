require('dotenv').config();

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'data', 'ecommerce.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log(`[DB] Created database directory: ${dbDir}`);
}

let db;
try {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  console.log('[DB] SQLite database initialized successfully');
  console.log(`[DB] Path: ${dbPath}`);
} catch (error) {
  console.error('[DB ERROR] Failed to initialize SQLite:', error.message);
  process.exit(1);
}

const initSQL = `
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  parent_id INTEGER DEFAULT NULL,
  sort_order INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price REAL NOT NULL CHECK(price >= 0),
  original_price REAL DEFAULT 0,
  stock INTEGER DEFAULT 0 CHECK(stock >= 0),
  category_id INTEGER DEFAULT NULL,
  image TEXT DEFAULT '',
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  avatar TEXT DEFAULT '',
  role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin', 'manager')),
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'banned')),
  last_login DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT NOT NULL UNIQUE,
  user_id INTEGER DEFAULT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  total_amount REAL NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','paid','shipped','completed','cancelled')),
  shipping_address TEXT,
  remark TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  price REAL NOT NULL CHECK(price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
`;

try {
  db.exec(initSQL);
  console.log('[DB] All tables created/verified successfully');
} catch (error) {
  console.error('[DB ERROR] Failed to create tables:', error.message);
}

const query = (sql, params = []) => {
  return db.prepare(sql).all(...params);
};

const queryAsync = async (sql, params = []) => {
  return db.prepare(sql).all(...params);
};

const getOne = (sql, params = []) => {
  return db.prepare(sql).get(...params) || null;
};

const getOneAsync = async (sql, params = []) => {
  return db.prepare(sql).get(...params) || null;
};

const run = (sql, params = []) => {
  const result = db.prepare(sql).run(...params);
  return { changes: result.changes, lastInsertRowid: result.lastInsertRowid };
};

const runAsync = async (sql, params = []) => {
  const result = db.prepare(sql).run(...params);
  return { changes: result.changes, lastInsertRowid: result.lastInsertRowid };
};

const transaction = (fn) => {
  const txn = db.transaction(() => fn(db));
  return txn();
};

module.exports = {
  db,
  query,
  queryAsync,
  getOne,
  getOneAsync,
  run,
  runAsync,
  transaction
};
