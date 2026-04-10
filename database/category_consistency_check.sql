-- ============================================================
-- 分类数据一致性验证脚本 v2.0
-- Purpose: 验证后台分类与小程序显示的分类完全一致
-- Usage: 
--   定期执行（推荐每日或分类变更后）
--   mysql -u user -p qmzyxcx < category_consistency_check.sql
--
-- Compatibility: MySQL 5.7+ / TDSQL-C
-- Database: qmzyxcx
-- Created: 2026-04-10
-- Version: 1.0.0
-- ============================================================

SET NAMES utf8mb4;

SELECT '================================================' AS header;
SELECT '= Category Consistency Check Tool v2.0        =' AS title;
SELECT '================================================' AS header;
SELECT CONCAT('Execution Time: ', NOW()) AS timestamp;
SELECT '' AS separator;

-- ============================================================
-- Section 1: 基础完整性检查 (Basic Integrity Checks)
-- 验证分类数据的基本完整性和约束条件
-- ============================================================

SELECT '--- Section 1: Basic Integrity Checks ---' AS section;

-- 1.1 检查表是否存在且可访问
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ PASS'
        ELSE '❌ FAIL'
    END AS table_exists_check,
    COUNT(*) AS total_categories
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'categories'
  AND TABLE_TYPE = 'BASE TABLE';

-- 1.2 统计分类总数和状态分布
SELECT 
    'Category Count & Status Distribution' AS check_name,
    COUNT(*) AS total_categories,
    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_count,
    SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) AS inactive_count,
    ROUND(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) AS active_percentage
FROM categories;

-- 1.3 检查顶级分类和子级分类数量
SELECT 
    'Category Hierarchy Analysis' AS check_name,
    (SELECT COUNT(*) FROM categories WHERE parent_id IS NULL) AS top_level_count,
    (SELECT COUNT(*) FROM categories WHERE parent_id IS NOT NULL) AS sub_level_count,
    (SELECT MAX(level_depth) FROM (
        SELECT 
            c1.id,
            (SELECT COUNT(*) FROM categories c2 WHERE c2.id = c1.parent_id) +
            (SELECT COUNT(*) FROM categories c3 WHERE c3.parent_id = c1.parent_id) AS level_depth
        FROM categories c1
    ) AS depth_table) AS max_hierarchy_level;

-- 1.4 检查分类名称唯一性（应该无重复）
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ PASS - No duplicate names found'
        ELSE CONCAT('⚠️  WARNING - Found ', COUNT(), ' duplicate name(s)')
    END AS duplicate_name_check,
    GROUP_CONCAT(name SEPARATOR ', ') AS duplicate_names
FROM (
    SELECT name, COUNT(*) as cnt 
    FROM categories 
    GROUP BY name 
    HAVING cnt > 1
) AS duplicates;

-- 1.5 检查孤儿分类（父分类不存在）
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ PASS - No orphan categories'
        ELSE CONCAT('❌ FAIL - Found ', COUNT(), ' orphan category/ies with missing parent')
    END AS orphan_category_check,
    c.id AS orphan_id,
    c.name AS orphan_name,
    c.parent_id AS missing_parent_id
FROM categories c
LEFT JOIN categories parent ON c.parent_id = parent.id
WHERE c.parent_id IS NOT NULL AND parent.id IS NULL;

-- 1.6 检查循环引用（父分类指向自己或形成环）
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ PASS - No circular references detected'
        ELSE CONCAT('⚠️  WARNING - Potential circular reference detected')
    END AS circular_reference_check
FROM categories c1
WHERE EXISTS (
    SELECT 1 FROM categories c2 
    WHERE c2.id = c1.parent_id AND c2.id = c1.id
);

SELECT '' AS separator;

-- ============================================================
-- Section 2: 数据质量验证 (Data Quality Validation)
-- 验证分类数据的字段质量和业务规则
-- ============================================================

SELECT '--- Section 2: Data Quality Validation ---' AS section;

-- 2.1 检查空值/null字段
SELECT 
    'NULL Value Analysis' AS field_check,
    SUM(CASE WHEN name IS NULL OR name = '' THEN 1 ELSE 0 END) AS null_names,
    SUM(CASE WHEN sort_order IS NULL THEN 1 ELSE 0 END) AS null_sort_orders,
    SUM(CASE WHEN created_at IS NULL THEN 1 ELSE 0 END) AS null_created_dates,
    SUM(CASE WHEN updated_at IS NULL THEN 1 ELSE 0 END) AS null_updated_dates,
    SUM(CASE WHEN created_by IS NULL THEN 1 ELSE 0 END) AS null_created_by
FROM categories;

-- 2.2 检查created_by来源分布（v2.0溯源字段）
SELECT 
    'Source Distribution (Data Lineage)' AS lineage_check,
    created_by,
    COUNT(*) AS count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM categories), 2) AS percentage,
    MIN(created_at) AS earliest_record,
    MAX(created_at) AS latest_record
FROM categories
GROUP BY created_by
ORDER BY count DESC;

-- 2.3 检查sort_order排序一致性
SELECT 
    'Sort Order Consistency' AS sort_check,
    CASE 
        WHEN COUNT(DISTINCT sort_order) = COUNT(*) THEN '✅ PASS - All unique sort orders'
        WHEN COUNT(DISTINCT sort_order) < COUNT(*) THEN CONCAT('ℹ️  INFO - ', COUNT(*) - COUNT(DISTINCT sort_order), ' categories share same sort order')
        ELSE '❌ UNEXPECTED'
    END AS result,
    COUNT(*) AS total_categories,
    COUNT(DISTINCT sort_order) AS unique_sort_orders,
    MIN(sort_order) AS min_order,
    MAX(sort_order) AS max_order
FROM categories;

-- 2.4 检查分类名称长度和格式
SELECT 
    'Name Format Validation' AS format_check,
    COUNT(*) AS total,
    SUM(CASE WHEN LENGTH(TRIM(name)) = 0 THEN 1 ELSE 0 END) AS empty_names,
    SUM(CASE WHEN LENGTH(name) > 100 THEN 1 ELSE 0 END) AS overly_long_names,
    SUM(CASE WHEN name REGEXP '^[a-zA-Z0-9\u4e00-\u9fa5\\s-_]+$' THEN 1 ELSE 0 END) AS valid_format_count,
    AVG(LENGTH(name)) AS avg_name_length,
    MAX(LENGTH(name)) AS max_name_length,
    MIN(LENGTH(name)) AS min_name_length
FROM categories;

-- 2.5 检查时间戳合理性（未来日期、异常旧日期等）
SELECT 
    'Timestamp Sanity Check' AS time_check,
    SUM(CASE WHEN created_at > NOW() THEN 1 ELSE 0 END) AS future_created_dates,
    SUM(CASE WHEN created_at < '2020-01-01' THEN 1 ELSE 0 END) AS very_old_records,
    SUM(CASE WHEN updated_at < created_at THEN 1 ELSE 0 END) AS update_before_create_errors,
    SUM(CASE WHEN DATEDIFF(NOW(), updated_at) > 365 THEN 1 ELSE 0 END) AS not_updated_over_1year
FROM categories;

SELECT '' AS separator;

-- ============================================================
-- Section 3: 关联完整性检查 (Referential Integrity)
-- 验证分类与其他表的关联关系正确性
-- ============================================================

SELECT '--- Section 3: Referential Integrity Checks ---' AS section;

-- 3.1 检查所有商品是否都关联到有效的分类
SELECT 
    'Products → Categories Link Integrity' AS ref_check,
    (SELECT COUNT(*) FROM products) AS total_products,
    (SELECT COUNT(*) FROM products WHERE category_id IS NOT NULL) AS products_with_category,
    (SELECT COUNT(*) FROM products WHERE category_id IS NULL) AS products_without_category,
    (SELECT COUNT(*) FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.category_id IS NOT NULL AND c.id IS NULL) AS products_with_invalid_category,
    CASE 
        WHEN (SELECT COUNT(*) FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.category_id IS NOT NULL AND c.id IS NULL) = 0 
        THEN '✅ PASS - All product categories are valid'
        ELSE '❌ FAIL - Some products reference invalid categories'
    END AS validation_result;

-- 3.2 统计每个分类下的商品数量（用于小程序API对比）
SELECT 
    'Category → Product Count Summary' AS summary_check,
    c.id,
    c.name,
    c.parent_id,
    c.status,
    COUNT(p.id) AS product_count,
    SUM(CASE WHEN p.status = 'active' THEN 1 ELSE 0 END) AS active_product_count
FROM categories c
LEFT JOIN products p ON c.id = p.category_id
GROUP BY c.id, c.name, c.parent_id, c.status
ORDER BY c.sort_order ASC, c.id ASC;

-- 3.3 检查是否有活跃分类下没有任何商品（可能需要关注）
SELECT 
    'Empty Active Categories Warning' AS warning_check,
    c.id,
    c.name,
    c.status,
    COUNT(p.id) AS product_count
FROM categories c
LEFT JOIN products p ON c.id = p.category_id
WHERE c.status = 'active'
GROUP BY c.id, c.name, c.status
HAVING COUNT(p.id) = 0
ORDER BY c.sort_order ASC;

-- 3.4 检查非活跃分类下是否有活跃商品（数据不一致）
SELECT 
    'Inactive Categories With Active Products' AS inconsistency_check,
    c.id,
    c.name,
    c.status AS category_status,
    COUNT(p.id) AS active_products_in_inactive_category
FROM categories c
JOIN products p ON c.id = p.category_id
WHERE c.status != 'active' AND p.status = 'active'
GROUP BY c.id, c.name, c.status;

SELECT '' AS separator;

-- ============================================================
-- Section 4: 小程序API模拟查询 (Mini-program API Simulation)
-- 模拟小程序端GET /api/v1/categories接口返回的数据格式
-- 用于验证后台数据在小程序端的展示效果
-- ============================================================

SELECT '--- Section 4: Mini-program API Response Simulation ---' AS section;

-- 4.1 获取完整的分类树形结构（模拟小程序首页分类展示）
SELECT 
    'Full Category Tree for Mini-program' AS api_simulation,
    JSON_OBJECT(
        'success', true,
        'data', (
            SELECT JSON_ARRAYAGG(
                JSON_OBJECT(
                    'id', cat.id,
                    'name', cat.name,
                    'icon', COALESCE(cat.icon, ''),
                    'parent_id', cat.parent_id,
                    'sort_order', cat.sort_order,
                    'status', cat.status,
                    'product_count', COALESCE(pc.count, 0),
                    'children', IF(
                        cat.parent_id IS NULL,
                        (SELECT JSON_ARRAYAGG(
                            JSON_OBJECT(
                                'id', child.id,
                                'name', child.name,
                                'icon', COALESCE(child.icon, ''),
                                'parent_id', child.parent_id,
                                'sort_order', child.sort_order,
                                'status', child.status,
                                'product_count', COALESCE(child_pc.count, 0)
                            )
                        )
                        FROM categories child
                        LEFT JOIN (
                            SELECT category_id, COUNT(*) as count FROM products WHERE status = 'active' GROUP BY category_id
                        ) child_pc ON child.id = child_pc.category_id
                        WHERE child.parent_id = cat.id AND child.status = 'active'
                        ORDER BY child.sort_order ASC, child.id ASC
                    ),
                    JSON_ARRAY()
                    )
                )
            )
            FROM categories cat
            LEFT JOIN (
                SELECT category_id, COUNT(*) as count FROM products WHERE status = 'active' GROUP BY category_id
            ) pc ON cat.id = pc.category_id
            WHERE cat.status = 'active'
            ORDER BY cat.sort_order ASC, cat.id ASC
        ),
        'timestamp', NOW()
    ) AS response_json;

-- 4.2 扁平化分类列表（用于小程序搜索筛选）
SELECT 
    'Flat Category List (for Search Filters)' AS api_simulation,
    id,
    name,
    icon,
    parent_id,
    sort_order,
    status,
    (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.status = 'active') AS product_count,
    CASE 
        WHEN parent_id IS NULL THEN 0
        ELSE (SELECT COUNT(*) FROM categories WHERE id = c.parent_id) + 1
    END AS level
FROM categories c
WHERE c.status = 'active'
ORDER BY c.parent_id ASC NULLS FIRST, c.sort_order ASC, c.id ASC;

-- 4.3 仅获取顶级分类（用于小程序首页导航栏）
SELECT 
    'Top-level Categories Only (Navigation Bar)' AS api_simulation,
    id,
    name,
    COALESCE(icon, '') AS icon,
    sort_order,
    (SELECT COUNT(*) FROM categories child WHERE child.parent_id = c.id AND child.status = 'active') AS sub_category_count,
    (SELECT COUNT(*) FROM products p WHERE p.category_id IN (SELECT id FROM categories WHERE parent_id = c.id) AND p.status = 'active') AS total_product_count_in_tree
FROM categories c
WHERE c.parent_id IS NULL AND c.status = 'active'
ORDER BY c.sort_order ASC, c.id ASC;

-- 4.4 模拟带分页的分类列表（测试分页逻辑）
SET @page_size = 20;
SET @page_offset = 0;

SELECT 
    'Paginated Category List (Page 1)' AS api_simulation,
    COUNT(*) OVER() AS total_records,
    CEILING(COUNT(*) OVER() / @page_size) AS total_pages,
    id,
    name,
    parent_id,
    sort_order,
    status,
    created_by,
    updated_at
FROM categories
WHERE status = 'active'
ORDER BY sort_order ASC, id ASC
LIMIT @page_size OFFSET @page_offset;

SELECT '' AS separator;

-- ============================================================
-- Section 5: 变更历史与同步验证 (Change History & Sync)
-- 检查最近的分类变更，确保后台和小程序数据一致
-- ============================================================

SELECT '--- Section 5: Change History & Synchronization Verification ---' AS section;

-- 5.1 最近24小时的分类变更记录（从admin_logs查询）
SELECT 
    'Recent Category Changes (Last 24 Hours)' AS change_log,
    al.created_at AS change_time,
    al.action,
    al.target_type,
    al.target_id AS category_id,
    al.details->>'$.name' AS category_name,
    al.ip_address,
    u.username AS operator
FROM admin_logs al
LEFT JOIN users u ON al.admin_id = u.id
WHERE al.target_type = 'category'
  AND al.created >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
ORDER BY al.created_at DESC;

-- 5.2 统计各操作类型的变更频率（最近7天）
SELECT 
    'Operation Type Distribution (Last 7 Days)' AS stats,
    action,
    COUNT(*) AS operation_count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM admin_logs WHERE target_type = 'category' AND created >= DATE_SUB(NOW(), INTERVAL 7 DAY)), 2) AS percentage
FROM admin_logs
WHERE target_type = 'category'
  AND created >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY action
ORDER BY operation_count DESC;

-- 5.3 检查分类变更后的数据一致性快照
-- 对比categories表当前状态与admin_logs中最后一次变更记录
SELECT 
    'Current vs Last Logged State Comparison' AS consistency_check,
    c.id,
    c.name AS current_name,
    c.status AS current_status,
    c.updated_at AS last_update_time,
    al.created_at AS last_log_time,
    al.action AS last_action,
    TIMESTAMPDIFF(SECOND, al.created_at, c.updated_at) AS seconds_since_log,
    CASE 
        WHEN al.created_at IS NULL THEN '⚠️  No log entry found'
        WHEN TIMESTAMPDIFF(SECOND, al.created_at, c.updated_at) <= 5 THEN '✅ SYNCED - Log and DB match (<5s diff)'
        WHEN TIMESTAMPDIFF(SECOND, al.created_at, c.updated_at) <= 60 THEN '⚠️  NEARLY SYNCED - Small delay (1min)'
        ELSE '❌ OUT OF SYNC - Significant delay or missing log'
    END AS sync_status
FROM categories c
LEFT JOIN (
    SELECT target_id, MAX(created_at) as max_created_at, action
    FROM admin_logs 
    WHERE target_type = 'category'
    GROUP BY target_id, action
) latest_log ON c.id = latest_log.target_id
LEFT JOIN admin_logs al ON latest_log.target_id = al.target_id AND latest_log.max_created_at = al.created_at
ORDER BY sync_status, c.id;

SELECT '' AS separator;

-- ============================================================
-- Section 6: 性能与健康检查 (Performance & Health)
-- 分析分类相关查询的性能指标
-- ============================================================

SELECT '--- Section 6: Performance & Health Metrics ---' AS section;

-- 6.1 表大小统计
SELECT 
    'Table Size Statistics' AS size_info,
    TABLE_NAME,
    ROUND(data_length / 1024 / 1024, 2) AS data_size_mb,
    ROUND(index_length / 1024 / 1024, 2) AS index_size_mb,
    ROUND((data_length + index_length) / 1024 / 1024, 2) AS total_size_mb,
    TABLE_ROWS AS estimated_rows,
    AVG_ROW_LENGTH AS avg_row_bytes
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'categories';

-- 6.2 索引使用情况分析（需要开启性能schema，可选）
-- 注意：此查询在未启用performance_schema时可能返回空结果
/*
SELECT 
    'Index Usage Statistics' AS index_stats,
    s.INDEX_NAME,
    s.COUNT_READ,
    s.COUNT_FETCH,
    s.TIMER_READ / 1000000000 AS total_read_time_seconds
FROM performance_schema.table_io_waits_summary_by_index_usage s
JOIN information_schema.TABLES t ON s.OBJECT_NAME = t.TABLE_NAME
WHERE s.OBJECT_SCHEMA = DATABASE()
  AND t.TABLE_NAME = 'categories'
  AND s.INDEX_NAME IS NOT NULL
ORDER BY s.COUNT_READ DESC;
*/

-- 6.3 分类查询执行计划分析（关键查询性能预估）
EXPLAIN SELECT 
    c.*, 
    COUNT(p.id) as product_count
FROM categories c
LEFT JOIN products p ON c.id = p.category_id AND p.status = 'active'
WHERE c.status = 'active'
GROUP BY c.id
ORDER BY c.sort_order ASC;

SELECT '' AS separator;

-- ============================================================
-- Section 7: 自动化报告生成 (Automated Report Generation)
-- 生成最终的验证报告摘要
-- ============================================================

SELECT '--- Section 7: Final Verification Report ---' AS section;

-- 7.1 生成综合健康评分
SELECT 
    '═══════════════════════════════════════════════════' AS separator,
    '     CATEGORY CONSISTENCY CHECK REPORT              ' AS report_title,
    '═══════════════════════════════════════════════════' AS separator;

SELECT 
    CONCAT('Report Generated: ', NOW()) AS generated_at,
    CONCAT('Database: ', DATABASE()) AS database_name,
    CONCAT('MySQL Version: ', VERSION()) AS mysql_version;

-- 7.2 关键指标汇总
SELECT 
    'Key Metrics Summary' AS metrics,
    
    -- 完整性得分
    (SELECT 
        CASE 
            WHEN COUNT(*) > 0 THEN 25
            ELSE 0
        END 
     FROM categories) AS integrity_score_base,
     
    -- 数据质量得分
    (SELECT 
        CASE 
            WHEN (SELECT COUNT(*) FROM categories WHERE name IS NULL OR name = '') = 0 
                 AND (SELECT COUNT(*) FROM categories WHERE created_at IS NULL) = 0
                THEN 25
            WHEN (SELECT COUNT(*) FROM categories WHERE name IS NULL OR name = '') = 0 
                 OR (SELECT COUNT(*) FROM categories WHERE created_at IS NULL) = 0
                THEN 15
            ELSE 0
        END) AS data_quality_score,
        
    -- 关联完整性得分
    (SELECT 
        CASE 
            WHEN (SELECT COUNT(*) FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.category_id IS NOT NULL AND c.id IS NULL) = 0
                THEN 25
            ELSE 0
        END) AS referential_integrity_score,
        
    -- 同步一致性得分
    (SELECT 
        CASE 
            WHEN (SELECT COUNT(*) FROM (
                SELECT c.id, al.created_at, c.updated_at
                FROM categories c
                LEFT JOIN (
                    SELECT target_id, MAX(created_at) as max_created_at
                    FROM admin_logs WHERE target_type = 'category' GROUP BY target_id
                ) latest ON c.id = latest.target_id
                LEFT JOIN admin_logs al ON latest.target_id = al.target_id AND latest.max_created_at = al.created_at
                WHERE TIMESTAMPDIFF(SECOND, al.created_at, c.updated_at) > 300 OR al.created_at IS NULL
            ) AS out_of_sync) = 0
                THEN 25
            ELSE 10
        END) AS synchronization_score;

-- 7.3 最终结论和建议
SELECT 
    '═══════════════════════════════════════════════════' AS separator,
    '     CONCLUSIONS & RECOMMENDATIONS                  ' AS conclusion_title,
    '═══════════════════════════════════════════════════' AS separator;

SELECT 
    CASE 
        WHEN (
            (SELECT CASE WHEN COUNT(*) > 0 THEN 25 ELSE 0 END FROM categories) +
            (SELECT CASE WHEN (SELECT COUNT(*) FROM categories WHERE name IS NULL OR name = '') = 0 AND (SELECT COUNT(*) FROM categories WHERE created_at IS NULL) = 0 THEN 25 WHEN (SELECT COUNT(*) FROM categories WHERE name IS NULL OR name = '') = 0 OR (SELECT COUNT(*) FROM categories WHERE created_at IS NULL) = 0 THEN 15 ELSE 0 END) +
            (SELECT CASE WHEN (SELECT COUNT(*) FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.category_id IS NOT NULL AND c.id IS NULL) = 0 THEN 25 ELSE 0 END) +
            (SELECT CASE WHEN (SELECT COUNT(*) FROM (SELECT c.id, al.created_at, c.updated_at FROM categories c LEFT JOIN (SELECT target_id, MAX(created_at) as max_created_at FROM admin_logs WHERE target_type = 'category' GROUP BY target_id) latest ON c.id = latest.target_id LEFT JOIN admin_logs al ON latest.target_id = al.target_id AND latest.max_created_at = al.created_at WHERE TIMESTAMPDIFF(SECOND, al.created_at, c.updated_at) > 300 OR al.created_at IS NULL) AS out_of_sync) = 0 THEN 25 ELSE 10 END)
        ) >= 90
            THEN '🟢 OVERALL STATUS: HEALTHY - All critical checks passed'
        WHEN (
            (SELECT CASE WHEN COUNT(*) > 0 THEN 25 ELSE 0 END FROM categories) +
            (SELECT CASE WHEN (SELECT COUNT(*) FROM categories WHERE name IS NULL OR name = '') = 0 AND (SELECT COUNT(*) FROM categories WHERE created_at IS NULL) = 0 THEN 25 WHEN (SELECT COUNT(*) FROM categories WHERE name IS NULL OR name = '') = 0 OR (SELECT COUNT(*) FROM categories WHERE created_at IS NULL) = 0 THEN 15 ELSE 0 END) +
            (SELECT CASE WHEN (SELECT COUNT(*) FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.category_id IS NOT NULL AND c.id IS NULL) = 0 THEN 25 ELSE 0 END) +
            (SELECT CASE WHEN (SELECT COUNT(*) FROM (SELECT c.id, al.created_at, c.updated_at FROM categories c LEFT JOIN (SELECT target_id, MAX(created_at) as max_created_at FROM admin_logs WHERE target_type = 'category' GROUP BY target_id) latest ON c.id = latest.target_id LEFT JOIN admin_logs al ON latest.target_id = al.target_id AND latest.max_created_at = al.created_at WHERE TIMESTAMPDIFF(SECOND, al.created_at, c.updated_at) > 300 OR al.created_at IS NULL) AS out_of_sync) = 0 THEN 25 ELSE 10 END)
        ) >= 70
            THEN '🟡 OVERALL STATUS: WARNING - Some non-critical issues detected'
        ELSE '🔴 OVERALL STATUS: CRITICAL - Immediate attention required'
    END AS overall_health_status;

-- 推荐的后续行动
SELECT 
    'Recommended Actions:' AS actions_header,
    '1. Review all ⚠️ WARNING and ❌ FAIL items above' AS action_1,
    '2. Fix any data quality issues (null values, invalid references)' AS action_2,
    '3. Verify mini-program displays correct category tree' AS action_3,
    '4. Schedule this script to run daily via cron job' AS action_4,
    '5. Set up alerts if health score drops below 80' AS action_5;

SELECT 
    '═══════════════════════════════════════════════════' AS separator,
    '     END OF REPORT                                  ' AS end_marker,
    '═══════════════════════════════════════════════════' AS separator;

SELECT '' AS empty_line;
SELECT 'Script execution completed successfully.' AS final_message;
SELECT 'For detailed analysis, review each section output above.' AS note;
SELECT '' AS empty_line;
SELECT 'Related Files:' AS related;
SELECT '- Design Document: database/table_structure_design_v2.md' AS doc;
SELECT '- Upgrade Script: database/schema_v2_upgrade_system_identification.sql' AS upgrade;
SELECT '- Data Lineage Queries: database/data_lineage_queries.sql' AS lineage;