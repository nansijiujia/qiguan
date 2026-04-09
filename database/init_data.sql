-- 插入分类数据
INSERT INTO categories (name, parent_id, sort_order, status) VALUES
('电子产品', NULL, 1, 'active'),
('手机', 1, 1, 'active'),
('电脑', 1, 2, 'active'),
('家用电器', NULL, 2, 'active'),
('洗衣机', 4, 1, 'active'),
('冰箱', 4, 2, 'active'),
('服装', NULL, 3, 'active'),
('男装', 7, 1, 'active'),
('女装', 7, 2, 'active');

-- 插入用户数据 (密码: admin123, 使用bcrypt哈希)
INSERT INTO users (username, email, password, role, status) VALUES
('admin', 'admin@example.com', '$2b$10$5IWMn9ZaV26OORwID2nzi..TYSrGZjXCcIowVEwtKb55EypbLBDAO', 'admin', 'active'),
('user1', 'user1@example.com', '$2b$10$5IWMn9ZaV26OORwID2nzi..TYSrGZjXCcIowVEwtKb55EypbLBDAO', 'user', 'active'),
('manager', 'manager@example.com', '$2b$10$5IWMn9ZaV26OORwID2nzi..TYSrGZjXCcIowVEwtKb55EypbLBDAO', 'manager', 'active');

-- 插入商品数据
INSERT INTO products (name, description, price, stock, category_id, image, status) VALUES
('iPhone 15 Pro', '苹果最新款手机，搭载A17 Pro芯片', 7999.00, 50, 2, 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=iPhone%2015%20Pro%20smartphone&image_size=square', 'active'),
('MacBook Pro 14', '苹果笔记本电脑，M3芯片', 14999.00, 30, 3, 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=MacBook%20Pro%2014%20laptop&image_size=square', 'active'),
('海尔洗衣机', '全自动洗衣机，10kg容量', 2999.00, 20, 5, 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Haier%20washing%20machine&image_size=square', 'active'),
('美的冰箱', '双开门冰箱，500L容量', 3999.00, 15, 6, 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Midea%20refrigerator&image_size=square', 'active'),
('耐克运动鞋', '男士运动鞋，舒适透气', 899.00, 100, 8, 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Nike%20sports%20shoes&image_size=square', 'active'),
('阿迪达斯运动服', '女士运动服套装', 699.00, 80, 9, 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Adidas%20sportswear%20for%20women&image_size=square', 'active');

-- 插入订单数据
INSERT INTO orders (order_no, user_id, customer_name, customer_phone, total_amount, status, shipping_address) VALUES
('ORD20260401001', 2, '张三', '13800138001', 7999.00, 'completed', '北京市朝阳区某某街道123号'),
('ORD20260401002', 2, '李四', '13900139001', 2999.00, 'shipped', '上海市浦东新区某某街道456号'),
('ORD20260401003', 3, '王五', '13700137001', 14999.00, 'pending', '广州市天河区某某街道789号');

-- 插入订单项数据
INSERT INTO order_items (order_id, product_id, product_name, quantity, price) VALUES
(1, 1, 'iPhone 15 Pro', 1, 7999.00),
(2, 3, '海尔洗衣机', 1, 2999.00),
(3, 2, 'MacBook Pro 14', 1, 14999.00);