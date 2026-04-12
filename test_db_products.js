const { initPool, query, getOne } = require('./db_mysql');

async function testDatabase() {
  // 初始化数据库连接池
  await initPool();
  try {
    console.log('=== 测试数据库连接 ===');
    
    // 测试1: 检查products表是否存在
    console.log('\n1. 检查products表是否存在:');
    const productsCheck = await getOne('SHOW TABLES LIKE ?', ['products']);
    console.log('   结果:', productsCheck ? '✅ 存在' : '❌ 不存在');
    
    // 测试2: 检查categories表是否存在
    console.log('\n2. 检查categories表是否存在:');
    const categoriesCheck = await getOne('SHOW TABLES LIKE ?', ['categories']);
    console.log('   结果:', categoriesCheck ? '✅ 存在' : '❌ 不存在');
    
    // 测试3: 查看products表结构
    console.log('\n3. 查看products表结构:');
    const productsColumns = await query('DESCRIBE products');
    console.log('   字段数:', productsColumns.length);
    console.log('   字段:', productsColumns.map(col => col.Field).join(', '));
    
    // 测试4: 查看categories表结构
    console.log('\n4. 查看categories表结构:');
    const categoriesColumns = await query('DESCRIBE categories');
    console.log('   字段数:', categoriesColumns.length);
    console.log('   字段:', categoriesColumns.map(col => col.Field).join(', '));
    
    // 测试5: 测试简单的products查询
    console.log('\n5. 测试products查询:');
    const products = await query('SELECT * FROM products LIMIT 5');
    console.log('   结果数:', products.length);
    
    // 测试6: 测试带JOIN的查询
    console.log('\n6. 测试带JOIN的查询:');
    const joinResult = await query('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id LIMIT 5');
    console.log('   结果数:', joinResult.length);
    
    console.log('\n=== 测试完成 ===');
    
  } catch (error) {
    console.error('\n=== 测试失败 ===');
    console.error('错误:', error.message);
    console.error('堆栈:', error.stack);
  }
}

testDatabase();
