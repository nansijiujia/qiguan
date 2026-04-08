require('dotenv').config();

const mysql = require('mysql2/promise');
const { log } = console;

function validateRequiredEnvVars() {
  const requiredVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(
      `[DB ERROR] 缺少必需的环境变量: ${missingVars.join(', ')}. ` +
      `请在 .env 文件中配置这些变量，不要使用硬编码凭据（安全审计要求）`
    );
  }
}

validateRequiredEnvVars();

const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
  queueLimit: parseInt(process.env.DB_QUEUE_LIMIT) || 0,
  waitForConnections: true,

  charset: process.env.DB_CHARSET || 'utf8mb4',
  timezone: process.env.DB_TIMEZONE || '+08:00',

  connectTimeout: parseInt(process.env.DB_TIMEOUT) || 60000,
  acquireTimeout: 60000,

  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,

  debug: process.env.DB_DEBUG === 'true'
};

let pool;

async function initPool() {
  try {
    pool = mysql.createPool(dbConfig);

    const connection = await pool.getConnection();

    log('[DB] ✅ MySQL数据库连接池初始化成功');
    log(`[DB] 📍 主机: ${dbConfig.host}:${dbConfig.port}`);
    log(`[DB] 📦 数据库: ${dbConfig.database}`);
    log(`[DB] 🔗 连接池大小: ${dbConfig.connectionLimit}`);

    const [rows] = await connection.execute('SELECT VERSION() AS version');
    log(`[DB] 🔧 MySQL版本: ${rows[0].version}`);

    connection.release();

    return pool;

  } catch (error) {
    log(`[DB ERROR] ❌ 连接池初始化失败: ${error.message}`);
    log('[DB ERROR] 请检查 .env 文件中的数据库配置');
    throw error;
  }
}

function getPool() {
  if (!pool) {
    throw new Error('[DB ERROR] 数据库未初始化，请先调用 initPool()');
  }
  return pool;
}

async function query(sql, params = []) {
  const poolInstance = getPool();

  if (dbConfig.debug) {
    const startTime = Date.now();
    log(`[DB/DEBUG] SQL: ${sql}`);
    if (params.length > 0) log(`[DB/DEBUG] Params: ${JSON.stringify(params)}`);
  }

  try {
    const [rows] = await poolInstance.execute(sql, params);
    return rows;
  } catch (error) {
    log(`[DB ERROR] 查询失败: ${error.message}`);
    log(`[DB ERROR] SQL: ${sql}`);
    if (params.length > 0) log(`[DB ERROR] Params: ${JSON.stringify(params)}`);
    throw error;
  }
}

async function queryAsync(sql, params = []) {
  return query(sql, params);
}

async function getOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

async function getOneAsync(sql, params = []) {
  return getOne(sql, params);
}

async function run(sql, params = []) {
  const poolInstance = getPool();

  if (dbConfig.debug) {
    log(`[DB/DEBUG] SQL: ${sql}`);
    if (params.length > 0) log(`[DB/DEBUG] Params: ${JSON.stringify(params)}`);
  }

  try {
    const [result] = await poolInstance.execute(sql, params);

    return {
      insertId: result.insertId,
      affectedRows: result.affectedRows,
      changedRows: result.changedRows || 0
    };
  } catch (error) {
    log(`[DB ERROR] 写操作失败: ${error.message}`);
    log(`[DB ERROR] SQL: ${sql}`);
    if (params.length > 0) log(`[DB ERROR] Params: ${JSON.stringify(params)}`);
    throw error;
  }
}

async function runAsync(sql, params = []) {
  return run(sql, params);
}

async function execute(sql, params = []) {
  const sqlTrim = sql.trim().toUpperCase();

  if (
    sqlTrim.startsWith('SELECT') ||
    sqlTrim.startsWith('PRAGMA') ||
    sqlTrim.startsWith('EXPLAIN') ||
    sqlTrim.startsWith('SHOW') ||
    sqlTrim.startsWith('DESCRIBE') ||
    sqlTrim.startsWith('DESC')
  ) {
    return query(sql, params);
  } else {
    const result = await run(sql, params);
    return {
      ...result,
      rows: sqlTrim.startsWith('INSERT') ? [] : undefined
    };
  }
}

async function executeAsync(sql, params = []) {
  return execute(sql, params);
}

async function transaction(callback) {
  const poolInstance = getPool();
  const connection = await poolInstance.getConnection();

  try {
    await connection.beginTransaction();

    log('[DB/TRANSACTION] 🔄 开始事务');

    const txConnection = {
      async query(sql, params = []) {
        const [rows] = await connection.execute(sql, params);
        return rows;
      },

      async getOne(sql, params = []) {
        const [rows] = await connection.execute(sql, params);
        return rows.length > 0 ? rows[0] : null;
      },

      async run(sql, params = []) {
        const [result] = await connection.execute(sql, params);
        return {
          insertId: result.insertId,
          affectedRows: result.affectedRows
        };
      }
    };

    const result = await callback(txConnection);

    await connection.commit();

    log('[DB/TRANSACTION] ✅ 事务提交成功');

    return result;

  } catch (error) {
    await connection.rollback();
    log(`[DB/TRANSACTION] ❌ 事务回滚: ${error.message}`);
    throw error;

  } finally {
    connection.release();
  }
}

async function closePool() {
  if (pool) {
    await pool.end();
    log('[DB] 🔌 连接池已关闭');
    pool = null;
  }
}

async function healthCheck() {
  try {
    const poolInstance = getPool();
    const [rows] = await poolInstance.execute('SELECT 1 AS health');
    return {
      status: 'healthy',
      database: dbConfig.database,
      host: dbConfig.host,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

initPool().catch(err => {
  log(`[DB ERROR] 数据库初始化失败: ${err.message}`);
  process.exit(1);
});

module.exports = {
  initPool,
  getPool,
  query,
  queryAsync,
  getOne,
  getOneAsync,
  run,
  runAsync,
  execute,
  executeAsync,
  transaction,
  closePool,
  healthCheck,
  config: dbConfig
};
