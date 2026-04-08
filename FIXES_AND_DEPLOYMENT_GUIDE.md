# 绮管后台 - 问题修复与上线指南

## 🎯 修复内容汇总

### 1. ✅ 仪表盘模拟数据已清除
**文件**: `qiguanqianduan/src/views/Dashboard.vue`

**修改点**:
- **统计卡片** (第98-103行): 将硬编码的模拟数据（1,234商品、567订单、¥89,432营收、8,901用户）改为初始值0
- **销售趋势图** (第132-179行): 图表数据从假数据（3200, 4500...）改为全0，显示空状态
- **热门商品TOP5** (第182-215行): 从假商品名（无线耳机、智能手表...）改为"暂无数据"
- **订单列表bug修复** (第229行): 修正数据取值路径错误 `ordersRes.data.list` → `ordersRes.data.data.list`

### 2. ✅ 列表数据显示问题已修复
**根本原因**: API响应格式不匹配

**前端期望格式**:
```javascript
{
  data: {
    list: [...],        // 数据数组
    pagination: {...}   // 分页信息
  }
}
```

**后端原始返回格式** (❌ 错误):
```javascript
{
  data: [...],          // 数据直接在第一层
  pagination: {...}     // 分页信息与data同级
}
```

**修复文件**: `routes/products.js` (第88-98行)
- 将响应格式改为: `{ data: { list: formattedList, pagination: {...} } }`
- 现在与前端期望格式完全匹配

### 3. ✅ 数据库连接配置优化
**文件**: `index.js` (第14-30行)

**新增功能**:
- 根据 `DB_TYPE` 环境变量自动选择数据库类型
- 支持 MySQL (生产环境) 和 SQLite (开发环境)
- MySQL连接失败时自动回退到SQLite
- 启动时显示详细的数据库类型和状态日志

**配置逻辑**:
```javascript
if (DB_TYPE === 'mysql') {
  // 使用 db_mysql.js (腾讯云TDSQL-C)
} else {
  // 使用 db.js (本地SQLite)
}
```

### 4. ✅ 新增生产环境配置文件
**文件**: `.env.production`

**包含配置**:
- MySQL数据库连接参数（主机、端口、用户名、密码）
- JWT认证密钥
- 文件上传路径
- CORS跨域设置
- 功能开关

### 5. ✅ 新增MySQL数据库初始化脚本
**文件**: `scripts/init_mysql_database.js`

**功能**:
- 自动检测表是否存在
- 首次运行时创建完整的表结构
- 插入示例分类、管理员账户、示例商品
- 支持命令行直接执行或被其他脚本调用

---

## 📋 上线部署步骤

### 方式一：使用CloudBase CLI部署（推荐）

#### 1️⃣ 初始化MySQL数据库（首次部署必须执行）
```bash
cd 绮管后台
node scripts/init_mysql_database.js
```

预期输出：
```
✅ 已连接到数据库: 10.0.0.16:3306/qmzyxcx
📝 首次运行，开始创建表结构...
✅ 表结构创建成功
✅ 初始数据插入成功

📊 初始化完成统计:
   分类: 6
   商品: 5
   用户: 1 (含管理员账户)
   管理员账号: admin / admin123

✅✅✅ 数据库初始化完成! ✅✅✅
```

#### 2️⃣ 构建前端项目
```bash
cd qiguanqianduan
npm install
npm run build
```

构建产物会生成在 `dist/` 目录。

#### 3️⃣ 部署到腾讯云CloudBase
```bash
# 在项目根目录执行
tcb fn deploy ecommerce-backend env=nansijiujia-1gaeh8qpb9ad09a5

# 或者使用 cloudbase 命令
cloudbase fn deploy ecommerce-backend
```

#### 4️⃣ 配置环境变量（在CloudBase控制台）

进入腾讯云CloudBase控制台 → 你的环境 → 云函数 → ecommerce-backend → 配置：

添加以下环境变量：
```
DB_TYPE=mysql
DB_HOST=10.0.0.16
DB_PORT=3306
DB_USER=QMZYXCX
DB_PASSWORD=LJN040821.
DB_NAME=qmzyxcx
NODE_ENV=production
JWT_SECRET=qiguan-production-secret-key-2026-change-me
```

#### 5️⃣ 验证部署

访问：`https://qimengzhiyue.cn/dashboard`

检查项：
- [ ] 仪表盘统计卡片显示真实数据（或0）
- [ ] 销售趋势图显示空状态（无假数据）
- [ ] 热门商品TOP5显示"暂无数据"
- [ ] 商品管理页面能正常显示数据列表
- [ ] 分类管理页面能正常显示分类
- [ ] 用户管理页面能正常显示用户列表
- [ ] 添加商品/分类/用户功能正常工作

---

### 方式二：手动部署到服务器

#### 1️⃣ 服务器环境准备
确保服务器已安装：
- Node.js 18+
- MySQL 5.7+ 或 腾讯云TDSQL-C

#### 2️⃣ 上传代码
```bash
scp -r 绮管后台/* user@your-server:/var/www/qiguan/
```

#### 3️⃣ 安装依赖并构建
```bash
ssh user@your-server
cd /var/www/qiguan

# 后端依赖
npm install --production

# 前端构建
cd qiguanqianduan
npm install
npm run build
```

#### 4️⃣ 初始化数据库
```bash
cd /var/www/qiguan
node scripts/init_mysql_database.js
```

#### 5️⃣ 启动服务
```bash
# 使用 PM2 进程管理器（推荐）
npm install -g pm2
pm2 start index.js --name qiguan-backend

# 或直接启动
NODE_ENV=production node index.js
```

#### 6️⃣ 配置Nginx反向代理
```nginx
server {
    listen 443 ssl;
    server_name qimengzhiyue.cn;

    ssl_certificate /path/to/qimengzhiyue.cn_bundle.pem;
    ssl_certificate_key /path/to/qimengzhiyue.cn.key;

    # 前端静态文件
    location / {
        root /var/www/qiguan/qiguanqianduan/dist;
        try_files $uri $uri/ /index.html;
    }

    # API反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

---

## 🔍 故障排查

### 问题1：仍然显示"No Data"

**可能原因**:
1. 数据库未正确初始化
2. 环境变量配置错误
3. MySQL连接失败

**排查步骤**:
```bash
# 1. 检查数据库是否可连接
node -e "
const mysql = require('mysql2/promise');
mysql.createConnection({
  host: '10.0.0.16',
  port: 3306,
  user: 'QMZYXCX',
  password: 'LJN040821.',
  database: 'qmzyxcx'
}).then(conn => {
  console.log('✅ 数据库连接成功');
  return conn.end();
}).catch(err => {
  console.error('❌ 连接失败:', err.message);
});
"

# 2. 检查表是否存在
mysql -h 10.0.0.16 -P 3306 -u QMZYXCX -p'LJN040821.' qmzyxcx -e "SHOW TABLES;"

# 3. 检查是否有数据
mysql -h 10.0.0.16 -P 3306 -u QMZYXCX -p'LJN040821.' qmzyxcx -e "SELECT COUNT(*) as count FROM products;"
```

### 问题2：控制台报错

**常见错误及解决方案**:

| 错误信息 | 原因 | 解决方案 |
|---------|------|---------|
| `ER_ACCESS_DENIED_ERROR` | 用户名密码错误 | 检查.env中的DB_USER和DB_PASSWORD |
| `ECONNREFUSED` | MySQL服务未启动 | 检查MySQL服务状态 |
| `ER_BAD_DB_ERROR` | 数据库不存在 | 先创建数据库：`CREATE DATABASE qmzyxcx` |
| `Table doesn't exist` | 表未创建 | 执行初始化脚本 |

### 问题3：前端请求404

**检查项**:
1. Nginx配置是否正确（API路径 `/api/` 是否代理到后端）
2. 后端服务是否正常运行（端口3000）
3. CloudBase云函数是否部署成功

```bash
# 测试API是否可达
curl https://qimengzhiyue.cn/api/v1/health
```

预期返回：
```json
{
  "status": "ok",
  "database": true,
  "uptime": 123.456,
  "timestamp": "2026-04-09T..."
}
```

---

## 📊 修改文件清单

| 文件路径 | 修改类型 | 说明 |
|---------|---------|------|
| `qiguanqianduan/src/views/Dashboard.vue` | 修改 | 清除模拟数据，修复数据取值bug |
| `routes/products.js` | 修改 | 修正API响应格式 |
| `index.js` | 修改 | 增加数据库类型选择逻辑 |
| `.env.production` | 新增 | 生产环境配置文件 |
| `scripts/init_mysql_database.js` | 新增 | MySQL自动初始化脚本 |

---

## ⚠️ 重要提醒

1. **修改默认密码**: 
   - 管理员账户默认密码是 `admin123`，**上线前务必修改**
   - JWT密钥也要更换为强随机字符串

2. **备份数据库**: 
   - 定期备份MySQL数据库
   - 使用脚本：`mysqldump -h 10.0.0.16 -u QMZYXCX -p qmzyxcx > backup.sql`

3. **监控日志**:
   - 关注CloudBase云函数的运行日志
   - 检查数据库连接是否正常

4. **性能优化**:
   - 生产环境建议开启Redis缓存
   - 对频繁查询的接口添加索引

---

## 📞 技术支持

如遇到问题，请检查：
1. CloudBase控制台的云函数日志
2. MySQL数据库连接状态
3. 浏览器控制台的错误信息
3. Nginx/error.log 访问日志

---

**修复时间**: 2026-04-09  
**修复版本**: v1.0.1-production-fix  
**状态**: ✅ 已完成，待部署验证
