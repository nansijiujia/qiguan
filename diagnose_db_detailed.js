require('dotenv').config({path:'.env.production'});

console.log('=== 详细数据库诊断 ===\n');

console.log('1. 环境变量检查:');
console.log('   DB_NAME:', process.env.DB_NAME);
console.log('   DB_HOST:', process.env.DB_HOST);
console.log('');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'test'
};

console.log('2. dbConfig对象:');
console.log('   host:', dbConfig.host);
console.log('   port:', dbConfig.port);
console.log('   user:', dbConfig.user);
console.log('   database:', dbConfig.database);
console.log('   password:', dbConfig.password ? '***已设置***' : '❌ 未设置');
console.log('');

console.log('3. 测试database字段访问:');
try {
  console.log('   dbConfig.database =', dbConfig.database);
  console.log('   ✅ database字段可访问\n');
} catch (e) {
  console.error('   ❌ 访问失败:', e.message, '\n');
}

const mysql = require('mysql2/promise');

async function test() {
  try {
    console.log('4. 尝试创建连接池...');
    const pool = mysql.createPool(dbConfig);
    console.log('   ✅ 连接池创建成功\n');

    console.log('5. 测试获取连接...');
    const conn = await pool.getConnection();
    console.log('   ✅ 获取连接成功\n');

    console.log('6. 执行测试查询...');
    const [rows] = await conn.execute('SELECT 1 AS test, DATABASE() AS current_db');
    console.log('   ✅ 查询结果:', rows, '\n');
    console.log('   当前数据库:', rows[0].current_db);

    conn.release();
    await pool.end();

    console.log('\n🎉 数据库连接完全正常！');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 错误详情:');
    console.error('   消息:', error.message);
    console.error('   代码:', error.code);
    console.error('   编号:', error.errno);
    if (error.sql) console.error('   SQL:', error.sql);
    console.error('\n堆栈:', error.stack);
    process.exit(1);
  }
}

test();
