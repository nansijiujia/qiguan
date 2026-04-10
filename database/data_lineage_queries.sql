-- ============================================================
-- 数据溯源查询工具集 v2.0
-- Purpose: 追溯数据的创建来源、修改历史和操作轨迹
-- Usage: 
--   按需执行单个查询或整个脚本
--   mysql -u user -p qmzyxcx < data_lineage_queries.sql
--
-- Compatibility: MySQL 5.7+ / TDSQL-C
-- Database: qmzyxcx (需要先执行v2.0升级脚本)
-- Created: 2026-04-10
-- Version: 1.0.0
-- ============================================================

SET NAMES utf8mb4;

SELECT '================================================' AS header;
SELECT '= Data Lineage & Audit Query Toolset v2.0      =' AS title;
SELECT '================================================' AS header;
SELECT CONCAT('Execution Time: ', NOW()) AS timestamp;
SELECT '' AS separator;

-- ============================================================
-- Section 1: 全局数据来源分布统计 (Global Source Distribution)
-- 统计所有Common Table中数据的创建来源分布
-- ============================================================

SELECT '--- Section 1: Global Data Source Distribution ---' AS section;

-- 1.1 各表数据来源总览（仪表板式展示）
SELECT 
    'Data Source Dashboard - All Common Tables' AS dashboard_title;

SELECT 
    'users' AS table_name,
    COUNT(*) AS total_records,
    SUM(CASE WHEN created_by = 'backend' THEN 1 ELSE 0 END) AS backend_count,
    SUM(CASE WHEN created_by = 'miniprogram' THEN 1 ELSE 0 END) AS miniprogram_count,
    SUM(CASE WHEN created_by = 'system' THEN 1 ELSE 0 END) AS system_count,
    SUM(CASE WHEN created_by = 'migration' THEN 1 ELSE 0 END) AS migration_count,
    ROUND(SUM(CASE WHEN created_by IS NULL THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2) AS missing_source_pct
FROM users

UNION ALL

SELECT 
    'products',
    COUNT(*),
    SUM(CASE WHEN created_by = 'backend' THEN 1 ELSE 0 END),
    SUM(CASE WHEN created_by = 'miniprogram' THEN 1 ELSE 0 END),
    SUM(CASE WHEN created_by = 'system' THEN 1 ELSE 0 END),
    SUM(CASE WHEN created_by = 'migration' THEN 1 ELSE 0 END),
    ROUND(SUM(CASE WHEN created_by IS NULL THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2)
FROM products

UNION ALL

SELECT 
    'categories',
    COUNT(*),
    SUM(CASE WHEN created_by = 'backend' THEN 1 ELSE 0 END),
    SUM(CASE WHEN created_by = 'miniprogram' THEN 1 ELSE 0 END),
    SUM(CASE WHEN created_by = 'system' THEN 1 ELSE 0 END),
    SUM(CASE WHEN created_by = 'migration' THEN 1 ELSE 0 END),
    ROUND(SUM(CASE WHEN created_by IS NULL THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2)
FROM categories

UNION ALL

SELECT 
    'orders',
    COUNT(*),
    SUM(CASE WHEN created_by = 'backend' THEN 1 ELSE 0 END),
    SUM(CASE WHEN created_by = 'miniprogram' THEN 1 ELSE 0 END),
    SUM(CASE WHEN created_by = 'system' THEN 1 ELSE 0 END),
    SUM(CASE WHEN created_by = 'migration' THEN 1 ELSE 0 END),
    ROUND(SUM(CASE WHEN created_by IS NULL THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2)
FROM orders

UNION ALL

SELECT 
    'cart',
    COUNT(*),
    SUM(CASE WHEN created_by = 'backend' THEN 1 ELSE 0 END),
    SUM(CASE WHEN created_by = 'miniprogram' THEN 1 ELSE 0 END),
    SUM(CASE WHEN created_by = 'system' THEN 1 ELSE 0 END),
    SUM(CASE WHEN created_by = 'migration' THEN 1 ELSE 0 END),
    ROUND(SUM(CASE WHEN created_by IS NULL THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2)
FROM cart

UNION ALL

SELECT 
    'favorites',
    COUNT(*),
    SUM(CASE WHEN created_by = 'backend' THEN 1 ELSE 0 END),
    SUM(CASE WHEN created_by = 'miniprogram' THEN 1 ELSE 0 END),
    SUM(CASE WHEN created_by = 'system' THEN 1 ELSE 0 END),
    SUM(CASE WHEN created_by = 'migration' THEN 1 ELSE 0 END),
    ROUND(SUM(CASE WHEN created_by IS NULL THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 2))
FROM favorites

UNION ALL

SELECT 
    'coupons',
    COUNT(*),
    SUM(CASE WHEN created_by = 'backend' THEN 1 ELSE 0 END),
    SUM(CASE WHEN created_by = 'miniprogram' THEN 1 ELSE 0 END),
    SUM(CASE WHEN created_by = 'system' THEN 1 ELSE 0 END),
    SUM(CASE WHEN created_by = 'migration' THEN 1 ELSE 0 END),
    ROUND(SUM(CASE WHEN created_by IS NULL THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2)
FROM coupons

ORDER BY table_name;

-- 1.2 按时间维度的数据来源趋势（最近30天）
SELECT 
    'Source Distribution Trend (Last 30 Days)' AS trend_analysis,
    DATE(created_at) AS date,
    SUM(CASE WHEN created_by = 'backend' THEN 1 ELSE 0 END) AS backend_new,
    SUM(CASE WHEN created_by = 'miniprogram' THEN 1 ELSE 0 END) AS miniprogram_new,
    SUM(CASE WHEN created_by = 'system' THEN 1 ELSE 0 END) AS system_new,
    SUM(CASE WHEN created_by = 'migration' THEN 1 ELSE 0 END) AS migration_new
FROM products
WHERE created >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY DATE(created_at)
ORDER BY date DESC;

SELECT '' AS separator;

-- ============================================================
-- Section 2: 商品数据溯源 (Product Data Lineage)
-- 针对商品表的详细溯源分析
-- ============================================================

SELECT '--- Section 2: Product Data Lineage Analysis ---' AS section;

-- 2.1 商品数据来源分布详情
SELECT 
    'Product Source Distribution Detail' AS analysis,
    created_by AS source,
    COUNT(*) AS total_products,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM products), 2) AS percentage,
    MIN(created_at) AS earliest_product,
    MAX(created_at) AS latest_product,
    AVG(price) AS avg_price,
    SUM(stock) AS total_stock
FROM products
GROUP BY created_by
ORDER BY total_products DESC;

-- 2.2 最近24小时新增的商品（带来源信息）
SELECT 
    'Recently Added Products (Last 24 Hours) - With Lineage' AS recent_products,
    p.id,
    p.name,
    p.price,
    p.stock,
    c.name AS category_name,
    p.created_by AS data_source,
    p.source_ip AS creator_ip,
    p.created_at AS creation_time,
    CASE p.created_by
        WHEN 'backend' THEN '🖥️ Admin Created'
        WHEN 'miniprogram' THEN '📱 User Created'
        WHEN 'system' THEN '⚙️ Auto Generated'
        WHEN 'migration' THEN '📦 Migrated'
        ELSE '❓ Unknown'
    END AS source_description
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
WHERE p.created >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
ORDER BY p.created_at DESC
LIMIT 20;

-- 2.3 特定商品的完整操作历史（参数化查询模板）
-- 使用方法: 将 :product_id 替换为实际的商品ID
SET @target_product_id = 1; -- ← 修改此处为目标商品ID

SELECT 
    CONCAT('Complete Operation History for Product ID: ', @target_product_id) AS product_history;

-- 从admin_logs获取管理操作记录
SELECT 
    'admin_logs' AS source_table,
    al.action AS operation_type,
    al.details AS change_details,
    al.ip_address AS operator_ip,
    al.user_agent,
    al.request_method AS http_method,
    u.username AS operator_name,
    al.created_at AS operation_time,
    TIMESTAMPDIFF(SECOND, al.created_at, NOW()) AS seconds_ago
FROM admin_logs al
LEFT JOIN users u ON al.admin_id = u.id
WHERE al.target_type = 'product' 
  AND al.target_id = @target_product_id
UNION ALL
-- 从products表自身获取基本信息和更新记录
SELECT 
    'products_snapshot' AS source_table,
    CASE 
        WHEN p.updated_at > p.created_at THEN 'current_state'
        ELSE 'initial_creation'
    END AS operation_type,
    JSON_OBJECT(
        'name', p.name,
        'price', p.price,
        'original_price', p.original_price,
        'stock', p.stock,
        'status', p.status,
        'category_id', p.category_id
    ) AS change_details,
    p.source_ip AS operator_ip,
    NULL AS user_agent,
    NULL AS http_method,
    CASE p.created_by
        WHEN 'backend' THEN 'Admin System'
        WHEN 'miniprogram' THEN 'Mini-program User'
        WHEN 'system' THEN 'System Auto'
        WHEN 'migration' THEN 'Data Migration'
        ELSE 'Unknown'
    END AS operator_name,
    GREATEST(p.created_at, COALESCE(p.updated_at, p.created_at)) AS operation_time,
    TIMESTAMPDIFF(SECOND, GREATEST(p.created_at, COALESCE(p.updated_at, p.created_at)), NOW()) AS seconds_ago
FROM products p
WHERE p.id = @target_product_id
ORDER BY operation_time DESC;

SELECT '' AS separator;

-- ============================================================
-- Section 3: 用户行为溯源 (User Behavior Lineage)
-- 分析用户在小程序端的行为轨迹和数据来源
-- ============================================================

SELECT '--- Section 3: User Behavior Lineage Analysis ---' AS section;

-- 3.1 用户注册来源分布
SELECT 
    'User Registration Source Distribution' AS registration_analysis,
    created_by AS registration_source,
    COUNT(*) AS user_count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM users), 2) AS percentage,
    MIN(created_at) AS earliest_registration,
    MAX(created_at) AS latest_registration
FROM users
GROUP BY created_by
ORDER BY user_count DESC;

-- 3.2 高活跃用户的行为来源分析（Top 10）
SELECT 
    'Top 10 Active Users - Activity Source Breakdown' AS active_users,
    u.id AS user_id,
    u.username,
    u.role,
    
    -- 订单来源统计
    (SELECT COUNT(*) FROM orders WHERE user_id = u.id AND created_by = 'miniprogram') AS mp_orders,
    (SELECT COUNT(*) FROM orders WHERE user_id = u.id AND created_by = 'backend') AS backend_orders,
    
    -- 收藏来源统计
    (SELECT COUNT(*) FROM favorites WHERE user_id = u.id AND created_by = 'miniprogram') AS mp_favorites,
    (SELECT COUNT(*) FROM favorites WHERE user_id = u.id AND created_by = 'backend') AS backend_favorites,
    
    -- 足迹来源统计
    (SELECT COUNT(*) FROM footprints WHERE user_id = u.id AND created_by = 'miniprogram') AS mp_footprints,
    (SELECT COUNT(*) FROM footprints WHERE user_id = u.id AND created_by = 'backend') AS backend_footprints,
    
    -- 总活跃度评分
    ((SELECT COUNT(*) FROM orders WHERE user_id = u.id) +
     (SELECT COUNT(*) FROM favorites WHERE user_id = u.id) +
     (SELECT COUNT(*) FROM footprints WHERE user_id = u.id)) AS activity_score
    
FROM users u
WHERE u.status = 'active'
ORDER BY activity_score DESC
LIMIT 10;

-- 3.3 特定用户的完整数据足迹（参数化查询模板）
SET @target_user_id = 1; -- ← 修改此处为目标用户ID

SELECT 
    CONCAT('Complete Data Footprint for User ID: ', @target_user_id) AS user_footprint;
SELECT 
    u.username,
    u.email,
    u.phone,
    u.role,
    u.status,
    u.created_by AS registration_source,
    u.source_ip AS registration_ip,
    u.created_at AS registration_time,
    u.last_login AS last_login_time
FROM users u
WHERE u.id = @target_user_id;

-- 该用户的所有订单及来源
SELECT 
    'Orders' AS data_type,
    o.id,
    o.order_no,
    o.total_amount,
    o.status,
    o.created_by AS order_source,
    o.source_ip AS order_ip,
    o.created_at AS order_time
FROM orders o
WHERE o.user_id = @target_user_id
ORDER BY o.created_at DESC
LIMIT 20;

-- 该用户的收藏记录及来源
SELECT 
    'Favorites' AS data_type,
    f.id,
    p.name AS product_name,
    f.created_by AS favorite_source,
    f.source_ip AS favorite_ip,
    f.created_at AS favorite_time
FROM favorites f
JOIN products p ON f.product_id = p.id
WHERE f.user_id = @target_user_id
ORDER BY f.created_at DESC
LIMIT 20;

-- 该用户的浏览足迹及来源
SELECT 
    'Footprints' AS data_type,
    fp.id,
    p.name AS product_name,
    fp.created_by AS footprint_source,
    fp.source_ip AS footprint_ip,
    fp.device_info,
    fp.created_at AS view_time
FROM footprints fp
JOIN products p ON fp.product_id = p.id
WHERE fp.user_id = @target_user_id
ORDER BY fp.created_at DESC
LIMIT 30;

SELECT '' AS separator;

-- ============================================================
-- Section 4: 管理员操作审计 (Administrator Action Audit)
-- 审查后台管理员的操作记录和行为模式
-- ============================================================

SELECT '--- Section 4: Administrator Action Audit ---' AS section;

-- 4.1 管理员操作统计概览
SELECT 
    'Administrator Operations Summary' AS audit_summary,
    u.id AS admin_id,
    u.username AS admin_name,
    COUNT(al.id) AS total_operations,
    SUM(CASE WHEN al.action LIKE 'create%' THEN 1 ELSE 0 END) AS create_ops,
    SUM(CASE WHEN al.action LIKE 'update%' THEN 1 ELSE 0 END) AS update_ops,
    SUM(CASE WHEN al.action LIKE 'delete%' THEN 1 ELSE 0 END) AS delete_ops,
    SUM(CASE WHEN al.action IN ('login', 'logout') THEN 1 ELSE 0 END) AS auth_ops,
    MIN(al.created_at) AS first_operation,
    MAX(al.created_at) AS last_operation,
    COUNT(DISTINCT DATE(al.created_at)) AS active_days
FROM users u
JOIN admin_logs al ON u.id = al.admin_id
WHERE u.role IN ('admin', 'manager')
GROUP BY u.id, u.username
ORDER BY total_operations DESC;

-- 4.2 最近24小时的管理员操作日志
SELECT 
    'Recent Administrator Actions (Last 24 Hours)' AS recent_actions,
    al.id AS log_id,
    u.username AS administrator,
    al.action AS operation,
    al.target_type AS target_object,
    al.target_id AS target_id,
    LEFT(al.details, 100) AS details_preview,
    al.ip_address AS admin_ip,
    al.request_path,
    al.response_status AS http_status,
    al.execution_time_ms AS duration_ms,
    al.created_at AS operation_time
FROM admin_logs al
LEFT JOIN users u ON al.admin_id = u.id
WHERE al.created >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
ORDER BY al.created_at DESC
LIMIT 50;

-- 4.3 敏感操作监控（删除、批量修改等高风险操作）
SELECT 
    'High-Risk/Sensitive Operations Monitor' AS risk_monitor,
    al.id,
    u.username AS operator,
    al.action AS sensitive_action,
    al.target_type,
    al.target_id,
    al.details,
    al.ip_address,
    al.user_agent,
    al.created_at
FROM admin_logs al
LEFT JOIN users u ON al.admin_id = u.id
WHERE al.action IN ('delete', 'batch_import', 'batch_delete', 'config_change')
  AND al.created >= DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY al.created_at DESC;

-- 4.4 管理员登录活动分析
SELECT 
    'Administrator Login Activity Analysis' AS login_analysis,
    u.username,
    COUNT(CASE WHEN action = 'login' THEN 1 END) AS login_count,
    COUNT(CASE WHEN action = 'logout' THEN 1 END) AS logout_count,
    COUNT(DISTINCT ip_address) AS unique_ips,
    GROUP_CONCAT(DISTINCT ip_address SEPARATOR ', ') AS ip_list,
    MIN(CASE WHEN action = 'login' THEN created_at END) AS first_login_today,
    MAX(CASE WHEN action = 'login' THEN created_at END) AS last_login
FROM admin_logs al
JOIN users u ON al.admin_id = u.id
WHERE al.action IN ('login', 'logout')
  AND al.created >= DATE_SUB(NOW(), INTERVAL 1 DAY)
GROUP BY u.username
ORDER BY login_count DESC;

SELECT '' AS separator;

-- ============================================================
-- Section 5: 数据完整性验证 (Data Integrity Validation)
-- 检查数据溯源字段的完整性和一致性
-- ============================================================

SELECT '--- Section 5: Data Integrity Validation ---' AS section;

-- 5.1 缺失溯源标识的记录检测
SELECT 
    'Records Missing Source Identification' AS integrity_check,
    'products' AS table_name,
    COUNT(*) AS total_records,
    SUM(CASE WHEN created_by IS NULL THEN 1 ELSE 0 END) AS missing_created_by,
    SUM(CASE WHEN source_ip IS NULL THEN 1 ELSE 0 END) AS missing_source_ip,
    SUM(CASE WHEN created_by IS NULL AND source_ip IS NULL THEN 1 ELSE 0 END) AS missing_both,
    ROUND(SUM(CASE WHEN created_by IS NULL THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2) AS missing_source_pct
FROM products

UNION ALL

SELECT 
    'categories',
    COUNT(*),
    SUM(CASE WHEN created_by IS NULL THEN 1 ELSE 0 END),
    SUM(CASE WHEN source_ip IS NULL THEN 1 ELSE 0 END),
    SUM(CASE WHEN created_by IS NULL AND source_ip IS NULL THEN 1 ELSE 0 END),
    ROUND(SUM(CASE WHEN created_by IS NULL THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2)
FROM categories

UNION ALL

SELECT 
    'orders',
    COUNT(*),
    SUM(CASE WHEN created_by IS NULL THEN 1 ELSE 0 END),
    SUM(CASE WHEN source_ip IS NULL THEN 1 ELSE 0 END),
    SUM(CASE WHEN created_by IS NULL AND source_ip IS NULL THEN 1 ELSE 0 END),
    ROUND(SUM(CASE WHEN created_by IS NULL THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2)
FROM orders

UNION ALL

SELECT 
    'users',
    COUNT(*),
    SUM(CASE WHEN created_by IS NULL THEN 1 ELSE 0 END),
    SUM(CASE WHEN source_ip IS NULL THEN 1 ELSE 0 END),
    SUM(CASE WHEN created_by IS NULL AND source_ip IS NULL THEN 1 ELSE 0 END),
    ROUND(SUM(CASE WHEN created_by IS NULL THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2)
FROM users

ORDER BY table_name;

-- 5.2 时间戳合理性检查
SELECT 
    'Timestamp Anomaly Detection' AS anomaly_check,
    'products' AS table_name,
    COUNT(*) AS total,
    SUM(CASE WHEN created_at > NOW() THEN 1 ELSE 0 END) AS future_timestamps,
    SUM(CASE WHEN updated_at < created_at THEN 1 ELSE 0 END) AS update_before_create,
    SUM(CASE WHEN DATEDIFF(NOW(), updated_at) > 365 AND status = 'active' THEN 1 ELSE 0 END) AS stale_active_records
FROM products

UNION ALL

SELECT 
    'orders',
    COUNT(*),
    SUM(CASE WHEN created_at > NOW() THEN 1 ELSE 0 END),
    SUM(CASE WHEN updated_at < created_at THEN 1 ELSE 0 END),
    SUM(CASE WHEN DATEDIFF(NOW(), updated_at) > 180 AND status = 'pending' THEN 1 ELSE 0 END)
FROM orders

UNION ALL

SELECT 
    'users',
    COUNT(*),
    SUM(CASE WHEN created_at > NOW() THEN 1 ELSE 0 END),
    SUM(CASE WHEN updated_at < created_at THEN 1 ELSE 0 END),
    SUM(CASE WHEN DATEDIFF(NOW(), last_login) > 365 AND status = 'active' THEN 1 ELSE 0 END)
FROM users

ORDER BY table_name;

-- 5.3 IP地址分布分析（用于异常检测）
SELECT 
    'IP Address Distribution Analysis' AS ip_analysis,
    'products' AS table_name,
    source_ip,
    COUNT(*) AS record_count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM products WHERE source_ip IS NOT NULL), 2) AS percentage,
    COUNT(DISTINCT created_by) AS source_types,
    MIN(created_at) AS first_seen,
    MAX(created_at) AS last_seen
FROM products
WHERE source_ip IS NOT NULL
GROUP BY source_ip
HAVING COUNT(*) > 5  -- 仅显示出现超过5次的IP
ORDER BY record_count DESC
LIMIT 20;

-- 5.4 设备信息统计（如果存在device_info字段）
SELECT 
    'Device Information Summary (from device_info JSON)' AS device_stats,
    COUNT(*) AS records_with_device_info,
    AVG(JSON_LENGTH(device_info)) AS avg_json_fields
FROM products
WHERE device_info IS NOT NULL AND JSON_VALID(device_info)

UNION ALL

SELECT 
    COUNT(*),
    AVG(JSON_LENGTH(device_info))
FROM users
WHERE device_info IS NOT NULL AND JSON_VALID(device_info);

SELECT '' AS separator;

-- ============================================================
-- Section 6: 业务场景专项查询 (Business Scenario Queries)
-- 针对特定业务场景的溯源查询
-- ============================================================

SELECT '--- Section 6: Business Scenario Specific Queries ---' AS section;

-- 6.1 订单全链路溯源（从下单到完成的所有操作）
SET @target_order_id = 1; -- ← 修改此处为目标订单ID

SELECT 
    CONCAT('Order Full Lifecycle Trace - Order ID: ', @target_order_id) AS order_lifecycle;

-- 订单基本信息及创建来源
SELECT 
    'Order Header' AS info_type,
    o.*,
    u.username AS customer_name,
    CASE o.created_by
        WHEN 'miniprogram' THEN '📱 Placed via Mini-program'
        WHEN 'backend' THEN '🖥️ Placed by Admin'
        ELSE '❓ Unknown source'
    END AS placement_channel
FROM orders o
LEFT JOIN users u ON o.user_id = u.id
WHERE o.id = @target_order_id;

-- 订单状态变更历史（从admin_logs）
SELECT 
    'Status Change History' AS history_type,
    al.action,
    al.details,
    u.username AS changed_by,
    al.ip_address,
    al.created_at
FROM admin_logs al
LEFT JOIN users u ON al.admin_id = u.id
WHERE al.target_type = 'order' 
  AND al.target_id = @target_order_id
ORDER BY al.created_at ASC;

-- 订单项快照（下单时的商品信息）
SELECT 
    'Order Items Snapshot' AS items_type,
    oi.product_id,
    oi.product_name,
    oi.product_image,
    oi.quantity,
    oi.price,
    oi.quantity * oi.price AS subtotal
FROM order_items oi
WHERE oi.order_id = @target_order_id;

-- 6.2 商品从创建到当前状态的变更时间线
SET @timeline_product_id = 1; -- ← 修改此处为商品ID

SELECT 
    CONCAT('Product Change Timeline - Product ID: ', @timeline_product_id) AS timeline;

SELECT 
    ROW_NUMBER() OVER (ORDER BY event_time) AS sequence_num,
    event_time,
    event_type,
    event_source,
    description,
    details
FROM (
    -- 初始创建事件
    SELECT 
        created_at AS event_time,
        'CREATED' AS event_type,
        created_by AS event_source,
        CONCAT('Product created: ', name) AS description,
        JSON_OBJECT('name', name, 'price', price, 'stock', stock) AS details
    FROM products
    WHERE id = @timeline_product_id
    
    UNION ALL
    
    -- 管理操作事件
    SELECT 
        al.created_at AS event_time,
        UPPER(al.action) AS event_type,
        u.username AS event_source,
        CONCAT(al.action, ' on ', al.target_type) AS description,
        al.details
    FROM admin_logs al
    LEFT JOIN users u ON al.admin_id = u.id
    WHERE al.target_type = 'product' 
      AND al.target_id = @timeline_product_id
) AS timeline_events
ORDER BY event_time ASC;

-- 6.3 分类变更影响范围分析
SET @changed_category_id = 1; -- ← 修改此处为分类ID

SELECT 
    CONCAT('Category Change Impact Analysis - Category ID: ', @changed_category_id) AS impact_analysis;

-- 受影响的商品列表
SELECT 
    'Affected Products' AS impact_type,
    p.id,
    p.name,
    p.price,
    p.status,
    p.created_by,
    p.updated_at
FROM products p
WHERE p.category_id = @changed_category_id
ORDER BY p.created_at DESC;

-- 该分类的子分类及其商品数量
SELECT 
    'Sub-categories Impact' AS impact_type,
    c.id AS sub_category_id,
    c.name AS sub_category_name,
    COUNT(p.id) AS product_count_in_subcategory
FROM categories c
LEFT JOIN products p ON c.id = p.category_id
WHERE c.parent_id = @changed_category_id
GROUP BY c.id, c.name
ORDER BY product_count_in_subcategory DESC;

-- 6.4 批量导入/迁移数据识别
SELECT 
    'Migration/Batch Import Data Identification' AS batch_analysis,
    'products' AS table_name,
    COUNT(*) AS migrated_records,
    MIN(created_at) AS migration_start_date,
    MAX(created_at) AS migration_end_date,
    COUNT(DISTINCT DATE(created_at)) AS migration_span_days,
    COUNT(DISTINCT source_ip) AS unique_source_ips
FROM products
WHERE created_by = 'migration'

UNION ALL

SELECT 
    'users',
    COUNT(*),
    MIN(created_at),
    MAX(created_at),
    COUNT(DISTINCT DATE(created_at)),
    COUNT(DISTINCT source_ip)
FROM users
WHERE created_by = 'migration'

UNION ALL

SELECT 
    'orders',
    COUNT(*),
    MIN(created_at),
    MAX(created_at),
    COUNT(DISTINCT DATE(created_at)),
    COUNT(DISTINCT source_ip)
FROM orders
WHERE created_by = 'migration'

ORDER BY table_name;

SELECT '' AS separator;

-- ============================================================
-- Section 7: 自动化报告与导出 (Automated Reports & Export)
-- 生成可导出的溯源分析报告
-- ============================================================

SELECT '--- Section 7: Automated Report Generation ---' AS section;

-- 7.1 数据健康度综合评分
SELECT 
    '═══════════════════════════════════════════════════' AS separator,
    '     DATA LINEAGE HEALTH REPORT                    ' AS report_title,
    '═══════════════════════════════════════════════════' AS separator;

SELECT 
    CONCAT('Report Generated: ', NOW()) AS generated_at,
    DATABASE() AS database_name,
    VERSION() AS mysql_version;

-- 7.2 关键健康指标计算
WITH source_completeness AS (
    SELECT 
        'products' AS tbl,
        ROUND((1.0 - SUM(CASE WHEN created_by IS NULL THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)) * 100, 2) AS completeness_pct
    FROM products
    UNION ALL
    SELECT 
        'categories',
        ROUND((1.0 - SUM(CASE WHEN created_by IS NULL THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)) * 100, 2)
    FROM categories
    UNION ALL
    SELECT 
        'orders',
        ROUND((1.0 - SUM(CASE WHEN created_by IS NULL THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)) * 100, 2)
    FROM orders
    UNION ALL
    SELECT 
        'users',
        ROUND((1.0 - SUM(CASE WHEN created_by IS NULL THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)) * 100, 2)
    FROM users
)
SELECT 
    'Source Field Completeness Score (Higher is Better)' AS metric_name,
    tbl AS table_name,
    completeness_pct AS score,
    CASE 
        WHEN completeness_pct >= 95 THEN '✅ EXCELLENT'
        WHEN completeness_pct >= 80 THEN '🟢 GOOD'
        WHEN completeness_pct >= 60 THEN '🟡 ACCEPTABLE'
        ELSE '🔴 NEEDS ATTENTION'
    END AS grade
FROM source_completeness
ORDER BY completeness_pct DESC;

-- 7.3 最终总结和建议
SELECT 
    '═══════════════════════════════════════════════════' AS separator,
    '     SUMMARY & RECOMMENDATIONS                     ' AS summary_title,
    '═══════════════════════════════════════════════════' AS separator;

SELECT 
    'Total Records with Source Tracking:' AS stat_1,
    (SELECT COUNT(*) FROM products WHERE created_by IS NOT NULL) + 
    (SELECT COUNT(*) FROM categories WHERE created_by IS NOT NULL) + 
    (SELECT COUNT(*) FROM orders WHERE created_by IS NOT NULL) + 
    (SELECT COUNT(*) FROM users WHERE created_by IS NOT NULL) AS tracked_records;

SELECT 
    'Total Administrator Actions Logged:' AS stat_2,
    (SELECT COUNT(*) FROM admin_logs) AS total_log_entries;

SELECT 
    'Date Range of Logged Data:' AS stat_3,
    CONCAT(
        COALESCE((SELECT MIN(created_at) FROM admin_logs), 'N/A'), 
        ' to ', 
        COALESCE((SELECT MAX(created_at) FROM admin_logs), 'N/A')
    ) AS log_date_range;

SELECT 
    'Recommended Actions:' AS actions_header,
    '1. Review records with missing created_by values' AS rec_1,
    '2. Update application code to populate source fields' AS rec_2,
    '3. Schedule regular lineage audits (weekly recommended)' AS rec_3,
    '4. Set up alerts for high-risk operations' AS rec_4,
    '5. Archive old log entries (>90 days) to cold storage' AS rec_5;

SELECT 
    '═══════════════════════════════════════════════════' AS separator,
    '     END OF DATA LINEAGE REPORT                   ' AS end_marker,
    '═══════════════════════════════════════════════════' AS separator;

SELECT '' AS empty_line;
SELECT 'Query execution completed successfully.' AS final_message;
SELECT 'To analyze specific records, modify the @target_* variables at the top of each query section.' AS usage_tip;
SELECT '' AS empty_line;
SELECT 'Related Files:' AS related;
SELECT '- Schema Design: database/table_structure_design_v2.md' AS design_doc;
SELECT '- Upgrade Script: database/schema_v2_upgrade_system_identification.sql' AS upgrade_script;
SELECT '- Consistency Check: database/category_consistency_check.sql' AS check_script;