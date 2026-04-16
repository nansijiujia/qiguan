# 云服务器分步部署指南

> **目标**: 清理云服务器并重新部署最新后台代码  
> **时间**: 2026-04-16  
> **服务器**: 101.34.39.231 (腾讯云)  
> **路径**: /www/wwwroot/qiguan

---

## ⚠️ 重要提示

**在开始前请确认：**
- [x] 已备份 MySQL 数据库（使用 mysqldump 或腾讯云控制台快照）
- [x] 已记录 .env.production 中的数据库密码和配置
- [x] 本地代码已包含所有最新修复（Phase 1-3 完成）

---

## 🚀 部署步骤

### Step 1: 连接服务器并检查状态

```bash
# Windows PowerShell (以管理员身份运行)
ssh -i e:\1\qimengzhiyue.pem root@101.34.39.231

# 如果连接失败，尝试：
ssh -i e:\1\qimengzhiyue.pem -o StrictHostKeyChecking=no -o ConnectTimeout=30 root@101.34.39.231
```

**连接成功后执行：**
```bash
# 查看当前文件结构
ls -la /www/wwwroot/qiguan | head -20

# 检查磁盘空间
df -h /www/wwwroot

# 检查 PM2 状态
pm2 list
```

---

### Step 2: 备份当前配置（重要！）

```bash
# 创建备份目录
mkdir -p /tmp/deploy_backup_$(date +%Y%m%d)

# 备份 .env.production 文件
cp /www/wwwroot/qiguan/.env.production /tmp/deploy_backup_$(date +%Y%m%d)/ 2>/dev/null || echo "无.env.production"

# 备份 Nginx 配置
cp /www/server/panel/vhost/nginx/qimengzhiyue.cn.conf /tmp/deploy_backup_$(date +%Y%m%d)/ 2>/dev/null || echo "无Nginx配置"

# 记录当前文件列表
find /www/wwwroot/qiguan -type f > /tmp/deploy_backup_$(date +%Y%m%d)/file_list.txt

echo "✅ 备份完成，位置: /tmp/deploy_backup_$(date +%Y%m%d)"
```

---

### Step 3: 停止服务

```bash
# 停止所有 PM2 进程
pm2 stop all
pm2 delete all

# 停止 Nginx（可选，如果需要）
systemctl stop nginx || service nginx stop

echo "✅ 所有服务已停止"
```

---

### Step 4: 清理旧文件

```bash
# ⚠️ 危险操作！删除所有文件但保留目录
cd /www/wwwroot/qiguan

# 删除所有文件和子目录
rm -rf * .*  2>/dev/null || true

# 重建必要目录
mkdir -p logs uploads data backups node_modules

# 验证清理完成
ls -la

echo "✅ 清理完成"
```

---

### Step 5: 上传新代码（从本地）

**在本地 PowerShell 新开一个窗口执行：**

```powershell
# 使用 scp 批量上传核心文件
cd e:\1\绮管后台

# 上传后端 JS 文件（排除 node_modules）
scp -r -i ..\qimengzhiyue.pem `
    --exclude='node_modules' `
    --exclude='.git' `
    --exclude='qiguanqianduan' `
    --exclude='dist' `
    --exclude='coverage' `
    --exclude='*.log' `
    --exclude='*.backup' `
    . root@101.34.39.231:/www/wwwroot/qiguan/

# 或者使用 rsync（如果可用）
rsync -avz --progress `
    --exclude='node_modules' `
    --exclude='.git' `
    --exclude='qiguanqianduan' `
    --exclude='dist' `
    -e "ssh -i ../qimengzhiyue.pem" `
    ./ root@101.34.39.231:/www/wwwroot/qiguan/
```

**或者使用 SFTP 图形工具（推荐）：**
- 工具: WinSCP / FileZilla / Cyberduck
- 主机: 101.34.39.231
- 用户: root
- 密钥: e:\1\qimengzhiyue.pem
- 远程目录: /www/wwwroot/qiguan/
- 本地目录: e:\1\绮管后台\
- 排除: node_modules, .git, qiguanqianduan, dist, coverage, *.log

---

### Step 6: 上传前端构建产物

```bash
# 本地 PowerShell
cd e:\1\绮管后台\qiguanqianduan

# 先确保已构建
npm run build

# 上传 dist 目录内容到服务器根目录
scp -r -i ..\..\qimengzhiyue.pem `
    dist/* root@101.34.39.231:/www/wwwroot/qiguan/
```

---

### Step 7: 安装依赖并启动服务

**回到 SSH 会话（服务器端）：**

```bash
cd /www/wwwroot/qiguan

# 安装生产依赖
npm install --production

# 设置权限
chmod 600 .env.production

# 启动 PM2
pm2 start ecosystem.config.js

# 保存 PM2 配置
pm2 save

# 设置开机自启
pm2 startup

# 重启 Nginx
systemctl restart nginx || service nginx restart

echo "✅ 服务启动完成"
```

---

### Step 8: 验证部署

```bash
# 检查 PM2 状态
pm2 status
pm2 logs backend --lines 50

# 健康检查
curl -s http://127.0.0.1:3003/api/v1/health | jq .

# 详细健康检查
curl -s http://127.0.0.1:3003/api/v1/health/detailed | jq .

# 检查关键文件
test -f .env.package && echo "✅ .env.production 存在" || echo "❌ .env.production 缺失"
test -f index.js && echo "✅ index.js 存在" || echo "❌ index.js 缺失"
test -f package.json && echo "✅ package.json 存在" || echo "❌ package.json 缺失"
```

---

### Step 9: 外部验证

**在本地浏览器访问：**
- 后台管理: https://admin.qimengzhiyue.cn
- API健康检查: https://api.qimengzhiyue.cn/api/v1/health
- 前端首页: https://www.qimengzhiyue.cn

**测试清单：**
- [ ] 登录页面正常显示
- [ ] 登录功能正常（输入用户名密码）
- [ ] Dashboard 页面加载成功（无502错误）
- [ ] 商品列表正常显示
- [ ] 分类树形结构正确
- [ ] 订单列表可加载
- [ ] 用户管理可访问
- [ ] 优惠券模块正常

---

## 🔧 故障排查

### 问题 1: SSH 连接被拒绝
```bash
# 检查私钥权限（Linux/Mac）
chmod 600 qimengzhiyue.pem

# Windows: 确保私钥文件不被其他程序锁定
# 尝试用 Git Bash 或 WSL 运行 SSH 命令
```

### 问题 2: npm install 失败
```bash
# 清除缓存重试
npm cache clean --force
npm install --production --no-optional

# 如果还是失败，检查 Node 版本
node -v  # 需要 >= 14
```

### 问题 3: PM2 启动失败
```bash
# 查看详细错误
pm2 logs backend --err --lines 100

# 常见原因:
# 1. .env.production 缺失或格式错误
# 2. 数据库连接参数不正确
# 3. Node版本不兼容
# 4. 端口被占用
lsof -i :3003  # 检查端口占用
```

### 问题 4: 502 错误仍然存在
```bash
# 检查后端是否真的在运行
pm2 list
curl http://127.0.0.1:3003/api/v1/health

# 检查 Nginx 配置
cat /www/server/panel/vhost/nginx/qimengzhiyue.cn.conf | grep proxy_pass

# 检查 Nginx 错误日志
tail -100 /www/wwwlogs/qimengzhiyue.cn.error.log
```

---

## 📞 获取帮助

**如果遇到问题：**
1. 查看 PM2 日志: `pm2 logs`
2. 查看应用日志: `tail -f /www/wwwroot/qiguan/logs/app-error.log`
3. 检查系统日志: `journalctl -u nginx -f` (如果是 systemd 管理)
4. 截图错误信息并提供给技术支持

---

## ✅ 完成标志

当以下条件全部满足时，部署成功：

- [x] `pm2 status` 显示 backend 状态为 online
- [x] `curl http://127.0.0.1:3003/api/v1/health` 返回 {"status":"ok"}
- [x] 浏览器访问 https://admin.qimengzhiyue.cn 可以看到登录页面
- [x] 登录后 Dashboard 正常显示数据
- [x] 无 502/503/500 错误

---

**祝部署顺利！** 🚀
