-- ============================================================
-- 绮管电商后台 - 生产环境完整数据库Schema
-- 目标: 腾讯云TDSQL-C (MySQL 5.7+ 兼容)
-- 数据库: qmzyxcx
-- 字符集: utf8mb4
--
-- 包含:
-- 1. 基础表 (users, products, categories, orders, order_items)
-- 2. 扩展表 (cart, favorites, footprints, coupons, user_coupons)
-- 3. CMS表 (banners, homepage_config)
-- 4. 初始数据 (管理员账户、示例商品、优惠券等)
--
-- 执行方式: mysql -u QMZYXCX -p qmzyxcx < production_schema.sql
-- 创建时间: 2026-04-09
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- 删除已存在的表（确保Schema完全重建）
DROP TABLE IF EXISTS `user_coupons`;
DROP TABLE IF EXISTS `favorites`;
DROP TABLE IF EXISTS `footprints`;
DROP TABLE IF EXISTS `cart`;
DROP TABLE IF EXISTS `order_items`;
DROP TABLE IF EXISTS `orders`;
DROP TABLE IF EXISTS `coupons`;
DROP TABLE IF EXISTS `products`;
DROP TABLE IF EXISTS `categories`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `homepage_config`;
DROP TABLE IF EXISTS `banners`;

-- ============================================================
-- 1. 分类表 (categories)
-- 用途: 存储商品分类信息，支持多级分类树形结构
-- ============================================================
CREATE TABLE IF NOT EXISTS `categories` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '分类ID',
    `name` VARCHAR(100) NOT NULL COMMENT '分类名称',
    `parent_id` INT UNSIGNED DEFAULT NULL COMMENT '父分类ID (NULL表示顶级分类)',
    `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序权重 (数值越小越靠前)',
    `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active' COMMENT '状态',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_categories_name` (`name`),
    KEY `idx_categories_parent` (`parent_id`),
    KEY `idx_categories_status` (`status`),
    
    CONSTRAINT `fk_categories_parent` 
        FOREIGN KEY (`parent_id`) 
        REFERENCES `categories` (`id`) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE
) ENGINE=InnoDB 
DEFAULT CHARSET=utf8mb4 
COLLATE=utf8mb4_unicode_ci 
COMMENT='商品分类表';

-- ============================================================
-- 2. 商品表 (products)
-- 用途: 存储商品基本信息和库存
-- ============================================================
CREATE TABLE IF NOT EXISTS `products` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '商品ID',
    `name` VARCHAR(200) NOT NULL COMMENT '商品名称',
    `description` TEXT COMMENT '商品详细描述 (支持HTML)',
    `price` DECIMAL(10,2) NOT NULL COMMENT '现价',
    `original_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '原价 (用于显示折扣)',
    `stock` INT NOT NULL DEFAULT 0 COMMENT '库存数量',
    `category_id` INT UNSIGNED DEFAULT NULL COMMENT '所属分类ID',
    `image` VARCHAR(500) NOT NULL DEFAULT '' COMMENT '主图URL',
    `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active' COMMENT '商品状态 (上架/下架)',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    PRIMARY KEY (`id`),
    KEY `idx_products_category` (`category_id`),
    KEY `idx_products_status` (`status`),
    KEY `idx_products_name` (`name`(50)),
    
    CONSTRAINT `fk_products_category` 
        FOREIGN KEY (`category_id`) 
        REFERENCES `categories` (`id`) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
    
    CONSTRAINT `ck_products_price` CHECK (`price` >= 0),
    CONSTRAINT `ck_products_stock` CHECK (`stock` >= 0)
) ENGINE=InnoDB 
DEFAULT CHARSET=utf8mb4 
COLLATE=utf8mb4_unicode_ci 
COMMENT='商品表';

-- ============================================================
-- 3. 用户表 (users)
-- 用途: 存储系统用户信息 (管理员/普通用户)
-- ============================================================
CREATE TABLE IF NOT EXISTS `users` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户ID',
    `username` VARCHAR(50) NOT NULL COMMENT '用户名 (登录用)',
    `email` VARCHAR(100) NOT NULL COMMENT '邮箱地址 (唯一标识)',
    `password_hash` VARCHAR(255) NOT NULL COMMENT '密码哈希值 (bcrypt格式)',
    `avatar` VARCHAR(500) NOT NULL DEFAULT '' COMMENT '头像URL',
    `role` ENUM('user', 'admin', 'manager') NOT NULL DEFAULT 'user' COMMENT '用户角色',
    `status` ENUM('active', 'inactive', 'banned') NOT NULL DEFAULT 'active' COMMENT '账户状态',
    `last_login` DATETIME DEFAULT NULL COMMENT '最后登录时间',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_users_username` (`username`),
    UNIQUE KEY `uk_users_email` (`email`),
    KEY `users_role` (`role`),
    KEY `users_status` (`status`)
) ENGINE=InnoDB 
DEFAULT CHARSET=utf8mb4 
COLLATE=utf8mb4_unicode_ci 
COMMENT='用户表';

-- ============================================================
-- 4. 订单表 (orders)
-- 用途: 存储订单主信息
-- ============================================================
CREATE TABLE IF NOT EXISTS `orders` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '订单ID (内部使用)',
    `order_no` VARCHAR(50) NOT NULL COMMENT '订单编号 (对外展示, 唯一)',
    `user_id` INT UNSIGNED DEFAULT NULL COMMENT '下单用户ID (游客订单为NULL)',
    `customer_name` VARCHAR(100) DEFAULT NULL COMMENT '客户姓名',
    `customer_phone` VARCHAR(20) DEFAULT NULL COMMENT '客户手机号',
    `total_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '订单总金额',
    `status` ENUM('pending', 'paid', 'shipped', 'completed', 'cancelled') NOT NULL DEFAULT 'pending' COMMENT '订单状态',
    `shipping_address` TEXT DEFAULT NULL COMMENT '收货地址 (JSON或纯文本)',
    `remark` TEXT COMMENT '订单备注',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '下单时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
    
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_orders_order_no` (`order_no`),
    KEY `idx_orders_user` (`user_id`),
    KEY `idx_orders_status` (`status`),
    KEY `idx_orders_created` (`created_at`),
    KEY `idx_orders_customer_phone` (`customer_phone`),
    
    CONSTRAINT `fk_orders_user` 
        FOREIGN KEY (`user_id`) 
        REFERENCES `users` (`id`) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
    
    CONSTRAINT `ck_orders_amount` CHECK (`total_amount` >= 0)
) ENGINE=InnoDB 
DEFAULT CHARSET=utf8mb4 
COLLATE=utf8mb4_unicode_ci 
COMMENT='订单表';

-- ============================================================
-- 5. 订单项表 (order_items)
-- 用途: 存储订单中的商品明细 (快照数据)
-- ============================================================
CREATE TABLE IF NOT EXISTS `order_items` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '订单项ID',
    `order_id` INT UNSIGNED NOT NULL COMMENT '关联订单ID',
    `product_id` INT UNSIGNED NOT NULL COMMENT '关联商品ID (快照来源)',
    `product_name` VARCHAR(200) NOT NULL COMMENT '商品名称 (下单时快照)',
    `quantity` INT NOT NULL COMMENT '购买数量',
    `price` DECIMAL(10,2) NOT NULL COMMENT '单价 (下单时快照)',
    
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_order_items_order_product` (`order_id`, `product_id`),
    KEY `idx_order_items_order` (`order_id`),
    KEY `idx_order_items_product` (`product_id`),
    
    CONSTRAINT `fk_order_items_order` 
        FOREIGN KEY (`order_id`) 
        REFERENCES `orders` (`id`) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
    
    CONSTRAINT `fk_order_items_product` 
        FOREIGN KEY (`product_id`) 
        REFERENCES `products` (`id`) 
        ON DELETE RESTRICT 
        ON UPDATE CASCADE,
    
    CONSTRAINT `ck_order_items_quantity` CHECK (`quantity` > 0),
    CONSTRAINT `ck_order_items_price` CHECK (`price` >= 0)
) ENGINE=InnoDB 
DEFAULT CHARSET=utf8mb4 
COLLATE=utf8mb4_unicode_ci 
COMMENT='订单明细表';

-- ============================================================
-- 6. 购物车表 (cart)
-- 用途: 存储用户购物车商品
-- ============================================================
CREATE TABLE IF NOT EXISTS `cart` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '购物车记录ID',
    `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID',
    `product_id` INT UNSIGNED NOT NULL COMMENT '商品ID',
    `quantity` INT NOT NULL DEFAULT 1 COMMENT '数量',
    `selected` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否选中 (1-选中, 0-未选中)',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '添加时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_cart_user_product` (`user_id`, `product_id`),
    KEY `idx_cart_user` (`user_id`),
    
    CONSTRAINT `fk_cart_user` 
        FOREIGN KEY (`user_id`) 
        REFERENCES `users` (`id`) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
    
    CONSTRAINT `fk_cart_product` 
        FOREIGN KEY (`product_id`) 
        REFERENCES `products` (`id`) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
    
    CONSTRAINT `ck_cart_quantity` CHECK (`quantity` > 0)
) ENGINE=InnoDB 
DEFAULT CHARSET=utf8mb4 
COLLATE=utf8mb4_unicode_ci 
COMMENT='购物车表';

-- ============================================================
-- 7. 收藏表 (favorites)
-- 用途: 存储用户收藏的商品
-- ============================================================
CREATE TABLE IF NOT EXISTS `favorites` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '收藏记录ID',
    `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID',
    `product_id` INT UNSIGNED NOT NULL COMMENT '商品ID',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '收藏时间',
    
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_favorites_user_product` (`user_id`, `product_id`),
    KEY `idx_favorites_user` (`user_id`),
    KEY `idx_favorites_product` (`product_id`),
    
    CONSTRAINT `fk_favorites_user` 
        FOREIGN KEY (`user_id`) 
        REFERENCES `users` (`id`) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
    
    CONSTRAINT `fk_favorites_product` 
        FOREIGN KEY (`product_id`) 
        REFERENCES `products` (`id`) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE
) ENGINE=InnoDB 
DEFAULT CHARSET=utf8mb4 
COLLATE=utf8mb4_unicode_ci 
COMMENT='商品收藏表';

-- ============================================================
-- 8. 浏览足迹表 (footprints)
-- 用途: 记录用户浏览商品的历史
-- ============================================================
CREATE TABLE IF NOT EXISTS `footprints` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '足迹记录ID',
    `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID',
    `product_id` INT UNSIGNED NOT NULL COMMENT '商品ID',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '浏览时间',
    
    PRIMARY KEY (`id`),
    KEY `idx_footprints_user` (`user_id`, `created_at` DESC),
    KEY `idx_footprints_product` (`product_id`),
    
    CONSTRAINT `fk_footprints_user` 
        FOREIGN KEY (`user_id`) 
        REFERENCES `users` (`id`) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
    
    CONSTRAINT `fk_footprints_product` 
        FOREIGN KEY (`product_id`) 
        REFERENCES `products` (`id`) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE
) ENGINE=InnoDB 
DEFAULT CHARSET=utf8mb4 
COLLATE=utf8mb4_unicode_ci 
COMMENT='浏览足迹表';

-- ============================================================
-- 9. 优惠券表 (coupons)
-- 用途: 优惠券主表，管理所有优惠券信息
-- ============================================================
CREATE TABLE IF NOT EXISTS `coupons` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '优惠券ID',
    `name` VARCHAR(100) NOT NULL COMMENT '优惠券名称',
    `code` VARCHAR(50) NOT NULL COMMENT '优惠码',
    `type` ENUM('fixed', 'percent') NOT NULL DEFAULT 'fixed' COMMENT '类型: fixed固定金额, percent百分比',
    `value` DECIMAL(10,2) NOT NULL COMMENT '优惠值',
    `min_order_amount` DECIMAL(10,2) DEFAULT 0 COMMENT '最低订单金额',
    `max_discount` DECIMAL(10,2) DEFAULT NULL COMMENT '最大折扣金额(仅percent类型)',
    `stock` INT NOT NULL DEFAULT 0 COMMENT '发放总量',
    `per_user_limit` INT DEFAULT 1 COMMENT '每人限领数量',
    `used_count` INT DEFAULT 0 COMMENT '已使用数量',
    `start_time` DATETIME NOT NULL COMMENT '开始时间',
    `end_time` DATETIME NOT NULL COMMENT '结束时间',
    `status` ENUM('active', 'inactive', 'expired') DEFAULT 'active' COMMENT '状态',
    `description` TEXT COMMENT '使用说明',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_coupons_code` (`code`),
    KEY `idx_coupons_status` (`status`),
    KEY `idx_coupons_time` (`start_time`, `end_time`)
) ENGINE=InnoDB 
DEFAULT CHARSET=utf8mb4 
COLLATE=utf8mb4_unicode_ci 
COMMENT='优惠券表';

-- ============================================================
-- 10. 用户优惠券表 (user_coupons)
-- 用途: 用户领取和使用优惠券的关联表
-- ============================================================
CREATE TABLE IF NOT EXISTS `user_coupons` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录ID',
    `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID',
    `coupon_id` INT UNSIGNED NOT NULL COMMENT '优惠券ID',
    `status` ENUM('unused', 'used', 'expired') DEFAULT 'unused' COMMENT '状态',
    `order_id` INT UNSIGNED DEFAULT NULL COMMENT '使用的订单ID',
    `received_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '领取时间',
    `used_at` DATETIME DEFAULT NULL COMMENT '使用时间',
    
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_user_coupons_user_coupon` (`user_id`, `coupon_id`),
    KEY `idx_user_coupons_user_status` (`user_id`, `status`),
    
    CONSTRAINT `fk_user_coupons_user` 
        FOREIGN KEY (`user_id`) 
        REFERENCES `users` (`id`) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
    
    CONSTRAINT `fk_user_coupons_coupon` 
        FOREIGN KEY (`coupon_id`) 
        REFERENCES `coupons` (`id`) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
    
    CONSTRAINT `fk_user_coupons_order` 
        FOREIGN KEY (`order_id`) 
        REFERENCES `orders` (`id`) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE
) ENGINE=InnoDB 
DEFAULT CHARSET=utf8mb4 
COLLATE=utf8mb4_unicode_ci 
COMMENT='用户优惠券关联表';

-- ============================================================
-- 11. 轮播图表 (banners)
-- 用途: 首页轮播图管理
-- ============================================================
CREATE TABLE IF NOT EXISTS `banners` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '轮播图ID',
    `title` VARCHAR(200) DEFAULT NULL COMMENT '标题',
    `image_url` VARCHAR(500) NOT NULL COMMENT '图片URL',
    `link_url` VARCHAR(500) DEFAULT NULL COMMENT '点击跳转链接',
    `link_type` ENUM('product', 'category', 'url', 'none') DEFAULT 'none' COMMENT '链接类型',
    `position` INT DEFAULT 0 COMMENT '排序位置(越小越前)',
    `start_time` DATETIME DEFAULT NULL COMMENT '开始展示时间',
    `end_time` DATETIME DEFAULT NULL COMMENT '结束展示时间',
    `status` ENUM('active', 'inactive') DEFAULT 'active' COMMENT '状态',
    `clicks` INT DEFAULT 0 COMMENT '点击次数',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    PRIMARY KEY (`id`),
    KEY `idx_banners_position` (`position`),
    KEY `idx_banners_status` (`status`)
) ENGINE=InnoDB 
DEFAULT CHARSET=utf8mb4 
COLLATE=utf8mb4_unicode_ci 
COMMENT='首页轮播图表';

-- ============================================================
-- 12. 首页配置表 (homepage_config)
-- 用途: 首页动态配置管理
-- ============================================================
CREATE TABLE IF NOT EXISTS `homepage_config` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '配置ID',
    `config_key` VARCHAR(100) NOT NULL COMMENT '配置键',
    `config_value` TEXT COMMENT '配置值(JSON格式)',
    `description` VARCHAR(500) DEFAULT NULL COMMENT '配置说明',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_homepage_config_key` (`config_key`)
) ENGINE=InnoDB 
DEFAULT CHARSET=utf8mb4 
COLLATE=utf8mb4_unicode_ci 
COMMENT='首页配置表';

-- ============================================================
-- 初始数据 (Seed Data)
-- ============================================================

-- 插入示例分类数据
INSERT IGNORE INTO `categories` (`name`, `parent_id`, `sort_order`, `status`) VALUES
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
INSERT IGNORE INTO `users` (`username`, `email`, `password_hash`, `role`, `status`) VALUES
('admin', 'admin@qiguan.com', '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'admin', 'active');

-- 插入示例商品数据
INSERT IGNORE INTO `products` (`name`, `description`, `price`, `original_price`, `stock`, `category_id`, `status`) VALUES
('iPhone 15 Pro Max', '苹果最新旗舰手机，搭载A17 Pro芯片', 9999.00, 10999.00, 100, 2, 'active'),
('MacBook Pro 14英寸', 'M3 Pro芯片，18GB内存，512GB SSD', 14999.00, 16999.00, 50, 3, 'active'),
('男士休闲夹克', '春秋季新款，舒适透气面料', 299.00, 499.00, 200, 5, 'active'),
('女士连衣裙', '夏季新款韩版修身长裙', 199.00, 359.00, 150, 6, 'active'),
('进口巧克力礼盒', '比利时进口，多种口味组合装', 128.00, 168.00, 300, 8, 'active');

-- 插入优惠券测试数据
INSERT IGNORE INTO `coupons` (`name`, `code`, `type`, `value`, `min_order_amount`, `stock`, `per_user_limit`, `start_time`, `end_time`, `status`, `description`, `max_discount`) VALUES
('新用户专享券', 'NEWUSER2026', 'fixed', 50.00, 100.00, 1000, 1, '2026-01-01 00:00:00', '2026-12-31 23:59:59', 'active', '新用户注册即送，满100可用', NULL),
('满减大促券', 'SALE100', 'fixed', 100.00, 500.00, 500, 1, '2026-04-01 00:00:00', '2026-04-30 23:59:59', 'active', '全场通用，满500减100', NULL),
('折扣特惠券', 'DISCOUNT20', 'percent', 20.00, 200.00, 300, 1, '2026-04-10 00:00:00', '2026-05-10 23:59:59', 'active', '全场8折，最高减免200元', 200.00);

-- 插入轮播图示例数据
INSERT IGNORE INTO `banners` (`title`, `image_url`, `link_type`, `position`, `status`) VALUES
('春季新品上市', 'https://via.placeholder.com/1200x400?text=Spring+Sale', 'none', 1, 'active'),
('限时特惠', 'https://via.placeholder.com/1200x400?text=Special+Offer', 'none', 2, 'active'),
('会员专享日', 'https://via.placeholder.com/1200x400?text=VIP+Day', 'none', 3, 'active');

-- 初始化首页配置
INSERT IGNORE INTO `homepage_config` (`config_key`, `config_value`, `description`) VALUES
('recommended_products', '[1, 2]', '推荐商品ID列表(JSON数组)'),
('hot_products', '[1, 3, 5]', '热门商品ID列表(JSON数组)'),
('promotion_banner', '{"title":"限时抢购","subtitle":"全场5折起","link":""}', '促销活动配置(JSON)'),
('announcement', '欢迎使用绮梦之约电商平台！新用户注册即送50元优惠券。', '公告内容(纯文本或HTML)');

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- 验证
-- ============================================================
SELECT 
  CONCAT('✅ Schema initialization completed at ', NOW()) AS status,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='qmzyxcx' AND table_type='BASE TABLE') AS total_tables,
  CONCAT('Total tables: ', (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='qmzyxcx' AND table_type='BASE TABLE')) AS summary;
