-- ============================================================
-- 绮管后台 - MySQL/TDSQL-C 数据库初始化脚本
-- 
-- 目标数据库: TDSQL-C (腾讯云MySQL兼容)
-- 数据库名: qmzyxcx
-- 字符集: utf8mb4 (支持完整Unicode，包括emoji)
-- 引擎: InnoDB (支持事务、外键)
-- 兼容性: MySQL 5.7+ / TDSQL-C
--
-- 创建时间: 2026-04-08
-- 基于 SQLite 结构转换 (db.js initSQL)
-- ============================================================

-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS `qmzyxcx` 
DEFAULT CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `qmzyxcx`;

-- ============================================================
-- 设置会话变量 (TDSQL-C 优化)
-- ============================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- ============================================================
-- 删除已存在的表（按依赖关系逆序）
-- ============================================================
DROP TABLE IF EXISTS `order_items`;
DROP TABLE IF EXISTS `orders`;
DROP TABLE IF EXISTS `products`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `categories`;

-- ============================================================
-- 1. 分类表 (categories)
-- 对应SQLite: CREATE TABLE categories (...);
-- 用途: 存储商品分类信息，支持多级分类树形结构
-- ============================================================
CREATE TABLE `categories` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '分类ID (对应SQLite INTEGER PRIMARY KEY)',
    `name` VARCHAR(100) NOT NULL COMMENT '分类名称',
    `parent_id` INT UNSIGNED DEFAULT NULL COMMENT '父分类ID (NULL表示顶级分类)',
    `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序权重 (数值越小越靠前)',
    `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active' COMMENT '状态 (对应SQLite CHECK约束)',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间 (自动更新)',
    
    -- 主键
    PRIMARY KEY (`id`),
    
    -- 唯一约束
    UNIQUE KEY `uk_categories_name` (`name`),
    
    -- 索引
    KEY `idx_categories_parent` (`parent_id`),
    KEY `idx_categories_status` (`status`),
    
    -- 外键约束 (自引用，支持多级分类)
    CONSTRAINT `fk_categories_parent` 
        FOREIGN KEY (`parent_id`) 
        REFERENCES `categories` (`id`) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE
) ENGINE=InnoDB 
DEFAULT CHARSET=utf8mb4 
COLLATE=utf8mb4_unicode_ci 
COMMENT='商品分类表 (来自SQLite categories表)';

-- ============================================================
-- 2. 商品表 (products)
-- 对应SQLite: CREATE TABLE products (...);
-- 用途: 存储商品基本信息和库存
-- ============================================================
CREATE TABLE `products` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '商品ID',
    `name` VARCHAR(200) NOT NULL COMMENT '商品名称',
    `description` TEXT NOT NULL DEFAULT '' COMMENT '商品详细描述 (支持HTML)',
    `price` DECIMAL(10,2) NOT NULL COMMENT '现价 (对应SQLite REAL, 精确到分)',
    `original_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '原价 (用于显示折扣)',
    `stock` INT NOT NULL DEFAULT 0 COMMENT '库存数量 (对应SQLite CHECK>=0)',
    `category_id` INT UNSIGNED DEFAULT NULL COMMENT '所属分类ID',
    `image` VARCHAR(500) NOT NULL DEFAULT '' COMMENT '主图URL',
    `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active' COMMENT '商品状态 (上架/下架)',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    -- 主键
    PRIMARY KEY (`id`),
    
    -- 索引 (对应SQLite CREATE INDEX)
    KEY `idx_products_category` (`category_id`),
    KEY `idx_products_status` (`status`),
    KEY `idx_products_name` (`name`(50)),  -- 前缀索引，优化搜索性能
    
    -- 外键约束
    CONSTRAINT `fk_products_category` 
        FOREIGN KEY (`category_id`) 
        REFERENCES `categories` (`id`) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
    
    -- 检查约束 (MySQL 8.0.16+/TDSQL-C 支持)
    CONSTRAINT `ck_products_price` CHECK (`price` >= 0),
    CONSTRAINT `ck_products_stock` CHECK (`stock` >= 0)
) ENGINE=InnoDB 
DEFAULT CHARSET=utf8mb4 
COLLATE=utf8mb4_unicode_ci 
COMMENT='商品表 (来自SQLite products表)';

-- ============================================================
-- 3. 用户表 (users)
-- 对应SQLite: CREATE TABLE users (...);
-- 用途: 存储系统用户信息 (管理员/普通用户)
-- ============================================================
CREATE TABLE `users` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户ID',
    `username` VARCHAR(50) NOT NULL COMMENT '用户名 (登录用)',
    `email` VARCHAR(100) NOT NULL COMMENT '邮箱地址 (唯一标识)',
    `password_hash` VARCHAR(255) NOT NULL COMMENT '密码哈希值 (bcrypt格式)',
    `avatar` VARCHAR(500) NOT NULL DEFAULT '' COMMENT '头像URL',
    `role` ENUM('user', 'admin', 'manager') NOT NULL DEFAULT 'user' COMMENT '用户角色 (对应SQLite CHECK)',
    `status` ENUM('active', 'inactive', 'banned') NOT NULL DEFAULT 'active' COMMENT '账户状态',
    `last_login` DATETIME DEFAULT NULL COMMENT '最后登录时间 (可为空)',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    -- 主键
    PRIMARY KEY (`id`),
    
    -- 唯一约束
    UNIQUE KEY `uk_users_username` (`username`),
    UNIQUE KEY `uk_users_email` (`email`),
    
    -- 索引
    KEY `users_role` (`role`),
    KEY `users_status` (`status`)
) ENGINE=InnoDB 
DEFAULT CHARSET=utf8mb4 
COLLATE=utf8mb4_unicode_ci 
COMMENT='用户表 (来自SQLite users表)';

-- ============================================================
-- 4. 订单表 (orders)
-- 对应SQLite: CREATE TABLE orders (...);
-- 用途: 存储订单主信息
-- ============================================================
CREATE TABLE `orders` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '订单ID (内部使用)',
    `order_no` VARCHAR(50) NOT NULL COMMENT '订单编号 (对外展示, 唯一)',
    `user_id` INT UNSIGNED DEFAULT NULL COMMENT '下单用户ID (游客订单为NULL)',
    `customer_name` VARCHAR(100) DEFAULT NULL COMMENT '客户姓名',
    `customer_phone` VARCHAR(20) DEFAULT NULL COMMENT '客户手机号',
    `total_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '订单总金额 (对应SQLite REAL)',
    `status` ENUM('pending', 'paid', 'shipped', 'completed', 'cancelled') NOT NULL DEFAULT 'pending' COMMENT '订单状态 (对应SQLite CHECK)',
    `shipping_address` TEXT DEFAULT NULL COMMENT '收货地址 (JSON或纯文本)',
    `remark` TEXT NOT NULL DEFAULT '' COMMENT '订单备注',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '下单时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
    
    -- 主键
    PRIMARY KEY (`id`),
    
    -- 唯一约束
    UNIQUE KEY `uk_orders_order_no` (`order_no`),
    
    -- 索引 (对应SQLite CREATE INDEX)
    KEY `idx_orders_user` (`user_id`),
    KEY `idx_orders_status` (`status`),
    KEY `idx_orders_created` (`created_at`),
    KEY `idx_orders_customer_phone` (`customer_phone`),  -- 用于客服查询
    
    -- 外键约束
    CONSTRAINT `fk_orders_user` 
        FOREIGN KEY (`user_id`) 
        REFERENCES `users` (`id`) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
    
    -- 检查约束
    CONSTRAINT `ck_orders_amount` CHECK (`total_amount` >= 0)
) ENGINE=InnoDB 
DEFAULT CHARSET=utf8mb4 
COLLATE=utf8mb4_unicode_ci 
COMMENT='订单表 (来自SQLite orders表)';

-- ============================================================
-- 5. 订单项表 (order_items)
-- 对应SQLite: CREATE TABLE order_items (...);
-- 用途: 存储订单中的商品明细 (快照数据)
-- ============================================================
CREATE TABLE `order_items` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '订单项ID',
    `order_id` INT UNSIGNED NOT NULL COMMENT '关联订单ID',
    `product_id` INT UNSIGNED NOT NULL COMMENT '关联商品ID (快照来源)',
    `product_name` VARCHAR(200) NOT NULL COMMENT '商品名称 (下单时快照)',
    `quantity` INT NOT NULL COMMENT '购买数量 (对应SQLite CHECK>0)',
    `price` DECIMAL(10,2) NOT NULL COMMENT '单价 (下单时快照, 对应SQLite REAL)',
    
    -- 主键
    PRIMARY KEY (`id`),
    
    -- 复合唯一约束 (防止同一订单重复添加同一商品)
    UNIQUE KEY `uk_order_items_order_product` (`order_id`, `product_id`),
    
    -- 索引
    KEY `idx_order_items_order` (`order_id`),
    KEY `idx_order_items_product` (`product_id`),
    
    -- 外键约束
    CONSTRAINT `fk_order_items_order` 
        FOREIGN KEY (`order_id`) 
        REFERENCES `orders` (`id`) 
        ON DELETE CASCADE   -- 订单删除时自动删除明细
        ON UPDATE CASCADE,
    
    CONSTRAINT `fk_order_items_product` 
        FOREIGN KEY (`product_id`) 
        REFERENCES `products` (`id`) 
        ON DELETE RESTRICT  -- 商品存在关联订单时不允许删除
        ON UPDATE CASCADE,
    
    -- 检查约束
    CONSTRAINT `ck_order_items_quantity` CHECK (`quantity` > 0),
    CONSTRAINT `ck_order_items_price` CHECK (`price` >= 0)
) ENGINE=InnoDB 
DEFAULT CHARSET=utf8mb4 
COLLATE=utf8mb4_unicode_ci 
COMMENT='订单明细表 (来自SQLite order_items表)';

-- ============================================================
-- 恢复外键检查
-- ============================================================
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- 种子数据 (Seed Data) - 可选的基础数据
-- 注意: 生产环境建议通过迁移脚本导入真实数据
-- ============================================================

-- 插入示例分类数据 (与SQLite兼容的测试数据)
INSERT INTO `categories` (`name`, `parent_id`, `sort_order`, `status`) VALUES
('电子产品', NULL, 1, 'active'),
('手机数码', 1, 1, 'active'),
('电脑办公', 1, 2, 'active'),
('服装鞋帽', NULL, 2, 'active'),
('男装', 4, 1, 'active'),
('女装', 4, 2, 'active'),
('食品饮料', NULL, 3, 'active'),
('零食', 7, 1, 'active'),
('生鲜果蔬', 7, 2, 'active');

-- 插入管理员账户
-- 密码: admin123 (bcrypt hash)
INSERT INTO `users` (`username`, `email`, `password_hash`, `role`, `status`) VALUES
('admin', 'admin@qiguan.com', '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'admin', 'active');

-- 插入示例商品数据
INSERT INTO `products` (`name`, `description`, `price`, `original_price`, `stock`, `category_id`, `status`) VALUES
('iPhone 15 Pro Max', '苹果最新旗舰手机，搭载A17 Pro芯片', 9999.00, 10999.00, 100, 2, 'active'),
('MacBook Pro 14英寸', 'M3 Pro芯片，18GB内存，512GB SSD', 14999.00, 16999.00, 50, 3, 'active'),
('男士休闲夹克', '春秋季新款，舒适透气面料', 299.00, 499.00, 200, 5, 'active'),
('女士连衣裙', '夏季新款韩版修身长裙', 199.00, 359.00, 150, 6, 'active'),
('进口巧克力礼盒', '比利时进口，多种口味组合装', 128.00, 168.00, 300, 8, 'active');

-- ============================================================
-- 验证脚本执行结果
-- ============================================================
SELECT 
    '✅ 表创建完成' AS status,
    (SELECT COUNT(*) FROM `categories`) AS categories_count,
    (SELECT COUNT(*) FROM `products`) AS products_count,
    (SELECT COUNT(*) FROM `users`) AS users_count
AS verification;

-- ============================================================
-- 脚本结束
-- ============================================================
-- 使用说明:
-- 1. 在TDSQL-C控制台或MySQL客户端执行此脚本
-- 2. 或使用命令: mysql -h 10.0.0.16 -P 3306 -u QMZYXCX -p qmzyxcx < mysql_init.sql
-- 3. 执行前请确保有足够的权限 (CREATE, ALTER, INSERT)
-- 4. 建议在测试环境先验证后再部署到生产环境
-- ============================================================
