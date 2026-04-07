require('dotenv').config();

let db = null;
let app = null;

try {
  const cloudbase = require('@cloudbase/node-sdk');
  
  const secretId = process.env.SECRET_ID || '';
  const secretKey = process.env.SECRET_KEY || '';
  
  if (secretId && secretKey && 
      !secretId.includes('your-secret') && 
      !secretKey.includes('your-secret')) {
    app = cloudbase.init({
      env: process.env.CLOUDBASE_ENV || 'nansijiujia-1gaeh8qpb9ad09a5',
      secretId: secretId,
      secretKey: secretKey
    });
    db = app.database();
    console.log('[SUCCESS] CloudBase database initialized successfully');
    console.log(`[INFO] Environment: ${process.env.CLOUDBASE_ENV}`);
  } else {
    console.log('[WARNING] CloudBase credentials not configured or using placeholder values');
    console.log('[WARNING] Database operations will return mock/empty responses');
  }
} catch (error) {
  console.error('[ERROR] Failed to initialize CloudBase:', error.message);
}

const query = async (sql, params = []) => {
  if (!db) {
    throw new Error('Database not initialized - please check CloudBase credentials');
  }
  console.log('Query:', sql, params);
  return [];
};

const get = async (sql, params = []) => {
  if (!db) {
    throw new Error('Database not initialized - please check CloudBase credentials');
  }
  console.log('Get:', sql, params);
  return null;
};

const run = async (sql, params = []) => {
  if (!db) {
    throw new Error('Database not initialized - please check CloudBase credentials');
  }
  console.log('Run:', sql, params);
  return { lastID: 1, changes: 1 };
};

module.exports = {
  db,
  query,
  get,
  run
};