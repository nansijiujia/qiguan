# 绮管电商后台 - 数据库表结构设计 v2.0

## 文档信息
- **版本**: 2.0.0
- **创建日期**: 2026-04-10
- **目标数据库**: TDSQL-C (MySQL 5.7+ 兼容)
- **字符集**: utf8mb4
- **作者**: AI Assistant

---

## 目录
1. [设计目标与原则](#1-设计目标与原则)
2. [表分类体系](#2-表分类体系)
3. [系统标识字段标准](#3-系统标识字段标准)
4. [详细表结构定义](#4-详细表结构定义)
5. [ER关系图（文字版）](#5-er关系图文字版)
6. [索引设计原则](#6-索引设计原则)
7. [命名规范说明](#7-命名规范说明)
8. [设计决策与依据](#8-设计决策与依据)
9. [性能影响评估](#9-性能影响评估)
10. [扩展性考虑](#10-扩展性考虑)
11. [兼容性分析](#11-兼容性分析)
12. [迁移指南](#12-迁移指南)

---

## 1. 设计目标与原则

### 1.1 核心目标
1. **数据清晰划分**: 明确区分后台管理系统和小程序端的数据访问边界
2. **完整溯源能力**: 每条记录都能追溯到创建来源、修改历史和操作者
3. **向后兼容**: 平滑升级现有v1.0 schema，不破坏现有功能
4. **高性能**: 最小化存储开销和查询性能影响
5. **可维护性**: 清晰的命名规范和完善的注释

### 1.2 设计原则
- **最小侵入**: 仅添加必要的标识字段，避免过度设计
- **统一标准**: 所有表使用相同的标识字段模板
- **灵活分类**: 支持Common/Backend/Mini-program三层分类
- **审计就绪**: 满足未来合规性和审计需求

---

## 2. 表分类体系

### 2.1 三层分类模型

```
┌─────────────────────────────────────────────────────────────┐
│                    数据库: qmzyxcx                          │
├──────────────┬──────────────────┬──────────────────────────┤
│   Common     │  Backend-Specific│  Mini-program Specific   │
│  (共用表)    │   (后台专用)      │    (小程序专用)          │
├──────────────┼──────────────────┼──────────────────────────┤
│ users        │ admin_logs       │ mp_user_profiles         │
│ products     │ system_config    │ mp_browsing_history      │
│ categories   │ banners          │ mp_shopping_cart         │
│ orders       │ announcements    │ mp_favorites             │
│ order_items  │                  │ mp_footprints            │
│ cart         │                  │                          │
│ favorites    │                  │                          │
│ footprints   │                  │                          │
│ coupons      │                  │                          │
│ user_coupons │                  │                          │
│ homepage_    │                  │                          │
│ config       │                  │                          │
└──────────────┴──────────────────┴──────────────────────────┘
```

### 2.2 分类详细说明

#### A. Common Tables (共用表) - 10张
**特征**:
- 后台和小程序都需要读写
- 包含核心业务数据
- 需要完整的数据溯源
- 所有操作都会被记录来源

**包含表**:
| 表名 | 说明 | 主要使用者 |
|------|------|-----------|
| users | 用户基础信息（认证+角色） | Both |
| products | 商品核心数据 | Backend(写), MP(读) |
| categories | 分类数据 | Backend(写), MP(读) |
| orders | 订单主数据 | Both |
| order_items | 订单明细 | Both |
| cart | 购物车 | Both |
| favorites | 收藏夹 | Both |
| footprints | 浏览足迹 | MP(写), Backend(读) |
| coupons | 优惠券配置 | Backend(写), MP(读) |
| user_coupons | 用户优惠券 | Both |
| homepage_config | 首页配置 | Backend(写), MP(读) |

#### B. Backend-Specific Tables (后台专用) - 3张
**特征**:
- 仅后台管理系统使用
- 管理员操作产生
- 审计和监控用途
- 小程序端不可见

**包含表**:
| 表名 | 说明 | 用途 |
|------|------|------|
| admin_logs | 管理员操作日志 | 操作审计 |
| system_config | 系统配置 | 全局设置管理 |
| banners | 轮播图管理 | CMS内容管理 |
| announcements | 公告管理 | 通知发布 |

#### C. Mini-program Specific Tables (小程序专用) - 5张
**特征**:
- 仅小程序端使用或产生
- 用户行为数据
- 个性化功能
- 可独立于后台运行

**包含表**:
| 表名 | 说明 | 用途 |
|------|------|------|
| mp_user_profiles | 用户扩展信息 | 微信授权信息 |
| mp_browsing_history | 详细浏览历史 | 行为分析 |
| mp_shopping_cart | 小程序购物车 | 购物车状态同步 |
| mp_favorites | 收藏视图 | 收藏管理增强 |
| mp_footprints | 增强足迹 | 多类型行为追踪 |

---

## 3. 系统标识字段标准

### 3.1 统一标识字段模板

所有 **Common Tables** 必须包含以下标准化字段：

```sql
-- ============================================
-- 系统标识字段模板（适用于所有Common Tables）
-- ============================================

-- 操作来源标识
created_by ENUM('backend', 'miniprogram', 'system', 'migration') 
          DEFAULT 'system' 
          COMMENT '数据创建来源: backend=后台管理, miniprogram=小程序用户, system=系统自动, migration=数据迁移',

-- 创建时间戳
created_at DATETIME DEFAULT CURRENT_TIMESTAMP 
           COMMENT '创建时间',

-- 最后更新来源
updated_by ENUM('backend', 'miniprogram', 'system', 'migration') 
          COMMENT '最后更新来源',

-- 最后更新时间戳  
updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP 
           COMMENT '最后更新时间',

-- 操作来源IP地址
source_ip VARCHAR(45) DEFAULT NULL 
         COMMENT '操作者IP地址（IPv4/IPv6）',

-- 设备信息（可选，小程序端常用）
device_info JSON DEFAULT NULL 
            COMMENT '设备信息JSON（平台/型号/版本等）',
            
-- 软删除标志（可选）
is_deleted TINYINT(1) DEFAULT 0 
           COMMENT '软删除: 0=正常, 1=已删除',

-- 删除时间（可选）
deleted_at DATETIME DEFAULT NULL 
           COMMENT '删除时间'
```

### 3.2 字段选择依据

| 字段名 | 类型 | 是否必选 | 选择理由 |
|--------|------|---------|---------|
| created_by | ENUM | ✅ 必须 | 区分数据来源，支持统计分析 |
| created_at | DATETIME | ✅ 必须 | 时间线追溯基础 |
| updated_by | ENUM | ✅ 必须 | 追踪最后修改者 |
| updated_at | DATETIME | ✅ 必须 | 缓存失效和数据新鲜度判断 |
| source_ip | VARCHAR(45) | ✅ 推荐 | 安全审计、防刷、地域分析 |
| device_info | JSON | ⚪ 可选 | 小程序端设备指纹、AB测试 |
| is_deleted | TINYINT(1) | ⚪ 可选 | 软删除，保留历史数据 |
| deleted_at | DATETIME | ⚪ 可选 | 配合软删除使用 |

### 3.3 枚举值定义

**created_by / updated_by 枚举值**:

| 值 | 含义 | 使用场景 | 示例 |
|----|------|---------|------|
| backend | 后台管理员操作 | 商品上架、订单处理、分类编辑 | Admin通过Web界面创建商品 |
| miniprogram | 小程序用户操作 | 下单、收藏、浏览、注册 | 用户在小程序下单 |
| system | 系统自动生成 | 定时任务、自动过期、库存扣减 | 优惠券到期自动失效 |
| migration | 数据迁移导入 | 从旧系统导入、批量初始化 | 从SQLite迁移到MySQL的历史数据 |

---

## 4. 详细表结构定义

### 4.1 Common Tables 定义

#### 4.1.1 users (用户表)
```sql
CREATE TABLE IF NOT EXISTS `users` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户ID',
    `username` VARCHAR(50) NOT NULL COMMENT '用户名 (登录用)',
    `email` VARCHAR(100) NOT NULL COMMENT '邮箱地址 (唯一标识)',
    `password_hash` VARCHAR(255) NOT NULL COMMENT '密码哈希值 (bcrypt格式)',
    `phone` VARCHAR(20) DEFAULT NULL COMMENT '手机号 (小程序登录用)',
    `avatar` VARCHAR(500) NOT NULL DEFAULT '' COMMENT '头像URL',
    `role` ENUM('user', 'admin', 'manager', 'merchant') NOT NULL DEFAULT 'user' COMMENT '用户角色',
    `status` ENUM('active', 'inactive', 'banned') NOT NULL DEFAULT 'active' COMMENT '账户状态',
    `last_login` DATETIME DEFAULT NULL COMMENT '最后登录时间',
    
    -- 系统标识字段 (v2.0新增)
    `created_by` ENUM('backend','miniprogram','system','migration') DEFAULT 'system' COMMENT '数据创建来源',
    `updated_by` ENUM('backend','miniprogram','system','migration') COMMENT '最后更新来源',
    `source_ip` VARCHAR(45) DEFAULT NULL COMMENT '操作者IP地址',
    `device_info` JSON DEFAULT NULL COMMENT '设备信息',
    
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_users_username` (`username`),
    UNIQUE KEY `uk_users_email` (`email`),
    UNIQUE KEY `uk_users_phone` (`phone`),
    KEY `idx_users_role` (`role`),
    KEY `idx_users_status` (`status`),
    KEY `idx_users_created_by` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表 (v2.0 - 含溯源字段)';
```

**变更说明**:
- 新增: `phone` 字段（支持手机号登录）
- 新增: `role` 增加 `merchant` 选项（商家角色）
- 新增: `created_by`, `updated_by`, `source_ip`, `device_info` 标识字段

---

#### 4.1.2 products (商品表)
```sql
CREATE TABLE IF NOT EXISTS `products` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '商品ID',
    `name` VARCHAR(200) NOT NULL COMMENT '商品名称',
    `description` TEXT NOT NULL DEFAULT '' COMMENT '商品详细描述 (支持HTML)',
    `price` DECIMAL(10,2) NOT NULL COMMENT '现价',
    `original_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '原价 (用于显示折扣)',
    `stock` INT NOT NULL DEFAULT 0 COMMENT '库存数量',
    `category_id` INT UNSIGNED DEFAULT NULL COMMENT '所属分类ID',
    `image` VARCHAR(500) NOT NULL DEFAULT '' COMMENT '主图URL',
    `images` JSON DEFAULT NULL COMMENT '多图URL数组JSON',
    `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active' COMMENT '商品状态 (上架/下架)',
    
    -- 系统标识字段 (v2.0新增)
    `created_by` ENUM('backend','miniprogram','system','migration') DEFAULT 'system' COMMENT '数据创建来源',
    `updated_by` ENUM('backend','miniprogram','system','migration') COMMENT '最后更新来源',
    `source_ip` VARCHAR(45) DEFAULT NULL COMMENT '操作者IP地址',
    `device_info` JSON DEFAULT NULL COMMENT '设备信息',
    
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    PRIMARY KEY (`id`),
    KEY `idx_products_category` (`category_id`),
    KEY `idx_products_status` (`status`),
    KEY `idx_products_name` (`name`(50)),
    KEY `idx_products_created_by` (`created_by`),
    
    CONSTRAINT `fk_products_category` 
        FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) 
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `ck_products_price` CHECK (`price` >= 0),
    CONSTRAINT `ck_products_stock` CHECK (`stock` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品表 (v2.0 - 含溯源字段)';
```

**变更说明**:
- 新增: `images` JSON字段（支持多图）
- 新增: 完整的系统标识字段集

---

#### 4.1.3 categories (分类表)
```sql
CREATE TABLE IF NOT EXISTS `categories` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '分类ID',
    `name` VARCHAR(100) NOT NULL COMMENT '分类名称',
    `parent_id` INT UNSIGNED DEFAULT NULL COMMENT '父分类ID (NULL表示顶级分类)',
    `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序权重 (数值越小越靠前)',
    `icon` VARCHAR(200) DEFAULT NULL COMMENT '分类图标URL',
    `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active' COMMENT '状态',
    
    -- 系统标识字段 (v2.0新增)
    `created_by` ENUM('backend','miniprogram','system','migration') DEFAULT 'system' COMMENT '数据创建来源',
    `updated_by` ENUM('backend','miniprogram','system','migration') COMMENT '最后更新来源',
    `source_ip` VARCHAR(45) DEFAULT NULL COMMENT '操作者IP地址',
    
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_categories_name` (`name`),
    KEY `idx_categories_parent` (`parent_id`),
    KEY `idx_categories_status` (`status`),
    KEY `idx_categories_created_by` (`created_by`),
    
    CONSTRAINT `fk_categories_parent` 
        FOREIGN KEY (`parent_id`) REFERENCES `categories` (`id`) 
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品分类表 (v2.0 - 含溯源字段)';
```

**变更说明**:
- 新增: `icon` 字段（分类图标）
- 新增: 系统标识字段（不含device_info，分类不需要）

---

#### 4.1.4 orders (订单表)
```sql
CREATE TABLE IF NOT EXISTS `orders` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '订单ID (内部使用)',
    `order_no` VARCHAR(50) NOT NULL COMMENT '订单编号 (对外展示, 唯一)',
    `user_id` INT UNSIGNED DEFAULT NULL COMMENT '下单用户ID (游客订单为NULL)',
    `customer_name` VARCHAR(100) DEFAULT NULL COMMENT '客户姓名',
    `customer_phone` VARCHAR(20) DEFAULT NULL COMMENT '客户手机号',
    `total_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '订单总金额',
    `payment_amount` DECIMAL(10,2) DEFAULT NULL COMMENT '实际支付金额',
    `status` ENUM('pending', 'paid', 'shipped', 'completed', 'cancelled', 'refunded') NOT NULL DEFAULT 'pending' COMMENT '订单状态',
    `payment_status` ENUM('unpaid', 'paid', 'refunding', 'refunded') DEFAULT 'unpaid' COMMENT '支付状态',
    `shipping_address` JSON DEFAULT NULL COMMENT '收货地址JSON',
    `remark` TEXT NOT NULL DEFAULT '' COMMENT '订单备注',
    
    -- 系统标识字段 (v2.0新增)
    `created_by` ENUM('backend','miniprogram','system','migration') DEFAULT 'miniprogram' COMMENT '数据创建来源',
    `updated_by` ENUM('backend','miniprogram','system','migration') COMMENT '最后更新来源',
    `source_ip` VARCHAR(45) DEFAULT NULL COMMENT '操作者IP地址',
    
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '下单时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
    
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_orders_order_no` (`order_no`),
    KEY `idx_orders_user` (`user_id`),
    KEY `idx_orders_status` (`status`),
    KEY `idx_orders_created` (`created_at`),
    KEY `idx_orders_customer_phone` (`customer_phone`),
    KEY `idx_orders_created_by` (`created_by`),
    
    CONSTRAINT `fk_orders_user` 
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) 
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `ck_orders_amount` CHECK (`total_amount` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单表 (v2.0 - 含溯源字段)';
```

**变更说明**:
- 新增: `payment_amount` 字段（实际支付金额）
- 新增: `payment_status` 字段（支付状态细分）
- 新增: `shipping_address` 改为JSON格式
- 新增: `status` 增加 `refunded` 选项
- 新增: 完整的系统标识字段集
- 默认 `created_by` 为 `'miniprogram'`（订单通常由用户下单创建）

---

#### 4.1.5 order_items (订单项表)
```sql
CREATE TABLE IF NOT EXISTS `order_items` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '订单项ID',
    `order_id` INT UNSIGNED NOT NULL COMMENT '关联订单ID',
    `product_id` INT UNSIGNED NOT NULL COMMENT '关联商品ID (快照来源)',
    `product_name` VARCHAR(200) NOT NULL COMMENT '商品名称 (下单时快照)',
    `product_image` VARCHAR(500) DEFAULT NULL COMMENT '商品图片 (下单时快照)',
    `quantity` INT NOT NULL COMMENT '购买数量',
    `price` DECIMAL(10,2) NOT NULL COMMENT '单价 (下单时快照)',
    
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_order_items_order_product` (`order_id`, `product_id`),
    KEY `idx_order_items_order` (`order_id`),
    KEY `idx_order_items_product` (`product_id`),
    
    CONSTRAINT `fk_order_items_order` 
        FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_order_items_product` 
        FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) 
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `ck_order_items_quantity` CHECK (`quantity` > 0),
    CONSTRAINT `ck_order_items_price` CHECK (`price` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单明细表 (v2.0)';
```

**变更说明**:
- 新增: `product_image` 快照字段（显示订单详情时无需再查products表）

---

#### 4.1.6 cart (购物车表)
```sql
CREATE TABLE IF NOT EXISTS `cart` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '购物车记录ID',
    `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID',
    `product_id` INT UNSIGNED NOT NULL COMMENT '商品ID',
    `quantity` INT NOT NULL DEFAULT 1 COMMENT '数量',
    `selected` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否选中 (1-选中, 0-未选中)',
    
    -- 系统标识字段 (v2.0新增)
    `created_by` ENUM('backend','miniprogram','system','migration') DEFAULT 'miniprogram' COMMENT '数据创建来源',
    `source_ip` VARCHAR(45) DEFAULT NULL COMMENT '操作者IP地址',
    
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '添加时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_cart_user_product` (`user_id`, `product_id`),
    KEY `idx_cart_user` (`user_id`),
    KEY `idx_cart_created_by` (`created_by`),
    
    CONSTRAINT `fk_cart_user` 
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_cart_product` 
        FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `ck_cart_quantity` CHECK (`quantity` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='购物车表 (v2.0 - 含溯源字段)';
```

---

#### 4.1.7 favorites (收藏表)
```sql
CREATE TABLE IF NOT EXISTS `favorites` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '收藏记录ID',
    `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID',
    `product_id` INT UNSIGNED NOT NULL COMMENT '商品ID',
    
    -- 系统标识字段 (v2.0新增)
    `created_by` ENUM('backend','miniprogram','system','migration') DEFAULT 'miniprogram' COMMENT '数据创建来源',
    `source_ip` VARCHAR(45) DEFAULT NULL COMMENT '操作者IP地址',
    
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '收藏时间',
    
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_favorites_user_product` (`user_id`, `product_id`),
    KEY `idx_favorites_user` (`user_id`),
    KEY `idx_favorites_product` (`product_id`),
    KEY `idx_favorites_created_by` (`created_by`),
    
    CONSTRAINT `fk_favorites_user` 
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_favorites_product` 
        FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) 
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品收藏表 (v2.0 - 含溯源字段)';
```

---

#### 4.1.8 footprints (浏览足迹表)
```sql
CREATE TABLE IF NOT EXISTS `footprints` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '足迹记录ID',
    `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID',
    `product_id` INT UNSIGNED NOT NULL COMMENT '商品ID',
    
    -- 系统标识字段 (v2.0新增)
    `created_by` ENUM('backend','miniprogram','system','migration') DEFAULT 'miniprogram' COMMENT '数据创建来源',
    `source_ip` VARCHAR(45) DEFAULT NULL COMMENT '操作者IP地址',
    `device_info` JSON DEFAULT NULL COMMENT '设备信息',
    
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '浏览时间',
    
    PRIMARY KEY (`id`),
    KEY `idx_footprints_user` (`user_id`, `created_at` DESC),
    KEY `idx_footprints_product` (`product_id`),
    KEY `idx_footprints_created_by` (`created_by`),
    
    CONSTRAINT `fk_footprints_user` 
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_footprints_product` 
        FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) 
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='浏览足迹表 (v2.0 - 含溯源字段)';
```

---

#### 4.1.9 coupons (优惠券表)
```sql
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
    
    -- 系统标识字段 (v2.0新增)
    `created_by` ENUM('backend','miniprogram','system','migration') DEFAULT 'backend' COMMENT '数据创建来源',
    `updated_by` ENUM('backend','miniprogram','system','migration') COMMENT '最后更新来源',
    `source_ip` VARCHAR(45) DEFAULT NULL COMMENT '操作者IP地址',
    
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_coupons_code` (`code`),
    KEY `idx_coupons_status` (`status`),
    KEY `idx_coupons_time` (`start_time`, `end_time`),
    KEY `idx_coupons_created_by` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='优惠券表 (v2.0 - 含溯源字段)';
```
**默认值说明**: 优惠券通常由后台管理员创建，所以 `created_by` 默认为 `'backend'`

---

#### 4.1.10 user_coupons (用户优惠券表)
```sql
CREATE TABLE IF NOT EXISTS `user_coupons` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录ID',
    `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID',
    `coupon_id` INT UNSIGNED NOT NULL COMMENT '优惠券ID',
    `status` ENUM('unused', 'used', 'expired') DEFAULT 'unused' COMMENT '状态',
    `order_id` INT UNSIGNED DEFAULT NULL COMMENT '使用的订单ID',
    
    -- 系统标识字段 (v2.0新增)
    `created_by` ENUM('backend','miniprogram','system','migration') DEFAULT 'miniprogram' COMMENT '数据创建来源 (领取动作)',
    `source_ip` VARCHAR(45) DEFAULT NULL COMMENT '操作者IP地址',
    
    `received_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '领取时间',
    `used_at` DATETIME DEFAULT NULL COMMENT '使用时间',
    
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_user_coupons_user_coupon` (`user_id`, `coupon_id`),
    KEY `idx_user_coupons_user_status` (`user_id`, `status`),
    KEY `idx_user_coupons_created_by` (`created_by`),
    
    CONSTRAINT `fk_user_coupons_user` 
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_user_coupons_coupon` 
        FOREIGN KEY (`coupon_id`) REFERENCES `coupons` (`id`) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_user_coupons_order` 
        FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) 
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户优惠券关联表 (v2.0 - 含溯源字段)';
```

---

#### 4.1.11 homepage_config (首页配置表)
```sql
CREATE TABLE IF NOT EXISTS `homepage_config` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '配置ID',
    `config_key` VARCHAR(100) NOT NULL COMMENT '配置键',
    `config_value` TEXT COMMENT '配置值(JSON格式)',
    `description` VARCHAR(500) DEFAULT NULL COMMENT '配置说明',
    
    -- 系统标识字段 (v2.0新增)
    `created_by` ENUM('backend','miniprogram','system','migration') DEFAULT 'backend' COMMENT '数据创建来源',
    `updated_by` ENUM('backend','miniprogram','system','migration') COMMENT '最后更新来源',
    `source_ip` VARCHAR(45) DEFAULT NULL COMMENT '操作者IP地址',
    
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_homepage_config_key` (`config_key`),
    KEY `idx_homepage_config_created_by` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='首页配置表 (v2.0 - 含溯源字段)';
```

---

### 4.2 Backend-Specific Tables 定义

#### 4.2.1 admin_logs (管理员操作日志表)
```sql
CREATE TABLE IF NOT EXISTS `admin_logs` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '日志ID',
    `admin_id` INT UNSIGNED NOT NULL COMMENT '管理员用户ID',
    `action` VARCHAR(50) NOT NULL COMMENT '操作类型: create/update/delete/login/logout/config_change',
    `target_type` VARCHAR(50) COMMENT '目标对象类型: user/product/order/category/coupon/banner/system',
    `target_id` INT UNSIGNED COMMENT '目标对象ID',
    `details` JSON COMMENT '操作详情（变更前后对比）',
    `ip_address` VARCHAR(45) COMMENT '管理员IP',
    `user_agent` VARCHAR(255) COMMENT '浏览器UA',
    `request_method` VARCHAR(10) COMMENT 'HTTP方法: GET/POST/PUT/DELETE',
    `request_path` VARCHAR(255) COMMENT '请求路径',
    `response_status` SMALLINT COMMENT 'HTTP响应状态码',
    `execution_time_ms` INT COMMENT '执行耗时(毫秒)',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
    
    PRIMARY KEY (`id`),
    KEY `idx_admin_logs_admin_id` (`admin_id`),
    KEY `idx_admin_logs_action` (`action`),
    KEY `idx_admin_logs_target` (`target_type`, `target_id`),
    KEY `idx_admin_logs_created_at` (`created_at`),
    KEY `idx_admin_logs_ip` (`ip_address`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='管理员操作日志表 (v2.0 新建)';
```

**设计要点**:
- 记录所有后台管理员的CRUD操作
- `details` 使用JSON存储变更前后对比
- 记录性能指标（执行时间）
- 不需要 `updated_by` 等字段（日志一旦写入不修改）

---

#### 4.2.2 system_config (系统配置表)
```sql
CREATE TABLE IF NOT EXISTS `system_config` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '配置ID',
    `config_key` VARCHAR(100) NOT NULL COMMENT '配置键 (唯一)',
    `config_value` TEXT COMMENT '配置值 (支持JSON/文本/数字)',
    `config_group` VARCHAR(50) DEFAULT 'general' COMMENT '配置分组: general/payment/shipping/email/security/seo',
    `config_type` ENUM('string', 'number', 'boolean', 'json', 'text') DEFAULT 'string' COMMENT '值类型',
    `description` VARCHAR(500) DEFAULT NULL COMMENT '配置说明',
    `is_public` TINYINT(1) DEFAULT 0 COMMENT '是否公开 (1=前端可见, 0=仅后台)',
    `is_editable` TINYINT(1) DEFAULT 1 COMMENT '是否可编辑 (1=可编辑, 0=只读)',
    `sort_order` INT DEFAULT 0 COMMENT '排序权重',
    
    -- 系统标识字段
    `created_by` ENUM('backend','miniprogram','system','migration') DEFAULT 'system' COMMENT '创建来源',
    `updated_by` ENUM('backend','miniprogram','system','migration') COMMENT '最后更新来源',
    `source_ip` VARCHAR(45) DEFAULT NULL COMMENT '操作者IP',
    
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_system_config_key` (`config_key`),
    KEY `idx_system_config_group` (`config_group`),
    KEY `idx_system_config_public` (`is_public`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统全局配置表 (v2.0 新建)';
```

**设计要点**:
- 替代硬编码配置，实现动态配置管理
- 支持 `config_type` 自动类型转换
- `is_public` 控制是否暴露给小程序API
- `config_group` 方便分组管理

---

#### 4.2.3 banners (轮播图表 - 升级版)
```sql
CREATE TABLE IF NOT EXISTS `banners` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '轮播图ID',
    `title` VARCHAR(200) DEFAULT NULL COMMENT '标题',
    `subtitle` VARCHAR(200) DEFAULT NULL COMMENT '副标题',
    `image_url` VARCHAR(500) NOT NULL COMMENT '图片URL',
    `mobile_image_url` VARCHAR(500) DEFAULT NULL COMMENT '移动端图片URL (可选)',
    `link_url` VARCHAR(500) DEFAULT NULL COMMENT '点击跳转链接',
    `link_type` ENUM('product', 'category', 'url', 'none', 'activity') DEFAULT 'none' COMMENT '链接类型',
    `position` INT DEFAULT 0 COMMENT '排序位置(越小越前)',
    `start_time` DATETIME DEFAULT NULL COMMENT '开始展示时间',
    `end_time` DATETIME DEFAULT NULL COMMENT '结束展示时间',
    `status` ENUM('active', 'inactive') DEFAULT 'active' COMMENT '状态',
    `clicks` INT DEFAULT 0 COMMENT '点击次数',
    `impressions` INT DEFAULT 0 COMMENT '展示次数',
    
    -- 系统标识字段 (v2.0新增)
    `created_by` ENUM('backend','miniprogram','system','migration') DEFAULT 'backend' COMMENT '创建来源',
    `updated_by` ENUM('backend','miniprogram','system','migration') COMMENT '最后更新来源',
    `source_ip` VARCHAR(45) DEFAULT NULL COMMENT '操作者IP',
    
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    PRIMARY KEY (`id`),
    KEY `idx_banners_position` (`position`),
    KEY `idx_banners_status` (`status`),
    KEY `idx_banners_time` (`start_time`, `end_time`),
    KEY `idx_banners_created_by` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='首页轮播图表 (v2.0 升级)';
```

**变更说明**:
- 新增: `subtitle` 字段
- 新增: `mobile_image_url` 字段（响应式设计）
- 新增: `impressions` 字段（展示统计）
- 新增: `link_type` 增加 `activity` 选项
- 新增: 系统标识字段

---

#### 4.2.4 announcements (公告管理表)
```sql
CREATE TABLE IF NOT EXISTS `announcements` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '公告ID',
    `title` VARCHAR(200) NOT NULL COMMENT '公告标题',
    `content` TEXT NOT NULL COMMENT '公告内容 (支持HTML)',
    `type` ENUM('notice', 'activity', 'maintenance', 'urgent') DEFAULT 'notice' COMMENT '公告类型',
    `is_top` TINYINT(1) DEFAULT 0 COMMENT '是否置顶 (1-置顶, 0-普通)',
    `status` ENUM('draft', 'published', 'archived') DEFAULT 'draft' COMMENT '状态',
    `published_at` DATETIME DEFAULT NULL COMMENT '发布时间',
    `expire_at` DATETIME DEFAULT NULL COMMENT '过期时间',
    `view_count` INT DEFAULT 0 COMMENT '阅读次数',
    
    -- 系统标识字段
    `created_by` ENUM('backend','miniprogram','system','migration') DEFAULT 'backend' COMMENT '创建来源',
    `updated_by` ENUM('backend','miniprogram','system','migration') COMMENT '最后更新来源',
    `source_ip` VARCHAR(45) DEFAULT NULL COMMENT '操作者IP',
    
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    PRIMARY KEY (`id`),
    KEY `idx_announcements_status` (`status`),
    KEY `idx_announcements_type` (`type`),
    KEY `idx_announcements_top` (`is_top`, `published_at` DESC),
    KEY `idx_announcements_time` (`published_at`, `expire_at`),
    KEY `idx_announcements_created_by` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='公告管理表 (v2.0 新建)';
```

---

### 4.3 Mini-program Specific Tables 定义

#### 4.3.1 mp_user_profiles (小程序用户扩展信息表)
```sql
CREATE TABLE IF NOT EXISTS `mp_user_profiles` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录ID',
    `user_id` INT UNSIGNED NOT NULL COMMENT '关联用户ID (唯一)',
    `openid` VARCHAR(100) DEFAULT NULL COMMENT '微信OpenID',
    `unionid` VARCHAR(100) DEFAULT NULL COMMENT '微信UnionID (跨应用唯一)',
    `nickname` VARCHAR(100) COMMENT '微信昵称',
    `avatar_url` VARCHAR(500) COMMENT '微信头像URL',
    `gender` TINYINT DEFAULT 0 COMMENT '性别: 0=未知, 1=男, 2=女',
    `city` VARCHAR(50) COMMENT '城市',
    `province` VARCHAR(50) COMMENT '省份',
    `country` VARCHAR(50) COMMENT '国家',
    `language` VARCHAR(20) COMMENT '语言',
    `last_login_time` DATETIME DEFAULT NULL COMMENT '最后登录时间',
    `login_count` INT DEFAULT 0 COMMENT '累计登录次数',
    `session_key` VARCHAR(100) DEFAULT NULL COMMENT '会话密钥 (加密存储)',
    
    -- 设备信息
    `device_info` JSON DEFAULT NULL COMMENT '设备信息JSON',
    `source_ip` VARCHAR(45) DEFAULT NULL COMMENT '最近登录IP',
    
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '首次授权时间',
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_mp_user_profiles_user_id` (`user_id`),
    UNIQUE KEY `uk_mp_user_profiles_openid` (`openid`),
    UNIQUE KEY `uk_mp_user_profiles_unionid` (`unionid`),
    KEY `idx_mp_user_profiles_last_login` (`last_login_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='小程序用户扩展信息表 (v2.0 新建)';
```

**设计要点**:
- 与 `users` 表1:1关系，存储微信特有信息
- `openid` 和 `unionid` 用于微信生态集成
- `session_key` 敏感信息需加密存储
- 登录统计用于用户活跃度分析

---

#### 4.3.2 mp_browsing_history (详细浏览历史表)
```sql
CREATE TABLE IF NOT EXISTS `mp_browsing_history` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录ID',
    `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID',
    `product_id` INT UNSIGNED NOT NULL COMMENT '商品ID',
    `viewed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '浏览时间',
    `session_id` VARCHAR(64) DEFAULT NULL COMMENT '会话ID (用于分析用户会话)',
    `duration_seconds` INT DEFAULT NULL COMMENT '停留时长(秒, 估算值)',
    `entry_source` ENUM('search', 'recommendation', 'category', 'homepage', 'share', 'other') DEFAULT 'other' COMMENT '入口来源',
    `scroll_depth` TINYINT DEFAULT NULL COMMENT '滚动深度百分比 (0-100)',
    
    PRIMARY KEY (`id`),
    KEY `idx_mp_browsing_history_user_time` (`user_id`, `viewed_at` DESC),
    KEY `idx_mp_browsing_history_product` (`product_id`),
    KEY `idx_mp_browsing_history_session` (`session_id`),
    KEY `idx_mp_browsing_history_entry` (`entry_source`),
    
    CONSTRAINT `fk_mp_browsing_history_user` 
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_mp_browsing_history_product` 
        FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) 
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='小程序详细浏览历史表 (v2.0 新建)';
```

**设计要点**:
- 比 `footprints` 更详细的浏览数据
- 支持会话分析和用户路径追踪
- `duration_seconds` 和 `scroll_depth` 用于用户体验优化
- 高频写入表，考虑定期归档到冷存储

---

#### 4.3.3 mp_shopping_cart (小程序专用购物车表)
```sql
CREATE TABLE IF NOT EXISTS `mp_shopping_cart` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录ID',
    `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID',
    `product_id` INT UNSIGNED NOT NULL COMMENT '商品ID',
    `quantity` INT NOT NULL DEFAULT 1 COMMENT '数量',
    `selected` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否选中',
    `sku_id` INT UNSIGNED DEFAULT NULL COMMENT 'SKU ID (预留, 未来规格支持)',
    `added_from` ENUM('detail_page', 'list_page', 'recommendation', 'cart_share') DEFAULT 'detail_page' COMMENT '添加来源',
    `source_ip` VARCHAR(45) DEFAULT NULL COMMENT '操作IP',
    
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='小程序购物车表 (v2.0 新建)';
```

**设计要点**:
- 与通用 `cart` 表结构类似但增加小程序特有字段
- `added_from` 用于分析用户加购行为
- `sku_id` 预留SKU支持
- 可与 `cart` 表保持同步或独立使用

---

#### 4.3.4 mp_favorites (小程序收藏视图表)
```sql
CREATE TABLE IF NOT EXISTS `mp_favorites` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录ID',
    `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID',
    `product_id` INT UNSIGNED NOT NULL COMMENT '商品ID',
    `favorite_type` ENUM('normal', 'wish_list', 'compare') DEFAULT 'normal' COMMENT '收藏类型',
    `remark` VARCHAR(200) DEFAULT NULL COMMENT '备注 (如:想买给谁)',
    `favorite_folder_id` INT UNSIGNED DEFAULT NULL COMMENT '收藏夹分组ID (预留)',
    `source_ip` VARCHAR(45) DEFAULT NULL COMMENT '操作IP',
    
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='小程序收藏表 (v2.0 新建)';
```

**设计要点**:
- 支持多种收藏类型（普通收藏、心愿单、对比）
- `remark` 字段增加个性化体验
- `favorite_folder_id` 预留收藏夹分组功能

---

#### 4.3.5 mp_footprints (增强足迹表)
```sql
CREATE TABLE IF NOT EXISTS `mp_footprints` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '足迹ID',
    `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID',
    `product_id` INT UNSIGNED NOT NULL COMMENT '商品ID',
    `action_type` ENUM('view', 'search', 'share', 'add_to_cart', 'collect') DEFAULT 'view' COMMENT '行为类型',
    `context` JSON DEFAULT NULL COMMENT '上下文信息 (搜索关键词、分享渠道等)',
    `source_ip` VARCHAR(45) DEFAULT NULL COMMENT '操作IP',
    `device_info` JSON DEFAULT NULL COMMENT '设备信息',
    
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发生时间',
    
    PRIMARY KEY (`id`),
    KEY `idx_mp_footprints_user_time` (`user_id`, `created_at` DESC),
    KEY `idx_mp_footprints_product` (`product_id`),
    KEY `idx_mp_footprints_action` (`action_type`),
    KEY `idx_mp_footprints_created_date` (DATE(`created_at`)),
    
    CONSTRAINT `fk_mp_footprints_user` 
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_mp_footprints_product` 
        FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) 
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='小程序增强足迹表 (v2.0 新建)';
```

**设计要点**:
- 比 `footprints` 支持更多行为类型
- `context` JSON字段灵活存储额外信息
- 高写入频率，需注意性能优化
- 建议按月分区或定期归档

---

## 5. ER关系图（文字版）

### 5.1 核心实体关系

```
┌─────────────┐       ┌──────────────┐       ┌─────────────┐
│   users     │       │  categories  │       │  products   │
├─────────────┤       ├──────────────┤       ├─────────────┤
│ id (PK)     │◄──┐   │ id (PK)      │◄──┐   │ id (PK)     │
│ username    │   │   │ name         │   │   │ name        │
│ email       │   │   │ parent_id(FK)│──┘   │ price       │
│ phone       │   │   │ sort_order   │       │ stock       │
│ role        │   └──►│ status       │       │ category_id │
│ status      │       │ icon         │──┐   │ (FK)        │
│ ...         │       │ ...          │  └──►│ status      │
└──────┬──────┘       └──────────────┘       │ ...         │
       │                                     └──────┬──────┘
       │                                            │
       │ 1:N                                        │ N:1
       ▼                                            ▼
┌─────────────┐                             ┌─────────────┐
│   orders    │                             │ order_items │
├─────────────┤                             ├─────────────┤
│ id (PK)     │                             │ id (PK)     │
│ user_id(FK) │◄────────────────────────────│ order_id(FK)│
│ order_no(UK)│                             │ product_id  │
│ total_amount│                             │ (FK)        │
│ status      │                             │ quantity    │
│ ...         │                             │ price       │
└─────────────┘                             └─────────────┘
```

### 5.2 辅助实体关系

```
┌──────────┐     ┌─────────────┐     ┌──────────────┐
│   cart   │     │  favorites  │     │  footprints  │
├──────────┤     ├─────────────┤     ├──────────────┤
│ user_id  │────►│ user_id     │────►│ user_id      │
│ product_ │     │ product_id  │     │ product_id   │
│ id (FK)  │     │ (FK)        │     │ (FK)         │
│ quantity │     │ created_at  │     │ created_at   │
└──────────┘     └─────────────┘     └──────────────┘

┌──────────┐     ┌───────────────┐
│ coupons  │◄────│ user_coupons  │
├──────────┤     ├───────────────┤
│ id (PK)  │     │ user_id (FK)  │
│ code(UK) │     │ coupon_id(FK) │
│ type     │     │ status        │
│ value    │     │ received_at   │
└──────────┘     └───────────────┘
```

### 5.3 系统管理实体关系

```
┌─────────────┐
│ admin_logs  │
├─────────────┤
│ admin_id(FK)│────► users.id
│ action      │
│ target_type │
│ target_id   │
│ details     │
│ ip_address  │
│ created_at  │
└─────────────┘

┌──────────────┐     ┌───────────────┐
│    banners   │     │ announcements │
├──────────────┤     ├───────────────┤
│ title        │     │ title         │
│ image_url    │     │ content       │
│ link_url     │     │ type          │
│ position     │     │ is_top        │
│ status       │     │ status        │
└──────────────┘     └───────────────┘

┌─────────────────┐
│ system_config   │
├─────────────────┤
│ config_key (UK) │
│ config_value    │
│ config_group    │
│ is_public       │
└─────────────────┘
```

### 5.4 小程序扩展实体关系

```
┌─────────────────┐
│ mp_user_profiles│
├─────────────────┤
│ user_id (FK,UQ) │────► users.id (1:1)
│ openid (UQ)     │
│ unionid (UQ)    │
│ nickname        │
│ avatar_url      │
│ last_login_time │
└─────────────────┘

┌─────────────────────┐
│mp_browsing_history  │
├─────────────────────┤
│ user_id (FK)        │
│ product_id (FK)     │
│ session_id          │
│ duration_seconds    │
│ entry_source        │
└─────────────────────┘

┌──────────────────┐
│ mp_shopping_cart │
├──────────────────┤
│ user_id (FK)     │
│ product_id (FK)  │
│ added_from       │
│ sku_id (预留)    │
└──────────────────┘

┌──────────────┐
│ mp_favorites │
├──────────────┤
│ user_id (FK) │
│ product_id   │
│ favorite_type│
│ remark       │
└──────────────┘

┌──────────────┐
│ mp_footprints│
├──────────────┤
│ user_id (FK) │
│ product_id   │
│ action_type  │
│ context(JSON)│
└──────────────┘
```

---

## 6. 索引设计原则

### 6.1 索引策略

#### 主键索引 (PRIMARY KEY)
- 所有表必须有无符号自增主键 `INT UNSIGNED AUTO_INCREMENT`
- 高频写入表（footprints, mp_*）可使用 `BIGINT UNSIGNED`

#### 唯一约束 (UNIQUE KEY)
- 业务唯一标识：`username`, `email`, `order_no`, `code`
- 关联唯一：`(user_id, product_id)` 防止重复

#### 普通索引 (INDEX)
- 外键列：自动创建索引加速JOIN查询
- 查询条件列：WHERE子句常用字段
- 排序列：ORDER BY字段
- 组合索引：多条件联合查询

#### 特殊索引
- **前缀索引**: 长文本字段如 `name(50)`
- **函数索引**: DATE(`created_at`) 用于按日期查询
- **覆盖索引**: 查询字段全部包含在索引中

### 6.2 各表索引清单

| 表名 | 索引名 | 索引列 | 类型 | 用途 |
|------|--------|--------|------|------|
| users | PRIMARY | id | PK | 主键查询 |
| users | uk_users_username | username | UK | 登录验证 |
| users | uk_users_email | email | UK | 邮箱唯一 |
| users | uk_users_phone | phone | UK | 手机号唯一 |
| users | idx_users_role | role | INDEX | 角色筛选 |
| users | idx_users_status | status | INDEX | 状态筛选 |
| users | idx_users_created_by | created_by | INDEX | 来源统计 |
| products | PRIMARY | id | PK | 主键查询 |
| products | idx_products_category | category_id | INDEX | 分类筛选 |
| products | idx_products_status | status | INDEX | 上架状态 |
| products | idx_products_name | name(50) | PREFIX | 名称搜索 |
| products | idx_products_created_by | created_by | INDEX | 来源统计 |
| categories | PRIMARY | id | PK | 主键查询 |
| categories | uk_categories_name | name | UK | 名称唯一 |
| categories | idx_categories_parent | parent_id | INDEX | 树形查询 |
| categories | idx_categories_status | status | INDEX | 状态筛选 |
| orders | PRIMARY | id | PK | 主键查询 |
| orders | uk_orders_order_no | order_no | UK | 订单号唯一 |
| orders | idx_orders_user | user_id | INDEX | 用户订单列表 |
| orders | idx_orders_status | status | INDEX | 状态筛选 |
| orders | idx_orders_created | created_at | INDEX | 时间范围查询 |
| admin_logs | idx_admin_logs_admin_id | admin_id | INDEX | 管理员操作查询 |
| admin_logs | idx_admin_logs_action | action | INDEX | 操作类型统计 |
| admin_logs | idx_admin_logs_target | target_type,target_id | COMBO | 目标对象查询 |
| admin_logs | idx_admin_logs_created_at | created_at | INDEX | 时间范围查询 |
| mp_browsing_history | PRIMARY | id (BIGINT) | PK | 主键查询 |
| mp_browsing_history | idx_mp_bh_user_time | user_id,viewed_at | COMBO | 用户浏览历史 |
| mp_browsing_history | idx_mp_bh_session | session_id | INDEX | 会话分析 |
| mp_footprints | idx_mp_fp_created_date | DATE(created_at) | FUNC | 按日期归档 |

### 6.3 索引优化建议

**高频读取优化**:
```sql
-- 商品列表查询优化（覆盖索引）
ALTER TABLE products ADD INDEX idx_products_list 
(category_id, status, created_at DESC);

-- 订单查询优化（复合索引）
ALTER TABLE orders ADD INDEX idx_orders_user_status_created 
(user_id, status, created_at DESC);
```

**写入性能优化**:
- `mp_browsing_history`, `mp_footprints` 等高频写入表
- 考虑延迟索引创建或批量写入后重建索引
- 定期清理或归档旧数据

---

## 7. 命名规范说明

### 7.1 表命名规则

| 分类 | 前缀 | 示例 | 说明 |
|------|------|------|------|
| Common Tables | 无前缀 | `users`, `products` | 核心业务表，简洁命名 |
| Backend-Specific | 无前缀 | `admin_logs`, `banners` | 后台管理表 |
| Mini-program Specific | `mp_` | `mp_user_profiles` | 小程序专用表 |

**命名约定**:
- 全部小写字母
- 单词间用下划线 `_` 分隔
- 使用复数形式（表示集合）：`users`, `orders`, `items`
- 避免SQL保留字：`order` → `orders`, `group` → `groups`

### 7.2 列命名规则

| 规则 | 正确示例 | 错误示例 |
|------|---------|---------|
| 小写下划线 | `created_at`, `user_id` | `createdAt`, `userID` |
| 布尔型用is/tinyint | `is_deleted`, `selected` | `deleted`, `isSelected` |
| 时间戳用_at/_time | `created_at`, `login_time` | `createTime`, `logTime` |
| 外键用_id后缀 | `category_id`, `user_id` | `categoryId`, `catId` |
| 数量用_count后缀 | `clicks`, `view_count` | `numClicks`, `views` |
| JSON字段明确标注 | `device_info`, `shipping_address` | `data`, `extra` |
| 枚举用完整单词 | `created_by`, `action_type` | `src`, `type` |

### 7.3 索引命名规则

| 类型 | 格式 | 示例 |
|------|------|------|
| 主键 | `PRIMARY` 或 `pk_表名` | `pk_users` |
| 唯一约束 | `uk_表名_列名` | `uk_users_email` |
| 普通索引 | `idx_表名_列名` | `idx_products_category` |
| 复合索引 | `idx_表名_列1_列2` | `idx_orders_user_status` |
| 外键约束 | `fk_表名_引用表` | `fk_products_category` |
| 检查约束 | `ck_表名_字段` | `ck_products_price` |

### 7.4 枚举值命名规则

**created_by / updated_by**:
- `backend`: 后台管理系统
- `miniprogram`: 小程序端
- `system`: 系统自动
- `migration`: 数据迁移

**status相关**:
- 用户: `active`, `inactive`, `banned`
- 商品: `active`, `inactive`
- 订单: `pending`, `paid`, `shipped`, `completed`, `cancelled`, `refunded`
- 支付: `unpaid`, `paid`, `refunding`, `refunded`
- 公告: `draft`, `published`, `archived`

---

## 8. 设计决策与依据

### 8.1 为什么这样分类？

**决策背景**:
绮管电商系统包含两个客户端：
1. **后台管理系统** (Web): 管理员使用，进行商品管理、订单处理、CMS管理等
2. **小程序端** (WeChat Mini Program): 消费者使用，进行浏览、下单、支付等

**分类理由**:

| 分类维度 | Common | Backend-Specific | Mini-program Specific |
|---------|--------|-------------------|---------------------|
| **数据共享需求** | 高（两端都需要） | 低（仅后台） | 低（仅小程序） |
| **读写比例** | 后台写/小程序读 | 后台读写 | 小程序读写 |
| **安全级别** | 中 | 高（敏感操作） | 低（用户行为） |
| **数据量级** | 中等 | 小 | 大（用户行为） |
| **变更频率** | 中 | 低 | 高 |

**具体案例**:
- **products放在Common**: 商品数据后台创建和管理，小程序展示和购买，两端紧密耦合
- **admin_logs仅Backend**: 只有管理员会产生操作日志，小程序不需要也不应该看到
- **mp_user_profiles仅MP**: 存储微信OpenID等敏感信息，不应暴露给后台普通管理员
- **cart在Common而非MP**: 后台可能需要查看用户购物车做客服干预

### 8.2 标识字段的选择依据

**为什么选择这些字段？**

1. **created_by / updated_by**
   - **必要性**: ⭐⭐⭐⭐⭐ (核心溯源字段)
   - **价值**: 
     - 数据治理：知道数据从哪来
     - 问题排查：快速定位问题来源
     - 合规审计：满足GDPR/个人信息保护法要求
     - 业务分析：统计各渠道贡献度
   - **成本**: 每行仅1字节ENUM + 少量索引空间

2. **source_ip**
   - **必要性**: ⭐⭐⭐⭐ (强烈推荐)
   - **价值**:
     - 安全防护：检测异常IP、防刷、地理位置分析
     - 风控：识别欺诈行为（如异地登录）
     - 合规：某些行业要求记录操作IP
   - **成本**: IPv4最大15字节，IPv6最大45字节

3. **device_info (JSON)**
   - **必要性**: ⭐⭐⭐ (推荐用于MP表)
   - **价值**:
     - 用户体验优化：了解用户设备分布
     - AB测试：按设备型号分流
     - 问题复现：定位设备兼容性问题
   - **成本**: JSON字段，大小不一（平均~200字节）
   - **适用场景**: 主要用于小程序表，Common表可选

4. **is_deleted / deleted_at (软删除)**
   - **必要性**: ⭐⭐⭐ (视业务需求)
   - **价值**:
     - 数据恢复：误删可恢复
     - 历史追溯：保留删除前的状态
     - 关联完整性：避免外键级联删除导致数据丢失
   - **成本**: 每行+1字节TINYINT + 8字节DATETIME
   - **权衡**: 增加查询复杂度（需要额外WHERE条件）

**为什么不选其他字段？**

| 未选用字段 | 原因 |
|-----------|------|
| `created_by_id` (具体用户ID) | 已有admin_logs记录详细信息，这里只需枚举类型 |
| `request_id` (链路追踪) | 应在应用层处理，不适合存在数据库 |
| `version` (乐观锁) | 当前并发不高，暂不需要；可通过updated_at实现简单版本控制 |
| `tenant_id` (多租户) | 当前为单租户系统，预留扩展即可 |

### 8.3 性能影响评估

#### 存储开销计算

**假设数据量**:
- users: 10万条
- products: 1万条
- orders: 50万条
- order_items: 150万条
- 其他表: 共计约300万条

**每表新增字段存储成本** (以products表为例):

| 字段 | 类型 | 大小 | 总计(1万条) |
|------|------|------|------------|
| created_by | ENUM(4) | 1 byte | ~10 KB |
| updated_by | ENUM(4) | 1 byte | ~10 KB |
| source_ip | VARCHAR(45) | avg 15 bytes | ~150 KB |
| device_info | JSON | avg 200 bytes (30%填充率) | ~600 KB |
| **合计** | | | **~770 KB** |

**全库总增量估算**:
- 约300万条记录 × 平均每条约50字节 = **~150 MB**
- 占总数据库容量(<1%)的极小部分
- 索引额外开销: ~50 MB

**结论**: 存储影响可忽略不计

#### 查询性能影响

**正面影响**:
```sql
-- 场景1: 快速筛选后台创建的商品
SELECT * FROM products WHERE created_by = 'backend';
-- 使用索引 idx_products_created_by，毫秒级响应

-- 场景2: 统计各来源数据量
SELECT created_by, COUNT(*) FROM products GROUP BY created_by;
-- 聚合查询，利用索引快速返回
```

**潜在负面影响**:
```sql
-- 场景: INSERT语句变长（影响微乎其微）
INSERT INTO products (..., created_by, source_ip) VALUES (..., 'backend', '192.168.1.1');
-- 每次INSERT增加约20字节传输，网络延迟<0.01ms
```

**基准测试预估** (基于MySQL 5.7/TDSQL-C):
- SELECT性能: 无明显变化（<1%差异）
- INSERT性能: 下降0.5%-1%（可接受范围）
- UPDATE性能: 下降0.3%-0.8%（updated_by字段更新）
- 批量导入: 下降1%-2%（大量新字段填充）

**结论**: 性能影响在可接受范围内，远小于业务价值

### 8.4 扩展性考虑

#### 横向扩展（未来可能的需求）

1. **多租户支持**
   ```sql
   -- 预留方案: 在Common表中添加 tenant_id
   ALTER TABLE users ADD COLUMN tenant_id INT UNSIGNED DEFAULT 1;
   ALTER TABLE products ADD COLUMN tenant_id INT UNSIGNED DEFAULT 1;
   -- 已有的 created_by 可辅助租户内审计
   ```

2. **数据分片（Sharding）**
   - `created_by` 字段可作为分片键参考
   - 按来源分片: backend数据在一片，miniprogram在另一片
   - 但更推荐按 user_id 或 time 范围分片

3. **读写分离**
   - Common表的写操作主要来自backend
   - 读操作主要来自miniprogram
   - 天然适合主从复制架构
   - `source_ip` 可帮助判断流量来源

#### 纵向扩展（功能增强）

1. **数据血缘（Data Lineage）增强**
   ```sql
   -- 可扩展: 添加 parent_record_id 支持记录衍生关系
   ALTER TABLE products ADD COLUMN parent_record_id INT UNSIGNED 
   COMMENT '源记录ID (如从模板创建)';
   
   -- 可扩展: 添加 batch_id 支持批量操作追踪
   ALTER TABLE products ADD COLUMN batch_id VARCHAR(36) 
   COMMENT '批次UUID (批量导入时使用)';
   ```

2. **字段级加密**
   ```sql
   -- 敏感字段加密（如 phone, email）
   -- 应用层加密后存储，database层面透明
   ```

3. **审计日志增强**
   - `admin_logs` 已覆盖后台操作
   - 未来可增加 `change_log` 表记录所有字段级变更
   - 利用 `updated_by` 过滤关注来源

#### 版本演进路线图

```
v1.0 (当前) → v2.0 (本方案) → v3.0 (未来)
─────────────────────────────────────────────
基础CRUD     → 完整溯源     → 智能化运营
无标识字段   → 4个核心字段   → ML特征工程
无分类体系   → 3层分类      → 自动归类
无审计日志   → admin_logs   → 实时风控
```

---

## 9. 兼容性分析

### 9.1 与现有代码的兼容性

#### 影响范围评估

**路由层** ([routes/*.js](file:///e:/1/绮管后台/routes)):
- ✅ **categories.js**: INSERT/UPDATE语句需补充 `created_by`, `source_ip` 字段
- ✅ **products.js**: 同上
- ✅ **orders.js**: 同上
- ✅ **其他路由**: 类似调整

**数据库模块** ([db_mysql.js](file:///e:/1/绮管后台/db_mysql.js)):
- ✅ **完全兼容**: 新字段均为可选(DEFAULT/NULL)，不影响现有查询
- ✅ **query()方法**: SELECT * 能自动包含新字段
- ✅ **execute()方法**: INSERT/UPDATE不指定新字段时会使用DEFAULT值

**中间件** ([middleware/auth.js](file:///e:/1/绮管后台/middleware/auth)):
- ✅ **建议增强**: 在req对象中附加来源信息
  ```javascript
  req.sourceInfo = {
    by: 'backend', // 或 'miniprogram'
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.headers['user-agent']
  };
  ```

#### 向后兼容性保证

1. **DDL兼容性**
   - 所有新字段都设置了 `DEFAULT` 值或允许 `NULL`
   - 现有代码不修改也能正常运行
   - 不会导致INSERT语句报错

2. **DML兼容性**
   ```sql
   -- 现有代码（升级前）
   INSERT INTO products (name, price) VALUES ('iPhone', 9999);
   -- 升级后仍然有效，created_by会自动填入'system'
   
   -- 现有代码
   SELECT * FROM products WHERE status = 'active';
   -- 升级后会额外返回 created_by, updated_by, source_ip 等字段
   -- 前端忽略即可，不影响功能
   ```

3. **应用层兼容性**
   - Node.js后端: 新字段会被映射到对象属性，未使用时不影响
   - Vue前端: API返回额外字段会被忽略
   - 小程序: 同上

#### 需要适配的代码点

| 文件 | 改动点 | 优先级 | 工作量 |
|------|--------|--------|--------|
| routes/categories.js | POST/PUT补充字段 | P1 | 小 |
| routes/products.js | POST/PUT补充字段 | P1 | 小 |
| routes/orders.js | POST/PUT补充字段 | P1 | 小 |
| routes/users.js | POST/PUT补充字段 | P1 | 小 |
| middleware/auth.js | 添加sourceInfo | P2 | 小 |
| db_mysql.js | 无需改动 | - | - |
| 前端Vue组件 | 可选择性展示 | P3 | 可选 |

**适配示例** (routes/products.js):
```javascript
// Before (v1.0)
router.post('/', async (req, res) => {
  const sql = `INSERT INTO products (name, description, price, ...) VALUES (?, ?, ?, ?)`;
  await execute(sql, [name, description, price, ...]);
});

// After (v2.0 - 推荐)
router.post('/', async (req, res) => {
  const sql = `INSERT INTO products (name, description, price, ..., created_by, source_ip) 
               VALUES (?, ?, ?, ..., ?, ?)`;
  await execute(sql, [
    name, description, price, ..., 
    req.sourceInfo?.by || 'backend', 
    req.sourceInfo?.ip || req.ip
  ]);
});
```

### 9.2 MySQL版本兼容性

| 特性 | MySQL 5.7 | MySQL 8.0 | TDSQL-C |
|------|----------|----------|---------|
| ENUM类型 | ✅ | ✅ | ✅ |
| JSON类型 | ✅ (5.7.8+) | ✅ | ✅ |
| GENERATED COLUMN | ✅ | ✅ | ✅ |
| CHECK约束 | ❌ (语法接受但不强制) | ✅ (8.0.16+) | ✅ |
| IF NOT EXISTS (ALTER) | ✅ | ✅ | ✅ |
| DATE()函数索引 | ✅ | ✅ | ✅ |
| utf8mb4字符集 | ✅ | ✅ | ✅ |

**注意事项**:
- TDSQL-C基于MySQL 5.7/8.0，完全兼容本方案
- CHECK约束在5.7中仅语法检查，实际生效需8.0.16+
- 建议生产环境使用MySQL 8.0+或确认TDSQL-C版本支持

---

## 10. 迁移指南

### 10.1 升级步骤

#### Step 1: 备份生产数据库
```bash
# 导出完整备份
mysqldump -h <host> -u <user> -p qmzyxcx > backup_before_v2_$(date +%Y%m%d_%H%M%S).sql

# 验证备份完整性
mysql -h <host> -u <user> -p -e "SHOW TABLES FROM qmzyxcx;" < backup_file.sql
```

#### Step 2: 执行Schema升级脚本
```bash
# 执行升级脚本（详见 schema_v2_upgrade_system_identification.sql）
mysql -h <host> -u <user> -p qmzyxcx < database/schema_v2_upgrade_system_identification.sql

# 监控执行过程
# 预计执行时间: < 5分钟（取决于数据量）
```

#### Step 3: 验证升级结果
```sql
-- 检查新字段是否存在
SELECT COLUMN_NAME, DATA_TYPE, COLUMN_DEFAULT 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'qmzyxcx' 
  AND TABLE_NAME = 'products' 
  AND COLUMN_NAME IN ('created_by', 'updated_by', 'source_ip');

-- 检查新表是否创建
SELECT TABLE_NAME, TABLE_COMMENT 
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'qmzyxcx' 
  AND TABLE_NAME LIKE 'mp_%' OR TABLE_NAME IN ('admin_logs', 'system_config', 'announcements');
```

#### Step 4: 填充历史数据标识
```sql
-- 将现有数据的 created_by 标记为 'migration'
UPDATE users SET created_by = 'migration' WHERE created_by IS NULL;
UPDATE products SET created_by = 'migration' WHERE created_by IS NULL;
UPDATE categories SET created_by = 'migration' WHERE created_by IS NULL;
-- ... 对所有Common表执行
```

#### Step 5: 更新应用代码
- 按照第9节"兼容性分析"中的清单逐步适配
- 建议先在测试环境验证
- 灰度发布到生产环境

#### Step 6: 监控与回滚准备
- 密切监控系统性能指标（QPS、延迟、错误率）
- 准备好回滚脚本（详见升级脚本末尾的ROLLBACK部分）
- 如遇问题，可在30分钟内完成回滚

### 10.2 回滚方案

如果升级后出现严重问题：

```bash
# 1. 停止应用服务
pm2 stop all  # 或 systemctl stop your-app

# 2. 执行回滚脚本
mysql -h <host> -u <user> -p qmzyxcx < database/schema_v2_rollback.sql

# 3. 恢复备份（如果回滚脚本不够）
mysql -h <host> -u <user> -p qmzyxcx < backup_before_v2_YYYYMMDD.sql

# 4. 重启服务并验证
pm2 start all
```

**回滚脚本要点**:
- DROP新建的表（mp_*, admin_logs, system_config, announcements）
- ALTER TABLE删除新增的字段（created_by, updated_by, source_ip, device_info等）
- 注意：如果已有新数据写入，回滚会导致数据丢失！

---

## 附录

### A. 完整表清单汇总

| # | 表名 | 分类 | 说明 | 状态 |
|---|------|------|------|------|
| 1 | users | Common | 用户表 | 升级✓ |
| 2 | products | Common | 商品表 | 升级✓ |
| 3 | categories | Common | 分类表 | 升级✓ |
| 4 | orders | Common | 订单表 | 升级✓ |
| 5 | order_items | Common | 订单项表 | 升级✓ |
| 6 | cart | Common | 购物车表 | 升级✓ |
| 7 | favorites | Common | 收藏表 | 升级✓ |
| 8 | footprints | Common | 浏览足迹表 | 升级✓ |
| 9 | coupons | Common | 优惠券表 | 升级✓ |
| 10 | user_coupons | Common | 用户优惠券表 | 升级✓ |
| 11 | homepage_config | Common | 首页配置表 | 升级✓ |
| 12 | banners | Backend | 轮播图表 | 升级✓ |
| 13 | admin_logs | Backend | 管理员日志表 | 新建★ |
| 14 | system_config | Backend | 系统配置表 | 新建★ |
| 15 | announcements | Backend | 公告管理表 | 新建★ |
| 16 | mp_user_profiles | MP | 用户扩展信息表 | 新建★ |
| 17 | mp_browsing_history | MP | 详细浏览历史表 | 新建★ |
| 18 | mp_shopping_cart | MP | 小程序购物车表 | 新建★ |
| 19 | mp_favorites | MP | 小程序收藏表 | 新建★ |
| 20 | mp_footprints | MP | 增强足迹表 | 新建★ |

**总计**: 20张表（11张升级 + 4张Backend新建 + 5张MP新建）

### B. 字段字典速查

| 字段名 | 类型 | 适用表 | 默认值 | 必填 | 说明 |
|--------|------|--------|--------|------|------|
| id | INT UNSIGNED PK | All | AUTO_INCREMENT | 是 | 主键 |
| created_by | ENUM(4) | Common | 'system' | 否 | 创建来源 |
| updated_by | ENUM(4) | Common | NULL | 否 | 更新来源 |
| created_at | DATETIME | All | CURRENT_TIMESTAMP | 是 | 创建时间 |
| updated_at | DATETIME | All | ON UPDATE | 是 | 更新时间 |
| source_ip | VARCHAR(45) | Common+MP | NULL | 否 | IP地址 |
| device_info | JSON | Products,Users,MP | NULL | 否 | 设备信息 |
| is_deleted | TINYINT(1) | Optional | 0 | 否 | 软删除 |
| deleted_at | DATETIME | Optional | NULL | 否 | 删除时间 |

### C. 参考资源

- [MySQL 5.7 官方文档](https://dev.mysql.com/doc/refman/5.7/en/)
- [TDSQL-C 产品文档](https://cloud.tencent.com/document/product/237)
- [数据库索引优化最佳实践](https://dev.mysql.com/doc/refman/5.7/en/optimization.html)
- [UTF8MB4 字符集说明](https://dev.mysql.com/doc/refman/5.7/en/charset-unicode-utf8mb4.html)

---

**文档结束**

*版本*: v2.0.0  
*最后更新*: 2026-04-10  
*状态*: 待审核  
*下一步*: 执行Schema升级脚本并验证