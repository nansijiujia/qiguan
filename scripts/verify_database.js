const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/ecommerce.db');

console.log('\n🔍 数据库验证报告\n');

db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
  if (err) {
    console.error('❌ 查询表列表失败:', err.message);
    process.exit(1);
  }

  console.log('📋 数据库表结构:');
  tables.forEach(t => console.log(`   ✅ ${t.name}`));
  console.log(`\n   共 ${tables.length} 张表\n`);

  const checkTable = (tableName, callback) => {
    db.get(`SELECT COUNT(*) as count FROM ${tableName}`, (err, row) => {
      if (err) {
        console.log(`   ❌ ${tableName}: 查询失败 - ${err.message}`);
      } else {
        console.log(`   📊 ${tableName}: ${row.count} 条记录`);
      }
      callback();
    });
  };

  const tableNames = ['categories', 'users', 'products', 'orders', 'order_items', 'coupons', 'user_coupons', 'coupon_receive_logs'];
  
  let completed = 0;
  const checkNext = () => {
    if (completed < tableNames.length) {
      checkTable(tableNames[completed], () => {
        completed++;
        checkNext();
      });
    } else {
      // 验证关键数据
      console.log('\n📝 关键数据抽样验证:');
      
      db.all('SELECT id, name FROM categories LIMIT 3', (err, cats) => {
        if (!err) {
          console.log('   分类数据示例:');
          cats.forEach(c => console.log(`      [${c.id}] ${c.name}`));
        }
        
        db.get('SELECT id, username, role FROM users WHERE username = ?', ['admin'], (err2, admin) => {
          if (!err2 && admin) {
            console.log(`\n   管理员账户: ${admin.username} (${admin.role})`);
          }
          
          db.all('SELECT id, name, code FROM coupons LIMIT 4', (err3, coupons) => {
            if (!err3) {
              console.log('\n   优惠券数据示例:');
              if (coupons.length === 0) {
                console.log('      ⚠️  暂无优惠券数据');
              } else {
                coupons.forEach(c => console.log(`      [${c.id}] ${c.name} (${c.code || '无优惠码'})`));
              }
            }
            
            console.log('\n✅ 数据库验证完成\n');
            db.close();
          });
        });
      });
    }
  };

  console.log('📊 各表记录统计:');
  checkNext();
});
