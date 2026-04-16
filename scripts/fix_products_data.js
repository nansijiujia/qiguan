const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/ecommerce.db');

console.log('\n🔧 修复商品数据...\n');

db.get("SELECT COUNT(*) as count FROM products", (err, row) => {
  if (err) {
    console.error('❌ 查询失败:', err.message);
    process.exit(1);
  }

  console.log(`📊 当前商品数量: ${row.count}`);

  if (row.count > 0) {
    console.log('✅ 商品数据已存在，无需修复\n');
    db.close();
    process.exit(0);
  }

  console.log('📝 开始插入商品数据...\n');

  const products = [
    { name: '智能手机 Pro Max', description: '旗舰级智能手机，搭载最新处理器', price: 6999.00, stock: 150, category_id: 1, status: 'active' },
    { name: '无线蓝牙耳机', description: '降噪蓝牙耳机，续航30小时', price: 299.00, stock: 500, category_id: 1, status: 'active' },
    { name: '纯棉T恤', description: '100%纯棉面料，舒适透气', price: 89.00, stock: 1000, category_id: 2, status: 'active' },
    { name: '有机绿茶 250g', description: '高山有机绿茶，清香回甘', price: 128.00, stock: 300, category_id: 3, status: 'active' },
    { name: '智能手表 运动版', description: '心率监测、GPS定位、50米防水', price: 1599.00, stock: 200, category_id: 1, status: 'active' }
  ];

  let inserted = 0;
  
  const insertNext = () => {
    if (inserted < products.length) {
      const p = products[inserted];
      db.run(
        `INSERT INTO products (name, description, price, stock, category_id, status) VALUES (?, ?, ?, ?, ?, ?)`,
        [p.name, p.description, p.price, p.stock, p.category_id, p.status],
        function(err) {
          if (err) {
            console.error(`   ❌ 插入失败 [${p.name}]: ${err.message}`);
          } else {
            console.log(`   ✅ [${this.lastID}] ${p.name} - ¥${p.price}`);
          }
          inserted++;
          insertNext();
        }
      );
    } else {
      db.get("SELECT COUNT(*) as count FROM products", (err2, finalRow) => {
        if (!err2) {
          console.log(`\n🎉 商品数据修复完成! 共 ${finalRow.count} 条商品\n`);
          
          // 显示完整统计
          db.all(`
            SELECT 
              (SELECT COUNT(*) FROM categories) as categories,
              (SELECT COUNT(*) FROM products) as products,
              (SELECT COUNT(*) FROM users) as users,
              (SELECT COUNT(*) FROM coupons) as coupons
          `, (err3, stats) => {
            if (!err3 && stats[0]) {
              console.log('📋 数据库最终状态:');
              console.log(`   分类: ${stats[0].categories} 个`);
              console.log(`   商品: ${stats[0].products} 个`);
              console.log(`   用户: ${stats[0].users} 个`);
              console.log(`   优惠券: ${stats[0].coupons} 张\n`);
            }
            db.close();
          });
        }
      });
    }
  };

  insertNext();
});
