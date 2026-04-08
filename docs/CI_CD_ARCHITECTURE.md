# 绮管电商后台系统 - CI/CD 自动化部署架构文档

## 📋 目录
- [1. 架构概览](#1-架构概览)
- [2. 部署架构图](#2-部署架构图)
- [3. Git Hook 工作流程](#3-git-hook-工作流程)
- [4. PM2 进程管理策略](#4-pm2-进程管理策略)
- [5. Nginx 反向代理配置](#5-nginx-反向代理配置)
- [6. 环境隔离方案](#6-环境隔离方案)
- [7. 部署脚本说明](#7-部署脚本说明)
- [8. 监控与日志](#8-监控与日志)
- [9. 故障恢复机制](#9-故障恢复机制)

---

## 1. 架构概览

### 服务器信息
```
服务器IP: 101.34.39.231
Git仓库: /home/git/repo.git (裸仓库)
部署目录: /var/www/qiguan
Node.js路径: /usr/local/node
域名: qimengzhiyue.cn

PM2进程:
  - qiguan-backend (后端API服务, 端口3000)
  - qiguan-frontend (前端静态资源, 端口8080)
```

### 技术栈
- **版本控制**: Git + Git Hooks
- **后端**: Node.js >= 18.x + Express/Koa
- **前端**: Vue.js 3 + Vite
- **进程管理**: PM2
- **Web服务器**: Nginx (反向代理 + 静态资源)
- **数据库**: MySQL / SQLite
- **日志**: PM2 Logs + 自定义部署日志

---

## 2. 部署架构图

### 完整部署流程图

```
┌─────────────────────────────────────────────────────────────────┐
│                        开发者本地环境                            │
│  ┌──────────┐    ┌──────────┐    ┌──────────────┐              │
│  │  VS Code │ → │   Git    │ → │  git push     │              │
│  │  编辑器   │    │  提交代码 │    │  推送到远程   │              │
│  └──────────┘    └──────────┘    └──────┬───────┘              │
└────────────────────────────────────────┼────────────────────────┘
                                         │ SSH/Git Protocol
                                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     生产服务器 (101.34.39.231)                  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Git 裸仓库                           │   │
│  │            /home/git/repo.git                          │   │
│  │                                                         │   │
│  │   ┌─────────────────────────────────────────┐          │   │
│  │   │         post-receive Hook               │          │   │
│  │   │  ┌─────────────────────────────────┐   │          │   │
│  │   │  │ 1. 检测分支 (仅处理 绮管 分支)   │   │          │   │
│  │   │  │ 2. 文件锁检查 (防止并发)         │   │          │   │
│  │   │  │ 3. 健康检查 (Node/npm/PM2)       │   │          │   │
│  │   │  │ 4. 备份当前版本                   │   │          │   │
│  │   │  │ 5. 检出代码到工作目录             │   │          │   │
│  │   │  │ 6. 安装依赖 (npm install)        │   │          │   │
│  │   │  │ 7. 构建项目 (npm run build)      │   │          │   │
│  │   │  │ 8. 重启PM2服务                   │   │          │   │
│  │   │  │ 9. 健康验证                       │   │          │   │
│  │   │  │ 10. 记录部署日志                  │   │          │   │
│  │   │  └─────────────────────────────────┘   │          │   │
│  │   └─────────────────────────────────────────┘          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                         │                                       │
│                         ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 部署工作目录                             │   │
│  │              /var/www/qiguan                            │   │
│  │                                                         │   │
│  │  ┌─────────────┐    ┌─────────────┐    ┌──────────┐  │   │
│  │  │  后端代码    │    │  前端代码    │    │  备份目录 │  │   │
│  │  │ functions/  │    │qiguanqianduan│    │ backups/ │  │   │
│  │  │ routes/    │    │  dist/       │    │          │  │   │
│  │  │ middleware/ │    │  node_modules│    │          │  │   │
│  │  └─────────────┘    └─────────────┘    └──────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                         │                                       │
│         ┌───────────────┼───────────────┐                      │
│         ▼               ▼               ▼                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                │
│  │   PM2      │  │   PM2      │  │  Nginx     │                │
│  │ Backend    │  │ Frontend   │  │ :80/:443   │                │
│  │ :3000      │  │ :8080      │  │            │                │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘                │
│        │               │               │                      │
│        └───────────────┴───────────────┘                      │
│                        │                                      │
│                        ▼                                      │
│              ┌─────────────────┐                              │
│              │   用户浏览器     │                              │
│              │ qimengzhiyue.cn │                              │
│              └─────────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
```

### 数据流图

```
用户请求
    │
    ▼
┌─────────┐
│  Nginx  │ ← 端口 80/443 (HTTPS)
│  :80    │
└────┬────┘
     │
     ├──────────────────┬──────────────────┐
     │                  │                  │
     ▼                  ▼                  ▼
 /api/*           /admin/*           静态资源
     │                  │                  │
     ▼                  ▼                  ▼
┌─────────┐     ┌─────────┐     ┌─────────┐
│Backend  │     │Frontend │     │ Nginx   │
│PM2:3000 │     │PM2:8080 │     │ 直接响应 │
└────┬────┘     └─────────┘     └─────────┘
     │
     ▼
┌─────────┐
│ MySQL   │
│ /SQLite │
└─────────┘
```

---

## 3. Git Hook 工作流程

### post-receive Hook 详细流程

```
开发者执行 git push
        │
        ▼
Git 服务器接收推送数据
        │
        ▼
触发 post-receive hook
        │
        ├── 读取标准输入: oldrev newrev refname
        │
        ├── 解析分支名称
        │       │
        │       ├── 如果不是 "绮管" 分支 → 跳过，结束
        │       └── 如果是 "绮管" 分支 → 继续
        │
        ├── 检查部署锁文件 (/tmp/qiguan_deploy.lock)
        │       │
        │       ├── 锁存在且进程存活 → 退出，提示"部署进行中"
        │       └── 锁不存在或过期 → 创建锁，继续
        │
        ├── 执行健康检查 (pre_deploy_check.sh)
        │       │
        │       ├── Node.js 版本检查 (>=18.x)
        │       ├── npm 可用性检查
        │       ├── PM2 安装检查
        │       ├── 端口占用检查 (3000, 8080)
        │       ├── 磁盘空间检查 (>=500MB)
        │       ├── 内存空间检查 (>=256MB)
        │       └── .env 文件检查
        │
        ├── 备份当前版本
        │       │
        │       ├── 创建时间戳备份目录
        │       │   格式: backups/YYYYMMDD_HHMMSS/
        │       ├── 复制当前代码和构建产物
        │       └── 保留最近5个备份，删除更早的
        │
        ├── 检出代码到工作目录
        │       └── git checkout -f 绮管
        │
        ├── 安装依赖
        │       │
        │       ├── npm install --production=false
        │       ├── 失败 → 自动回滚到上一个备份
        │       └── 成功 → 继续
        │
        ├── 构建项目
        │       │
        │       ├── npm run build (前端)
        │       ├── 失败 → 自动回滚到上一个备份
        │       └── 成功 → 继续
        │
        ├── 重启服务
        │       │
        │       ├── pm2 restart all
        │       ├── 失败 → 尝试 pm2 start
        │       ├── 再失败 → 自动回滚到上一个备份
        │       └── 成功 → 继续
        │
        ├── 健康验证 (可选)
        │       └── curl http://localhost:3000/api/health
        │
        ├── 清理旧日志 (保留7天)
        │
        ├── 记录部署成功日志
        │
        ├── 发送通知 (可扩展: Webhook/邮件/钉钉)
        │
        └── 删除锁文件，完成部署
```

### Hook 触发时机

| Hook名称 | 触发时机 | 用途 |
|---------|---------|------|
| pre-receive | 接收数据前 | 权限校验、分支保护 |
| **post-receive** | **接收完成后** | **自动部署** |
| update | 更新每个引用前 | 强制策略检查 |

---

## 4. PM2 进程管理策略

### 进程配置 (ecosystem.config.js)

```javascript
module.exports = {
  apps: [
    {
      name: 'qiguan-backend',
      script: './index.js',
      cwd: '/var/www/qiguan',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      // 日志配置
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: '/var/log/qiguan/backend-error.log',
      out_file: '/var/log/qiguan/backend-out.log',
      // 自动重启配置
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      // 内存限制
      max_memory_restart: '500M'
    },
    {
      name: 'qiguan-frontend',
      script: './qiguanqianduan/server.js',  // 或使用 serve
      cwd: '/var/www/qiguan',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 8080
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: '/var/log/qiguan/frontend-error.log',
      out_file: '/var/log/qiguan/frontend-out.log',
      autorestart: true,
      max_memory_restart: '300M'
    }
  ]
}
```

### PM2 常用命令

```bash
# 启动所有服务
pm2 start ecosystem.config.js --env production

# 重启所有服务
pm2 restart all

# 重启指定服务
pm2 restart qiguan-backend
pm2 restart qiguan-frontend

# 查看状态
pm2 status
pm2 list

# 查看实时日志
pm2 logs
pm2 logs qiguan-backend

# 监控面板
pm2 monit

# 停止服务
pm2 stop all

# 删除服务
pm2 delete all

# 保存进程列表 (开机自启)
pm2 save
pm2 startup  # 执行输出命令设置开机自启
```

### PM2 高级特性

#### 1. 零停机重启 (Graceful Reload)
```bash
# 平滑重启（先启动新进程，再关闭旧进程）
pm2 reload all
```

#### 2. 集群模式 (Cluster Mode)
```javascript
// 多核CPU利用
instances: 'max',  // 或指定数字如 2
exec_mode: 'cluster'
```

#### 3. 进程监控
```bash
# 安装监控模块
pm2 install pm2-server-monit
pm2 plus
```

---

## 5. Nginx 反向代理配置

### 主配置文件 (/etc/nginx/sites-available/qimengzhiyue.cn)

```nginx
# HTTP → HTTPS 重定向
server {
    listen 80;
    server_name qimengzhiyue.cn www.qimengzhiyue.cn;
    
    # Let's Encrypt 验证路径
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    # 其他请求重定向到HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS 主配置
server {
    listen 443 ssl http2;
    server_name qimengzhiyue.cn www.qimengzhiyue.cn;

    # SSL证书配置 (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/qimengzhiyue.cn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/qimengzhiyue.cn/privkey.pem;

    # SSL优化配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Gzip压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    # API请求 → 后端 (PM2:3000)
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        
        # WebSocket支持 (如果需要)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        
        # 传递真实IP
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # 缓存控制
        proxy_cache_bypass $http_upgrade;
    }

    # 管理后台 → 前端 (PM2:8080)
    location /admin {
        alias /var/www/qiguan/qiguanqianduan/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        
        # 前端静态资源
        root /var/www/qiguan/qiguanqianduan/dist;
    }

    # 上传文件大小限制
    client_max_body_size 50M;

    # 访问日志
    access_log /var/log/nginx/qimengzhiyue_access.log;
    error_log /var/log/nginx/qimengzhiyue_error.log;
}
```

### Nginx 性能优化建议

```nginx
# 在 http 块中添加
worker_processes auto;
worker_rlimit_nofile 65535;

events {
    worker_connections 2048;
    use epoll;
    multi_accept on;
}

# 连接优化
keepalive_timeout 65;
keepalive_requests 1000;

# 缓冲区优化
client_body_buffer_size 128k;
client_max_body_size 50m;
proxy_buffer_size 16k;
proxy_buffers 4 64k;
```

---

## 6. 环境隔离方案

### 三环境架构

```
┌─────────────────────────────────────────────────────────────┐
│                      开发环境 (Development)                  │
│  ─────────────────────────────────────────────────────────  │
│  • 分支: develop / feature/*                                │
│  • 域名: dev.qimengzhiyue.cn (可选)                        │
│  • 数据库: qiguan_dev (开发数据库)                          │
│  • Node: 开启调试模式 (NODE_ENV=development)                │
│  • 特性: 热重载、详细错误信息、Source Map                   │
│  • 部署: 手动触发或自动 (push to develop)                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ 合并代码
┌─────────────────────────────────────────────────────────────┐
│                      测试环境 (Staging)                      │
│  ─────────────────────────────────────────────────────────  │
│  • 分支: staging / release/*                                │
│  • 域名: staging.qimengzhiyue.cn (可选)                    │
│  • 数据库: qiguan_staging (测试数据库)                      │
│  • Node: 生产模式但允许测试接口 (NODE_ENV=staging)          │
│  • 特性: 接近生产、性能测试、QA验收                          │
│  • 部署: 自动 (push to staging) 或手动审批                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ 发布审批
┌─────────────────────────────────────────────────────────────┐
│                      生产环境 (Production)                   │
│  ─────────────────────────────────────────────────────────  │
│  • 分支: 绮管 (main/master)                                 │
│  • 域名: qimengzhiyue.cn                                   │
│  • 数据库: qiguan_prod (生产数据库)                         │
│  • Node: 生产模式 (NODE_ENV=production)                    │
│  • 特性: 性能优先、安全加固、日志完整                        │
│  • 部署: 自动 (push to 绮管)                                │
└─────────────────────────────────────────────────────────────┘
```

### 环境变量管理

#### .env 文件结构

```
项目根目录/
├── .env                  # 当前环境变量 (gitignore)
├── .env.example          # 变量模板 (提交到git)
├── .env.development      # 开发环境覆盖
├── .env.staging          # 测试环境覆盖
└── .env.production       # 生产环境覆盖
```

#### 环境差异对比

| 配置项 | Development | Staging | Production |
|--------|-------------|---------|------------|
| NODE_ENV | development | staging | production |
| DEBUG | true | false | false |
| LOG_LEVEL | debug | info | warn |
| 数据库 | localhost:3306/dev | staging-db:3306/stage | prod-db:3306/prod |
| JWT_SECRET | dev-secret-key | staging-secret-key | [强密钥] |
| CORS | * | staging.qimengzhiyue.cn | qimengzhiyue.cn |
| 缓存 | 关闭 | Redis (小) | Redis (集群) |
| 压缩 | 关闭 | 开启 | 开启+优化 |

---

## 7. 部署脚本说明

### 脚本清单

| 脚本文件 | 功能 | 使用场景 |
|---------|------|---------|
| `post-receive` | Git Hook主脚本 | 自动触发部署 |
| `scripts/pre_deploy_check.sh` | 部署前健康检查 | 验证环境就绪 |
| `scripts/rollback.sh` | 版本回滚 | 快速恢复稳定版本 |
| `scripts/setup_env.sh` | 环境配置初始化 | 首次部署/重置配置 |
| `scripts/analyze_logs.sh` | 日志分析工具 | 运维监控、问题排查 |

### 脚本调用关系

```
post-receive (Git Hook)
    │
    ├──→ pre_deploy_check.sh (健康检查)
    │       │
    │       ├── Node.js 版本 ✓
    │       ├── npm 可用性 ✓
    │       ├── PM2 状态 ✓
    │       ├── 端口占用 ✓
    │       ├── 磁盘空间 ✓
    │       ├── 内存空间 ✓
    │       └── .env 文件 ✓
    │
    ├──→ 备份当前版本
    │       └── 备份到 /var/www/qiguan/backups/
    │
    ├──→ npm install & npm run build
    │       │
    │       ├── 成功 → 继续
    │       └── 失败 → rollback.sh (自动回滚)
    │
    ├──→ pm2 restart
    │       │
    │       ├── 成功 → 完成
    │       └── 失败 → rollback.sh (自动回滚)
    │
    └──→ 记录日志到 deploy.log
            │
            └──→ analyze_logs.sh (分析统计)
```

---

## 8. 监控与日志

### 日志体系

```
/var/log/qiguan/
├── deploy/                          # 部署日志
│   ├── deploy_20260408_143022.log   # 单次部署详情
│   ├── deploy_20260408_150105.log
│   └── ...
├── deploy.log                       # 部署汇总日志
├── backend-error.log                # 后端错误日志 (PM2)
├── backend-out.log                  # 后端输出日志 (PM2)
├── frontend-error.log               # 前端错误日志 (PM2)
├── frontend-out.log                 # 前端输出日志 (PM2)
└── rollback.log                     # 回滚操作日志

/var/log/nginx/
├── qimengzhiyue_access.log          # Nginx访问日志
└── qimengzhiyue_error.log           # Nginx错误日志
```

### 日志格式规范

```
[2026-04-08 14:30:22] ==========================================
[2026-04-08 14:30:22] 🚀 开始自动部署流程
[2026-04-08 14:30:22] ==========================================
[2026-04-08 14:30:22] 收到推送: 分支=绮管, oldrev=abc123, newrev=def456
[2026-04-08 14:30:23] ✅ 健康检查通过
[2026-04-08 14:30:23] 📦 正在备份当前版本...
[2026-04-08 14:30:24] ✅ 备份完成: backups/20260408_143023
[2026-04-08 14:30:25] ✅ 代码检出成功
[2026-04-08 14:31:15] ✅ npm install 完成
[2026-04-08 14:32:45] ✅ 构建完成
[2026-04-08 14:32:46] ✅ 服务重启成功
[2026-04-08 14:32:46] ==========================================
[2026-04-08 14:32:46] ✅ 部署完成！耗时: 124秒
[2026-04-08 14:32:46] ==========================================
```

### 监控指标

| 指标类型 | 监控项 | 告警阈值 | 工具 |
|---------|-------|---------|------|
| 服务可用性 | HTTP响应码 | 非200 > 5% | UptimeRobot |
| 响应时间 | P95延迟 | > 3秒 | PM2 + 自定义 |
| 错误率 | 5xx错误 | > 1% | Nginx日志 |
| 资源使用 | CPU/内存 | CPU>80%, MEM>90% | PM2 monit |
| 磁盘空间 | 使用率 | > 85% | 系统脚本 |
| 部署状态 | 成功/失败 | 连续失败>3次 | 部署日志 |

---

## 9. 故障恢复机制

### 自动回滚触发条件

```
部署失败时自动回滚:
┌─────────────────────────────────────────┐
│ 1. npm install 失败                     │ → 回滚到上一版本
│ 2. npm run build 失败                   │ → 回滚到上一版本
│ 3. pm2 restart/start 失败               │ → 回滚到上一版本
│ 4. 健康检查失败 (超时/非200)            │ → 回滚到上一版本
└─────────────────────────────────────────┘
```

### 回滚流程

```
检测到部署失败
    │
    ▼
记录错误信息到日志
    │
    ▼
停止当前失败的部署
    │
    ▼
从备份目录恢复最近的成功版本
    │
    ├── 恢复代码文件
    ├── 恢复node_modules (如果有)
    └── 恢复dist构建产物
    │
    ▼
重启PM2服务
    │
    ▼
验证服务正常 (健康检查)
    │
    ▼
发送回滚通知
    │
    ▼
记录回滚日志
```

### 手动回滚

```bash
# 查看可用备份
bash scripts/rollback.sh --list

# 回滚到指定版本
bash scripts/rollback.sh --version 20260408_143023

# 回滚到最近一个版本
bash scripts/rollback.sh --latest
```

### 应急预案

| 场景 | 处理步骤 | 恢复时间目标 |
|-----|---------|------------|
| 部署失败 | 自动回滚 + 通知 | < 30秒 |
| 服务崩溃 | PM2自动重启 | < 10秒 |
| 服务器宕机 | 云平台重启 + 数据恢复 | < 5分钟 |
| 数据丢失 | 从备份恢复 | < 30分钟 |
| DDoS攻击 | Cloudflare防护 + 流量清洗 | 即时 |

---

## 📚 附录

### A. 快速开始指南

```bash
# 1. 服务器首次配置
sudo bash server-setup.sh

# 2. 初始化环境配置
bash scripts/setup_env.sh

# 3. 运行部署前检查
bash scripts/pre_deploy_check.sh

# 4. 测试部署 (首次手动)
cd /var/www/qiguan
npm install && npm run build
pm2 start ecosystem.config.js --env production

# 5. 后续自动部署
git push origin 绮管  # 触发post-receive自动部署
```

### B. 常见问题排查

**Q: 部署卡住不动？**
```bash
# 检查是否有锁文件
cat /tmp/qiguan_deploy.lock
# 如果有，确认进程是否还在运行
ps aux | grep $(cat /tmp/qiguan_deploy.lock)
# 如果进程已死，删除锁文件
rm /tmp/qiguan_deploy.lock
```

**Q: PM2服务启动失败？**
```bash
# 查看详细错误日志
pm2 logs qiguan-backend --err --lines 50
# 检查端口占用
netstat -tlnp | grep -E '3000|8080'
# 检查Node.js版本
node --version
```

**Q: 如何查看部署历史？**
```bash
# 分析部署日志
bash scripts/analyze_logs.sh

# 查看最近的部署记录
ls -lt /var/log/qiguan/deploy/ | head -10
```

### C. 安全最佳实践

1. **SSH密钥认证** - 禁用密码登录
2. **防火墙规则** - 仅开放22, 80, 443端口
3. **定期更新** -系统和依赖包安全补丁
4. **敏感信息加密** - .env文件权限600
5. **日志轮转** - 防止磁盘占满
6. **备份策略** - 定期备份数据库和配置
7. **监控告警** - 异常情况及时通知

---

**文档版本**: v1.0  
**最后更新**: 2026-04-08  
**维护团队**: 绮管电商技术组
