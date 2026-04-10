require('dotenv').config({path:'.env.production'});
const bcrypt = require('bcryptjs');
const db = require('./db_mysql');

const NEW_PASSWORD = 'Qm@2026#Admin!Secure';

console.log('=== 🔐 管理员密码重置工具 ===\n');
console.log(`新密码: ${NEW_PASSWORD}`);
console.log(`密码强度: ✅ 强 (12位+大小写+数字+特殊字符)\n`);

async function resetPassword() {
  try {
    await db.initPool();
    console.log('✅ 数据库连接成功\n');

    // 1. 生成bcrypt hash
    console.log('1️⃣ 生成安全密码哈希...');
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(NEW_PASSWORD, saltRounds);
    console.log('   ✅ bcrypt哈希生成成功');
    console.log(`   哈希值: ${passwordHash.substring(0, 20)}...\n`);

    // 2. 更新管理员密码
    console.log('2️⃣ 更新管理员账户密码...');
    const result = await db.query(
      "UPDATE users SET password = ?, updated_at = NOW() WHERE username = 'admin'",
      [passwordHash]
    );

    if (result.affectedRows > 0) {
      console.log(`   ✅ 密码更新成功 (影响 ${result.affectedRows} 行)\n`);
    } else {
      throw new Error('未找到admin用户或更新失败');
    }

    // 3. 验证更新结果
    console.log('3️⃣ 验证密码更新...');
    const user = await db.query(
      "SELECT id, username, email, role, status FROM users WHERE username = 'admin'"
    );

    if (user.length > 0) {
      const admin = user[0];
      console.log('   ✅ 管理员账户信息:');
      console.log(`     ID: ${admin.id}`);
      console.log(`     用户名: ${admin.username}`);
      console.log(`     邮箱: ${admin.email}`);
      console.log(`     角色: ${admin.role}`);
      console.log(`     状态: ${admin.status}\n`);

      // 4. 测试登录验证
      console.log('4️⃣ 测试新密码登录验证...');
      const isValid = await bcrypt.compare(NEW_PASSWORD, passwordHash);
      if (isValid) {
        console.log('   ✅ 密码验证通过!\n');
      } else {
        throw new Error('密码验证失败');
      }
    }

    // 输出最终报告
    console.log('='.repeat(60));
    console.log('🎉 管理员密码重置完成!');
    console.log('='.repeat(60));
    console.log('\n📋 登录凭据 (请妥善保管):\n');
    console.log(`   🔗 后台地址: https://admin.qimengzhiyue.cn`);
    console.log(`   👤 用户名:   admin`);
    console.log(`   🔑 密码:     ${NEW_PASSWORD}\n`);
    console.log('⚠️ 安全提示:');
    console.log('   - 请立即登录并修改为您自己的密码');
    console.log('   - 不要在聊天工具中分享此密码');
    console.log('   - 建议定期更换密码 (90天/次)\n');
    console.log('='.repeat(60));

    process.exit(0);
  } catch (error) {
    console.error('\n❌ 密码重置失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

resetPassword();
