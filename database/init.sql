-- ============================================================
-- 绮管后台 - 数据库初始化脚本
-- 数据库名: qmzyxcx
-- 字符集: utf8mb4
-- 引擎: InnoDB
-- 创建时间: 2026-04-08
-- ============================================================

CREATE DATABASE IF NOT EXISTS `qmzyxcx` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `qmzyxcx`;

-- ============================================================
-- 1. 分类表 (categories)
-- 用途: 存储商品分类信息，支持多级分类
-- ============================================================
DROP TABLE IF EXISTS `order_items`;
DROP TABLE IF EXISTS `orders`;
DROP TABLE IF EXISTS `products`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `categories`;

CREATE TABLE IF NOT EXISTS `categories` (
    `id` INT NOT NULL AUTO_INCREMENT COMMENT '分类ID',
    `name` VARCHAR(100) NOT NULL COMMENT '分类名称',
    `parent_id` INT DEFAULT NULL COMMENT '父分类ID',
    `sort_order` INT DEFAULT 0 COMMENT '排序顺序',
    `status` ENUM('active', 'inactive') DEFAULT 'active' COMMENT '状态: active-启用, inactive-禁用',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_categories_name` (`name`),
    KEY `idx_categories_parent` (`parent_id`),
    CONSTRAINT `fk_categories_parent` FOREIGN KEY (`parent_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品分类表';

-- ============================================================
-- 2. 商品表 (products)
-- 用途: 存储商品基本信息
-- ============================================================
CREATE TABLE IF NOT EXISTS `products` (
    `id` INT NOT NULL AUTO_INCREMENT COMMENT '商品ID',
    `name` VARCHAR(200) NOT NULL COMMENT '商品名称',
    `description` TEXT DEFAULT '' COMMENT '商品描述',
    `price` DECIMAL(10,2) NOT NULL CHECK (price >= 0) COMMENT '现价',
    `original_price` DECIMAL(10,2) DEFAULT 0.00 COMMENT '原价',
    `stock` INT DEFAULT 0 CHECK (stock >= 0) COMMENT '库存数量',
    `category_id` INT DEFAULT NULL COMMENT '所属分类ID',
    `image` VARCHAR(500) DEFAULT '' COMMENT '商品图片URL',
    `status` ENUM('active', 'inactive') DEFAULT 'active' COMMENT '状态: active-上架, inactive-下架',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    KEY `idx_products_category` (`category_id`),
    KEY `idx_products_status` (`status`),
    CONSTRAINT `fk_products_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品表';

-- ============================================================
-- 3. 用户表 (users)
-- 用途: 存储系统用户信息，包括管理员和普通用户
-- ============================================================
CREATE TABLE IF NOT EXISTS `users` (
    `id` INT NOT NULL AUTO_INCREMENT COMMENT '用户ID',
    `username` VARCHAR(50) NOT NULL COMMENT '用户名',
    `email` VARCHAR(100) NOT NULL COMMENT '邮箱',
    `password_hash` VARCHAR(255) NOT NULL COMMENT '密码哈希(bcrypt)',
    `avatar` VARCHAR(500) DEFAULT '' COMMENT '头像URL',
    `role` ENUM('user', 'admin', 'manager') DEFAULT 'user' COMMENT '角色: user-普通用户, admin-管理员, manager-运营',
    `status` ENUM('active', 'inactive', 'banned') DEFAULT 'active' COMMENT '状态: active-正常, inactive-未激活, banned-封禁',
    `last_login` DATETIME DEFAULT NULL COMMENT '最后登录时间',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_users_username` (`username`),
    UNIQUE KEY `uk_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- ============================================================
-- 4. 订单表 (orders)
-- 用途: 存储订单主信息
-- ============================================================
CREATE TABLE IF NOT EXISTS `orders` (
    `id` INT NOT NULL AUTO_INCREMENT COMMENT '订单ID',
    `order_no` VARCHAR(50) NOT NULL COMMENT '订单编号',
    `user_id` INT DEFAULT NULL COMMENT '下单用户ID',
    `customer_name` VARCHAR(100) DEFAULT NULL COMMENT '客户姓名',
    `customer_phone` VARCHAR(20) DEFAULT NULL COMMENT '客户电话',
    `total_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '订单总金额',
    `status` ENUM('pending', 'paid', 'shipped', 'completed', 'cancelled') DEFAULT 'pending' COMMENT '订单状态: pending-待支付, paid-已支付, shipped-已发货, completed-已完成, cancelled-已取消',
    `shipping_address` TEXT DEFAULT NULL COMMENT '收货地址',
    `remark` TEXT DEFAULT NULL COMMENT '备注',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_orders_order_no` (`order_no`),
    KEY `idx_orders_user` (`user_id`),
    KEY `idx_orders_status` (`status`),
    KEY `idx_orders_created` (`created_at`),
    CONSTRAINT `fk_orders_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单表';

-- ============================================================
-- 5. 订单项表 (order_items)
-- 用途: 存储订单中的具体商品明细
-- ============================================================
CREATE TABLE IF NOT EXISTS `order_items` (
    `id` INT NOT NULL AUTO_INCREMENT COMMENT '订单项ID',
    `order_id` INT NOT NULL COMMENT '关联订单ID',
    `product_id` INT NOT NULL COMMENT '关联商品ID',
    `product_name` VARCHAR(200) NOT NULL COMMENT '商品名称(快照)',
    `quantity` INT NOT NULL CHECK (quantity > 0) COMMENT '购买数量',
    `price` DECIMAL(10,2) NOT NULL CHECK (price >= 0) COMMENT '单价(快照)',
    PRIMARY KEY (`id`),
    KEY `idx_order_items_order` (`order_id`),
    KEY `idx_order_items_product` (`product_id`),
    CONSTRAINT `fk_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_order_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单明细表';

-- ============================================================
-- 种子数据 (Seed Data)
-- ============================================================

-- 插入示例分类
INSERT INTO `categories` (`name`, `parent_id`, `sort_order`, `status`) VALUES
('电子产品', NULL, 1, 'active'),
('手机数码', 1, 1, 'active'),
('电脑办公', 1, 2, 'active'),
('服装', NULL, 2, 'active'),
('男装', 4, 1, 'active'),
('女装', 4, 2, 'active'),
('食品', NULL, 3, 'active'),
('零食饮料', 7, 1, 'active'),
('生鲜果蔬', 7, 2, 'active');

-- 插入管理员用户 (username: admin, password: admin123)
-- bcrypt hash of "admin123": $2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW
INSERT INTO `users` (`username`, `email`, `password_hash`, `avatar`, `role`, `status`) VALUES
('admin', 'admin@qiguan.com', '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', '', 'admin', 'active');

-- 插入示例商品
INSERT INTO `products` (`name`, `description`, `price`, `original_price`, `stock`, `category_id`, `image`, `status`) VALUES
('iPhone 15 Pro Max', '苹果最新旗舰手机，搭载A17 Pro芯片', 9999.00, 10999.00, 100, 2, '', 'active'),
('MacBook Pro 14英寸', 'M3 Pro芯片，18GB内存，512GB存储', 14999.00, 16999.00, 50, 3, '', 'active'),
('男士休闲夹克', '春秋季新款，舒适透气面料', 299.00, 499.00, 200, 5, '', 'active'),
('女士连衣裙', '夏季新款韩版修身长裙', 199.00, 359.00, 150, 6, '', 'active'),
('进口巧克力礼盒', '比利时进口，多种口味组合', 128.00, 168.00, 300, 8, '', 'active');

-- ============================================================
-- 初始化完成
-- ============================================================
