-- ============================================================
-- 绮管后台 - 优惠券发放与领取系统 数据库升级脚本
-- 
-- 包含:
-- 1. coupons 表 (优惠券模板表) - 升级版
-- 2. user_coupons 表 (用户领取的优惠券) - 支持OpenID
-- 3. coupon_receive_logs 表 (领取日志)
--
-- 创建时间: 2026-04-15
-- 注意: 此脚本用于新增/升级优惠券系统相关表结构
-- ============================================================

-- ============================================================
-- 1. coupons 表 (优惠券模板表)
-- 如果已存在则跳过，否则创建新表
-- ============================================================
CREATE TABLE IF NOT EXISTS coupons (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL COMMENT '优惠券名称',
  code VARCHAR(50) UNIQUE COMMENT '优惠码',
  type ENUM('fixed', 'percent') NOT NULL COMMENT '类型:固定金额/百分比',
  value DECIMAL(10,2) NOT NULL COMMENT '优惠值',
  max_discount DECIMAL(10,2) COMMENT '最大减免额(百分比类型用)',
  min_order_amount DECIMAL(10,2) DEFAULT 0 COMMENT '最低消费金额',
  stock INT NOT NULL COMMENT '库存数量',
  used_count INT DEFAULT 0 COMMENT '已使用数量',
  per_user_limit INT DEFAULT 1 COMMENT '每人限领数量',
  start_time DATETIME NOT NULL COMMENT '开始时间',
  end_time DATETIME NOT NULL COMMENT '结束时间',
  description TEXT COMMENT '描述',
  status ENUM('active', 'inactive', 'expired') DEFAULT 'active' COMMENT '状态',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_code (code),
  INDEX idx_time (start_time, end_time),
  INDEX idx_stock_status (stock, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='优惠券模板表';

-- ============================================================
-- 2. user_coupons 表 (用户领取的优惠券)
-- 支持存储微信小程序用户的 OpenID (VARCHAR(100))
-- ============================================================
CREATE TABLE IF NOT EXISTS user_coupons (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id VARCHAR(100) NOT NULL COMMENT '用户OpenID或用户ID',
  coupon_id INT NOT NULL COMMENT '优惠券ID',
  status ENUM('unused', 'used', 'expired') DEFAULT 'unused' COMMENT '状态',
  received_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '领取时间',
  used_at DATETIME COMMENT '使用时间',
  order_id INT COMMENT '使用的订单ID',
  FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_coupon (user_id, coupon_id),
  INDEX idx_user_id (user_id),
  INDEX idx_coupon_id (coupon_id),
  INDEX idx_user_status (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户优惠券关联表';

-- ============================================================
-- 3. coupon_receive_logs 表 (领取日志)
-- 记录所有优惠券领取操作，用于审计和防刷
-- ============================================================
CREATE TABLE IF NOT EXISTS coupon_receive_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id VARCHAR(100) NOT NULL COMMENT '用户OpenID',
  coupon_id INT NOT NULL COMMENT '优惠券ID',
  ip VARCHAR(45) COMMENT '客户端IP地址',
  user_agent TEXT COMMENT '用户代理信息',
  receive_type ENUM('self_claim', 'admin_assign') DEFAULT 'self_claim' COMMENT '领取类型:自行领取/管理员发放',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  INDEX idx_created_at (created_at),
  INDEX idx_user_id (user_id),
  INDEX idx_coupon_id (coupon_id),
  INDEX idx_ip (ip)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='优惠券领取日志表';

-- ============================================================
-- 插入测试数据（如果不存在）
-- ============================================================
INSERT IGNORE INTO coupons (name, code, type, value, min_order_amount, stock, per_user_limit, start_time, end_time, status, description, max_discount) VALUES
('新用户专享券', 'NEWUSER2026', 'fixed', 50.00, 100.00, 1000, 1, '2026-01-01 00:00:00', '2026-12-31 23:59:59', 'active', '新用户注册即送，满100可用', NULL),
('满减大促券', 'SALE100', 'fixed', 100.00, 500.00, 500, 1, '2026-04-01 00:00:00', '2026-04-30 23:59:59', 'active', '全场通用，满500减100', NULL),
('折扣特惠券', 'DISCOUNT20', 'percent', 20.00, 200.00, 300, 1, '2026-04-10 00:00:00', '2026-05-10 23:59:59', 'active', '全场8折，最高减免200元', 200.00),
('限时秒杀券', 'FLASHSALE', 'fixed', 30.00, 99.00, 100, 1, '2026-04-15 00:00:00', '2026-04-15 23:59:59', 'active', '限时秒杀，满99减30', NULL);

-- ============================================================
-- 完成提示
-- ============================================================
SELECT '✅ 优惠券发放与领取系统数据库表初始化完成' AS message;
SELECT CONCAT('- coupons 表: ', COUNT(*), ' 条记录') AS info FROM coupons;
