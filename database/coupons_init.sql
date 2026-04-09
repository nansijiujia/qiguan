-- ============================================================
-- 绮管后台 - 优惠券管理系统 数据库初始化脚本
-- 
-- 包含:
-- 1. coupons 表 (优惠券主表)
-- 2. user_coupons 表 (用户优惠券关联表)
-- 3. 测试数据
--
-- 创建时间: 2026-04-09
-- ============================================================

-- 创建优惠券主表
CREATE TABLE IF NOT EXISTS coupons (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL COMMENT '优惠券名称',
  code VARCHAR(50) NOT NULL UNIQUE COMMENT '优惠码',
  type ENUM('fixed', 'percent') NOT NULL DEFAULT 'fixed' COMMENT '类型: fixed固定金额, percent百分比',
  value DECIMAL(10,2) NOT NULL COMMENT '优惠值',
  min_order_amount DECIMAL(10,2) DEFAULT 0 COMMENT '最低订单金额',
  max_discount DECIMAL(10,2) DEFAULT NULL COMMENT '最大折扣金额(仅percent类型)',
  stock INT NOT NULL DEFAULT 0 COMMENT '发放总量',
  per_user_limit INT DEFAULT 1 COMMENT '每人限领数量',
  used_count INT DEFAULT 0 COMMENT '已使用数量',
  start_time DATETIME NOT NULL COMMENT '开始时间',
  end_time DATETIME NOT NULL COMMENT '结束时间',
  status ENUM('active', 'inactive', 'expired') DEFAULT 'active' COMMENT '状态',
  description TEXT COMMENT '使用说明',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_code (code),
  INDEX idx_time (start_time, end_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='优惠券表';

-- 创建用户优惠券关联表
CREATE TABLE IF NOT EXISTS user_coupons (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  coupon_id INT NOT NULL,
  status ENUM('unused', 'used', 'expired') DEFAULT 'unused',
  order_id INT DEFAULT NULL COMMENT '使用的订单ID',
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  used_at TIMESTAMP DEFAULT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (coupon_id) REFERENCES coupons(id),
  UNIQUE KEY unique_user_coupon (user_id, coupon_id),
  INDEX idx_user_status (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户优惠券关联表';

-- 插入测试数据
INSERT IGNORE INTO coupons (name, code, type, value, min_order_amount, stock, per_user_limit, start_time, end_time, status, description, max_discount) VALUES
('新用户专享券', 'NEWUSER2026', 'fixed', 50.00, 100.00, 1000, 1, '2026-01-01 00:00:00', '2026-12-31 23:59:59', 'active', '新用户注册即送，满100可用', NULL),
('满减大促券', 'SALE100', 'fixed', 100.00, 500.00, 500, 1, '2026-04-01 00:00:00', '2026-04-30 23:59:59', 'active', '全场通用，满500减100', NULL),
('折扣特惠券', 'DISCOUNT20', 'percent', 20.00, 200.00, 300, 1, '2026-04-10 00:00:00', '2026-05-10 23:59:59', 'active', '全场8折，最高减免200元', 200.00);
