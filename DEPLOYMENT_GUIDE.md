# 绮管后台 - 云服务器全自动部署方案 v3.0

## 📋 目录
- [架构概览](#-架构概览)
- [快速开始](#-快速开始)
- [首次部署](#-首次部署)
- [日常使用](#-日常使用)
- [自动化流程](#-自动化流程)
- [故障排查](#-故障排查)

---

## 🏗️ 架构概览

### **部署前后对比**

| 项目 | ❌ 旧方案（CloudBase） | ✅ 新方案（一体化） |
|------|------------------------|---------------------|
| **前端托管** | CloudBase静态托管 | Nginx直接托管 |
| **后端服务** | CloudBase云函数 | PM2 + Node.js |
| **数据库** | 腾讯云MySQL | 腾讯云MySQL |
| **更新方式** | 前后端分开部署 | **一键部署** |
| **缓存问题** | CDN缓存导致旧版本 | **无缓存问题** |
| **复杂度** | 两套部署流程 | **一套搞定** |

### **系统架构图**

```
┌─────────────────────────────────────────┐
│         用户浏览器 (Chrome/Edge)         │
└──────────────┬──────────────────────────┘
               │ HTTPS :443
               ▼
┌─────────────────────────────────────────┐
│            Nginx 反向代理                │
│    ┌──────────────────────────────┐     │
│    │ /api/* → Node.js:3000 (后端) │     │
│    │ /* → dist/ (前端静态文件)      │     │
│    └──────────────────────────────┘     │
└──────────────┬──────────────────────────┘
               │
        ┌──────┴──────┐
        ▼             ▼
   ┌─────────┐  ┌──────────┐
   │ PM2 +   │  │ 静态文件  │
   │ Node.js │  │ /dist/   │
   │ :3000   │  │          │
   └────┬─────┘  └──────────┘
        │
        ▼
   ┌──────────┐
   │ MySQL    │
   │ 云数据库 │
   └──────────┘
```

---

## 🚀 快速开始

### **前提条件**
- ✅ 云服务器（已配置）
- ✅ Node.js 18+ 已安装
- ✅ Git 已安装
- ✅ Nginx 已安装
- ✅ PM2 已全局安装 (`npm install -g pm2`)

---

## 📦 首次部署（一次性操作）

### **第1步：克隆代码到服务器**

```bash
# SSH登录到服务器后执行
cd /var/www
git clone <你的Git仓库地址> qiguan
cd qiguan
git checkout 绮管
```

### **第2步：配置环境变量**

```bash
# 创建 .env 文件
cat > .env << 'EOF'
DB_TYPE=mysql
DB_HOST=10.0.0.16
DB_PORT=3306
DB_USER=QMZYXCX
DB_PASSWORD=LJN040821.
DB_NAME=qmzyxcx
NODE_ENV=production
JWT_SECRET=qiguan-production-secret-key-2026-change-me-at-least-32-characters-long
EOF
```

### **第3步：创建数据库选择器**

```bash
cat > db_selector.js << 'EOF'
let db;
try {
  db = require('./db_mysql');
  console.log('[DB] MySQL Mode');
} catch(e) {
  db = require('./db');
  console.log('[DB] SQLite Mode');
}
module.exports = db;
EOF
```

### **第4步：初始化MySQL数据库**（首次必须）

```bash
node scripts/init_mysql_database.js
```

预期输出：
```
✅ 已连接到MySQL数据库
📝 表结构创建成功
✅ 初始数据插入完成
管理员账号: admin / admin123
```

### **第5步：执行一键部署脚本**

```bash
chmod +x auto-deploy.sh
./auto-deploy.sh
```

脚本会自动完成：
1. ✅ 安装所有依赖
2. ✅ 构建前端项目
3. ✅ 配置Nginx
4. ✅ 启动PM2服务
5. ✅ 验证部署结果

### **第6步：验证部署成功**

访问：`https://qimengzhiyue.cn/dashboard`

应该看到：
- ✅ 统计卡片显示 '0' 或真实数据（不是假数据）
- ✅ 图表显示空状态
- ✅ 所有页面正常工作

---

## 🔄 日常使用

### **方式1：手动触发部署（推荐用于测试）**

```bash
cd /var/www/qiguan
./auto-deploy.sh
```

### **方式2：Git Push 自动部署（推荐用于生产）⭐**

#### 配置自动部署Hook：

```bash
# 在服务器上初始化Git裸仓库（如果还没有）
cd /var/www
git clone --bare qiguan qiguan.git

# 复制post-receive hook
cp hooks/post-receive qiguan.git/hooks/
chmod +x qiguan.git/hooks/post-receive
```

#### 本地推送触发部署：

```bash
# 在本地电脑执行
git add .
git commit -m "fix: 更新功能"
git push origin 绮管
```

**Push完成后**：
- ✅ 服务器自动拉取代码
- ✅ 自动构建前端
- ✅ 自动重启服务
- ✅ 无需手动干预！

#### 查看部署日志：

```bash
# 实时查看部署进度
tail -f /var/log/qiguan/deploy-*.log

# 或查看最近的部署记录
ls -lt /var/log/qiguan/ | head -10
```

---

## ⚙️ 自动化流程详解

### **完整的工作流**

```
开发者本地电脑                    云服务器
     │                              │
     ├─ 1. 修改代码                 │
     ├─ 2. git commit               │
     ├─ 3. git push origin 绮管 ────►│  4. post-receive hook 触发
     │                              │  5. 执行 auto-deploy.sh
     │                              │  ├── git pull 拉取代码
     │                              │  ├── npm install 安装依赖
     │                              │  ├── npm run build 构建前端
     │                              │  ├── nginx -t && reload 重载Nginx
     │                              │  └── pm2 restart 重启后端
     │                              │  
     ◄─ 6. 访问网站验证 ────────────│  7. 部署完成！
```

### **部署脚本功能清单**

| 步骤 | 功能 | 耗时 |
|------|------|------|
| 1️⃣ 环境预检 | 检查Node/Nginx/PM2/Git | <5秒 |
| 2️⃣ 数据备份 | 备份dist和data目录 | <10秒 |
| 3️⃣ 拉取代码 | git pull最新代码 | <15秒 |
| 4️⃣ 环境配置 | 生成.env和db_selector.js | <3秒 |
| 5️⃣ 安装&构建 | npm install + npm run build | **60-120秒** |
| 6️⃣ Web服务器 | 配置并重载Nginx | <5秒 |
| 7️⃣ 服务重启 | pm2 restart + 验证 | <10秒 |
| **总计** | | **~2-3分钟** |

---

## 🔧 故障排查

### **常见问题及解决方案**

#### 问题1：部署后还是旧版本

**原因**：浏览器缓存

**解决方案**：
```bash
# 方法1：强制刷新浏览器
Windows: Ctrl + Shift + R
Mac: Cmd + Shift + R

# 方法2：清除CDN缓存（如果用了CDN）
# 方法3：检查Nginx是否正确重载
sudo nginx -t && sudo systemctl reload nginx

# 方法4：查看线上文件时间
curl -sI https://qimengzhiyue.cn/ | grep -i "last-modified"
```

#### 问题2：PM2启动失败

**诊断命令**：
```bash
# 查看PM2错误日志
pm2 logs qiguan-backend --lines 50 --err

# 检查端口占用
lsof -i :3000

# 手动测试能否启动
NODE_ENV=production node index.js
```

#### 问题3：MySQL连接失败

**测试连接**：
```bash
node -e "
const mysql = require('mysql2/promise');
mysql.createConnection({
  host: '10.0.0.16',
  port: 3306,
  user: 'QMZYXCX',
  password: 'LJN040821.',
  database: 'qmzyxcx'
}).then(c => { console.log('✅ OK'); return c.end(); })
  .catch(e => console.error('❌', e.message));
"
```

#### 问题4：前端构建失败

**解决步骤**：
```bash
cd qiguanqianduan

# 清除缓存重新安装
rm -rf node_modules package-lock.json .vite
npm install

# 再次构建
npm run build -- --debug

# 如果还是失败，查看详细错误
npm run build 2>&1 | tail -50
```

#### 问题5：Nginx配置错误

**诊断与修复**：
```bash
# 测试Nginx配置语法
sudo nginx -t

# 如果有错误，查看具体位置
sudo nginx -t 2>&1 | grep -A5 "error"

# 修复后重载
sudo systemctl reload nginx
```

---

## 📊 监控和维护

### **日常监控命令**

```bash
# 查看PM2进程状态
pm2 status

# 实时查看日志
pm2 logs qiguan-backend --lines 100

# 查看系统资源
pm2 monit

# 查看最近部署日志
ls -lt /var/log/qiguan/deploy-*.log | head -5

# 查看Nginx访问日志
tail -f /var/log/nginx/access.log

# 查看系统负载
uptime
free -h
df -h
```

### **定期维护任务**

#### 每周备份：
```bash
#!/bin/bash
# backup_weekly.sh
BACKUP_DIR="/var/www/backups/weekly_$(date +%Y%m%d)"
mkdir -p "$BACKUP_DIR"

# 备份数据库
mysqldump -h 10.0.0.16 -u QMZYXCX -p'LJN040821.' qmzyxcx > "$BACKUP_DIR/db.sql"

# 备份前端dist
cp -r /var/www/qiguan/qiguanqianduan/dist "$BACKUP_DIR/"

# 备份配置文件
cp /var/www/qiguan/.env "$BACKUP_DIR/"
cp /var/www/qiguan/ecosystem.config.js "$BACKUP_DIR/"

echo "✅ 备份完成: $BACKUP_DIR"
```

#### 设置定时任务：
```bash
crontab -e

# 添加以下行（每周日凌晨3点自动备份）
0 3 * * 0 /var/www/scripts/backup_weekly.sh >> /var/log/qiguan/backup.log 2>&1

# 添加PM2开机自启（如果还没配置）
@reboot cd /var/www/qiguan && pm2 resurrect
```

---

## 🎯 最佳实践

### **1. 版本控制策略**
- ✅ 使用 `绮管` 分支作为生产分支
- ✅ 提交信息格式：`type: description`
  - `feat: 新增xxx功能`
  - `fix: 修复xxx问题`
  - `docs: 更新文档`
- ✅ 重要变更前先在测试环境验证

### **2. 安全建议**
- ✅ 定期更换JWT_SECRET（至少90天一次）
- ✅ 限制API访问频率（已配置rate-limit）
- ✅ 定期备份数据库
- ✅ 监控异常日志

### **3. 性能优化**
- ✅ 开启Gzip压缩（已在Nginx配置中）
- ✅ 静态资源设置长期缓存
- ✅ HTML文件禁用缓存（确保用户获取最新版本）
- ✅ 使用PM2集群模式（多核CPU）

---

## 📞 技术支持

如遇到问题：

1. **查看文档**：本文件的[故障排查](#-故障排查)章节
2. **查看日志**：
   ```bash
   # 部署日志
   cat /var/log/qiguan/deploy-$(date +%Y%m%d)*.log
   
   # PM2日志
   pm2 logs qiguan-backend --lines 200
   
   # Nginx日志
   tail -100 /var/log/nginx/error.log
   ```
3. **快速回滚**：
   ```bash
   # 回滚到上一个版本
   cd /var/www/qiguan
   git log --oneline -5
   git revert HEAD
   ./auto-deploy.sh
   ```

---

## 📝 更新日志

### v3.0 (2026-04-09)
- ✅ 新增：前后端一体化部署（无需CloudBase静态托管）
- ✅ 新增：Nginx配置自动生成
- ✅ 新增：Git Post-Receive Hook自动触发
- ✅ 新增：PM2 Ecosystem配置
- ✅ 新增：完整的故障排查指南
- ✅ 优化：部署脚本增加详细日志
- ✅ 修复：JWT_SECRET默认值机制
- ✅ 修复：数据库选择器自动切换

### v2.0 (2026-04-09)
- ✅ 修复：仪表盘模拟数据清除
- ✅ 修复：API响应格式统一
- ✅ 新增：MySQL支持

### v1.0 (2026-04-08)
- ✅ 初始版本
- ✅ 基础部署功能

---

**最后更新**: 2026-04-09  
**维护团队**: 绮管技术团队  
**技术支持**: 见本文档[故障排查](#-故障排查)章节
