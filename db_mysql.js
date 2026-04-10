require('dotenv').config();

const mysql = require('mysql2/promise');
const { log } = console;

/**
 * ============================================================
 * 绮管后台 - MySQL/TDSQL-C 数据库配置模块
 * 
 * 功能:
 * 1. 连接池管理 (自动重连、连接复用)
 * 2. 兼容原有 db.js 的API接口
 * 3. 支持事务操作
 * 4. 错误处理与日志记录
 * 
 * 目标: TDSQL-C (腾讯云MySQL兼容实例)
 * 
 * 使用方法:
 *   const db_mysql = require('./db_mysql');
 *   const rows = await db_mysql.queryAsync('SELECT * FROM users');
 * 
 * API接口 (与db.js兼容):
 *   - query(sql, params)          → Promise<rows[]>
 *   - queryAsync(sql, params)     → Promise<rows[]>
 *   - getOne(sql, params)         → Promise<row|null>
 *   - getOneAsync(sql, params)    → Promise<row|null>
 *   - run(sql, params)            → Promise<{insertId, affectedRows}>
 *   - runAsync(sql, params)       → Promise<{insertId, affectedRows}>
 *   - execute(sql, params)        → 根据SQL类型自动选择query或run
 *   - executeAsync(sql, params)   → 同上(异步)
 *   - transaction(callback)       → 事务处理
 * 
 * 作者: AI Assistant
 * 创建时间: 2026-04-08
 * ============================================================
 */

// 强制生产环境必须配置数据库凭证（安全要求）
if (process.env.NODE_ENV === 'production') {
  if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME) {
    console.error('========================================');
    console.error('[FATAL] Production environment requires:');
    console.error('  - DB_HOST');
    console.error('  - DB_USER');
    console.error('  - DB_PASSWORD');
    console.error('  - DB_NAME');
    console.error('');
    console.error('Please configure these in .env.production file');
    console.error('========================================');
    process.exit(1);
  }
  log('[SECURITY] ✅ Production database credentials validated from environment variables');
}

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'test',

  // 连接池配置 (生产级优化)
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 20,
  queueLimit: parseInt(process.env.DB_QUEUE_LIMIT) || 100,
  waitForConnections: true,
  maxIdle: parseInt(process.env.DB_MAX_IDLE) || 10,
  idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT) || 60000,
  acquireTimeout: 30000,

  // 字符集与时区
  charset: 'utf8mb4',
  timezone: '+08:00',

  // SSL配置 (生产环境可选)
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,

  // 调试模式 (生产环境关闭)
  debug: process.env.NODE_ENV === 'development',

  // 连接保活 (防止MySQL wait_timeout断开)
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};

// 全局连接池变量
let pool;

// 健康检查定时器
let healthCheckInterval;

/**
 * 启动定期健康检查 (每5分钟)
 */
function startHealthCheck() {
  if (healthCheckInterval) clearInterval(healthCheckInterval);

  healthCheckInterval = setInterval(async () => {
    try {
      const poolInstance = getPool();
      await poolInstance.query('SELECT 1 AS ping');
      if (process.env.NODE_ENV === 'development') {
        log('[MySQL/HEALTHCHECK] ✅ Ping successful', 'info');
      }
    } catch (error) {
      log(`[MySQL/HEALTHCHECK] ❌ Health check failed: ${error.message}`, 'error');
    }
  }, 5 * 60 * 1000);
}

/**
async function initPool() {
    try {
        pool = mysql.createPool(dbConfig);
        
        // 测试连接
        const connection = await pool.getConnection();
        
        log('[MySQL/TDSQL-C] ✅ 数据库连接池初始化成功');
        log(`[MySQL/TDSQL-C] 📍 主机: ${dbConfig.host}:${dbConfig.port}`);
        log(`[MySQL/TDSQL-C] 📦 数据库: ${database}`);
        log(`[MySQL/TDSQL-C] 🔗 连接池大小: ${dbConfig.connectionLimit}`);
        
        // 获取连接信息
        const [rows] = await connection.execute('SELECT VERSION() AS version');
        log(`[MySQL/TDSQL-C] 🔧 版本: ${rows[0].version}`);
        
        connection.release();

        // 启动定期健康检查
        startHealthCheck();
        
        return pool;
        
    } catch (error) {
        log(`[MySQL/TDSQL-C] ❌ 连接池初始化失败: ${error.message}`, 'error');
        log('[MySQL/TDSQL-C] 请检查 .env 文件中的数据库配置', 'warn');
        throw error;
    }
}

/**
 * 获取连接池实例 (懒加载)
 */
function getPool() {
    if (!pool) {
        throw new Error('[MySQL/TDSQL-C] 数据库未初始化，请先调用 initPool()');
    }
    return pool;
}

/**
 * 执行查询 (返回多行)
 * 对应SQLite的 query() 方法
 * @param {string} sql SQL语句
 * @param {Array} params 参数数组
 * @returns {Promise<Array>} 结果行数组
 */
async function query(sql, params = []) {
    const poolInstance = getPool();
    
    if (dbConfig.debug) {
        const startTime = Date.now();
        log(`[MySQL/DEBUG] ⏱️  SQL: ${sql}`, 'debug');
        if (params.length > 0) log(`[MySQL/DEBUG] 📋 Params: ${JSON.stringify(params)}`, 'debug');
    }
    
    try {
        const [rows] = await poolInstance.execute(sql, params);
        
        if (dbConfig.debug) {
            const duration = Date.now() - startTime;
            log(`[MySQL/DEBUG] ✅ 查询完成 (${duration}ms), 返回 ${rows.length} 行`, 'debug');
        }
        
        return rows;
        
    } catch (error) {
        log(`[MySQL/ERROR] ❌ 查询失败: ${error.message}`, 'error');
        log(`[MySQL/ERROR] SQL: ${sql}`, 'error');
        if (params.length > 0) log(`[MySQL/ERROR] Params: ${JSON.stringify(params)}`, 'error');
        throw error;
    }
}

/**
 * 异步查询别名
 */
async function queryAsync(sql, params = []) {
    return query(sql, params);
}

/**
 * 执行查询 (返回单行)
 * 对应SQLite的 getOne() 方法
 * @param {string} sql SQL语句
 * @param {Array} params 参数数组
 * @returns {Promise<Object|null>} 单行结果或null
 */
async function getOne(sql, params = []) {
    const rows = await query(sql, params);
    return rows.length > 0 ? rows[0] : null;
}

/**
 * 异步查询单行别名
 */
async function getOneAsync(sql, params = []) {
    return getOne(sql, params);
}

/**
 * 执行写操作 (INSERT/UPDATE/DELETE)
 * 对应SQLite的 run() 方法
 * @param {string} sql SQL语句
 * @param {Array} params 参数数组
 * @returns {Promise<Object>} { insertId, affectedRows }
 */
async function run(sql, params = []) {
    const poolInstance = getPool();
    
    if (dbConfig.debug) {
        log(`[MySQL/DEBUG] ⏱️  SQL: ${sql}`, 'debug');
        if (params.length > 0) log(`[MySQL/DEBUG] 📋 Params: ${JSON.stringify(params)}`, 'debug');
    }
    
    try {
        const [result] = await poolInstance.execute(sql, params);
        
        const response = {
            insertId: result.insertId,
            affectedRows: result.affectedRows,
            changedRows: result.changedRows || 0
        };
        
        if (dbConfig.debug) {
            log(`[MySQL/DEBUG] ✅ 写操作完成, 影响行数: ${response.affectedRows}, 插入ID: ${response.insertId}`, 'debug');
        }
        
        return response;
        
    } catch (error) {
        log(`[MySQL/ERROR] ❌ 写操作失败: ${error.message}`, 'error');
        log(`[MySQL/ERROR] SQL: ${sql}`, 'error');
        if (params.length > 0) log(`[MySQL/ERROR] Params: ${JSON.stringify(params)}`, 'error');
        throw error;
    }
}

/**
 * 异步写操作别名
 */
async function runAsync(sql, params = []) {
    return run(sql, params);
}

/**
 * 自动执行 (根据SQL类型智能选择query或run)
 * 完全兼容 db.js 的 execute() 接口
 * @param {string} sql SQL语句
 * @param {Array} params 参数数组
 * @returns {Promise<Array|Object>}
 */
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
        // 查询操作
        return query(sql, params);
    } else {
        // 写操作
        const result = await run(sql, params);
        return {
            ...result,
            rows: sqlTrim.startsWith('INSERT') ? [] : undefined
        };
    }
}

/**
 * 异步执行别名
 */
async function executeAsync(sql, params = []) {
    return execute(sql, params);
}

/**
 * 事务处理
 * 对应SQLite的 transaction() 方法
 * @param {Function} callback 事务回调函数，接收connection参数
 * @returns {Promise<any>}
 */
async function transaction(callback) {
    const poolInstance = getPool();
    const connection = await poolInstance.getConnection();
    
    try {
        await connection.beginTransaction();
        
        log('[MySQL/TRANSACTION] 🔄 开始事务', 'info');
        
        // 包装connection以提供与db.js相同的API
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
        
        // 执行用户回调
        const result = await callback(txConnection);
        
        await connection.commit();
        
        log('[MySQL/TRANSACTION] ✅ 事务提交成功', 'info');
        
        return result;
        
    } catch (error) {
        await connection.rollback();
        log(`[MySQL/TRANSACTION] ❌ 事务回滚: ${error.message}`, 'error');
        throw error;
        
    } finally {
        connection.release();
    }
}

/**
 * 关闭连接池
 */
async function closePool() {
    if (pool) {
        await pool.end();
        log('[MySQL/TDSQL-C] 🔌 连接池已关闭', 'info');
        pool = null;
    }
}

/**
 * 健康检查
 */
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

// 导出模块
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
    
    // 配置信息 (仅用于调试)
    config: dbConfig
};

// 如果直接运行此文件，执行测试连接
if (require.main === module) {
    (async () => {
        try {
            log('\n' + '='.repeat(60), 'info');
            log('🔍 测试 MySQL/TDSQL-C 连接...', 'info');
            log('='.repeat(60) + '\n', 'info');
            
            await initPool();
            
            const health = await healthCheck();
            log('\n健康检查结果:', 'info');
            log(JSON.stringify(health, null, 2), 'info');
            
            await closePool();
            
            log('\n✅ 测试通过! MySQL模块可正常使用\n', 'green');
            
        } catch (error) {
            log(`\n❌ 测试失败: ${error.message}\n`, 'error');
            process.exit(1);
        }
    })();
}
