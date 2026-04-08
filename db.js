require('dotenv').config();

const sqlite3 = require('sqlite3').verbose();
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
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('[DB ERROR] Failed to initialize SQLite:', err.message);
      process.exit(1);
    }
    console.log('[DB] SQLite database initialized successfully');
    console.log(`[DB] Path: ${dbPath}`);
  });
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
  db.exec(initSQL, (err) => {
    if (err) {
      console.error('[DB ERROR] Failed to create tables:', err.message);
    } else {
      console.log('[DB] All tables created/verified successfully');
    }
  });
} catch (error) {
  console.error('[DB ERROR] Failed to create tables:', error.message);
}

const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

const queryAsync = async (sql, params = []) => {
  return query(sql, params);
};

const getOne = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row || null);
      }
    });
  });
};

const getOneAsync = async (sql, params = []) => {
  return getOne(sql, params);
};

const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ changes: this.changes, lastInsertRowid: this.lastID });
      }
    });
  });
};

const runAsync = async (sql, params = []) => {
  return run(sql, params);
};

const execute = (sql, params = []) => {
  const sqlTrim = sql.trim().toUpperCase();
  if (sqlTrim.startsWith('SELECT') || sqlTrim.startsWith('PRAGMA') || sqlTrim.startsWith('EXPLAIN')) {
    return query(sql, params);
  } else {
    return run(sql, params).then(result => {
      return {
        insertId: result.lastInsertRowid,
        affectedRows: result.changes,
        rows: sqlTrim.startsWith('INSERT') ? [] : undefined
      };
    });
  }
};

const executeAsync = async (sql, params = []) => {
  return execute(sql, params);
};

const transaction = (fn) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        try {
          const result = fn(db);
          db.run('COMMIT', (err) => {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
            } else {
              resolve(result);
            }
          });
        } catch (error) {
          db.run('ROLLBACK');
          reject(error);
        }
      });
    });
  });
};

module.exports = {
  db,
  query,
  queryAsync,
  getOne,
  getOneAsync,
  run,
  runAsync,
  execute,
  executeAsync,
  transaction
};
