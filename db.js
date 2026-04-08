require('dotenv').config();

const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || '10.0.0.16',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'QMZYXCX',
  password: process.env.DB_PASSWORD || 'LJN040821.',
  database: process.env.DB_NAME || 'qmzyxcx',
  connectionLimit: 10,
  waitForConnections: true
};

let pool = null;

try {
  pool = mysql.createPool(dbConfig);
  
  (async () => {
    try {
      const connection = await pool.getConnection();
      console.log('[DB] MySQL connected successfully');
      connection.release();
    } catch (error) {
      console.error('[DB ERROR] Failed to connect to MySQL:', error.message);
      console.error('[DB ERROR] Config:', {
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        database: dbConfig.database
      });
    }
  })();
} catch (error) {
  console.error('[DB ERROR] Failed to create MySQL pool:', error.message);
}

const query = async (sql, params = []) => {
  if (!pool) {
    throw new Error('Database not initialized - please check MySQL configuration');
  }
  const [rows] = await pool.execute(sql, params);
  return rows;
};

const getOne = async (sql, params = []) => {
  if (!pool) {
    throw new Error('Database not initialized - please check MySQL configuration');
  }
  const [rows] = await pool.execute(sql, params);
  return rows.length > 0 ? rows[0] : null;
};

module.exports = {
  db: pool,
  query,
  getOne
};
