const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// 数据库路径
const dbPath = path.join(__dirname, '..', 'data', 'ecommerce.db');

// SQL文件路径
const sqlFilePath = path.join(__dirname, 'init_data.sql');

// 读取SQL文件内容
const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

// 连接数据库
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
    return;
  }
  console.log('成功连接到数据库');
  
  // 执行SQL语句
  db.exec(sqlContent, (err) => {
    if (err) {
      console.error('执行SQL失败:', err.message);
    } else {
      console.log('数据插入成功');
    }
    
    // 关闭数据库连接
    db.close((err) => {
      if (err) {
        console.error('关闭数据库失败:', err.message);
      } else {
        console.log('数据库连接已关闭');
      }
    });
  });
});