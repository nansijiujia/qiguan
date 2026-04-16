const mysql = require('mysql2/promise');

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT) || 3306;
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'ecommerce';

let mysqlPool;
let initPromise = null;
let isInitialized = false;
let initError = null;
let lastSuccessfulPing = 0;
let poolHealthCheckInProgress = false;

const POOL_HEALTH_CHECK_INTERVAL = 30000;
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_BASE_DELAY = 1000;
let healthCheckTimer = null;
let reconnectAttemptCount = 0;
let consecutiveFailures = 0;
let startTime = Date.now();
let connectionStatusHistory = [];
const MAX_HISTORY_SIZE = 100;
const SLOW_QUERY_THRESHOLD = 1000; // 慢查询阈值：1秒
let slowQueryLog = [];
const MAX_SLOW_QUERY_LOG_SIZE = 50;

async function initDatabase() {
  if (isInitialized && mysqlPool) {
    console.log('[DB] ✅ 数据库已初始化，跳过重复初始化');
    return true;
  }
  if (initPromise) {
    console.log('[DB] ⏳ 数据库正在初始化中，等待完成...');
    return initPromise;
  }

  initPromise = _doInit();
  try {
    await initPromise;
    return true;
  } finally {
    initPromise = null;
  }
}

async function _doInit() {
  try {
    if (process.env.NODE_ENV === 'production') {
      const defaults = {
        DB_HOST: 'localhost',
        DB_NAME: 'ecommerce',
        DB_PASSWORD: ''
      };

      const usingDefaults = Object.entries(defaults).some(
        ([key, defaultValue]) => {
          const actualValue = process.env[key];
          return !actualValue || actualValue === defaultValue;
        }
      );

      if (usingDefaults && !process.env.FORCE_DEFAULT_DB) {
        const error = new Error(
          '[FATAL] Production environment is using default database credentials. ' +
          'This likely means .env.production is missing or misconfigured. ' +
          'Set FORCE_DEFAULT_DB=true to override (not recommended for production).'
        );
        error.code = 'CONFIG_ERROR';
        throw error;
      }

      if (usingDefaults && process.env.FORCE_DEFAULT_DB) {
        console.warn('[WARN] FORCE_DEFAULT_DB is enabled. Using default database credentials in production is NOT recommended.');
      }
    }

    const maskedPassword = DB_PASSWORD ? '***' : '(empty)';
    console.log('[DB] 🔐 连接参数配置:');
    console.log(`[DB]   Host: ${DB_HOST}`);
    console.log(`[DB]   Port: ${DB_PORT}`);
    console.log(`[DB]   User: ${DB_USER}`);
    console.log(`[DB]   Password: ${maskedPassword}`);
    console.log(`[DB]   Database: ${DB_NAME}`);
    console.log(`[DB]   Environment: ${process.env.NODE_ENV || 'development'}`);

    mysqlPool = mysql.createPool({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: parseInt(process.env.DB_POOL_MAX) || 20,
      maxIdle: parseInt(process.env.DB_POOL_MIN) || 10,
      idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
      acquireTimeout: parseInt(process.env.DB_ACQUIRE_TIMEOUT) || 30000,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      charset: process.env.DB_CHARSET || 'utf8mb4',
      timezone: process.env.DB_TIMEZONE || '+08:00',
      multipleStatements: false,
      connectTimeout: parseInt(process.env.DB_TIMEOUT) || 10000
    });

    const connection = await mysqlPool.getConnection();
    await connection.ping();
    connection.release();

    console.log('[DB] ✅ TDSQL-C 云数据库 (MySQL) 连接成功');
    console.log(`[DB] 📍 ${DB_HOST}:${DB_PORT}/${DB_NAME}`);

    await initMysqlSchema();

    isInitialized = true;
    initError = null;
    lastSuccessfulPing = Date.now();
    consecutiveFailures = 0;
    reconnectAttemptCount = 0;

    _recordStatusChange('initialized');

    _startHealthCheckTimer();

    return true;
  } catch (error) {
    initError = error;
    isInitialized = false;
    mysqlPool = null;
    console.error('[DB] ❌ TDSQL-C 数据库初始化失败:', error.message);
    throw error;
  }
}

async function initMysqlSchema() {
  try {
    const connection = await mysqlPool.getConnection();

    const [result] = await connection.query("SHOW TABLES LIKE 'users'");

    if (result.length === 0) {
      console.log('[DB] 🔧 初始化数据库表结构...');

      await connection.query(`
        CREATE TABLE IF NOT EXISTS users (
          id INT PRIMARY KEY AUTO_INCREMENT,
          username VARCHAR(50) NOT NULL UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          email VARCHAR(100) UNIQUE,
          avatar VARCHAR(255),
          role VARCHAR(20) DEFAULT 'user',
          status VARCHAR(20) DEFAULT 'active',
          last_login DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      await connection.query(`
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

      await connection.query(`
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

      await connection.query(`
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

      await connection.query(`
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

      await connection.query(`
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

      await connection.query(`
        CREATE TABLE IF NOT EXISTS admin_logs (
          id INT PRIMARY KEY AUTO_INCREMENT,
          admin_id INT,
          action VARCHAR(50) NOT NULL,
          target_type VARCHAR(50),
          target_id INT,
          details TEXT,
          ip_address VARCHAR(45),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_admin_id (admin_id),
          INDEX idx_action (action),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS favorites (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          product_id INT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_favorite (user_id, product_id),
          INDEX idx_user_id (user_id),
          INDEX idx_product_id (product_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS footprints (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          product_id INT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_user_id (user_id),
          INDEX idx_product_id (product_id),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS user_coupons (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          coupon_id INT NOT NULL,
          status VARCHAR(20) DEFAULT 'unused',
          received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          used_at DATETIME,
          order_id INT,
          UNIQUE KEY unique_user_coupon (user_id, coupon_id),
          INDEX idx_user_id (user_id),
          INDEX idx_coupon_id (coupon_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      const bcrypt = require('bcryptjs');
      const adminPassword = bcrypt.hashSync('admin123', 10);

      await connection.query(
        `INSERT INTO users (username, password_hash, email, role, status) VALUES (?, ?, ?, ?, ?)`,
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

function _logSlowQuery(sql, params, queryTime) {
  const entry = {
    timestamp: new Date().toISOString(),
    sql: sql.substring(0, 200),
    params: params ? JSON.stringify(params).substring(0, 100) : null,
    queryTime
  };
  slowQueryLog.push(entry);
  if (slowQueryLog.length > MAX_SLOW_QUERY_LOG_SIZE) {
    slowQueryLog.shift();
  }
  console.warn(`[DB] 🐢 慢查询检测 (${queryTime}ms):`, sql.substring(0, 100));
}

async function query(sql, params = []) {
  await ensureReady();
  const startTime = Date.now();
  try {
    const [rows] = await mysqlPool.query(sql, params);
    const queryTime = Date.now() - startTime;
    
    if (queryTime > SLOW_QUERY_THRESHOLD) {
      _logSlowQuery(sql, params, queryTime);
    }

    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      return rows;
    } else {
      return {
        affectedRows: rows.affectedRows,
        insertId: rows.insertId
      };
    }
  } catch (error) {
    if (_isConnectionError(error)) {
      console.warn('[DB] ⚠️ 检测到连接错误，尝试重连后重试...');
      _markPoolUnhealthy();
      await ensureReady();
      const [rows] = await mysqlPool.query(sql, params);
      if (sql.trim().toUpperCase().startsWith('SELECT')) return rows;
      return { affectedRows: rows.affectedRows, insertId: rows.insertId };
    }
    console.error('[DB] ❌ Query error:', error.message, '| SQL:', sql.substring(0, 150));
    throw error;
  }
}

async function getOne(sql, params = []) {
  await ensureReady();
  const startTime = Date.now();
  try {
    const [rows] = await mysqlPool.query(sql, params);
    const queryTime = Date.now() - startTime;
    
    if (queryTime > SLOW_QUERY_THRESHOLD) {
      _logSlowQuery(sql, params, queryTime);
    }
    
    return rows[0] || null;
  } catch (error) {
    if (_isConnectionError(error)) {
      console.warn('[DB] ⚠️ getOne 连接错误，尝试重连后重试...');
      _markPoolUnhealthy();
      await ensureReady();
      const [rows] = await mysqlPool.query(sql, params);
      return rows[0] || null;
    }
    console.error('[DB] ❌ getOne error:', error.message);
    throw error;
  }
}

async function execute(sql, params = []) {
  await ensureReady();
  const startTime = Date.now();
  try {
    const [result] = await mysqlPool.query(sql, params);
    const queryTime = Date.now() - startTime;
    
    if (queryTime > SLOW_QUERY_THRESHOLD) {
      _logSlowQuery(sql, params, queryTime);
    }
    
    return {
      affectedRows: result.affectedRows,
      insertId: result.insertId
    };
  } catch (error) {
    if (_isConnectionError(error)) {
      console.warn('[DB] ⚠️ execute 连接错误，尝试重连后重试...');
      _markPoolUnhealthy();
      await ensureReady();
      const [result] = await mysqlPool.query(sql, params);
      return { affectedRows: result.affectedRows, insertId: result.insertId };
    }
    console.error('[DB] ❌ Execute error:', error.message, '| SQL:', sql.substring(0, 150));
    throw error;
  }
}

function _isConnectionError(error) {
  if (!error) return false;
  const code = error.code || '';
  const msg = (error.message || '').toLowerCase();
  return code === 'PROTOCOL_CONNECTION_LOST' ||
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'ESOCKET' ||
    code === 'ER_ACCESS_DENIED_ERROR' ||
    msg.includes('connection lost') ||
    msg.includes('connection refused') ||
    msg.includes('timed out') ||
    msg.includes('socket hang up') ||
    msg.includes('not connected') ||
    msg.includes('server has gone away');
}

function _recordStatusChange(status) {
  const entry = {
    timestamp: new Date().toISOString(),
    status,
    consecutiveFailures
  };
  connectionStatusHistory.push(entry);
  if (connectionStatusHistory.length > MAX_HISTORY_SIZE) {
    connectionStatusHistory.shift();
  }
}

function _startHealthCheckTimer() {
  if (healthCheckTimer) return;
  healthCheckTimer = setInterval(async () => {
    await _performHealthCheck();
  }, POOL_HEALTH_CHECK_INTERVAL);
  healthCheckTimer.unref();
  console.log('[DB] 🔄 连接池健康检查定时任务已启动 (间隔: ' + (POOL_HEALTH_CHECK_INTERVAL / 1000) + 's)');
}

async function _performHealthCheck() {
  if (!mysqlPool || poolHealthCheckInProgress) return;

  poolHealthCheckInProgress = true;
  try {
    const conn = await mysqlPool.getConnection();
    await conn.ping();
    lastSuccessfulPing = Date.now();
    consecutiveFailures = 0;
    reconnectAttemptCount = 0;
    conn.release();
  } catch (error) {
    consecutiveFailures++;
    _recordStatusChange('ping_failed');
    console.error('[DB] ⚠️ 健康检查 ping 失败 (连续失败: ' + consecutiveFailures + '):', error.message);

    if (consecutiveFailures >= 3 && isInitialized) {
      console.log('[DB] 🚨 连续失败 ' + consecutiveFailures + ' 次，触发自动重连...');
      _markPoolUnhealthy();
      await _reconnectWithBackoff();
    }
  } finally {
    poolHealthCheckInProgress = false;
  }
}

async function _reconnectWithBackoff() {
  for (let i = 0; i < MAX_RECONNECT_ATTEMPTS; i++) {
    const delay = RECONNECT_BASE_DELAY * Math.pow(2, i);
    reconnectAttemptCount = i + 1;
    console.log('[DB] 🔁 重连尝试 ' + reconnectAttemptCount + '/' + MAX_RECONNECT_ATTEMPTS + '，等待 ' + delay + 'ms...');

    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      isInitialized = false;
      initError = null;
      if (mysqlPool) {
        try { await mysqlPool.end(); } catch(e) {}
        mysqlPool = null;
      }

      await initDatabase();

      _recordStatusChange('reconnected');
      console.log('[DB] ✅ 自动重连成功 (尝试 ' + reconnectAttemptCount + ')');
      return true;
    } catch (error) {
      initError = error;
      _recordStatusChange('reconnect_failed');
      console.error('[DB] ❌ 重连尝试 ' + reconnectAttemptCount + ' 失败:', error.message);
    }
  }

  _recordStatusChange('reconnect_exhausted');
  console.error('[DB] 💥 重连失败：已达最大重试次数 (' + MAX_RECONNECT_ATTEMPTS + ')');
  return false;
}

function _markPoolUnhealthy() {
  lastSuccessfulPing = 0;
}

async function ensureReady() {
  if (isInitialized && mysqlPool) {
    const now = Date.now();
    if (now - lastSuccessfulPing < POOL_HEALTH_CHECK_INTERVAL) {
      return;
    }
    if (!poolHealthCheckInProgress) {
      poolHealthCheckInProgress = true;
      try {
        const conn = await mysqlPool.getConnection();
        await conn.ping();
        lastSuccessfulPing = Date.now();
        conn.release();
        poolHealthCheckInProgress = false;
        return;
      } catch (pingErr) {
        console.error('[DB] ⚠️ 连接池健康检查失败，尝试重新初始化:', pingErr.message);
        poolHealthCheckInProgress = false;
        isInitialized = false;
        initError = pingErr;
        try { await mysqlPool.end(); } catch(e) {}
        mysqlPool = null;
      }
    }
  }

  if (initError) {
    initError = null;
  }

  try {
    await initDatabase();
  } catch (err) {
    initError = err;
    
    let errorMessage = `MySQL/TDSQL-C: 数据库连接失败`;
    
    if (err.code === 'CONFIG_ERROR') {
      errorMessage = `[配置错误] ${err.message}`;
    } else if (err.code === 'ECONNREFUSED') {
      errorMessage = `${errorMessage} - 无法连接到数据库服务器 (${DB_HOST}:${DB_PORT})，请检查：1) 数据库服务是否启动 2) 主机地址和端口是否正确 3) 防火墙设置`;
    } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      errorMessage = `${errorMessage} - 认证失败，请检查 DB_USER 和 DB_PASSWORD 配置是否正确`;
    } else if (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN') {
      errorMessage = `${errorMessage} - 无法解析主机名 "${DB_HOST}"，请检查 DNS 配置或使用 IP 地址`;
    } else {
      errorMessage = `${errorMessage} (${err.message})。请检查数据库配置和网络连接。`;
    }
    
    const wrappedErr = new Error(errorMessage);
    wrappedErr.code = 'DB_NOT_READY';
    wrappedErr.statusCode = 503;
    wrappedErr.originalError = err;
    throw wrappedErr;
  }
}

function isDbReady() {
  return isInitialized && !!mysqlPool;
}

function getDbStatus() {
  return {
    isInitialized,
    hasPool: !!mysqlPool,
    dbType: 'mysql',
    host: DB_HOST,
    database: DB_NAME,
    lastError: initError ? initError.message : null
  };
}

async function getDatabaseHealth() {
  let status = 'healthy';
  let poolSize = 0;
  let activeConnections = 0;
  let idleConnections = 0;
  let waitingConnections = 0;

  if (!mysqlPool || !isInitialized) {
    status = 'unhealthy';
  } else if (consecutiveFailures > 0 && consecutiveFailures < 3) {
    status = 'degraded';
  } else if (consecutiveFailures >= 3) {
    status = 'unhealthy';
  }

  if (mysqlPool) {
    try {
      poolSize = mysqlPool.pool.config.connectionLimit || 10;
      const allConnections = mysqlPool.pool._allConnections || [];
      const freeConnections = mysqlPool.pool._freeConnections || [];
      const connectionQueue = mysqlPool.pool._connectionQueue || [];
      activeConnections = allConnections.length - freeConnections.length;
      idleConnections = freeConnections.length;
      waitingConnections = connectionQueue.length;
    } catch(e) {}
  }

  return {
    status,
    poolSize,
    activeConnections,
    idleConnections,
    waitingConnections,
    lastSuccessfulPing: lastSuccessfulPing ? new Date(lastSuccessfulPing).toISOString() : null,
    uptime: Math.round((Date.now() - startTime) / 1000),
    consecutiveFailures,
    reconnectAttemptCount,
    slowQueryCount: slowQueryLog.length,
    recentSlowQueries: slowQueryLog.slice(-5)
  };
}

async function initPool() {
  console.log('[DB] 🚀 初始化 TDSQL-C 云数据库连接池...');
  return initDatabase();
}

async function closePool() {
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
  }
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
  closePool,
  isDbReady,
  getDbStatus,
  getDatabaseHealth,
  getSlowQueryLog: () => [...slowQueryLog],
  clearSlowQueryLog: () => { slowQueryLog = []; },
  checkPoolHealth: async () => {
    if (!mysqlPool || !isInitialized) {
      return { healthy: false, status: 'uninitialized', message: '数据库未初始化' };
    }
    
    try {
      const conn = await mysqlPool.getConnection();
      await conn.ping();
      conn.release();
      
      return {
        healthy: true,
        status: 'healthy',
        message: '连接池健康',
        poolConfig: {
          connectionLimit: mysqlPool.pool?.config?.connectionLimit,
          maxIdle: mysqlPool.pool?.config?.maxIdle,
          idleTimeout: mysqlPool.pool?.config?.idleTimeout
        },
        currentStatus: await getDatabaseHealth()
      };
    } catch (error) {
      return {
        healthy: false,
        status: 'error',
        message: error.message,
        error: process.env.NODE_ENV === 'production' ? undefined : error.stack
      };
    }
  }
};