-- ============================================================
-- 绮管电商后台 - 测试数据清理脚本
-- Version: 1.0.0
-- Warning: 此操作不可逆! 执行前请确认!
-- Usage: mysql -u user -p database < cleanup_test_data.sql
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 记录清理开始时间
SELECT CONCAT('🧹 测试数据清理开始于: ', NOW()) AS info;

-- 1. 删除测试商品 (名称包含特殊标识符)
DELETE FROM order_items WHERE product_id IN (
  SELECT id FROM products WHERE name LIKE '%[TEST]%'
    OR name LIKE '%[SYNC-TEST]%'
    OR name LIKE '%测试商品%'
);

DELETE FROM cart WHERE product_id IN (
  SELECT id FROM products WHERE name LIKE '%[TEST]%'
    OR name LIKE '%[SYNC-TEST]%'
);

DELETE FROM favorites WHERE product_id IN (
  SELECT id FROM products WHERE name LIKE '%[TEST]%'
    OR name LIKE '%[SYNC-TEST]%'
);

DELETE FROM products WHERE name LIKE '%[TEST]%'
  OR name LIKE '%[SYNC-TEST]%'
  OR name LIKE '%测试商品%';

SELECT CONCAT('✅ 已删除测试商品: ', ROW_COUNT(), ' 条') AS result;

-- 2. 删除测试订单
DELETE FROM order_items WHERE order_id IN (
  SELECT id FROM orders WHERE order_no LIKE 'ORD-TEST%'
    OR order_no LIKE 'TEST-%'
    OR remark LIKE '%测试%'
);

DELETE FROM orders WHERE order_no LIKE 'ORD-TEST%'
  OR order_no LIKE 'TEST-%'
  OR remark LIKE '%测试%';

SELECT CONCAT('✅ 已删除测试订单: ', ROW_COUNT(), ' 条') AS result;

-- 3. 删除测试优惠券及其领取记录
DELETE FROM user_coupons WHERE coupon_id IN (
  SELECT id FROM coupons WHERE name LIKE '%[TEST]%'
    OR name LIKE '%[SYNC-TEST]%'
    OR code LIKE 'SYNCTEST%'
    OR code LIKE 'TEST%'
);

DELETE FROM coupons WHERE name LIKE '%[TEST]%'
  OR name LIKE '%[SYNC-TEST]%'
  OR code LIKE 'SYNCTEST%'
  OR code LIKE 'TEST%';

SELECT CONCAT('✅ 已删除测试优惠券: ', ROW_COUNT(), ' 条') AS result;

-- 4. 删除测试Banner
DELETE FROM banners WHERE title LIKE '%TEST%'
  OR title LIKE '%测试%'
  OR image_url LIKE '%test%';

SELECT CONCAT('✅ 已删除测试Banner: ', ROW_COUNT(), ' 条') AS result;

-- 5. 清空测试用户的购物车 (可选, 注释掉默认不执行)
-- DELETE FROM cart WHERE user_id IN (
--   SELECT id FROM users WHERE username LIKE 'test%' OR email LIKE '%@test.com'
-- );
-- SELECT CONCAT('✅ 已清空测试用户购物车') AS result;

SET FOREIGN_KEY_CHECKS = 1;

-- 验证清理结果
SELECT
  '========================================' AS separator,
  '📊 测试数据清理报告' AS title,
  '========================================' AS separator,
  CONCAT('⏰ 清理完成时间: ', NOW()) AS completed_at,

  (SELECT COUNT(*) FROM products WHERE name LIKE '%[TEST]%') AS remaining_test_products,
  (SELECT COUNT(*) FROM orders WHERE order_no LIKE 'ORD-TEST%') AS remaining_test_orders,
  (SELECT COUNT(*) FROM coupons WHERE name LIKE '%[TEST]%') AS remaining_test_coupons,
  (SELECT COUNT(*) FROM banners WHERE title LIKE '%TEST%') AS remaining_test_banners,

  CASE
    WHEN (SELECT COUNT(*) FROM products WHERE name LIKE '%[TEST]%') = 0
     AND (SELECT COUNT(*) FROM orders WHERE order_no LIKE 'ORD-TEST%') = 0
     AND (SELECT COUNT(*) FROM coupons WHERE name LIKE '%[TEST]%') = 0
     AND (SELECT COUNT(*) FROM banners WHERE title LIKE '%TEST%') = 0
    THEN '✅ 系统已处于干净的生产状态!'
    ELSE '⚠️ 仍有测试数据残留，请检查!'
  END AS status;
