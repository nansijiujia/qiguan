require('dotenv').config();

const dbType = process.env.DB_TYPE || 'sqlite';

let dbModule;

if (dbType === 'sqlite') {
  console.log('[DB] Loading SQLite database module');
  dbModule = require('./db.js');
  
  // 确保数据库已初始化
  dbModule.initDatabase();
  
  // 包装为与 db_mysql 兼容的接口
  module.exports = {
    initPool: async () => {
      console.log('[SQLite] Database already initialized');
      return Promise.resolve();
    },
    query: dbModule.queryAsync,
    queryAsync: dbModule.queryAsync,
    getOne: dbModule.getOneAsync,
    getOneAsync: dbModule.getOneAsync,
    run: dbModule.query,
    runAsync: dbModule.queryAsync,
    execute: dbModule.execute,
    executeAsync: dbModule.queryAsync,
    transaction: dbModule.transaction
  };
} else {
  console.log('[DB] Loading MySQL database module');
  dbModule = require('./db_mysql.js');
  module.exports = dbModule;
}
