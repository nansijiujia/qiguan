require('dotenv').config({path:'.env.production'});
const db = require('./db_mysql');

async function checkUser() {
  try {
    await db.initPool();
    console.log('=== 检查admin用户 ===\n');
    
    const user = await db.query(
      "SELECT id, username, email, password, status, role FROM users WHERE username = 'admin'"
    );
    
    if (user.length > 0) {
      const admin = user[0];
      console.log('用户信息:');
      console.log('  ID:', admin.id);
      console.log('  用户名:', admin.username);
      console.log('  邮箱:', admin.email);
      console.log('  状态:', admin.status);
      console.log('  角色:', admin.role);
      console.log('  password字段存在:', !!admin.password);
      
      if (admin.password) {
        console.log('\n  password前30字符:', admin.password.substring(0, 30));
        
        // 测试密码验证
        const bcrypt = require('bcryptjs');
        const isValid = await bcrypt.compare('Qm@2026#Admin!Secure', admin.password);
        console.log('\n  密码验证结果:', isValid ? '✅ 通过' : '❌ 失败');
      }
    } else {
      console.log('❌ 未找到admin用户');
    }
    
    process.exit(0);
  } catch (e) {
    console.error('错误:', e.message);
    process.exit(1);
  }
}

checkUser();
