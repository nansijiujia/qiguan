#!/bin/bash

# ============================================================
# 绮管后台 - 全自动一键部署脚本 v3.0
# 功能：前端+后端一体化部署，无需CloudBase静态托管
# 触发方式：Git push后自动执行 / 手动执行
# 作者：绮管技术团队
# 日期：2026-04-09
# ============================================================

set -e

# ==================== 配置变量 ====================
PROJECT_DIR="/var/www/qiguan"
BACKEND_DIR="$PROJECT_DIR"
FRONTEND_DIR="$PROJECT_DIR/qiguanqianduan"
DIST_DIR="$FRONTEND_DIR/dist"
NGINX_CONF="/etc/nginx/conf.d/qiguan.conf"
LOG_FILE="/var/log/qiguan/deploy_$(date +%Y%m%d_%H%M%S).log"
PM2_APP_NAME="qiguan-backend"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

# ==================== 工具函数 ====================
log_info() { echo -e "${BLUE}[INFO]${NC} $(date '+%H:%M:%S') $1" | tee -a "$LOG_FILE"; }
log_success() { echo -e "${GREEN}[✓]${NC} $(date '+%H:%M:%S') $1" | tee -a "$LOG_FILE"; }
log_error() { echo -e "${RED}[✗]${NC} $(date '+%H:%M:%S') $1" | tee -a "$LOG_FILE"; }
log_warning() { echo -e "${YELLOW}[!]${NC} $(date '+%H:%M:%S') $1" | tee -a "$LOG_FILE"; }

show_header() {
    echo -e "${CYAN}${BOLD}"
    echo "╔══════════════════════════════════════════════════╗"
    echo "║     🚀 绮管后台 - 全自动部署系统 v3.0            ║"
    echo "║     前后端一体化 · 无需静态托管 · 一键生效       ║"
    echo "╚══════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

check_command() {
    if command -v $1 &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# ==================== 主流程开始 ====================
main() {
    show_header
    
    # 创建日志目录
    mkdir -p /var/log/qiguan
    
    log_info "📍 部署开始..."
    log_info "项目目录: $PROJECT_DIR"
    log_info "日志文件: $LOG_FILE"
    echo ""
    
    local START_TIME=$(date +%s)
    
    # ====== 步骤1: 环境检查 ======
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}  步骤 1/7: 环境预检${NC}"
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    
    check_environment || exit 1
    
    # ====== 步骤2: 备份数据 ======
    echo -e "\n${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}  步骤 2/7: 数据备份${NC}"
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    
    backup_data
    
    # ====== 步骤3: 拉取最新代码 ======
    echo -e "\n${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}  步骤 3/7: 拉取代码${NC}"
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    
    pull_code
    
    # ====== 步骤4: 配置环境变量 ======
    echo -e "\n${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}  步骤 4/7: 环境配置${NC}"
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    
    setup_env
    
    # ====== 步骤5: 安装依赖 & 构建 ======
    echo -e "\n${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}  步骤 5/7: 安装依赖 & 构建${NC}"
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    
    install_and_build
    
    # ====== 步骤6: 配置Nginx（前后端一体化） ======
    echo -e "\n${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}  步骤 6/7: 配置Web服务器${NC}"
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    
    setup_nginx
    
    # ====== 步骤7: 重启服务 & 验证 ======
    echo -e "\n${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}  步骤 7/7: 重启服务 & 验证${NC}"
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    
    restart_and_verify
    
    # ====== 完成 ======
    local END_TIME=$(date +%s)
    local DURATION=$((END_TIME - START_TIME))
    
    echo -e "\n${GREEN}${BOLD}"
    echo "╔══════════════════════════════════════════════════╗"
    echo "║     ✨ 部署完成！耗时 ${DURATION} 秒                   ║"
    echo "╚══════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    log_success "🎉 所有步骤执行完成！"
    
    echo -e "\n${CYAN}📋 后续操作:${NC}"
    echo -e "   1. 访问网站: ${BLUE}https://qimengzhiyue.cn/dashboard${NC}"
    echo -e "   2. 查看日志: ${BLUE}pm2 logs $PM2_APP_NAME --lines 100${NC}"
    echo -e "   3. 监控状态: ${BLUE}pm2 monit${NC}"
    echo -e "   4. 查看部署日志: ${BLUE}cat $LOG_FILE${NC}"
    echo ""
}

# ==================== 功能函数实现 ====================

# 环境检查
check_environment() {
    log_info "检查必要工具..."
    
    local missing_tools=()
    
    for tool in node npm pm2 git nginx; do
        if check_command $tool; then
            log_success "$tool ✓"
        else
            log_error "$tool ✗ (未安装)"
            missing_tools+=($tool)
        fi
    done
    
    if [ ${#missing_tools[@]} -gt 0 ]; then
        log_error "缺少必要工具: ${missing_tools[*]}"
        log_error "请先安装缺失的工具后重试"
        return 1
    fi
    
    # 检查项目目录
    if [ ! -d "$PROJECT_DIR" ]; then
        log_error "项目目录不存在: $PROJECT_DIR"
        return 1
    fi
    
    log_success "环境检查通过 ✓"
    return 0
}

# 数据备份
backup_data() {
    local BACKUP_DIR="$PROJECT_DIR/backups/$(date +%Y%m%d_%H%M%S)"
    
    if [ -d "$DIST_DIR" ]; then
        mkdir -p "$BACKUP_DIR"
        cp -r "$DIST_DIR" "$BACKUP_DIR/dist" 2>/dev/null || true
        
        if [ -d "$PROJECT_DIR/data" ]; then
            cp -r "$PROJECT_DIR/data" "$BACKUP_DIR/data" 2>/dev/null || true
        fi
        
        log_success "数据备份完成 → $BACKUP_DIR"
    else
        log_warning "未找到dist目录，跳过备份"
    fi
}

# 拉取代码
pull_code() {
    cd "$PROJECT_DIR"
    
    log_info "正在拉取最新代码..."
    
    # Stash本地修改
    git stash --quiet 2>/dev/null || true
    
    # Pull最新代码
    if git pull origin 绮管; then
        log_success "代码拉取成功 ✓"
        
        # 恢复stash
        git stash pop --quiet 2>/dev/null || true
    else
        log_warning "代码拉取失败，使用当前版本继续"
    fi
}

# 配置环境变量
setup_env() {
    cd "$PROJECT_DIR"
    
    log_info "配置环境变量..."
    
    cat > .env << 'ENVEOF'
# ============================================================
# 绮管电商后台 - 生产环境配置（自动生成）
# 生成时间: $(date)
# ============================================================

# 应用基础配置
PORT=3000
NODE_ENV=production

# 数据库配置（MySQL云数据库）
DB_TYPE=mysql
DB_HOST=10.0.0.16
DB_PORT=3306
DB_USER=QMZYXCX
DB_PASSWORD=LJN040821.
DB_NAME=qmzyxcx

# JWT认证配置
JWT_SECRET=qiguan-production-secret-key-2026-change-me-at-least-32-characters-long

# 服务器配置
CORS_ORIGIN=*
TRUST_PROXY=true
ENVEOF
    
    # 创建数据库选择器（如果不存在）
    if [ ! -f "db_selector.js" ]; then
        cat > db_selector.js << 'DSEOF'
// 数据库选择器 - 自动选择MySQL或SQLite
let db;
try {
  db = require('./db_mysql');
  console.log('[DB] MySQL Mode - Connected to cloud database');
} catch (e) {
  db = require('./db');
  console.log('[DB] SQLite Mode - Using local database');
}
module.exports = db;
DSEOF
        log_success "数据库选择器已创建"
    fi
    
    log_success "环境变量配置完成 ✓"
}

# 安装依赖和构建
install_and_build() {
    # 后端依赖
    log_info "安装后端依赖..."
    cd "$PROJECT_DIR"
    npm install --production --silent 2>&1 | grep -E "added|removed|changed|warn|error" || true
    log_success "后端依赖安装完成"
    
    # 前端依赖和构建
    if [ -d "$FRONTEND_DIR" ]; then
        log_info "安装前端依赖..."
        cd "$FRONTEND_DIR"
        npm install --silent 2>&1 | tail -5 || true
        log_success "前端依赖安装完成"
        
        # 清除旧构建产物
        log_info "清除旧构建缓存..."
        rm -rf dist node_modules/.vite .vite 2>/dev/null || true
        
        # 重新构建
        log_info "构建前端项目（生产模式）..."
        if npm run build 2>&1; then
            BUILD_TIME=$(date +"%Y-%m-%d %H:%M:%S")
            log_success "前端构建成功 ✓ (${BUILD_TIME})"
            
            # 记录构建信息
            cat > dist/build-info.json << BUILDEOF
{
  "buildTime": "$(date -Iseconds)",
  "gitCommit": "$(git rev-parse HEAD)",
  "nodeVersion": "$(node -v)",
  "dashboardVersion": "clean-no-mock-data",
  "deployedBy": "auto-deploy-script-v3.0"
}
BUILDEOF
            
            log_success "构建信息已记录"
        else
            log_error "前端构建失败！"
            return 1
        fi
    else
        log_error "前端目录不存在: $FRONTEND_DIR"
        return 1
    fi
}

# 配置Nginx
setup_nginx() {
    log_info "配置Nginx（前后端一体化）..."
    
    # 创建Nginx配置
    sudo tee "$NGINX_CONF" > /dev/null << NGINXEOF
# ============================================================
# 绮管电商后台 - Nginx配置（前后端一体化）
# 自动生成时间: $(date)
# ============================================================

server {
    listen 80;
    server_name qimengzhiyue.cn www.qimengzhiue.cn;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name qimengzhiyue.cn;

    # SSL证书配置（根据实际情况修改路径）
    ssl_certificate     /etc/nginx/ssl/qimengzhiyue.cn_bundle.pem;
    ssl_certificate_key /etc/nginx/ssl/qimengzhiyue.cn.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # API请求 - 转发到Node.js后端
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # 禁止API响应缓存
        add_header Cache-Control "no-store, no-cache, must-revalidate";
        add_header Pragma "no-cache";
    }

    # 前端静态文件 - 直接从dist目录读取
    location / {
        root $FRONTEND_DIR/dist;
        index index.html;
        
        try_files $uri $uri/ /index.html;
        
        # Gzip压缩
        gzip on;
        gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;
        gzip_min_length 1000;
        
        # 安全头
        add_header X-Frame-Options "SAMEORIGIN";
        add_header X-Content-Type-Options "nosniff";
        add_header X-XSS-Protection "1; mode=block";
    }

    # 静态资源缓存策略（JS/CSS/图片）
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        root $FRONTEND_DIR/dist;
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # HTML文件 - 禁止缓存（关键！确保用户获取最新版本）
    location ~* \.html$ {
        root $FRONTEND_DIR/dist;
        expires -1;
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate";
        add_header Pragma "no-cache";
        add_header Last-Modified "";
        etag off;
    }

    # 错误页面
    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
NGINXEOF

    # 测试Nginx配置
    if sudo nginx -t 2>&1; then
        sudo systemctl reload nginx
        log_success "Nginx配置已更新并重载 ✓"
    else
        log_warning "Nginx配置测试失败，使用现有配置"
    fi
}

# 重启服务和验证
restart_and_verify() {
    cd "$PROJECT_DIR"
    
    log_info "重启后端服务..."
    
    # 使用PM2管理进程
    if pm2 describe "$PM2_APP_NAME" > /dev/null 2>&1; then
        pm2 restart "$PM2_APP_NAME"
        log_success "PM2进程已重启"
    else
        # 首次启动
        JWT_SECRET="qiguan-production-secret-key-2026-change-me-at-least-32-characters-long" \
        DB_TYPE=mysql \
        DB_HOST=10.0.0.16 \
        DB_PORT=3306 \
        DB_USER=QMZYXCX \
        DB_PASSWORD=LJN040821. \
        DB_NAME=qmzyxcx \
        NODE_ENV=production \
        pm2 start index.js --name "$PM2_APP_NAME"
        log_success "PM2进程已启动"
    fi
    
    # 等待服务启动
    sleep 5
    
    # 显示PM2状态
    echo -e "\n${CYAN}📊 PM2 进程状态:${NC}"
    pm2 status | grep -A1 "$PM2_APP_NAME" || pm2 list
    
    # 测试API健康检查
    echo -e "\n${CYAN}🔍 服务健康检查:${NC}"
    
    sleep 2
    
    if curl -sf http://localhost:3000/api/v1/health > /dev/null 2>&1; then
        log_success "API服务正常 ✓ (http://localhost:3000)"
    else
        log_warning "API服务可能未启动，查看日志: pm2 logs"
    fi
    
    # 测试前端访问
    if [ -f "$DIST_DIR/index.html" ]; then
        log_success "前端文件就绪 ✓ ($DIST_DIR/index.html)"
    fi
    
    # 保存PM2配置（开机自启）
    pm2 save --force 2>/dev/null || true
    
    log_success "PM2配置已保存（开机自启）"
}

# ==================== 执行主函数 ====================
main "$@"
