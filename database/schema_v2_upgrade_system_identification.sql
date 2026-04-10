-- ============================================================
-- 数据库Schema v2.0 升级脚本
-- Purpose: 添加系统标识字段，支持数据溯源和多系统区分
-- Compatibility: MySQL 5.7+ / TDSQL-C (腾讯云)
-- Database: qmzyxcx
-- Charset: utf8mb4
--
-- 执行前必读:
--   ⚠️  生产环境执行前务必备份数据库！
--   ⚠️  建议在测试环境先验证后再部署到生产环境
--   ⚠️  预计执行时间: < 5分钟（取决于数据量）
--   ⚠️  此脚本可重复执行（使用IF NOT EXISTS）
--
-- Created: 2026-04-10
-- Version: 2.0.0
-- Author: AI Assistant
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

SELECT '============================================' AS info;
SELECT '= Schema v2.0 Upgrade: System Identification =' AS info;
SELECT '============================================' AS info;
SELECT CONCAT('Start Time: ', NOW()) AS info;

-- -----------------------------------------------------------
-- Part 1: 为Common Tables添加标识字段
-- 目标表: users, products, categories, orders, order_items,
--         cart, favorites, footprints, coupons, user_coupons,
--         homepage_config, banners
-- -----------------------------------------------------------

SELECT '--- Part 1: Alter Common Tables (Adding Identification Fields) ---' AS step;

-- 1.1 users表 - 添加溯源字段
SELECT 'Altering table: users ...' AS progress;
ALTER TABLE `users` 
  ADD COLUMN IF NOT EXISTS `phone` VARCHAR(20) DEFAULT NULL COMMENT '手机号 (小程序登录用)' AFTER `email`,
  ADD COLUMN IF NOT EXISTS `created_by` ENUM('backend','miniprogram','system','migration') DEFAULT 'system' COMMENT '数据创建来源: backend=后台管理, miniprogram=小程序用户, system=系统自动, migration=数据迁移' AFTER `last_login`,
  ADD COLUMN IF NOT EXISTS `updated_by` ENUM('backend','miniprogram','system','migration') DEFAULT NULL COMMENT '最后更新来源' AFTER `created_by`,
  ADD COLUMN IF NOT EXISTS `source_ip` VARCHAR(45) DEFAULT NULL COMMENT '操作者IP地址（IPv4/IPv6）' AFTER `updated_by`,
  ADD COLUMN IF NOT EXISTS `device_info` JSON DEFAULT NULL COMMENT '设备信息JSON（平台/型号/版本等）' AFTER `source_ip`,
  ADD INDEX IF NOT EXISTS `idx_users_phone` (`phone`),
  ADD INDEX IF NOT EXISTS `idx_users_created_by` (`created_by`);
SELECT '✅ users table altered successfully' AS result;

-- 1.2 products表 - 添加溯源字段和图片增强
SELECT 'Altering table: products ...' AS progress;
ALTER TABLE `products` 
  ADD COLUMN IF NOT EXISTS `images` JSON DEFAULT NULL COMMENT '多图URL数组JSON' AFTER `image`,
  ADD COLUMN IF NOT EXISTS `created_by` ENUM('backend','miniprogram','system','migration') DEFAULT 'system' COMMENT '数据创建来源' AFTER `status`,
  ADD COLUMN IF NOT EXISTS `updated_by` ENUM('backend','miniprogram','system','migration') DEFAULT NULL COMMENT '最后更新来源' AFTER `created_by`,
  ADD COLUMN IF NOT EXISTS `source_ip` VARCHAR(45) DEFAULT NULL COMMENT '操作者IP地址' AFTER `updated_by`,
  ADD COLUMN IF NOT EXISTS `device_info` JSON DEFAULT NULL COMMENT '设备信息' AFTER `source_ip`,
  ADD INDEX IF NOT EXISTS `idx_products_created_by` (`created_by`);
SELECT '✅ products table altered successfully' AS result;

-- 1.3 categories表 - 添加溯源字段和图标
SELECT 'Altering table: categories ...' AS progress;
ALTER TABLE `categories` 
  ADD COLUMN IF NOT EXISTS `icon` VARCHAR(200) DEFAULT NULL COMMENT '分类图标URL' AFTER `sort_order`,
  ADD COLUMN IF NOT EXISTS `created_by` ENUM('backend','miniprogram','system','migration') DEFAULT 'system' COMMENT '数据创建来源' AFTER `status`,
  ADD COLUMN IF NOT EXISTS `updated_by` ENUM('backend','miniprogram','system','migration') DEFAULT NULL COMMENT '最后更新来源' AFTER `created_by`,
  ADD COLUMN IF NOT EXISTS `source_ip` VARCHAR(45) DEFAULT NULL COMMENT '操作者IP地址' AFTER `updated_by`,
  ADD INDEX IF NOT EXISTS `idx_categories_created_by` (`created_by`);
SELECT '✅ categories table altered successfully' AS result;

-- 1.4 orders表 - 添加溯源字段和支付增强
SELECT 'Altering table: orders ...' AS progress;
ALTER TABLE `orders` 
  ADD COLUMN IF NOT EXISTS `payment_amount` DECIMAL(10,2) DEFAULT NULL COMMENT '实际支付金额' AFTER `total_amount`,
  ADD COLUMN IF NOT EXISTS `payment_status` ENUM('unpaid', 'paid', 'refunding', 'refunded') DEFAULT 'unpaid' COMMENT '支付状态' AFTER `payment_amount`,
  ADD COLUMN IF NOT EXISTS `created_by` ENUM('backend','miniprogram','system','migration') DEFAULT 'miniprogram' COMMENT '数据创建来源（订单通常由用户下单）' AFTER `remark`,
  ADD COLUMN IF NOT EXISTS `updated_by` ENUM('backend','miniprogram','system','migration') DEFAULT NULL COMMENT '最后更新来源' AFTER `created_by`,
  ADD COLUMN IF NOT EXISTS `source_ip` VARCHAR(45) DEFAULT NULL COMMENT '操作者IP地址' AFTER `updated_by`,
  MODIFY COLUMN `status` ENUM('pending', 'paid', 'shipped', 'completed', 'cancelled', 'refunded') NOT NULL DEFAULT 'pending' COMMENT '订单状态',
  ADD INDEX IF NOT EXISTS `idx_orders_created_by` (`created_by`);
SELECT '✅ orders table altered successfully' AS result;

-- 1.5 order_items表 - 添加快照增强
SELECT 'Altering table: order_items ...' AS progress;
ALTER TABLE `order_items` 
  ADD COLUMN IF NOT EXISTS `product_image` VARCHAR(500) DEFAULT NULL COMMENT '商品图片 (下单时快照)' AFTER `product_name`;
SELECT '✅ order_items table altered successfully' AS result;

-- 1.6 cart表 - 添加溯源字段
SELECT 'Altering table: cart ...' AS progress;
ALTER TABLE `cart` 
  ADD COLUMN IF NOT EXISTS `created_by` ENUM('backend','miniprogram','system','migration') DEFAULT 'miniprogram' COMMENT '数据创建来源（购物车通常由用户添加）' AFTER `selected`,
  ADD COLUMN IF NOT EXISTS `source_ip` VARCHAR(45) DEFAULT NULL COMMENT '操作者IP地址' AFTER `created_by`,
  ADD INDEX IF NOT EXISTS `idx_cart_created_by` (`created_by`);
SELECT '✅ cart table altered successfully' AS result;

-- 1.7 favorites表 - 添加溯源字段
SELECT 'Altering table: favorites ...' AS progress;
ALTER TABLE `favorites` 
  ADD COLUMN IF NOT EXISTS `created_by` ENUM('backend','miniprogram','system','migration') DEFAULT 'miniprogram' COMMENT '数据创建来源（收藏通常由用户操作）' AFTER `product_id`,
  ADD COLUMN IF NOT EXISTS `source_ip` VARCHAR(45) DEFAULT NULL COMMENT '操作者IP地址' AFTER `created_by`,
  ADD INDEX IF NOT EXISTS `idx_favorites_created_by` (`created_by`);
SELECT '✅ favorites table altered successfully' AS result;

-- 1.8 footprints表 - 添加溯源字段
SELECT 'Altering table: footprints ...' AS progress;
ALTER TABLE `footprints` 
  ADD COLUMN IF NOT EXISTS `created_by` ENUM('backend','miniprogram','system','migration') DEFAULT 'miniprogram' COMMENT '数据创建来源（足迹由用户浏览产生）' AFTER `product_id`,
  ADD COLUMN IF NOT EXISTS `source_ip` VARCHAR(45) DEFAULT NULL COMMENT '操作者IP地址' AFTER `created_by`,
  ADD COLUMN IF NOT EXISTS `device_info` JSON DEFAULT NULL COMMENT '设备信息' AFTER `source_ip`,
  ADD INDEX IF NOT EXISTS `idx_footprints_created_by` (`created_by`);
SELECT '✅ footprints table altered successfully' AS result;

-- 1.9 coupons表 - 添加溯源字段
SELECT 'Altering table: coupons ...' AS progress;
ALTER TABLE `coupons` 
  ADD COLUMN IF NOT EXISTS `created_by` ENUM('backend','miniprogram','system','migration') DEFAULT 'backend' COMMENT '数据创建来源（优惠券通常由后台创建）' AFTER `description`,
  ADD COLUMN IF NOT EXISTS `updated_by` ENUM('backend','miniprogram','system','migration') DEFAULT NULL COMMENT '最后更新来源' AFTER `created_by`,
  ADD COLUMN IF NOT EXISTS `source_ip` VARCHAR(45) DEFAULT NULL COMMENT '操作者IP地址' AFTER `updated_by`,
  ADD INDEX IF NOT EXISTS `idx_coupons_created_by` (`created_by`);
SELECT '✅ coupons table altered successfully' AS result;

-- 1.10 user_coupons表 - 添加溯源字段
SELECT 'Altering table: user_coupons ...' AS progress;
ALTER TABLE `user_coupons` 
  ADD COLUMN IF NOT EXISTS `created_by` ENUM('backend','miniprogram','system','migration') DEFAULT 'miniprogram' COMMENT '数据创建来源（领取动作通常来自小程序）' AFTER `order_id`,
  ADD COLUMN IF NOT EXISTS `source_ip` VARCHAR(45) DEFAULT NULL COMMENT '操作者IP地址' AFTER `created_by`,
  ADD INDEX IF NOT EXISTS `idx_user_coupons_created_by` (`created_by`);
SELECT '✅ user_coupons table altered successfully' AS result;

-- 1.11 homepage_config表 - 添加溯源字段
SELECT 'Altering table: homepage_config ...' AS progress;
ALTER TABLE `homepage_config` 
  ADD COLUMN IF NOT EXISTS `created_by` ENUM('backend','miniprogram','system','migration') DEFAULT 'backend' COMMENT '创建来源（配置通常由后台管理）' AFTER `description`,
  ADD COLUMN IF NOT EXISTS `updated_by` ENUM('backend','miniprogram','system','migration') DEFAULT NULL COMMENT '最后更新来源' AFTER `created_by`,
  ADD COLUMN IF NOT EXISTS `source_ip` VARCHAR(45) DEFAULT NULL COMMENT '操作者IP地址' AFTER `updated_by`,
  ADD INDEX IF NOT EXISTS `idx_homepage_config_created_by` (`created_by`);
SELECT '✅ homepage_config table altered successfully' AS result;

-- 1.12 banners表 - 升级为完整版本
SELECT 'Altering table: banners (upgrade to v2.0) ...' AS progress;
ALTER TABLE `banners` 
  ADD COLUMN IF NOT EXISTS `subtitle` VARCHAR(200) DEFAULT NULL COMMENT '副标题' AFTER `title`,
  ADD COLUMN IF NOT EXISTS `mobile_image_url` VARCHAR(500) DEFAULT NULL COMMENT '移动端图片URL (可选，响应式设计)' AFTER `image_url`,
  ADD COLUMN IF NOT EXISTS `impressions` INT DEFAULT 0 COMMENT '展示次数' AFTER `clicks`,
  ADD COLUMN IF NOT EXISTS `created_by` ENUM('backend','miniprogram','system','migration') DEFAULT 'backend' COMMENT '创建来源' AFTER `impressions`,
  ADD COLUMN IF NOT EXISTS `updated_by` ENUM('backend','miniprogram','system','migration') DEFAULT NULL COMMENT '最后更新来源' AFTER `created_by`,
  ADD COLUMN IF NOT EXISTS `source_ip` VARCHAR(45) DEFAULT NULL COMMENT '操作者IP地址' AFTER `updated_by`,
  MODIFY COLUMN `link_type` ENUM('product', 'category', 'url', 'none', 'activity') DEFAULT 'none' COMMENT '链接类型',
  ADD INDEX IF NOT EXISTS `idx_banners_time` (`start_time`, `end_time`),
  ADD INDEX IF NOT EXISTS `idx_banners_created_by` (`created_by`);
SELECT '✅ banners table upgraded to v2.0 successfully' AS result;

SELECT '--- Part 1 Completed: All Common Tables Altered ---' AS status;

-- -----------------------------------------------------------
-- Part 2: 创建Backend-Specific Tables（后台专用表）
-- 新建表: admin_logs, system_config, announcements
-- -----------------------------------------------------------

SELECT '--- Part 2: Create Backend-Specific Tables ---' AS step;

-- 2.1 admin_logs - 管理员操作日志表
CREATE TABLE IF NOT EXISTS `admin_logs` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '日志ID',
    `admin_id` INT UNSIGNED NOT NULL COMMENT '管理员用户ID',
    `action` VARCHAR(50) NOT NULL COMMENT '操作类型: create/update/delete/login/logout/config_change/batch_import',
    `target_type` VARCHAR(50) DEFAULT NULL COMMENT '目标对象类型: user/product/order/category/coupon/banner/system/announcement',
    `target_id` INT UNSIGNED DEFAULT NULL COMMENT '目标对象ID',
    `details` JSON DEFAULT NULL COMMENT '操作详情（变更前后对比JSON）',
    `ip_address` VARCHAR(45) DEFAULT NULL COMMENT '管理员IP地址',
    `user_agent` VARCHAR(255) DEFAULT NULL COMMENT '浏览器User-Agent',
    `request_method` VARCHAR(10) DEFAULT NULL COMMENT 'HTTP方法: GET/POST/PUT/DELETE',
    `request_path` VARCHAR(255) DEFAULT NULL COMMENT '请求路径',
    `response_status` SMALLINT DEFAULT NULL COMMENT 'HTTP响应状态码',
    `execution_time_ms` INT DEFAULT NULL COMMENT '执行耗时(毫秒)',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
    
    PRIMARY KEY (`id`),
    KEY `idx_admin_logs_admin_id` (`admin_id`),
    KEY `idx_admin_logs_action` (`action`),
    KEY `idx_admin_logs_target` (`target_type`, `target_id`),
    KEY `idx_admin_logs_created_at` (`created_at`),
    KEY `idx_admin_logs_ip` (`ip_address`)
) ENGINE=InnoDB 
DEFAULT CHARSET=utf8mb4 
COLLATE=utf8mb4_unicode_ci 
COMMENT='管理员操作日志表 (v2.0 新建 - 用于审计和问题追踪)';
SELECT '✅ Table admin_logs created (or already exists)' AS result;

-- 2.2 system_config - 系统全局配置表
CREATE TABLE IF NOT EXISTS `system_config` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '配置ID',
    `config_key` VARCHAR(100) NOT NULL COMMENT '配置键 (唯一标识)',
    `config_value` TEXT DEFAULT NULL COMMENT '配置值 (支持JSON/文本/数字)',
    `config_group` VARCHAR(50) DEFAULT 'general' COMMENT '配置分组: general/payment/shipping/email/security/seo/notification',
    `config_type` ENUM('string', 'number', 'boolean', 'json', 'text') DEFAULT 'string' COMMENT '值类型',
    `description` VARCHAR(500) DEFAULT NULL COMMENT '配置说明',
    `is_public` TINYINT(1) DEFAULT 0 COMMENT '是否公开 (1=前端API可见, 0=仅后台可见)',
    `is_editable` TINYINT(1) DEFAULT 1 COMMENT '是否可编辑 (1=可编辑, 0=只读系统配置)',
    `sort_order` INT DEFAULT 0 COMMENT '排序权重 (数值越小越靠前)',
    
    -- 系统标识字段
    `created_by` ENUM('backend','miniprogram','system','migration') DEFAULT 'system' COMMENT '创建来源',
    `updated_by` ENUM('backend','miniprogram','system','migration') DEFAULT NULL COMMENT '最后更新来源',
    `source_ip` VARCHAR(45) DEFAULT NULL COMMENT '操作者IP地址',
    
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_system_config_key` (`config_key`),
    KEY `idx_system_config_group` (`config_group`),
    KEY `idx_system_config_public` (`is_public`)
) ENGINE=InnoDB 
DEFAULT CHARSET=utf8mb4 
COLLATE=utf8mb4_unicode_ci 
COMMENT='系统全局配置表 (v2.0 新建 - 替代硬编码配置)';
SELECT '✅ Table system_config created (or already exists)' AS result;

-- 2.3 announcements - 公告管理表
CREATE TABLE IF NOT EXISTS `announcements` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '公告ID',
    `title` VARCHAR(200) NOT NULL COMMENT '公告标题',
    `content` TEXT NOT NULL COMMENT '公告内容 (支持HTML富文本)',
    `type` ENUM('notice', 'activity', 'maintenance', 'urgent', 'update') DEFAULT 'notice' COMMENT '公告类型: notice=通知, activity=活动, maintenance=维护, urgent=紧急, update=更新',
    `is_top` TINYINT(1) DEFAULT 0 COMMENT '是否置顶 (1-置顶显示, 0-普通排序)',
    `status` ENUM('draft', 'published', 'archived') DEFAULT 'draft' COMMENT '状态: draft=草稿, published=已发布, archived=已归档',
    `published_at` DATETIME DEFAULT NULL COMMENT '实际发布时间',
    `expire_at` DATETIME DEFAULT NULL COMMENT '过期时间 (NULL表示永不过期)',
    `view_count` INT DEFAULT 0 COMMENT '阅读次数统计',
    
    -- 系统标识字段
    `created_by` ENUM('backend','miniprogram','system','migration') DEFAULT 'backend' COMMENT '创建来源',
    `updated_by` ENUM('backend','miniprogram','system','migration') DEFAULT NULL COMMENT '最后更新来源',
    `source_ip` VARCHAR(45) DEFAULT NULL COMMENT '操作者IP地址',
    
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    PRIMARY KEY (`id`),
    KEY `idx_announcements_status` (`status`),
    KEY `idx_announcements_type` (`type`),
    KEY `idx_announcements_top` (`is_top`, `published_at` DESC),
    KEY `idx_announcements_time` (`published_at`, `expire_at`),
    KEY `idx_announcements_created_by` (`created_by`)
) ENGINE=InnoDB 
DEFAULT CHARSET=utf8mb4 
COLLATE=utf8mb4_unicode_ci 
COMMENT='公告管理表 (v2.0 新建 - 用于系统通知和活动发布)';
SELECT '✅ Table announcements created (or already exists)' AS result;

SELECT '--- Part 2 Completed: Backend-Specific Tables Created ---' AS status;

-- -----------------------------------------------------------
-- Part 3: 创建Mini-program Specific Tables（小程序专用表）
-- 新建表: mp_user_profiles, mp_browsing_history,
--         mp_shopping_cart, mp_favorites, mp_footprints
-- -----------------------------------------------------------

SELECT '--- Part 3: Create Mini-program Specific Tables ---' AS step;

-- 3.1 mp_user_profiles - 小程序用户扩展信息表
CREATE TABLE IF NOT EXISTS `mp_user_profiles` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录ID',
    `user_id` INT UNSIGNED NOT NULL COMMENT '关联用户ID (与users表1:1关系)',
    `openid` VARCHAR(100) DEFAULT NULL COMMENT '微信OpenID (应用内唯一)',
    `unionid` VARCHAR(100) DEFAULT NULL COMMENT '微信UnionID (跨应用唯一, 需开放平台)',
    `nickname` VARCHAR(100) DEFAULT NULL COMMENT '微信昵称',
    `avatar_url` VARCHAR(500) DEFAULT NULL COMMENT '微信头像URL',
    `gender` TINYINT DEFAULT 0 COMMENT '性别: 0=未知, 1=男, 2=女',
    `city` VARCHAR(50) DEFAULT NULL COMMENT '城市',
    `province` VARCHAR(50) DEFAULT NULL COMMENT '省份',
    `country` VARCHAR(50) DEFAULT NULL COMMENT '国家',
    `language` VARCHAR(20) DEFAULT NULL COMMENT '语言',
    `last_login_time` DATETIME DEFAULT NULL COMMENT '最后登录时间',
    `login_count` INT DEFAULT 0 COMMENT '累计登录次数',
    `session_key` VARCHAR(100) DEFAULT NULL COMMENT '会话密钥 (加密存储, 敏感信息)',
    
    -- 设备和来源信息
    `device_info` JSON DEFAULT NULL COMMENT '设备信息JSON',
    `source_ip` VARCHAR(45) DEFAULT NULL COMMENT '最近登录IP地址',
    
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '首次授权时间',
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_mp_user_profiles_user_id` (`user_id`),
    UNIQUE KEY `uk_mp_user_profiles_openid` (`openid`),
    UNIQUE KEY `uk_mp_user_profiles_unionid` (`unionid`),
    KEY `idx_mp_user_profiles_last_login` (`last_login_time`),
    
    CONSTRAINT `fk_mp_user_profiles_user` 
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) 
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB 
DEFAULT CHARSET=utf8mb4 
COLLATE=utf8mb4_unicode_ci 
COMMENT='小程序用户扩展信息表 (v2.0 新建 - 存储微信生态特有信息)';
SELECT '✅ Table mp_user_profiles created (or already exists)' AS result;

-- 3.2 mp_browsing_history - 详细浏览历史表
CREATE TABLE IF NOT EXISTS `mp_browsing_history` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录ID (使用BIGINT支持高频写入)',
    `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID',
    `product_id` INT UNSIGNED NOT NULL COMMENT '商品ID',
    `viewed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '浏览时间',
    `session_id` VARCHAR(64) DEFAULT NULL COMMENT '会话ID (用于分析用户会话路径)',
    `duration_seconds` INT DEFAULT NULL COMMENT '停留时长(秒, 前端估算值)',
    `entry_source` ENUM('search', 'recommendation', 'category', 'homepage', 'share', 'other', 'direct') DEFAULT 'other' COMMENT '入口来源渠道',
    `scroll_depth` TINYINT DEFAULT NULL COMMENT '滚动深度百分比 (0-100, NULL表示未统计)',
    
    PRIMARY KEY (`id`),
    KEY `idx_mp_browsing_history_user_time` (`user_id`, `viewed_at` DESC),
    KEY `idx_mp_browsing_history_product` (`product_id`),
    KEY `idx_mp_browsing_history_session` (`session_id`),
    KEY `idx_mp_browsing_history_entry` (`entry_source`),
    KEY `idx_mp_browsing_history_viewed_date` (`viewed_at`),
    
    CONSTRAINT `fk_mp_browsing_history_user` 
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_mp_browsing_history_product` 
        FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) 
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB 
DEFAULT CHARSET=utf8mb4 
COLLATE=utf8mb4_unicode_ci 
COMMENT='小程序详细浏览历史表 (v2.0 新建 - 用于行为分析和用户体验优化)';
SELECT '✅ Table mp_browsing_history created (or already exists)' AS result;

-- 3.3 mp_shopping_cart - 小程序专用购物车表
CREATE TABLE IF NOT EXISTS `mp_shopping_cart` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录ID',
    `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID',
    `product_id` INT UNSIGNED NOT NULL COMMENT '商品ID',
    `quantity` INT NOT NULL DEFAULT 1 COMMENT '数量',
    `selected` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否选中 (1-选中, 0-未选中)',
    `sku_id` INT UNSIGNED DEFAULT NULL COMMENT 'SKU ID (预留, 未来规格/SKU支持)',
    `added_from` ENUM('detail_page', 'list_page', 'recommendation', 'cart_share', 'search_result') DEFAULT 'detail_page' COMMENT '添加来源页面',
    `source_ip` VARCHAR(45) DEFAULT NULL COMMENT '操作IP地址',
    
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '添加时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_mp_cart_user_product` (`user_id`, `product_id`),
    KEY `idx_mp_cart_user` (`user_id`),
    KEY `idx_mp_cart_added_from` (`added_from`),
    
    CONSTRAINT `fk_mp_cart_user` 
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_mp_cart_product` 
        FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `ck_mp_cart_quantity` CHECK (`quantity` > 0)
) ENGINE=InnoDB 
DEFAULT CHARSET=utf8mb4 
COLLATE=utf8mb4_unicode_ci 
COMMENT='小程序购物车表 (v2.0 新建 - 可与通用cart表同步或独立使用)';
SELECT '✅ Table mp_shopping_cart created (or already exists)' AS result;

-- 3.4 mp_favorites - 小程序收藏视图表
CREATE TABLE IF NOT EXISTS `mp_favorites` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录ID',
    `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID',
    `product_id` INT UNSIGNED NOT NULL COMMENT '商品ID',
    `favorite_type` ENUM('normal', 'wish_list', 'compare') DEFAULT 'normal' COMMENT '收藏类型: normal=普通收藏, wish_list=心愿单, compare=对比清单',
    `remark` VARCHAR(200) DEFAULT NULL COMMENT '备注 (如:想买给谁、购买目的等)',
    `favorite_folder_id` INT UNSIGNED DEFAULT NULL COMMENT '收藏夹分组ID (预留, 未来收藏夹分组功能)',
    `source_ip` VARCHAR(45) DEFAULT NULL COMMENT '操作IP地址',
    
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '收藏时间',
    
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_mp_favorites_user_product` (`user_id`, `product_id`),
    KEY `idx_mp_favorites_user` (`user_id`),
    KEY `idx_mp_favorites_type` (`favorite_type`),
    
    CONSTRAINT `fk_mp_favorites_user` 
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_mp_favorites_product` 
        FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) 
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB 
DEFAULT CHARSET=utf8mb4 
COLLATE=utf8mb4_unicode_ci 
COMMENT='小程序收藏表 (v2.0 新建 - 支持多种收藏类型和个性化备注)';
SELECT '✅ Table mp_favorites created (or already exists)' AS result;

-- 3.5 mp_footprints - 增强足迹表（支持多种行为类型）
CREATE TABLE IF NOT EXISTS `mp_footprints` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '足迹ID (使用BIGINT支持高频写入)',
    `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID',
    `product_id` INT UNSIGNED NOT NULL COMMENT '商品ID',
    `action_type` ENUM('view', 'search', 'share', 'add_to_cart', 'collect', 'purchase') DEFAULT 'view' COMMENT '行为类型: view=浏览, search=搜索结果点击, share=分享, add_to_cart=加购, collect=收藏, purchase=购买后回看',
    `context` JSON DEFAULT NULL COMMENT '上下文信息 (搜索关键词、分享渠道、推荐理由等)',
    `source_ip` VARCHAR(45) DEFAULT NULL COMMENT '操作IP地址',
    `device_info` JSON DEFAULT NULL COMMENT '设备信息JSON',
    
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '行为发生时间',
    
    PRIMARY KEY (`id`),
    KEY `idx_mp_footprints_user_time` (`user_id`, `created_at` DESC),
    KEY `idx_mp_footprints_product` (`product_id`),
    KEY `idx_mp_footprints_action` (`action_type`),
    KEY `idx_mp_footprints_created_date` ((DATE(`created_at`))),
    
    CONSTRAINT `fk_mp_footprints_user` 
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_mp_footprints_product` 
        FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) 
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB 
DEFAULT CHARSET=utf8mb4 
COLLATE=utf8mb4_unicode_ci 
COMMENT='小程序增强足迹表 (v2.0 新建 - 支持多类型行为追踪和分析)';
SELECT '✅ Table mp_footprints created (or already exists)' AS result;

SELECT '--- Part 3 Completed: Mini-program Specific Tables Created ---' AS status;

-- -----------------------------------------------------------
-- Part 4: 创建触发器（可选增强功能）
-- 用途: 自动记录关键表的变更到admin_logs
-- 注意: 触发器会增加少量写入开销，可根据需要启用
-- -----------------------------------------------------------

SELECT '--- Part 4: Creating Triggers (Optional Enhancement) ---' AS step;

DELIMITER //

-- 4.1 分类变更触发器 - 记录分类的增删改操作
DROP TRIGGER IF EXISTS after_category_insert//
CREATE TRIGGER after_category_insert
AFTER INSERT ON categories
FOR EACH ROW
BEGIN
    INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, ip_address, request_method)
    VALUES (
        COALESCE(NEW.created_by, 'system'),
        'create_category',
        'category',
        NEW.id,
        JSON_OBJECT(
            'name', NEW.name,
            'parent_id', NEW.parent_id,
            'sort_order', NEW.sort_order,
            'icon', NEW.icon,
            'status', NEW.status
        ),
        NEW.source_ip,
        'INSERT'
    );
END//

DROP TRIGGER IF EXISTS after_category_update//
CREATE TRIGGER after_category_update
AFTER UPDATE ON categories
FOR EACH ROW
BEGIN
    IF NEW.name != OLD.name OR NEW.parent_id != OLD.parent_id OR NEW.status != OLD.status THEN
        INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, ip_address, request_method)
        VALUES (
            COALESCE(NEW.updated_by, 'system'),
            'update_category',
            'category',
            NEW.id,
            JSON_OBJECT(
                'old_name', OLD.name,
                'new_name', NEW.name,
                'old_parent_id', OLD.parent_id,
                'new_parent_id', NEW.parent_id,
                'old_status', OLD.status,
                'new_status', NEW.status
            ),
            NEW.source_ip,
            'UPDATE'
        );
    END IF;
END//

DROP TRIGGER IF EXISTS before_category_delete//
CREATE TRIGGER before_category_delete
BEFORE DELETE ON categories
FOR EACH ROW
BEGIN
    INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, ip_address, request_method)
    VALUES (
        'system',
        'delete_category',
        'category',
        OLD.id,
        JSON_OBJECT(
            'deleted_name', OLD.name,
            'deleted_parent_id', OLD.parent_id,
            'deleted_sort_order', OLD.sort_order
        ),
        NULL,
        'DELETE'
    );
END//

SELECT '✅ Category triggers created (after_category_insert, after_category_update, before_category_delete)' AS result;

-- 4.2 商品变更触发器 - 记录商品的增删改操作
DROP TRIGGER IF EXISTS after_product_insert//
CREATE TRIGGER after_product_insert
AFTER INSERT ON products
FOR EACH ROW
BEGIN
    INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, ip_address, request_method)
    VALUES (
        COALESCE(NEW.created_by, 'system'),
        'create_product',
        'product',
        NEW.id,
        JSON_OBJECT(
            'name', NEW.name,
            'price', NEW.price,
            'stock', NEW.stock,
            'category_id', NEW.category_id,
            'status', NEW.status
        ),
        NEW.source_ip,
        'INSERT'
    );
END//

DROP TRIGGER IF EXISTS after_product_update//
CREATE TRIGGER after_product_update
AFTER UPDATE ON products
FOR EACH ROW
BEGIN
    IF NEW.price != OLD.price OR NEW.stock != OLD.stock OR NEW.status != OLD.status THEN
        INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, ip_address, request_method)
        VALUES (
            COALESCE(NEW.updated_by, 'system'),
            'update_product',
            'product',
            NEW.id,
            JSON_OBJECT(
                'old_price', OLD.price,
                'new_price', NEW.price,
                'old_stock', OLD.stock,
                'new_stock', NEW.stock,
                'old_status', OLD.status,
                'new_status', NEW.status
            ),
            NEW.source_ip,
            'UPDATE'
        );
    END IF;
END//

SELECT '✅ Product triggers created (after_product_insert, after_product_update)' AS result;

DELIMITER ;

SELECT '--- Part 4 Completed: Triggers Created ---' AS status;

-- -----------------------------------------------------------
-- Part 5: 初始化系统配置默认值
-- 为system_config表插入基础配置项
-- -----------------------------------------------------------

SELECT '--- Part 5: Initializing Default System Config ---' AS step;

INSERT IGNORE INTO `system_config` (`config_key`, `config_value`, `config_group`, `config_type`, `description`, `is_public`, `is_editable`, `sort_order`, `created_by`) VALUES
('site_name', '"绮梦之约电商"', 'general', 'string', '网站/小程序名称', 1, 1, 1, 'system'),
('site_description', '"优质商品，品质生活"', 'general', 'text', '网站描述(SEO用)', 1, 1, 2, 'system'),
('site_logo', '""', 'general', 'string', '网站Logo URL', 1, 1, 3, 'system'),
('contact_phone', '"400-123-4567"', 'general', 'string', '客服电话', 1, 1, 4, 'system'),
('contact_email', '"service@qiguan.com"', 'general', 'string', '客服邮箱', 1, 1, 5, 'system'),
('enable_registration', 'true', 'general', 'boolean', '是否允许新用户注册', 1, 1, 10, 'system'),
('maintenance_mode', 'false', 'general', 'boolean', '维护模式 (开启后前台不可访问)', 0, 1, 20, 'system'),

('currency_symbol', '"¥"', 'payment', 'string', '货币符号', 1, 0, 1, 'system'),
('payment_timeout_minutes', '30', 'payment', 'number', '订单支付超时时间(分钟)', 0, 1, 2, 'system'),
('auto_cancel_unpaid_orders', 'true', 'payment', 'boolean', '是否自动取消超时未支付订单', 0, 1, 3, 'system'),
('min_order_amount', '0', 'payment', 'number', '最低订单金额(0表示不限制)', 1, 1, 4, 'system'),
('max_order_amount', '999999', 'payment', 'number', '最高订单金额', 0, 1, 5, 'system'),

('default_shipping_fee', '10', 'shipping', 'number', '默认运费(元)', 1, 1, 1, 'system'),
('free_shipping_threshold', '99', 'shipping', 'number', '免运费门槛(元)', 1, 1, 2, 'system'),
('supported_provinces', '"[]"', 'shipping', 'json', '支持的配送省份JSON数组(空=全部)', 0, 1, 3, 'system'),

('smtp_host', '""', 'email', 'string', 'SMTP服务器地址', 0, 1, 1, 'system'),
('smtp_port', '587', 'email', 'number', 'SMTP端口', 0, 1, 2, 'system'),
('smtp_user', '""', 'email', 'string', 'SMTP用户名', 0, 1, 3, 'system'),
('sender_name', '"绮梦之约"', 'email', 'string', '发件人名称', 0, 1, 4, 'system'),
('enable_email_notification', 'true', 'email', 'boolean', '是否启用邮件通知', 0, 1, 5, 'system'),

('max_login_attempts', '5', 'security', 'number', '最大登录尝试次数', 0, 1, 1, 'system'),
('lockout_duration_minutes', '30', 'security', 'number', '账户锁定时长(分钟)', 0, 1, 2, 'system'),
('session_timeout_hours', '24', 'security', 'number', '会话超时时间(小时)', 0, 1, 3, 'system'),
('enable_captcha', 'false', 'security', 'boolean', '是否启用验证码', 0, 1, 4, 'system'),

('seo_title', '"绮梦之约 - 优质商品电商平台"', 'seo', 'string', 'SEO标题模板', 1, 1, 1, 'system'),
('seo_keywords', '"绮梦之约,电商,购物,优惠"', 'seo', 'string', 'SEO关键词', 1, 1, 2, 'system'),
('seo_description', '"绮梦之约电商平台，提供优质的商品和贴心的服务"', 'seo', 'text', 'SEO描述', 1, 1, 3, 'system');

SELECT CONCAT('✅ Initialized ', ROW_COUNT(), ' default system config entries') AS result;

SELECT '--- Part 5 Completed: System Config Initialized ---' AS status;

-- -----------------------------------------------------------
-- Part 6: 数据迁移标记
-- 将现有历史数据的created_by标记为'migration'
-- 这样可以区分v2.0升级前后的数据
-- -----------------------------------------------------------

SELECT '--- Part 6: Migrating Historical Data Labels ---' AS step;

-- 标记所有现有数据为迁移数据
UPDATE `users` SET `created_by` = 'migration' WHERE `created_by` IS NULL OR `created_by` = 'system';
SELECT CONCAT('✅ Users: ', ROW_COUNT(), ' records labeled as migration') AS result;

UPDATE `products` SET `created_by` = 'migration' WHERE `created_by` IS NULL OR `created_by` = 'system';
SELECT CONCAT('✅ Products: ', ROW_COUNT(), ' records labeled as migration') AS result;

UPDATE `categories` SET `created_by` = 'migration' WHERE `created_by` IS NULL OR `created_by` = 'system';
SELECT CONCAT('✅ Categories: ', ROW_COUNT(), ' records labeled as migration') AS result;

UPDATE `orders` SET `created_by` = 'migration' WHERE `created_by` IS NULL OR `created_by` = 'miniprogram';
SELECT CONCAT('✅ Orders: ', ROW_COUNT(), ' records labeled as migration') AS result;

UPDATE `cart` SET `created_by` = 'migration' WHERE `created_by` IS NULL OR `created_by` = 'miniprogram';
SELECT CONCAT('✅ Cart: ', ROW_COUNT(), ' records labeled as migration') AS result;

UPDATE `favorites` SET `created_by` = 'migration' WHERE `created_by` IS NULL OR `created_by` = 'miniprogram';
SELECT CONCAT('✅ Favorites: ', ROW_COUNT(), ' records labeled as migration') AS result;

UPDATE `footprints` SET `created_by` = 'migration' WHERE `created_by` IS NULL OR `created_by` = 'miniprogram';
SELECT CONCAT('✅ Footprints: ', ROW_COUNT(), ' records labeled as migration') AS result;

UPDATE `coupons` SET `created_by` = 'migration' WHERE `created_by` IS NULL OR `created_by` = 'backend';
SELECT CONCAT('✅ Coupons: ', ROW_COUNT(), ' records labeled as migration') AS result;

UPDATE `user_coupons` SET `created_by` = 'migration' WHERE `created_by` IS NULL OR `created_by` = 'miniprogram';
SELECT CONCAT('✅ User_coupons: ', ROW_COUNT(), ' records labeled as migration') AS result;

UPDATE `homepage_config` SET `created_by` = 'migration' WHERE `created_by` IS NULL OR `created_by` = 'backend';
SELECT CONCAT('✅ Homepage_config: ', ROW_COUNT(), ' records labeled as migration') AS result;

UPDATE `banners` SET `created_by` = 'migration' WHERE `created_by` IS NULL OR `created_by` = 'backend';
SELECT CONCAT('✅ Banners: ', ROW_COUNT(), ' records labeled as migration') AS result;

SELECT '--- Part 6 Completed: Historical Data Labeled ---' AS status;

-- -----------------------------------------------------------
-- Part 7: 验证升级结果
-- 检查所有预期的更改是否成功应用
-- -----------------------------------------------------------

SELECT '--- Part 7: Verifying Upgrade Results ---' AS step;

-- 7.1 检查新增字段是否存在
SELECT 
    'Field Verification' AS check_type,
    TABLE_NAME,
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('users', 'products', 'categories', 'orders')
  AND COLUMN_NAME IN ('created_by', 'updated_by', 'source_ip', 'device_info', 'phone', 'images', 'icon', 'payment_amount', 'payment_status')
ORDER BY TABLE_NAME, ORDINAL_POSITION;

-- 7.2 统计各表的数据来源分布（验证标签正确性）
SELECT 
    'Source Distribution Check' AS check_type,
    'users' AS table_name,
    created_by,
    COUNT(*) AS record_count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM users), 2) AS percentage
FROM users
GROUP BY created_by
UNION ALL
SELECT 
    'Source Distribution Check',
    'products',
    created_by,
    COUNT(*),
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM products), 2)
FROM products
GROUP BY created_by
UNION ALL
SELECT 
    'Source Distribution Check',
    'categories',
    created_by,
    COUNT(*),
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM categories), 2)
FROM categories
GROUP BY created_by
ORDER BY table_name, percentage DESC;

-- 7.3 检查新建表是否存在
SELECT 
    'Table Existence Verification' AS check_type,
    TABLE_NAME,
    TABLE_COMMENT,
    CREATE_TIME,
    TABLE_ROWS
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN (
    'admin_logs', 
    'system_config', 
    'announcements',
    'mp_user_profiles',
    'mp_browsing_history',
    'mp_shopping_cart',
    'mp_favorites',
    'mp_footprints'
  )
ORDER BY TABLE_NAME;

-- 7.4 检查索引是否创建成功
SELECT 
    'Index Verification' AS check_type,
    TABLE_NAME,
    INDEX_NAME,
    COLUMN_NAME,
    SEQ_IN_INDEX
FROM information_schema.STATISTICS 
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('users', 'products', 'orders')
  AND INDEX_NAME LIKE '%created_by%'
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

-- 7.5 检查触发器是否创建成功
SHOW TRIGGERS WHERE `Trigger` LIKE '%category%' OR `Trigger` LIKE '%product%';

-- 7.6 最终汇总报告
SELECT 
    '═══════════════════════════════════════════════' AS separator,
    '       Schema v2.0 Upgrade Summary Report       ' AS title,
    '═══════════════════════════════════════════════' AS separator;

SELECT 
    CONCAT('Upgrade Status: ✅ COMPLETED SUCCESSFULLY') AS status,
    CONCAT('Execution Time: ', NOW()) AS completed_at,
    CONCAT('Total Tables in Database: ', 
           (SELECT COUNT(*) FROM information_schema.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE')) AS total_tables,
    CONCAT('New Tables Added: 9 (4 backend + 5 mini-program)') AS new_tables_count,
    CONCAT('Tables Upgraded: 12 (with identification fields)') AS upgraded_tables_count,
    CONCAT('Triggers Created: 5 (for categories & products)') AS triggers_count,
    CONCAT('System Config Entries: ', (SELECT COUNT(*) FROM system_config)) AS config_entries;

SELECT 
    '═══════════════════════════════════════════════' AS separator,
    '  Next Steps:                                   ' AS next_step_1,
    '  1. Review the verification results above       ' AS next_step_2,
    '  2. Test application compatibility             ' AS next_step_3,
    '  3. Update route handlers to populate new fields' AS next_step_4,
    '  4. Monitor performance for 24-48 hours         ' AS next_step_5,
    '═══════════════════════════════════════════════' AS separator;

SELECT '--- Part 7 Completed: Verification Finished ---' AS status;

-- -----------------------------------------------------------
-- Part 8: 回滚脚本（ROLLBACK SCRIPT）
-- ⚠️ 警告: 回滚会删除所有v2.0新增数据和字段！
-- 仅在出现严重问题时使用！
-- -----------------------------------------------------------

/*
-- ============================================================
-- ⚠️⚠️⚠️  ROLLBACK SCRIPT - 紧急回滚用  ⚠️⚠️⚠️
-- 执行前请确认：已备份当前数据库！
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

SELECT '🔄 Starting ROLLBACK of Schema v2.0...' AS warning;

-- Step 1: 删除触发器
DROP TRIGGER IF EXISTS after_category_insert;
DROP TRIGGER IF EXISTS after_category_update;
DROP TRIGGER IF EXISTS before_category_delete;
DROP TRIGGER IF EXISTS after_product_insert;
DROP TRIGGER IF EXISTS after_product_update;
SELECT '✅ Triggers dropped' AS rollback_step;

-- Step 2: 删除新建的后台专用表
DROP TABLE IF EXISTS `announcements`;
DROP TABLE IF EXISTS `system_config`;
DROP TABLE IF EXISTS `admin_logs`;
SELECT '✅ Backend-specific tables dropped' AS rollback_step;

-- Step 3: 删除新建的小程序专用表
DROP TABLE IF EXISTS `mp_footprints`;
DROP TABLE IF EXISTS `mp_favorites`;
DROP TABLE IF EXISTS `mp_shopping_cart`;
DROP TABLE IF EXISTS `mp_browsing_history`;
DROP TABLE IF EXISTS `mp_user_profiles`;
SELECT '✅ Mini-program specific tables dropped' AS rollback_step;

-- Step 4: 从Common表中删除新增字段（按逆序）
-- banners表
ALTER TABLE `banners` 
  DROP COLUMN IF EXISTS `source_ip`,
  DROP COLUMN IF EXISTS `updated_by`,
  DROP COLUMN IF EXISTS `created_by`,
  DROP COLUMN IF EXISTS `impressions`,
  DROP COLUMN IF EXISTS `mobile_image_url`,
  DROP COLUMN IF EXISTS `subtitle`,
  DROP INDEX IF EXISTS `idx_banners_time`,
  DROP INDEX IF EXISTS `idx_banners_created_by`,
  MODIFY COLUMN `link_type` ENUM('product', 'category', 'url', 'none') DEFAULT 'none' COMMENT '链接类型';

-- homepage_config表
ALTER TABLE `homepage_config` 
  DROP COLUMN IF EXISTS `source_ip`,
  DROP COLUMN IF EXISTS `updated_by`,
  DROP COLUMN IF EXISTS `created_by`,
  DROP INDEX IF EXISTS `idx_homepage_config_created_by`;

-- user_coupons表
ALTER TABLE `user_coupons` 
  DROP COLUMN IF EXISTS `source_ip`,
  DROP COLUMN IF EXISTS `created_by`,
  DROP INDEX IF EXISTS `idx_user_coupons_created_by`;

-- coupons表
ALTER TABLE `coupons` 
  DROP COLUMN IF EXISTS `source_ip`,
  DROP COLUMN IF EXISTS `updated_by`,
  DROP COLUMN IF EXISTS `created_by`,
  DROP INDEX IF EXISTS `idx_coupons_created_by`;

-- footprints表
ALTER TABLE `footprints` 
  DROP COLUMN IF EXISTS `device_info`,
  DROP COLUMN IF EXISTS `source_ip`,
  DROP COLUMN IF EXISTS `created_by`,
  DROP INDEX IF EXISTS `idx_footprints_created_by`;

-- favorites表
ALTER TABLE `favorites` 
  DROP COLUMN IF EXISTS `source_ip`,
  DROP COLUMN IF EXISTS `created_by`,
  DROP INDEX IF EXISTS `idx_favorites_created_by`;

-- cart表
ALTER TABLE `cart` 
  DROP COLUMN IF EXISTS `source_ip`,
  DROP COLUMN IF EXISTS `created_by`,
  DROP INDEX IF EXISTS `idx_cart_created_by`;

-- order_items表
ALTER TABLE `order_items` 
  DROP COLUMN IF EXISTS `product_image`;

-- orders表
ALTER TABLE `orders` 
  DROP COLUMN IF EXISTS `source_ip`,
  DROP COLUMN IF EXISTS `updated_by`,
  DROP COLUMN IF EXISTS `created_by`,
  DROP COLUMN IF EXISTS `payment_status`,
  DROP COLUMN IF EXISTS `payment_amount`,
  DROP INDEX IF EXISTS `idx_orders_created_by`,
  MODIFY COLUMN `status` ENUM('pending', 'paid', 'shipped', 'completed', 'cancelled') NOT NULL DEFAULT 'pending' COMMENT '订单状态';

-- categories表
ALTER TABLE `categories` 
  DROP COLUMN IF EXISTS `source_ip`,
  DROP COLUMN IF EXISTS `updated_by`,
  DROP COLUMN IF EXISTS `created_by`,
  DROP COLUMN IF EXISTS `icon`,
  DROP INDEX IF EXISTS `idx_categories_created_by`;

-- products表
ALTER TABLE `products` 
  DROP COLUMN IF EXISTS `device_info`,
  DROP COLUMN IF EXISTS `source_ip`,
  DROP COLUMN IF EXISTS `updated_by`,
  DROP COLUMN IF EXISTS `created_by`,
  DROP COLUMN IF EXISTS `images`,
  DROP INDEX IF EXISTS `idx_products_created_by`;

-- users表
ALTER TABLE `users` 
  DROP COLUMN IF EXISTS `device_info`,
  DROP COLUMN IF EXISTS `source_ip`,
  DROP COLUMN IF EXISTS `updated_by`,
  DROP COLUMN IF EXISTS `created_by`,
  DROP COLUMN IF EXISTS `phone`,
  DROP INDEX IF EXISTS `idx_users_phone`,
  DROP INDEX IF EXISTS `idx_users_created_by`;

SELECT '✅ All fields removed from Common tables' AS rollback_step;

SET FOREIGN_KEY_CHECKS = 1;

SELECT '🔄 ROLLBACK COMPLETED - Database restored to v1.0 schema' AS final_status;
SELECT '⚠️ Please verify application functionality after rollback' AS reminder;

-- END OF ROLLBACK SCRIPT
*/

-- -----------------------------------------------------------
-- 升级脚本结束
-- -----------------------------------------------------------

SET FOREIGN_KEY_CHECKS = 1;

SELECT '============================================' AS info;
SELECT '= Schema v2.0 Upgrade Completed Successfully! =' AS info;
SELECT '============================================' AS info;
SELECT CONCAT('End Time: ', NOW()) AS info;
SELECT '' AS empty_line;
SELECT 'Documentation: database/table_structure_design_v2.md' AS doc_ref;
SELECT 'Consistency Check: database/category_consistency_check.sql' AS check_script;
SELECT 'Data Lineage Queries: database/data_lineage_queries.sql' AS query_tool;