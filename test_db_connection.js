require('dotenv').config({path:'.env.production'});

console.log('=== 数据库配置检查 ===');
console.log('DB_TYPE:', process.env.DB_TYPE);
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '***已设置***' : '❌ 未设置');

const db = require('./db_mysql');

db.initPool()
  .then(() => {
    console.log('\n✅ MySQL连接成功！');
    return db.query('SELECT 1 AS test');
  })
  .then(result => {
    console.log('✅ 查询测试通过:', result);
    return db.query('SHOW TABLES');
  })
  .then(tables => {
    console.log('\n📦 数据库表列表:');
    tables.forEach(t => {
      const tableName = Object.values(t)[0];
      console.log('  -', tableName);
    });
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ 数据库连接失败:');
    console.error('错误信息:', err.message);
    console.error('\n请检查:');
    console.error('1. .env.production文件中的数据库配置');
    console.error('2. MySQL服务器是否可访问');
    console.error('3. 用户名密码是否正确');
    console.error('4. 数据库是否存在');
    process.exit(1);
  });
