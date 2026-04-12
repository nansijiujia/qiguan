const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function testDB() {
  console.log('=== 测试数据库连接 ===');
  try {
    const conn = await mysql.createConnection({
      host: '10.0.0.16',
      port: 3306,
      user: 'QMZYXCX',
      password: 'LJN040821.',
      database: 'qmzyxcx'
    });

    console.log('✅ 数据库连接成功');

    // 查询admin用户
    const [rows] = await conn.execute(
      'SELECT id, username, email, role, status, password FROM users WHERE username = ?',
      ['admin']
    );

    console.log('\n=== Admin用户信息 ===');
    if (rows.length > 0) {
      const user = rows[0];
      console.log('ID:', user.id);
      console.log('用户名:', user.username);
      console.log('邮箱:', user.email);
      console.log('角色:', user.role);
      console.log('状态:', user.status);
      console.log('密码哈希前30位:', user.password ? user.password.substring(0, 30) : 'NULL');

      // 测试密码验证
      console.log('\n=== 测试密码验证 ===');
      if (user.password) {
        const isValid = await bcrypt.compare('admin123', user.password);
        console.log('密码 "admin123" 验证结果:', isValid);

        if (!isValid) {
          console.log('\n⚠️  密码不匹配! 正在重置密码...');
          const newHash = await bcrypt.hash('admin123', 10);
          await conn.execute(
            'UPDATE users SET password = ? WHERE username = ?',
            [newHash, 'admin']
          );
          console.log('✅ 密码已重置为 admin123');

          // 再次验证
          const isValid2 = await bcrypt.compare('admin123', newHash);
          console.log('重置后验证结果:', isValid2);
        }
      } else {
        console.log('❌ 用户没有密码字段!');
      }
    } else {
      console.log('❌ 未找到admin用户!');
      console.log('\n正在创建admin用户...');

      const passwordHash = await bcrypt.hash('admin123', 10);
      await conn.execute(
        `INSERT INTO users (username, email, password, role, status, created_at)
         VALUES (?, ?, ?, 'admin', 'active', NOW())`,
        ['admin', 'admin@qimengzhiyue.cn', passwordHash]
      );
      console.log('✅ Admin用户已创建 (admin/admin123)');
    }

    await conn.end();
    console.log('\n=== 测试完成 ===');
  } catch (error) {
    console.error('❌ 错误:', error.message);
  }
}

testDB();
