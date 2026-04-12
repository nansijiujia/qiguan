const mysql = require('mysql2/promise');

async function checkSchema() {
  console.log('=== 检查users表结构 ===');
  try {
    const conn = await mysql.createConnection({
      host: '10.0.0.16',
      port: 3306,
      user: 'QMZYXCX',
      password: 'LJN040821.',
      database: 'qmzyxcx'
    });

    // 获取表结构
    const [columns] = await conn.execute('DESCRIBE users');
    console.log('\nUsers表字段:');
    columns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type}) ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    // 查询admin用户（使用*）
    console.log('\n=== 查询admin用户 ===');
    const [rows] = await conn.execute('SELECT * FROM users WHERE username = ?', ['admin']);
    if (rows.length > 0) {
      const user = rows[0];
      console.log('用户数据:', JSON.stringify(user, null, 2));

      // 查找密码相关字段
      const passwordFields = Object.keys(user).filter(key =>
        key.toLowerCase().includes('password') || key.toLowerCase().includes('pwd')
      );
      console.log('\n密码相关字段:', passwordFields);
    } else {
      console.log('❌ 未找到admin用户');
    }

    await conn.end();
  } catch (error) {
    console.error('❌ 错误:', error.message);
  }
}

checkSchema();
