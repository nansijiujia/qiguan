const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function fixPassword() {
  console.log('=== 修复admin密码 ===\n');
  try {
    const conn = await mysql.createConnection({
      host: '10.0.0.16',
      port: 3306,
      user: 'QMZYXCX',
      password: 'LJN040821.',
      database: 'qmzyxcx'
    });

    // 查询当前密码
    const [rows] = await conn.execute(
      'SELECT id, username, password_hash FROM users WHERE username = ?',
      ['admin']
    );

    if (rows.length > 0) {
      const user = rows[0];
      const currentHash = user.password_hash;

      console.log('当前密码哈希:', currentHash.substring(0, 40) + '...');

      // 测试当前密码是否匹配 admin123
      const isMatch = await bcrypt.compare('admin123', currentHash);
      console.log('\n测试 "admin123" 与当前密码匹配:', isMatch);

      if (!isMatch) {
        console.log('\n⚠️  密码不匹配! 正在重置为 admin123...');
        const newHash = await bcrypt.hash('admin123', 10);
        console.log('新密码哈希:', newHash.substring(0, 40) + '...');

        // 更新数据库
        await conn.execute(
          'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE username = ?',
          [newHash, 'admin']
        );
        console.log('✅ 数据库已更新');

        // 验证更新
        const [verifyRows] = await conn.execute(
          'SELECT password_hash FROM users WHERE username = ?',
          ['admin']
        );
        const verifyMatch = await bcrypt.compare('admin123', verifyRows[0].password_hash);
        console.log('\n✅ 验证结果: admin/admin123 现在可以登录!', verifyMatch);
      } else {
        console.log('\n✅ 密码已经正确! admin/admin123 可以登录');
      }
    } else {
      console.log('❌ 未找到admin用户');
    }

    await conn.end();
    console.log('\n=== 完成 ===');
  } catch (error) {
    console.error('❌ 错误:', error.message);
  }
}

fixPassword();
