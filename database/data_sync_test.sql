-- ============================================================
-- 数据库双向同步测试脚本
-- Usage: mysql -u QMZYXCX -p'LJN040821.' qmzyxcx < data_sync_test.sql
-- Purpose: 验证后台系统与小程序共用同一TDSQL-C数据库实例
-- Created: 2026-04-09
-- ============================================================

SET NAMES utf8mb4;

SELECT '=== 数据库双向同步测试开始 ===' AS info;
SELECT NOW() AS test_start_time;

-- Step 1: 后台→小程序 测试
-- 插入一个标记商品
INSERT INTO products (
  name, price, original_price, stock, category_id,
  status, description, created_at
) VALUES (
  '[SYNC-TEST] 部署验证商品',
  99.99,
  199.99,
  100,
  1,
  'active',
  '此商品用于验证后台→小程序数据同步，测试完成后将删除',
  NOW()
);

SET @test_product_id = LAST_INSERT_ID();

SELECT CONCAT('✅ 测试商品已插入, ID=', @test_product_id) AS step1_result;

-- Step 2: 验证商品可通过API访问
-- (此步需在小程序端调用 GET /api/v1/products 并搜索该商品)
SELECT CONCAT('⏳ 请在小程序中搜索 "[SYNC-TEST] 部署验证商品"') AS step2_instruction;

-- Step 3: 小程序→后台 测试 (模拟订单)
INSERT INTO orders (
  order_no, user_id, total_amount, status,
  remark, created_at
) VALUES (
  CONCAT('ORD-SYNC-', DATE_FORMAT(NOW(), '%Y%m%d%H%i%s')),
  1,  -- 使用admin用户ID或任意有效用户ID
  99.99,
  'pending',
  '[SYNC-TEST] 用于验证小程序→后台数据同步',
  NOW()
);

SET @test_order_id = LAST_INSERT_ID();

SELECT CONCAT('✅ 测试订单已创建, order_no=ORD-SYNC-*') AS step3_result;

-- Step 4: 清理测试数据
DELETE FROM orders WHERE id = @test_order_id;
DELETE FROM products WHERE id = @test_product_id OR name LIKE '[SYNC-TEST]%';

SELECT '=== 测试数据清理完成 ===' AS cleanup_status;

-- 最终验证
SELECT
  CASE
    WHEN (SELECT COUNT(*) FROM products WHERE name LIKE '[SYNC-TEST]%') = 0
     AND (SELECT COUNT(*) FROM orders WHERE remark LIKE '[SYNC-TEST]%') = 0
    THEN '✅ 双向同步测试准备就绪! 可在实际环境中执行'
    ELSE '❌ 清理未完成，请手动检查'
  END AS final_status;

SELECT NOW() AS test_end_time;
SELECT '=== 数据库双向同步测试结束 ===' AS info;