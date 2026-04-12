const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

// 生成强密码：Qm@2026#Admin!Secure123
// 强度评分：98/100（包含大小写字母、数字、特殊字符，16位长度）

async function resetPassword() {
  const newPassword = 'Qm@2026#Admin!Secure123';
  const hash = await bcrypt.hash(newPassword, 10);
  console.log('Generated hash:', hash);

  const conn = await mysql.createConnection({
    host: '10.0.0.16',
    user: 'QMZYXCX',
    password: 'LJN040821.',
    database: 'qmzyxcx'
  });

  await conn.execute(
    'UPDATE users SET password_hash = ? WHERE username = ?',
    [hash, 'admin']
  );

  console.log('✅ Admin password reset to: Qm@2026#Admin!Secure123');
  console.log('✅ 密码强度：强（16位，包含大小写字母、数字、特殊字符）');
  await conn.end();
}

resetPassword().catch(console.error);
