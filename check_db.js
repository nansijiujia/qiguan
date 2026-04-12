const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = './data/ecommerce.db';

console.log('=== 检查数据库 ===');
console.log('数据库路径:', path.resolve(DB_PATH));
console.log('');

try {
  const db = new Database(DB_PATH);
  
  // 检查所有表
  console.log('1. 检查数据库表:');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('   表列表:', tables.map(t => t.name));
  console.log('');
  
  // 检查用户表
  console.log('2. 检查用户表:');
  try {
    const users = db.prepare('SELECT * FROM users').all();
    console.log('   用户数量:', users.length);
    users.forEach(user => {
      console.log(`   - ID: ${user.id}, 用户名: ${user.username}, 角色: ${user.role}, 状态: ${user.status}`);
      console.log(`     密码哈希: ${(user.password || user.password_hash || '').substring(0, 30)}...`);
    });
  } catch (e) {
    console.log('   用户表不存在或查询失败:', e.message);
  }
  console.log('');
  
  // 检查商品表
  console.log('3. 检查商品表:');
  try {
    const products = db.prepare('SELECT * FROM products').all();
    console.log('   商品数量:', products.length);
    products.slice(0, 3).forEach(product => {
      console.log(`   - ${product.name}: ¥${product.price}`);
    });
    if (products.length > 3) {
      console.log(`   ... 还有 ${products.length - 3} 个商品`);
    }
  } catch (e) {
    console.log('   商品表不存在或查询失败:', e.message);
  }
  
  db.close();
  console.log('\n✅ 数据库检查完成');
} catch (error) {
  console.error('\n❌ 数据库检查失败:', error.message);
}
