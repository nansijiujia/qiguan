require('dotenv').config({path:'.env.production'});
const db = require('./db_mysql');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'qiguan-default-jwt-secret-key-for-development-change-in-production-at-least-32-chars';

async function fullLoginTest() {
  try {
    await db.initPool();
    console.log('=== 完整登录流程测试 ===\n');
    
    // 1. 查询用户
    console.log('1️⃣ 查询用户...');
    const users = await db.query("SELECT * FROM users WHERE username = 'admin'");
    
    if (users.length === 0) {
      console.log('❌ 用户不存在');
      return;
    }
    
    const user = users[0];
    console.log('✅ 找到用户:', user.username);
    console.log('   状态:', user.status);
    
    // 2. 验证密码
    console.log('\n2️⃣ 验证密码...');
    const password = 'Qm@2026#Admin!Secure';
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      console.log('❌ 密码不匹配');
      return;
    }
    
    console.log('✅ 密码验证通过');
    
    // 3. 生成Token
    console.log('\n3️⃣ 生成JWT Token...');
    const payload = {
      userId: user.id,
      username: user.username,
      role: user.role
    };
    
    try {
      const token = jwt.sign(payload, JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: '24h'
      });
      
      console.log('✅ Token生成成功');
      console.log('   Token (前50字符):', token.substring(0, 50));
      
      // 4. 验证Token
      console.log('\n4️⃣ 验证Token...');
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log('✅ Token验证通过');
      console.log('   解码后:', JSON.stringify(decoded));
      
      console.log('\n' + '='.repeat(50));
      console.log('🎉 完整登录流程测试成功！');
      console.log('='.repeat(50));
      
    } catch (jwtError) {
      console.error('❌ JWT错误:', jwtError.message);
    }
    
    process.exit(0);
  } catch (e) {
    console.error('❌ 测试失败:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
}

fullLoginTest();
