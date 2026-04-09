-- ============================================================
-- 绮管后台 - 内容管理系统 (CMS) 数据库初始化脚本
--
-- 功能:
-- 1. banners 表 - 首页轮播图管理
-- 2. homepage_config 表 - 首页配置管理
--
-- 创建时间: 2026-04-09
-- ============================================================

-- ----------------------------------------------------------
-- 1. banners 表（轮播图表）
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS banners (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(200) COMMENT '标题',
  image_url VARCHAR(500) NOT NULL COMMENT '图片URL',
  link_url VARCHAR(500) COMMENT '点击跳转链接',
  link_type ENUM('product', 'category', 'url', 'none') DEFAULT 'none' COMMENT '链接类型',
  position INT DEFAULT 0 COMMENT '排序位置(越小越前)',
  start_time DATETIME COMMENT '开始展示时间',
  end_time DATETIME COMMENT '结束展示时间',
  status ENUM('active', 'inactive') DEFAULT 'active' COMMENT '状态',
  clicks INT DEFAULT 0 COMMENT '点击次数',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_position (position),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='首页轮播图表';

-- 插入示例数据
INSERT IGNORE INTO banners (title, image_url, link_type, position, status) VALUES
('春季新品上市', 'https://via.placeholder.com/1200x400?text=Spring+Sale', 'none', 1, 'active'),
('限时特惠', 'https://via.placeholder.com/1200x400?text=Special+Offer', 'none', 2, 'active'),
('会员专享日', 'https://via.placeholder.com/1200x400?text=VIP+Day', 'none', 3, 'active');

-- ----------------------------------------------------------
-- 2. homepage_config 表（首页配置表）
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS homepage_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  config_key VARCHAR(100) NOT NULL UNIQUE COMMENT '配置键',
  config_value TEXT COMMENT '配置值(JSON格式)',
  description VARCHAR(500) COMMENT '配置说明',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='首页配置表';

-- 初始化配置项
INSERT IGNORE INTO homepage_config (config_key, config_value, description) VALUES
('recommended_products', '[1, 2]', '推荐商品ID列表(JSON数组)'),
('hot_products', '[1, 3, 5]', '热门商品ID列表(JSON数组)'),
('promotion_banner', '{"title":"限时抢购","subtitle":"全场5折起","link":""}', '促销活动配置(JSON)'),
('announcement', '欢迎使用绮梦之约电商平台！新用户注册即送50元优惠券。', '公告内容(纯文本或HTML)');
