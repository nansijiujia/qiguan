# 绮管电商 - 共用云服务器部署指南

## 📋 目录
- [架构概述](#架构概述)
- [部署前准备](#部署前准备)
- [首次部署流程](#首次部署流程)
- [日常维护](#日常维护)
- [故障排查](#故障排查)

---

## 🏗️ 架构概述

### 系统架构图

```
┌─────────────────────────────────────────────────────┐
│                  云服务器 (2核2G)                    │
│                                                     │
│  ┌──────────┐    ┌──────────┐    ┌──────────────┐  │
│  │  Nginx   │    │ Node.js  │    │   PM2        │  │
│  │ :80/443  │───>│  API     │    │ 进程管理器   │  │
│  │          │    │ :3000    │    │              │  │
│  └────┬─────┘    └────┬─────┘    └──────────────┘  │
│       │               │                            │
│       ▼               ▼                            │
│  ┌──────────┐   ┌──────────┐                       │
│  │ 前端静态 │   │ MySQL    │ (腾讯云TDSQL-C)      │
│  │ 文件服务 │   │ 数据库   │                       │
│  └──────────┘   └──────────┘                       │
└─────────────────────────────────────────────────────┘

域名路由:
├── qimengzhiyue.cn         -> 小程序API + 前端静态文件
├── admin.qimengzhiyue.cn   -> 后台管理系统
└── api.qimengzhiyue.cn     (可选) -> 纯API接口
```

### 服务端口分配

| 服务 | 端口 | 用途 |
|------|------|------|
| Nginx | 80/443 | Web服务器，HTTPS终止 |
| Node.js API | 3000 | 后端API服务（仅内网访问） |
| SSH | 22 | 远程管理（已限制IP） |
| MySQL | 3306 | 数据库（腾讯云TDSQL-C） |

---

## 🎯 部署前准备

### 必要条件

- [ ] 腾讯云轻量应用服务器（2核2G或更高）
- [ ] 域名：`qimengzhiyue.cn`（已备案）
- [ ] SSL证书（已有证书文件）
- [ ] 腾讯云MySQL数据库（TDSQL-C）
- [ ] 本地开发环境：Node.js、npm、Git

### 文件清单

在开始部署前，确认以下文件存在：

```
绮管后台/
├── nginx/conf.d/qiguan-dual-service.conf  # Nginx配置
├── ecosystem.config.dual.js                # PM2配置
├── deploy-dual.sh                          # 一键部署脚本
├── init-server.sh                          # 服务器初始化脚本
├── index.js                                # 后端入口
├── .env.production                         # 生产环境变量
└── qiguanqianduan/                         # Vue前端项目
```

---

## 🚀 首次部署流程（分3个阶段）

### 阶段1: 服务器环境初始化 ⏱️ 耗时约15分钟

#### 步骤1.1: 上传初始化脚本到服务器

**本地执行（Windows PowerShell）：**
```powershell
# 上传初始化脚本
scp init-server.sh root@你的服务器IP:/root/

# SSH登录服务器
ssh root@你的服务器IP
```

**或者使用工具上传：**
- 使用 WinSCP / FileZilla 将 `init-server.sh` 上传到 `/root/`

#### 步骤1.2: 执行初始化

```bash
# 登录服务器后执行
cd /root
chmod +x init-server.sh
./init-server.sh
```

**脚本会自动完成以下工作：**
1. ✅ 更新系统包
2. ✅ 安装Node.js LTS版本
3. ✅ 安装PM2进程管理器
4. ✅ 安装Nginx并配置
5. ✅ 创建项目目录结构
6. ✅ 配置防火墙（UFW）
7. ✅ 安装Fail2Ban防暴力破解
8. ✅ 系统性能优化
9. ✅ 配置日志轮转

#### 步骤1.3: 上传SSL证书

**本地执行：**
```bash
# 上传证书文件（你已有的证书）
scp qimengzhiyue.cn_bundle.pem root@服务器IP:/etc/nginx/ssl/
scp qimengzhiyue.cn.key root@服务器IP:/etc/nginx/ssl/
```

**设置权限（服务器上执行）：**
```bash
chmod 644 /etc/nginx/ssl/qimengzhiyue.cn_bundle.pem
chmod 600 /etc/nginx/ssl/qimengzhiyue.cn.key
```

---

### 阶段2: DNS域名解析配置 ⏱️ 即时生效

登录腾讯云控制台 → 域名解析 → 添加记录：

| 主机记录 | 记录类型 | 记录值 | TTL |
|---------|---------|--------|-----|
| @ | A | 你的服务器IP | 600 |
| www | A | 你的服务器IP | 600 |
| admin | CNAME | qimengzhiyue.cn | 600 |

**验证DNS生效：**
```bash
# 本地测试（等待几分钟后）
nslookup qimengzhiyue.cn
nslookup admin.qimengzhiyue.cn
```

---

### 阶段3: 应用部署 ⏱️ 耗时约5-10分钟

#### 步骤3.1: 配置部署脚本

编辑 [`deploy-dual.sh`](deploy-dual.sh)，修改顶部配置：

```bash
# ==================== 配置区（根据实际情况修改） ====================
SERVER_USER="root"                    # 服务器用户名
SERVER_IP="101.34.39.231"             # 替换为你的实际服务器IP
SERVER_PORT=22                        # SSH端口
REMOTE_DIR="/www/wwwroot/qiguan"      # 服务器上的项目目录
```

#### 步骤3.2: 执行一键部署

**本地执行（在项目根目录）：**
```bash
# Windows Git Bash 或 WSL
chmod +x deploy-dual.sh
./deploy-dual.sh production
```

**脚本会自动完成：**
1. ✅ 构建Vue前端项目（生产模式）
2. ✅ 上传后端代码到服务器
3. ✅ 上传前端构建产物到 `/var/www/admin/dist`
4. ✅ 安装依赖（`npm install --production`）
5. ✅ 启动/重启PM2管理的Node.js服务
6. ✅ 重载Nginx配置
7. ✅ 运行健康检查

#### 步骤3.3: 验证部署成功

**浏览器访问测试：**

| 地址 | 预期结果 | 用途 |
|------|---------|------|
| https://qimengzhiyue.cn/api/v1/health | JSON响应 | API健康检查 |
| https://admin.qimengzhiyue.cn | Vue页面加载 | 后台管理系统 |
| https://qimengzhiyue.cn/api-docs | Swagger界面 | API文档（可选） |

**命令行验证（SSH到服务器）：**
```bash
# 检查PM2进程状态
pm2 status

# 应该看到：
# ┌──────┬──────────┐
# │ name │ status   │
# ├──────┼──────────┤
# │ qiguan-backend │ online │
# └──────┴──────────┘

# 查看实时日志
pm2 logs qiguan-backend

# 测试API
curl http://localhost:3000/api/v1/health

# 查看Nginx状态
systemctl status nginx
```

---

## 📦 日常维护命令速查

### 应用管理

```bash
# 查看所有服务状态
pm2 status

# 重启后端API
pm2 restart qiguan-backend

# 查看最近100行日志
pm2 logs qiguan-backend --lines 100

# 清空日志
pm2 flush

# 监控资源使用
pm2 monit
```

### Nginx管理

```bash
# 测试配置语法
nginx -t

# 重载配置（不中断服务）
sudo systemctl reload nginx

# 完全重启（会短暂中断）
sudo systemctl restart nginx

# 查看访问日志
tail -f /var/log/nginx/qimengzhiyue_access.log

# 查看错误日志
tail -f /var/log/nginx/error.log
```

### 数据库备份（建议每日）

```bash
# 手动备份MySQL数据库
mysqldump -h 10.0.0.16 -u QMZYXCX -p'密码' qmzyxcx > backup_$(date +%Y%m%d).sql

# 自动备份脚本示例（添加到crontab）
echo "0 2 * * * mysqldump -h 10.0.0.16 -u QMZYXCX -p'密码' qmzyxcx > /backup/db_$(date +\%Y\%m\%d).sql" | crontab -
```

### 更新部署（代码更新后）

```bash
# 方法1: 一键部署（推荐）
./deploy-dual.sh production

# 方法2: 手动部署（如果一键脚本失败）
# 本地构建
cd qiguanqianduan && npm run build && cd ..

# 上传代码
rsync -avz --exclude 'node_modules' . root@服务器IP:/www/wwwroot/qiguan/

# 上传前端
scp -r qiguanqianduan/dist/* root@服务器IP:/var/www/admin/dist/

# 服务器上重启
ssh root@服务器IP "cd /www/wwwroot/qiguan && pm2 reload all"
```

---

## 🔧 故障排查

### 问题1: 无法访问网站

**症状**: 浏览器显示"无法访问此网站"

**排查步骤**:
```bash
# 1. 检查Nginx是否运行
systemctl status nginx

# 2. 检查端口监听
netstat -tlnp | grep -E ':(80|443|3000)'

# 3. 检查防火墙
ufw status

# 4. 测试本地访问
curl -I http://localhost

# 5. 检查DNS解析
nslookup qimengzhiyue.cn
```

**常见原因及解决**:
- ❌ Nginx未启动 → `systemctl start nginx`
- ❌ 防火墙阻止 → `ufw allow 80/tcp && ufw allow 443/tcp`
- ❌ DNS未生效 → 等待10分钟或检查腾讯云DNS配置
- ❌ SSL证书过期 → 续期证书并重载Nginx

---

### 问题2: API返回502 Bad Gateway

**症状**: 访问 `/api/v1/xxx` 返回502错误

**排查步骤**:
```bash
# 1. 检查Node.js进程是否运行
pm2 status

# 2. 查看Node.js日志
pm2 logs qiguan-backend --err

# 3. 检查端口3000是否监听
netstat -tlnp | grep 3000

# 4. 直接测试Node.js
curl http://localhost:3000/api/v1/health
```

**常见原因及解决**:
- ❌ Node.js崩溃 → `pm2 restart qiguan-backend` 并查看日志找原因
- ❌ 数据库连接失败 → 检查 `.env.production` 中数据库配置
- ❌ 内存不足 → 升级服务器或优化代码内存使用

---

### 问题3: 后台管理系统白屏

**症状**: 访问 `admin.qimengzhiyue.cn` 显示空白页

**排查步骤**:
```bash
# 1. 检查前端文件是否存在
ls -la /var/www/admin/dist/index.html

# 2. 检查Nginx配置
cat /etc/nginx/conf.d/qiguan.conf | grep "admin"

# 3. 查看浏览器控制台（F12）是否有JS错误

# 4. 检查API是否正常（后台系统需要调用API）
curl https://admin.qimengzhiyue.cn/api/v1/health
```

**常见原因及解决**:
- ❌ 前端未正确构建 → 重新执行 `./deploy-dual.sh`
- ❌ API地址配置错误 → 检查 `.env.production` 的 `VITE_API_BASE_URL`
- ❌ CORS跨域问题 → 检查后端CORS配置是否包含admin域名

---

### 问题4: 性能缓慢

**症状**: 页面加载慢，API响应时间长

**优化方案**:

```bash
# 1. 查看服务器资源使用
top
free -h

# 2. 检查PM2监控数据
pm2 monit

# 3. 分析Nginx日志中的慢请求
awk '{print $NF, $7}' /var/log/nginx/qimengzhiyue_access.log | sort -rn | head -20

# 4. 开启Gzip压缩（在Nginx配置中添加）
# 在server块中添加:
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml;
```

**性能优化建议**:
- ✅ 启用Nginx Gzip压缩
- ✅ 为静态资源设置长期缓存头
- ✅ 使用CDN加速静态资源（如图片、CSS、JS）
- ✅ 数据库查询优化（添加索引、避免N+1查询）
- ✅ 考虑升级服务器配置（当CPU持续>70%时）

---

## 📊 监控与告警建议

### 推荐监控项

| 监控指标 | 告警阈值 | 工具 |
|---------|---------|------|
| CPU使用率 | >80%持续5分钟 | 腾讯云监控 |
| 内存使用率 | >85% | PM2 + 自定义脚本 |
| 磁盘空间 | <20%剩余 | cron + 脚本 |
| API响应时间 | >3秒 | 自定义健康检查 |
| 错误率 | >5% | 日志分析 |

### 简单监控脚本示例

创建 `/opt/scripts/server-monitor.sh`:
```bash
#!/bin/bash
# 服务器资源监控脚本（可配合cron定期执行）

LOG_FILE="/var/log/qiguan/monitor.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# CPU使用率
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)

# 内存使用率
MEM_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100}')

# 磁盘使用率
DISK_USAGE=$(df -h / | tail -1 | awk '{print $5}' | cut -d'%' -f1)

# 写入日志
echo "$TIMESTAMP CPU:${CPU_USAGE}% MEM:${MEM_USAGE}% DISK:${DISK_USAGE}%" >> $LOG_FILE

# 告警逻辑（可通过邮件/微信通知）
if [ "$CPU_USAGE" -gt 80 ] || [ "$MEM_USAGE" -gt 85 ] || [ "$DISK_USAGE" -gt 90 ]; then
    echo "[ALERT] $TIMESTAMP High usage detected!" >> $LOG_FILE
fi
```

添加定时任务（每小时执行一次）：
```bash
echo "0 * * * * /opt/scripts/server-monitor.sh" | crontab -
```

---

## 🔒 安全加固清单

### 已自动配置的安全措施

- [x] UFW防火墙（仅开放必要端口）
- [x] Fail2Ban防暴力破解（SSH和Nginx认证）
- [x] SSL/TLS加密（TLS 1.2+）
- [x] 安全响应头（XSS保护、内容类型嗅探等）
- [x] 文件权限控制（私钥600，证书644）

### 建议额外配置

1. **修改SSH默认端口**
   ```bash
   # 编辑 /etc/ssh/sshd_config
   Port 2222  # 改为非标准端口
   
   # 更新防火墙规则
   ufw allow 2222/tcp comment 'Custom SSH'
   ufw delete allow 22/tcp
   ```

2. **禁用root远程登录（可选）**
   ```bash
   # 创建普通用户
   adduser deployer
   usermod -aG sudo deployer
   
   # 编辑 /etc/ssh/sshd_config
   PermitRootLogin no
   
   # 重启SSH
   systemctl restart sshd
   ```

3. **定期更新系统**
   ```bash
   # 设置自动安全更新
   apt install unattended-upgrades
   dpkg-reconfigure unattended-upgrades
   ```

4. **数据库访问限制**
   - 确保MySQL只允许服务器IP连接（腾讯云控制台配置安全组）
   - 定期备份数据库

---

## 📞 技术支持

如遇到问题无法解决：

1. **查看详细日志**:
   ```bash
   pm2 logs qiguan-backend --lines 200
   journalctl -u nginx -n 100
   ```

2. **收集诊断信息**:
   ```bash
   # 创建诊断报告
   echo "=== System Info ===" > /tmp/diagnosis.txt
   uname -a >> /tmp/diagnosis.txt
   free -h >> /tmp/diagnosis.txt
   df -h >> /tmp/diagnosis.txt
   pm2 list >> /tmp/diagnosis.txt
   netstat -tlnp >> /tmp/diagnosis.txt
   ```

3. **回滚部署**（如果更新导致问题）:
   ```bash
   # 回滚到上一个版本
   pm2 rollback qiguan-backend
   
   # 或者手动恢复备份
   ```

---

## ✅ 部署检查清单

首次部署完成后，逐项确认：

- [ ] 服务器可以通过SSH访问
- [ ] Node.js和PM2正常运行 (`pm2 status`)
- [ ] Nginx运行且配置正确 (`nginx -t` 无报错)
- [ ] SSL证书有效且未过期
- [ ] DNS解析正确（主域名和子域名都指向服务器IP）
- [ ] 防火墙已开启且规则正确 (`ufw status`)
- [ ] 可以通过HTTPS访问 `https://qimengzhiyue.cn/api/v1/health`
- [ ] 可以通过HTTPS访问 `https://admin.qimengzhiyue.cn`
- [ ] 后台管理系统可以正常登录和使用
- [ ] Fail2Ban正在运行 (`systemctl status fail2ban`)
- [ ] 数据库连接正常（查看后端日志无连接错误）
- [ ] 日志轮转已配置 (`cat /etc/logrotate.d/qiguan`)
- [ ] 已设置定时数据库备份任务

全部打勾后，恭喜！🎉 你的电商系统已经成功上线！

---

## 📝 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-04-10 | 初始版本，支持双服务共用部署 |

---

**最后更新时间**: 2026-04-10  
**适用环境**: Ubuntu 20.04+/Debian 11+, Node.js 18+, Nginx 1.18+
