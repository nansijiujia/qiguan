# 绮管电商后台系统 - 部署手册

> **版本**: 1.0.0  
> **适用环境**: CentOS 7+ / Ubuntu 18.04+ / 腾讯云CVM  
> **最后更新**: 2026-04-08  
> **维护者**: 绮管技术团队  

---

## 目录

- [1. 前置条件检查清单](#1-前置条件检查清单)
- [2. 分步骤部署流程](#2-分步骤部署流程)
  - [阶段一：服务器初始化](#阶段一服务器初始化)
  - [阶段二：Git仓库配置（自动部署）](#阶段二git仓库配置自动部署)
  - [阶段三：应用部署](#阶段三应用部署)
  - [阶段四：Nginx配置与SSL证书](#阶段四nginx配置与ssl证书)
  - [阶段五：数据库初始化](#阶段五数据库初始化)
- [3. 常见问题FAQ](#3-常见问题faq)
- [4. 故障排查指南](#4-故障排查指南)

---

## 1. 前置条件检查清单

在开始部署前，请逐项确认以下条件：

### 🖥️ 基础设施

| # | 检查项 | 要求 | 验证命令 | 状态 |
|---|--------|------|---------|------|
| 1 | **云服务器** | ≥ 2核CPU / 4GB RAM / 40GB SSD | `lscpu` + `free -h` | ⬜ |
| 2 | **操作系统** | CentOS 7.9+ 或 Ubuntu 20.04 LTS | `cat /etc/os-release` | ⬜ |
| 3 | **公网IP** | 已分配弹性公网IP | `curl ifconfig.me` | ⬜ |
| 4 | **域名** | 已备案，DNS解析到服务器IP | `nslookup yourdomain.com` | ⬜ |

### 🔐 安全与网络

| # | 检查项 | 要求 | 验证方式 | 状态 |
|---|--------|------|---------|------|
| 5 | **防火墙/安全组** | 开放 80、443、22 端口 | 云控制台安全组规则 | ⬜ |
| 6 | **SSL证书** | Let's Encrypt 或商业证书 | 后续章节配置 | ⬜ |
| 7 | **SSH密钥登录** | 禁用密码登录（推荐） | `/etc/ssh/sshd_config` | ⬜ |

### 🗄️ 数据库

| # | 检查项 | 要求 | 验证方式 | 状态 |
|---|--------|------|---------|------|
| 8 | **TDSQL-C MySQL** | 已创建实例，有连接信息 | 腾讯云控制台 | ⬜ |
| 9 | **数据库用户** | 已创建专用用户（非root） | MySQL客户端连接测试 | ⬜ |
| 10 | **字符集** | utf8mb4 | `SHOW VARIABLES LIKE 'charset'` | ⬜ |

### 🔧 开发工具

| # | 检查项 | 版本要求 | 安装方法 | 状态 |
|---|--------|---------|---------|------|
| 11 | **Node.js** | ≥ 18.x (推荐 22.x) | 见下方安装命令 | ⬜ |
| 12 | **npm** | ≥ 9.x (随Node.js) | 同上 | ⬜ |
| 13 | **PM2** | 最新稳定版 | `npm install -g pm2` | ⬜ |
| 14 | **Nginx** | ≥ 1.18 | `yum install nginx` | ⬜ |
| 15 | **Git** | ≥ 2.x | `yum install git` | ⬜ |

### 📦 代码仓库

| # | 检查项 | 要求 | 状态 |
|---|--------|------|------|
| 16 | **Git仓库访问权限** | GitHub/Gitee/GitLab 可克隆 | ⬜ |
| 17 | **分支策略** | 主分支名称为 `绮管`（或修改post-receive中的分支名） | ⬜ |

---

## 2. 分步骤部署流程

### 总体流程图

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ ① 服务器    │───▶│ ② Git仓库   │───▶│ ③ 应用      │───▶│ ④ Nginx    │
│   初始化     │    │   配置       │    │   部署       │    │   配置       │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                                             │
                       ┌─────────────┐                       ▼
                       │ ⑤ 数据库    │              ┌─────────────┐
                       │   初始化     │◀───────────────│ ⑥ SSL证书  │
                       └─────────────┘              └─────────────┘
```

预计总耗时：**30-60分钟**（取决于网络速度）

---

### 阶段一：服务器初始化

#### 1.1 系统更新与基础工具安装

```bash
# ===== CentOS 系统 =====

# 更新系统包
sudo yum update -y

# 安装基础工具
sudo yum install -y curl wget vim git unzip

# 安装 EPEL（用于获取额外软件）
sudo yum install -y epel-release

# 安装开发工具链（编译某些npm包可能需要）
sudo yum groupinstall -y "Development Tools"
```

```bash
# ===== Ubuntu 系统 =====

# 更新系统包
sudo apt update && sudo apt upgrade -y

# 安装基础工具
sudo apt install -y curl wget vim git unzip build-essential
```

#### 1.2 安装 Node.js 22.x

⚠️ **重要**: 推荐使用 NodeSource 官方源，避免系统自带版本过旧。

```bash
# ===== 方式A: NodeSource（推荐）=====

# 添加 NodeSource 仓库 (Node.js 22.x)
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -

# 安装 Node.js
sudo yum install -y nodejs

# 验证安装
node --version   # 应显示 v22.x.x
npm --version    # 应显示 10.x.x
```

```bash
# ===== 方式B: NVM（多版本管理）=====

# 安装 NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# 重新加载 shell
source ~/.bashrc

# 安装 Node.js 22
nvm install 22
nvm use 22
nvm alias default 22

# 验证
node --version
```

#### 1.3 安装 PM2 进程管理器

```bash
# 全局安装 PM2
sudo npm install -g pm2

# 验证安装
pm2 --version
pm2 list          # 应显示空列表

# 设置 PM2 开机自启
pm2 startup systemd -u root --hp /root
# 执行输出的 source 命令（类似: sudo env PATH=$PATH:/usr/bin ...）
```

#### 1.4 安装 Nginx

```bash
# ===== CentOS =====
sudo yum install -y nginx

# 启动并设置开机自启
sudo systemctl start nginx
sudo systemctl enable nginx

# 验证
nginx -v
curl localhost    # 应返回 Nginx 欢迎页
```

```bash
# ===== Ubuntu =====
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

#### 1.5 配置防火墙

```bash
# ===== firewalld (CentOS 默认) =====

# 开放 HTTP/HTTPS/SSH 端口
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --permanent --add-service=ssh

# 重载防火墙
sudo firewall-cmd --reload

# 查看已开放端口
sudo firewall-cmd --list-all
```

```bash
# ===== ufw (Ubuntu 默认) =====

sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw enable
sudo ufw status
```

> 💡 **提示**: 如果使用腾讯云/阿里云，还需在**云控制台的安全组**中放行相应端口！

#### 1.6 创建应用目录结构

```bash
# 创建项目目录
sudo mkdir -p /var/www/qiguan
sudo mkdir -p /var/www/qiguan/backups
sudo mkdir -p /var/log/qiguan/deploy
sudo mkdir -p /home/git

# 设置权限
sudo chown -R $USER:$USER /var/www/qiguan
sudo chown -R $USER:$USER /home/git

# 创建上传目录（如需要）
sudo mkdir -p /var/www/qiguan/uploads
sudo chmod 755 /var/www/qiguan/uploads
```

✅ **阶段一完成标志**: 
- `node --version` → v22.x.x
- `pm2 --version` → 正确输出
- `nginx -v` → 正确输出
- `curl localhost` → Nginx欢迎页

---

### 阶段二：Git仓库配置（自动部署）

本方案采用 **Git Hook + post-receive** 实现代码推送后自动部署。

#### 2.1 创建 Git 裸仓库

```bash
# 创建裸仓库目录
sudo mkdir -p /home/git/repo.git
cd /home/git/repo.git

# 初始化裸仓库
sudo git init --bare

# 设置权限
sudo chown -R $USER:$USER /home/git/repo.git
```

#### 2.2 配置 post-receive 钩子

将项目中的 [post-receive](../post-receive) 文件复制到钩子目录：

```bash
# 复制钩子文件
cp /path/to/绮管后台/post-receive /home/git/repo.git/hooks/post-receive

# 设置可执行权限
chmod +x /home/git/repo.git/hooks/post-receive
```

或者手动创建（精简版）：

```bash
cat > /home/git/repo.git/hooks/post-receive << 'EOF'
#!/bin/bash
set -e

GIT_DIR="/home/git/repo.git"
WORK_TREE="/var/www/qiguan"

while read oldrev newrev refname; do
    BRANCH=$(echo "$refname" | sed 's|refs/heads/||')
    
    echo "📥 收到推送: 分支=${BRANCH}"
    
    # 仅处理目标分支（根据实际情况修改）
    if [ "$BRANCH" = "绮管" ]; then
        echo "🚀 开始部署..."
        
        # 检出代码到工作目录
        GIT_WORK_TREE="$WORK_TREE" git checkout -f "$BRANCH"
        
        # 进入工作目录
        cd "$WORK_TREE"
        
        # 安装依赖
        npm install
        
        # 构建前端
        npm run build
        
        # 重启PM2服务
        pm2 restart all || pm2 start ecosystem.config.js --env production
        
        echo "✅ 部署完成!"
    else
        echo "⏭️ 跳过分支: ${BRANCH}"
    fi
done
EOF

chmod +x /home/git/repo.git/hooks/post-receive
```

#### 2.3 初始化远程仓库关联

**在本地开发机执行**:

```bash
# 进入项目目录
cd /path/to/绮管后台

# 添加远程仓库（替换为你的服务器IP）
git remote add deploy ssh://root@你的服务器IP/home/git/repo.git

# 或者使用 HTTPS（需配置 SSH 密钥或账号密码）
# git remote add deploy https://your-server/home/git/repo.git

# 推送触发首次部署
git push deploy 绮管
```

#### 2.4 SSH 免密登录配置（推荐）

```bash
# 在本地生成 SSH 密钥（如果还没有）
ssh-keygen -t ed25519 -C "deploy@qiguan"

# 将公钥复制到服务器
ssh-copy-id root@你的服务器IP

# 测试免密登录
ssh root@你的服务器IP  # 应无需输入密码即可登录
```

✅ **阶段二完成标志**: 
- `git push deploy 绮管` 能成功触发自动部署
- PM2 显示进程运行状态正常

---

### 阶段三：应用部署

#### 3.1 克隆/检出代码

**方式A：通过 Git 自动部署（推荐）**

见阶段二的 `git push` 操作。

**方式B：手动部署**

```bash
cd /var/www/qiguan

# 克隆代码（替换为实际仓库地址）
git clone https://github.com/your-org/qiguan-backend.git .

# 或从本地打包上传
# scp -r ./绮管后台/* root@server:/var/www/qiguan/
```

#### 3.2 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑配置文件
vim .env
```

**关键配置项**（必须修改！）:

```env
# ==================== 必须修改 ====================

# 服务端口
PORT=3000

# 运行环境（生产环境必须设为 production）
NODE_ENV=production

# JWT 密钥（至少32个字符！非常重要！）
JWT_SECRET=请生成一个随机长字符串-例如openssl-rand-base64-48

# ==================== 数据库配置 ====================
DB_TYPE=mysql
DB_HOST=你的TDSQL-C内网地址  # 例如: 10.0.0.16
DB_PORT=3306
DB_NAME=qmzyxcx               # 你的数据库名
DB_USER=QMZYXCX                # 你的数据库用户名
DB_PASSWORD=你的数据库密码      # ⚠️ 必须修改！

# ==================== 其他推荐设置 ====================
DEBUG=false
LOG_LEVEL=warn                  # 生产环境建议 warn 或 error
CORS_ORIGIN=https://你的域名    # 限制跨域来源
ENFORCE_HTTPS=true             # 强制HTTPS
```

💡 **快速生成安全密钥**:
```bash
# 生成 JWT_SECRET
openssl rand -base64 48

# 生成数据库密码
openssl rand -base64 24
```

#### 3.3 使用交互式配置脚本（推荐）

项目提供了自动化环境配置脚本 [setup_env.sh](../scripts/setup_env.sh):

```bash
# 交互式模式（逐步引导）
bash scripts/setup_env.sh -i

# 快速模式（使用默认值+随机密钥）
bash scripts/setup_env.sh -q

# 仅验证当前配置
bash scripts/setup_env.sh -v

# 查看当前配置（敏感信息已脱敏）
bash scripts/setup_env.sh --show
```

#### 3.4 安装依赖

```bash
cd /var/www/qiguan

# 安装生产依赖
npm install --production=false   # 包含devDependencies（需要构建前端）

# 如果遇到网络问题，使用淘宝镜像：
# npm config set registry https://registry.npmmirror.com
# npm install

# 验证依赖安装
ls node_modules/ | head -20
```

#### 3.5 构建前端

```bash
cd /var/www/qiguan/qiguanqianduan

# 安装前端依赖
npm install

# 构建生产版本
npm run build

# 验证构建产物
ls dist/    # 应包含 index.html, assets/ 等
```

构建完成后，前端静态文件在 `qiguanqianduan/dist/` 目录下。

#### 3.6 创建 PM2 配置文件

如果项目中没有 `ecosystem.config.js`，创建一个：

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'qiguan-backend',
      script: 'index.js',
      cwd: '/var/www/qiguan',
      instances: 1,           // 单实例（如需集群模式改为 'max'）
      autorestart: true,
      watch: false,           // 生产环境关闭监听
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/var/log/qiguan/error.log',
      out_file: '/var/log/qiguan/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // 关键：正确传递环境变量
      env_production: {
        NODE_ENV: 'production'
      }
    }
  ]
};
```

#### 3.7 启动服务

```bash
cd /var/www/qiguan

# 首次启动
pm2 start ecosystem.config.js --env production

# 保存进程列表（使重启后自动恢复）
pm2 save

# 查看运行状态
pm2 list
pm2 logs qiguan-backend --lines 50   # 查看日志

# 验证服务是否正常运行
curl http://localhost:3000/health
# 应返回: {"status":"ok","database":true,"uptime":...,"timestamp":"..."}
```

✅ **阶段三完成标志**: 
- `pm2 list` 显示 qiguan-backend 状态为 online
- `curl localhost:3000/health` 返回 200 OK

---

### 阶段四：Nginx配置与SSL证书

#### 4.1 配置 Nginx 反向代理

复制项目提供的 [nginx.conf.example](../nginx.conf.example) 并修改：

```bash
# 备份默认配置
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak

# 创建站点配置
sudo tee /etc/nginx/conf.d/qiguan.conf > /dev/null << 'NGINX'
# ============================================================
# 绮管电商后台 - Nginx 配置
# 域名: qimengzhiyue.cn (替换为你的域名)
# ============================================================

# HTTP -> HTTPS 强制跳转
server {
    listen 80;
    server_name qimengzhiyue.cn www.qimengzhiyue.cn;
    return 301 https://$host$request_uri;
}

# HTTPS 主配置
server {
    listen 443 ssl http2;
    server_name qimengzhiyue.cn www.qimengzhiyue.cn;

    # ========== SSL 证书（先占位，后续配置Certbot） ==========
    ssl_certificate /etc/letsencrypt/live/qimengzhiyue.cn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/qimengzhiyue.cn/privkey.pem;

    # SSL 安全优化
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # ========== 前端静态文件 ==========
    # 注意：路径指向 Vite 构建产物目录
    root /var/www/qiguan/qiguanqianduan/dist;
    index index.html;

    # 安全响应头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;

    # ========== Vue SPA 路由支持 ==========
    location / {
        try_files $uri $uri/ /index.html;
    }

    # ========== API 反向代理到 Node.js ==========
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # WebSocket 支持
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';

        # 传递真实客户端 IP
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 120s;

        # 缓存控制（API不缓存）
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }

    # ========== Swagger API 文档（可选，生产环境建议关闭）==========
    location /api-docs {
        proxy_pass http://127.0.0.1:3000;
        # 生产环境可以注释掉此段以隐藏文档
    }

    # ========== 静态资源缓存 ==========
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # ========== 禁止访问隐藏文件和安全文件 ==========
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    location ~* /(package\.json|\.env|\.git) {
        deny all;
        access_log off;
    }
}
NGINX
```

#### 4.2 测试并重载 Nginx

```bash
# 测试配置语法
sudo nginx -t

# 如果显示 syntax is ok 和 test is successful，则重载
sudo systemctl reload nginx

# 验证 HTTP→HTTPS 跳转
curl -I http://qimengzhiyue.cn
# 应返回: 301 Moved Permanently → Location: https://...

# 验证 HTTPS 访问
curl -I https://qimengzhiyue.cn
# 应返回: 200 OK
```

#### 4.3 配置 SSL 证书（Let's Encrypt 免费证书）

```bash
# ===== 方法A: Certbot 自动化（推荐）=====

# 安装 Certbot
# CentOS:
sudo yum install -y certbot python3-certbot-nginx

# Ubuntu:
sudo apt install -y certbot python3-certbot-nginx

# 获取证书并自动配置 Nginx
sudo certbot --nginx -d qimengzhiyue.cn -d www.qimengzhiyue.cn

# 按提示操作：
# 1. 输入邮箱地址
# 2. 同意服务条款 (Y)
# 3. 选择是否共享邮箱 (N)
# 4. 选择重定向方式 (2: 强制HTTPS重定向)

# 测试自动续期
sudo certbot renew --dry-run
```

```bash
# ===== 方法B: 手动申请（适用于特殊场景）=====

# 停止 Nginx（占用80端口）
sudo systemctl stop nginx

# 申请证书
sudo certbot certonly --standalone -d qimengzhiyue.cn

# 启动 Nginx
sudo systemctl start nginx
```

#### 4.4 设置 SSL 证书自动续期

Certbot 通常会自动添加 cron 任务或 systemd timer。验证一下：

```bash
# 检查 timer 是否启用
sudo systemctl list-timers | grep certbot

# 手动测试续期（不会真正续期，仅验证流程）
sudo certbot renew --dry-run
```

✅ **阶段四完成标志**: 
- `https://你的域名` 可以正常访问
- 浏览器地址栏显示 🔒 锁图标
- SSL Labs 评级 A 或以上

[截图：浏览器地址栏显示绿色锁头]

---

### 阶段五：数据库初始化

#### 5.1 连接 TDSQL-C 并执行初始化脚本

```bash
# 方式1: 使用 MySQL 客户端
mysql -h 你的TDSQL-C地址 -P 3306 -u QMZYXCX -p qmzyxcx < database/mysql_init.sql

# 方式2: 使用 Navicat/DBeaver 等GUI工具
# 打开 mysql_init.sql 文件，直接执行全部SQL
```

#### 5.2 验证数据库表创建成功

```sql
-- 登录 MySQL 后执行
USE qmzyxcx;
SHOW TABLES;

-- 预期结果:
-- +------------------+
-- | Tables_in_qmzyxcx|
-- +------------------+
-- | categories       |
-- | order_items      |
-- | orders           |
-- | products         |
-- | users            |
-- +------------------+
-- 5 rows in set

-- 验证种子数据
SELECT COUNT(*) AS category_count FROM categories;  -- 应 >= 9
SELECT COUNT(*) AS product_count FROM products;     -- 应 >= 5
SELECT id, username, role FROM users WHERE username='admin';  -- 管理员账户
```

#### 5.3 修改默认管理员密码 ⚠️

```sql
-- ⚠️ 重要！立即修改默认管理员密码
-- 先生成新的 bcrypt 哈希值（在 Node.js 中执行）:
-- node -e "console.log(require('bcryptjs').hashSync('你的新密码', 10))"

-- 然后执行 SQL 更新:
UPDATE users SET password_hash='新生成的哈希值' WHERE username='admin';
```

✅ **阶段五完成标志**: 
- 数据库中5张表全部创建成功
- 种子数据导入完整
- 管理员密码已修改

---

## 3. 常见问题FAQ

### Q1: npm install 失败/卡住怎么办？

**症状**: `npm install` 长时间无响应或报错 `ECONNRESET` / `ETIMEDOUT`

**解决方案**:
```bash
# 1. 切换到国内镜像源
npm config set registry https://registry.npmmirror.com

# 2. 清除缓存后重试
npm cache clean --force
rm -rf node_modules package-lock.json
npm install

# 3. 如果仍然失败，尝试增加超时时间
npm install --fetch-timeout=120000

# 4. 检查网络连通性
ping registry.npmmirror.com
curl -I https://registry.npmmirror.com
```

---

### Q2: PM2 启动报错？

**常见错误及解决**:

| 错误信息 | 原因 | 解决方案 |
|---------|------|---------|
| `EADDRINUSE: address already in use :::3000` | 端口被占用 | `lsof -i :3000` 找到并杀掉占用进程，或修改 `.env` 中的 `PORT` |
| `Cannot find module 'express'` | 依赖未安装 | 确保在项目根目录执行了 `npm install` |
| `Error: ENOENT: no such file or directory` | 工作目录错误 | 检查 `ecosystem.config.js` 中的 `cwd` 路径是否正确 |
| `FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed` | 内存不足 | 增加 swap 或升级服务器内存 |

**调试命令**:
```bash
# 查看详细错误日志
pm2 logs qiguan-backend --err --lines 100

# 以 fork 模式启动查看实时输出
NODE_ENV=production node index.js

# 检查端口占用
netstat -tlnp | grep 3000
# 或
ss -tlnp | grep 3000
```

---

### Q3: 数据库连接不上？

**症状**: 应用启动报 `ECONNREFUSED` 或 `connect ETIMEDOUT`

**排查步骤**:

```bash
# 1. 从服务器测试数据库连通性
telnet 你的TDSQL-C地址 3306
# 或
nc -zv 你的TDSQL-C地址 3306

# 2. 检查 .env 中的数据库配置
cat .env | grep DB_

# 3. 常见问题检查清单:
#    - DB_HOST 是否使用了内网地址？（TDSQL-C需用内网地址）
#    - DB_USER/DB_PASSWORD 是否正确？
#    - TDSQL-C 安全组是否允许当前服务器IP访问？
#    - 数据库是否创建了该用户？是否有该数据库的权限？

# 4. 使用 mysql 客户端直接测试
mysql -h 你的TDSQL-C地址 -u 用户名 -p
```

**TDSQL-C 特殊注意**:
- 必须使用**内网地址**（格式如 `10.0.x.x`），不要用外网域名
- 需要在腾讯云控制台的「安全组」中放行 3306 端口给 CVM 的内网IP

---

### Q4: Nginx 502 Bad Gateway？

**症状**: 浏览器访问显示 502，但 `curl localhost:3000` 正常

**原因**: Nginx 无法连接到后端 Node.js 服务

**解决方案**:

```bash
# 1. 检查后端服务是否运行
pm2 list                    # 状态应为 online
curl http://localhost:3000/health  # 应返回 200

# 2. 检查 Nginx 配置中的 proxy_pass 地址
grep "proxy_pass" /etc/nginx/conf.d/qiguan.conf
# 应为: proxy_pass http://127.0.0.1:3000;

# 3. 检查 SELinux（CentOS 特有）
getenforce
# 如果是 Enforcing，临时关闭测试:
sudo setenforce 0
# 或添加规则:
sudo setsebool -P httpd_can_network_connect 1

# 4. 重载 Nginx
sudo nginx -t && sudo systemctl reload nginx
```

---

### Q5: SSL 证书过期如何续期？

Let's Encrypt 证书有效期为 **90天**，Certbot 会自动续期。但如果需要手动操作：

```bash
# 手动续期
sudo certbot renew

# 强制续期（即使未到期）
sudo certbot renew --force-renewal

# 续期后重载 Nginx
sudo systemctl reload nginx

# 查看证书有效期
sudo openssl x509 -in /etc/letsencrypt/live/qimengzhiyue.cn/cert.pem -noout -dates
```

**如果自动续期失败**:
```bash
# 检查 cron/timer
systemctl status certbot.timer
crontab -l | grep certbot

# 手动测试
sudo certbot renew --dry-run
```

---

### Q6: 如何查看日志？

```bash
# ===== 应用日志 =====

# PM2 日志（推荐）
pm2 logs qiguan-backend --lines 100        # 最近100行
pm2 logs qiguan-backend --err              # 仅错误日志
pm2 logs --nostream                        # 不跟踪，打印后退出

# PM2 日志文件位置
tail -f /var/log/qiguan/error.log          # 错误日志
tail -f /var/log/qiguan/out.log            # 标准输出日志

# ===== Nginx 日志 =====
tail -f /var/log/nginx/access.log          # 访问日志
tail -f /var/log/nginx/error.log            # 错误日志

# ===== 部署日志 =====
tail -f /var/log/qiguan/deploy.log         # 部署汇总日志
ls /var/log/qiguan/deploy/                 # 按时间戳的详细日志

# ===== 系统日志 =====
journalctl -u nginx -f                      # Nginx系统日志
dmesg | tail                               # 内核日志
```

**日志分析技巧**:
```bash
# 搜索错误关键词
grep -i "error\|fail\|exception" /var/log/qiguan/error.log | tail -20

# 统计今日错误数
grep "$(date +%Y-%m-%d)" /var/log/qiguan/error.log | grep -c "ERROR"

# 实时监控（高亮关键字）
tail -f /var/log/qiguan/error.log | grep --color -E "ERROR|WARN|FATAL"
```

---

### Q7: 如何更新/回滚版本？

**更新版本**:
```bash
# 本地开发机执行
git add .
git commit -m "feat: 新功能描述"
git push deploy 绮管    # 触发自动部署
```

**手动回滚到上一版本**:
```bash
# 使用项目提供的回滚脚本
bash scripts/rollback.sh

# 或手动操作
cd /var/www/qiguan
git log --oneline -5        # 查看提交历史
git revert HEAD             # 回退最后一次提交
# 或
git reset --hard HEAD~1     # 强制回退（谨慎使用）
pm2 restart all
```

**使用备份回滚**（post-receive 自动备份的版本）:
```bash
# 查看可用备份
ls -lt /var/www/qiguan/backups/

# 回滚到指定备份
bash scripts/rollback.sh /var/www/qiguan/backups/20260408_120000
```

---

## 4. 故障排查指南

### 问题诊断流程图

```
用户报告网站无法访问
        │
        ▼
   ┌─────────────┐
   │ 能 ping 通   │──No──▶ 检查 DNS / 服务器是否关机 / 安全组
   │ 服务器 IP?   │
   └──────┬──────┘
          │Yes
          ▼
   ┌─────────────┐
   │ SSH 能登录?  │──No──▶ 检查 SSH 服务 / 密钥 / 安全组22端口
   └──────┬──────┘
          │Yes
          ▼
   ┌─────────────┐
   │ PM2 运行正常?│──No──▶ pm2 start / 查看 pm2 logs / 检查 .env
   └──────┬──────┘
          │Yes
          ▼
   ┌─────────────┐
   │ 本地能访问?  │──No──▶ 检查端口 / 防火墙 / SELinux
   │ localhost:3000│
   └──────┬──────┘
          │Yes
          ▼
   ┌─────────────┐
   │ Nginx 正常?  │──No──▶ nginx -t 检查配置 / systemctl restart nginx
   └──────┬──────┘
          │Yes
          ▼
   ┌─────────────┐
   │ 数据库连通?  │──No──▶ 检查 .env DB配置 / TDSQL-C安全组 / 网络策略
   └──────┬──────┘
          │Yes
          ▼
   ┌─────────────┐
   │ SSL证书有效? │──No──▶ certbot renew / 检查证书过期时间
   └──────┬──────┘
          │Yes
          ▼
      ✅ 问题可能在应用层，
      检查具体API返回的错误码
```

### 常见错误码速查

| HTTP状态码 | 含义 | 可能原因 | 解决方向 |
|-----------|------|---------|---------|
| **502** | Bad Gateway | 后端未启动/崩溃 | `pm2 list`, `pm2 logs` |
| **503** | Service Unavailable | 过载/维护中 | 检查负载, PM2重启 |
| **504** | Gateway Timeout | 后端响应超时 | 增加Nginx timeout, 优化慢查询 |
| **404** | Not Found | 路由不存在/前端路由问题 | 检查URL, Nginx try_files |
| **401** | Unauthorized | Token无效/过期 | 重新登录, 检查JWT_SECRET一致性 |
| **403** | Forbidden | 权限不足 | 检查用户角色, requireRole中间件 |
| **400** | Bad Request | 参数校验失败 | 检查请求体格式和必填字段 |
| **429** | Too Many Requests | 触发频率限制 | 降低请求频率, 检查Rate Limiter |

### 性能调优建议

#### Nginx 层优化

```nginx
# 在 http {} 块中添加：

# 开启高效文件传输
sendfile on;
tcp_nopush on;
tcp_nodelay on;

# 保持连接优化
keepalive_timeout 65;
types_hash_max_size 2048;

# 客户端上传大小限制
client_max_body_size 50m;

# 限制请求速率（防DDOS基础防护）
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_conn_zone $binary_remote_addr zone=connlimit:10m;

# 在 location /api/ 中应用：
limit_req zone=api burst=20 nodelay;
limit_conn connlimit 10;
```

#### Node.js/PM2 层优化

```bash
# 1. 启用 Cluster 模式（多核利用）
# 修改 ecosystem.config.js:
instances: 'max'   # 或指定数字如 2

# 2. 增加内存限制
max_memory_restart: '500M'

# 3. 开启 PM2 监控（可选）
pm2 plus          # 需要 PM2 Plus 账号

# 4. 设置垃圾回收日志（调优参考）
node --expose-gc index.js
```

#### 数据库层优化

```sql
-- 1. 确认索引存在
SHOW INDEX FROM products;
SHOW INDEX FROM orders;

-- 2. 分析慢查询（开启慢查询日志）
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 1;

-- 3. 常用优化索引
ALTER TABLE products ADD INDEX idx_status_price (status, price);
ALTER TABLE orders ADD INDEX idx_user_status (user_id, status);
```

### 紧急故障处理 checklist

当网站完全无法访问时，按顺序执行：

```bash
# ① 确认服务器存活
ping 你的服务器IP

# ② SSH 登录
ssh root@你的服务器IP

# ③ 检查基础服务
systemctl status nginx
pm2 list

# ④ 检查资源
free -h              # 内存
df -h                # 磁盘
top                  # CPU

# ⑤ 快速重启（核弹选项）
pm2 restart all && systemctl reload nginx

# ⑥ 如果仍不行，检查最近变更
git log --oneline -5
cat /var/log/qiguan/deploy/deploy_*.log | tail -50

# ⑦ 回滚到上一个已知可用版本
bash scripts/rollback.sh
```

---

## 附录

### A. 完整部署检查清单（打印版）

```
□ 服务器: 2核4G, CentOS 7+/Ubuntu 20.04+
□ 域名: 已备案, DNS A记录指向服务器IP
□ 安全组: 放行 22(SSH), 80(HTTP), 443(HTTPS), 3306(DB可选)
□ Node.js: v22.x 已安装
□ PM2: 全局安装, startup 已配置
□ Nginx: 已安装, 已启动
□ 代码: 已 clone/pull 到 /var/www/qiguan
□ .env: 已配置, JWT_SECRET已修改, DB连接信息正确
□ 依赖: npm install 成功
□ 前端: npm run build 成功, dist/ 目录存在
□ PM2: pm2 start 成功, health check 通过
□ Nginx: 配置文件就位, nginx -t 通过
□ SSL: 证书已签发, HTTPS可访问
□ 数据库: 表已创建, 种子数据已导入
□ 管理员: 默认密码已修改
□ 浏览器: https://域名 可正常打开后台页面
□ 日志: 确认知道日志位置, 可随时查看
```

### B. 有用的运维命令速查

```bash
# 服务管理
pm2 start|stop|restart|delete|list|logs
systemctl start|stop|reload|status nginx

# 日志查看
pm2 logs app_name --lines 100
journalctl -u nginx -f --since "1 hour ago"
tail -f /var/log/qiguan/*.log

# 系统监控
htop                          # 进程监控（需安装）
iotop                         # IO监控（需安装）
netstat -tlnp                 # 端口监听
ss -s                         # 连接统计
df -h                          # 磁盘使用
free -h                        # 内存使用

# Git 操作
git status / log / diff / pull / push
git reflog                     # 恢复丢失提交

# 数据库
mysqldump -u user -p db > backup.sql   # 备份
mysql -u user -p db < backup.sql       # 恢复
```

### C. 联系与支持

| 场景 | 渠道 |
|------|------|
| Bug反馈 | GitHub Issues |
| 部署问题 | 查阅本文档 FAQ 章节 |
| 安全漏洞 | security@qimengzhiyue.cn |
| 功能需求 | 项目 Roadmap |

---

> **文档维护说明**: 本手册应随基础设施变更同步更新。每次重大变更后，请在「附录 A」重新核对检查清单。
