#!/bin/bash
# ============================================================
# 绮管后台 - P0+P1 重构版本自动部署脚本
# ============================================================
# 使用方法:
#   1. SSH 登录到腾讯云服务器
#   2. 上传此脚本到服务器: scp deploy-p1.sh root@101.34.39.231:/root/
#   3. 执行: chmod +x deploy-p1.sh && ./deploy-p1.sh
#
# 前置条件:
#   - Node.js >= 18.x 已安装
#   - MySQL/TDSQL-C 数据库可访问
#   - Git 已安装
#
# 作者: AI Assistant
# 部署日期: 2026-04-14
# 版本: v2.0 (P0+P1重构版)
# ============================================================

set -e

echo "╔══════════════════════════════════════════════╗"
echo "║  🚀 绮管后台 P0+P1 重构版本部署工具       ║"
echo "║  Version: 2.0 (TDSQL-C Pure MySQL)          ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# 配置变量
APP_DIR="/www/wwwroot/qiguan-backend"
BACKUP_DIR="/www/backups/qiguan/$(date +%Y%m%d_%H%M%S)"
GIT_REPO="https://github.com/nansijiujia/qiguan.git"
GIT_BRANCH="feature/option-b-security-hardening"
NODE_ENV="production"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✅]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[⚠️]${NC} $1"
}

log_error() {
    echo -e "${RED}[❌]${NC} $1"
}

# 检查前置条件
check_prerequisites() {
    log_info "检查前置条件..."

    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安装！请先安装 Node.js >= 18.x"
        exit 1
    fi

    if ! command -v git &> /dev/null; then
        log_error "Git 未安装！请先安装 Git"
        exit 1
    fi

    NODE_VERSION=$(node -v | cut -d'.' -f1 | sed 's/v//')
    if [ "$NODE_VERSION" -lt 18 ]; then
        log_error "Node.js 版本过低 (当前: $(node -v), 需要: >=18)"
        exit 1
    fi

    log_success "Node.js 版本: $(node -v) ✅"
    log_success "Git 版本: $(git --version) ✅"
}

# 备份当前版本
backup_current_version() {
    log_info "备份当前版本到 ${BACKUP_DIR}..."

    if [ -d "$APP_DIR" ]; then
        mkdir -p "$BACKUP_DIR"
        cp -r "$APP_DIR" "$BACKUP_DIR/current"
        
        # 备份数据库配置
        if [ -f "$APP_DIR/.env.production" ]; then
            cp "$APP_DIR/.env.production" "$BACKUP_DIR/.env.backup"
        fi
        
        log_success "备份完成: $BACKUP_DIR"
    else
        log_warning "目录不存在，跳过备份"
    fi
}

# 拉取最新代码
pull_latest_code() {
    log_info "拉取最新代码 (分支: ${GIT_BRANCH})..."

    if [ -d "$APP_DIR/.git" ]; then
        cd "$APP_DIR"
        git fetch origin
        git reset --hard origin/${GIT_BRANCH}
    else
        mkdir -p "$APP_DIR"
        cd "$APP_DIR"
        git clone -b $GIT_BRANCH $GIT_REPO .
    fi

    log_success "代码拉取完成 ✅"
}

# 安装依赖
install_dependencies() {
    log_info "安装 npm 依赖..."
    
    cd "$APP_DIR"
    
    if [ -f "package.json" ]; then
        npm install --production
        log_success "npm 依赖安装完成 ✅"
    else
        log_error "package.json 不存在！"
        exit 1
    fi
}

# 配置环境变量
setup_environment() {
    log_info "配置环境变量..."
    
    cd "$APP_DIR"
    
    if [ ! -f ".env.production" ]; then
        if [ -f "$BACKUP_DIR/.env.backup" ]; then
            cp "$BACKUP_DIR/.env.backup" .env.production
            log_info "从备份恢复环境变量"
        else
            log_warning ".env.production 不存在！请手动配置数据库连接信息"
            
cat > .env.production << 'EOF'
# ============================================================
# 绮管电商后台 - 生产环境配置（P0+P1重构版）
# ============================================================
PORT=3003
NODE_ENV=production
DEBUG=false
LOG_LEVEL=warn
APP_NAME=qiguan-backend
APP_VERSION=2.0.0

# ==================== TDSQL-C 云数据库配置 ====================
DB_TYPE=mysql
DB_HOST=10.0.0.16
DB_PORT=3306
DB_USER=QMZYXCX
DB_PASSWORD=LJN040821.
DB_NAME=qmzyxcx
DB_CONNECTION_LIMIT=10
DB_CHARSET=utf8mb4
DB_TIMEZONE=+08:00
DB_TIMEOUT=60000

# ==================== JWT 认证配置 ====================
JWT_SECRET=dy/QDLXKFdtuUdPI8Z4/w2fOrL/dIMvEGGzOvRlpk+fMIkLow849X2m2lx3mxygvWMYnJFt2qZ9EfCpxPGmxrA==
JWT_EXPIRES_IN=24h
JWT_ALGORITHM=HS256
JWT_ISSUER=qiguan-api
JWT_AUDIENCE=https://api.qimengzhiyue.cn

# ==================== 服务器配置 ====================
HOST=localhost
API_PREFIX=/api
API_VERSION=v1
BODY_SIZE_LIMIT=50mb
REQUEST_TIMEOUT=30000
CORS_ORIGIN=*
CORS_CREDENTIALS=true
TRUST_PROXY=true
TRUST_PROXY_COUNT=1

# ==================== 功能开关 ====================
ENABLE_REGISTRATION=true
REQUIRE_EMAIL_VERIFICATION=false
ENABLE_RATE_LIMIT=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
ENABLE_SWAGGER=true
SWAGGER_PATH=/api-docs

# ==================== 安全相关 ====================
ENFORCE_HTTPS=false
SHOW_STACK_TRACE=false
USE_MOCK_DATA=false
EOF
            
            log_success "已生成默认 .env.production 配置文件"
            log_warning "⚠️ 请检查并修改数据库密码等敏感信息！"
        fi
    else
        log_success ".env.production 已存在 ✅"
    fi
}

# 构建前端（如果需要）
build_frontend() {
    log_info "检查是否需要构建前端..."
    
    cd "$APP_DIR/qiguanqianduan"
    
    if [ -f "package.json" ] && [ ! -d "dist" ]; then
        log_info "构建前端资源..."
        npm install
        npm run build
        
        # 复制构建产物到后端dist目录
        rm -rf ../dist/*
        cp -r dist/* ../dist/
        
        log_success "前端构建完成 ✅"
    elif [ -d "dist" ]; then
        log_info "前端已构建，复制到后端目录..."
        rm -rf ../dist/*
        cp -r dist/* ../dist/
        log_success "前端资源更新完成 ✅"
    else
        log_warning "未找到前端项目，跳过构建"
    fi
}

# 测试数据库连接
test_database_connection() {
    log_info "测试 TDSQL-C 数据库连接..."
    
    cd "$APP_DIR"
    
    timeout 10 node -e "
const { initDatabase } = require('./db-unified');
initDatabase()
    .then(() => {
        console.log('✅ 数据库连接成功！');
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ 数据库连接失败:', err.message);
        process.exit(1);
    });
" || {
        log_error "数据库连接失败！请检查："
        echo "  1. DB_HOST 是否正确 (当前: $(grep DB_HOST .env.production | cut -d'=' -f2))"
        echo "  2. 网络是否能访问 TDSQL-C (10.0.0.16:3306)"
        echo "  3. 防火墙规则是否允许出站 3306 端口"
        exit 1
    }
}

# 启动服务
start_service() {
    log_info "启动服务..."
    
    cd "$APP_DIR"
    
    if command -v pm2 &> /dev/null; then
        log_info "使用 PM2 管理进程..."
        pm2 delete qiguan-backend 2>/dev/null || true
        pm2 start index.js --name qiguan-backend -i max --env production
        pm2 save
        log_success "PM2 启动成功 ✅"
    else
        log_warning "PM2 未安装，使用 nohup 启动..."
        pkill -f "node index.js" 2>/dev/null || true
        sleep 2
        nohup node index.js > qiguan.log 2>&1 &
        log_success "服务已启动 (PID: $!) ✅"
    fi
}

# 健康检查
health_check() {
    log_info "执行健康检查..."
    
    sleep 5
    
    if curl -sf http://localhost:3003/api/v1/health > /dev/null 2>&1; then
        log_success "健康检查通过 ✅"
        log_success "服务地址: http://localhost:3003"
        log_success "健康检查: http://localhost:3003/api/v1/health"
        log_success "API文档: http://localhost:3003/api-docs (如果启用Swagger)"
    else
        log_error "健康检查失败！服务可能未正常启动"
        log_error "请查看日志: tail -f $APP_DIR/qiguan.log (nohup) 或 pm2 logs qiguan-backend (pm2)"
        exit 1
    fi
}

# 显示部署摘要
show_summary() {
    echo ""
    echo "╔══════════════════════════════════════════════╗"
    echo "║  🎊 部署完成！                              ║"
    echo "╚══════════════════════════════════════════════╝"
    echo ""
    echo "📋 部署摘要:"
    echo "  • 版本: P0+P1重构版 (v2.0)"
    echo "  • 分支: ${GIT_BRANCH}"
    echo "  • 目录: ${APP_DIR}"
    echo "  • Node: $(node -v)"
    echo "  • 数据库: TDSQL-C (MySQL)"
    echo ""
    echo "🔗 重要链接:"
    echo "  • API地址: http://$(hostname -I | awk '{print $1}'):3003"
    echo "  • 健康检查: http://localhost:3003/api/v1/health"
    echo "  • Swagger文档: http://localhost:3003/api-docs"
    echo ""
    echo "📝 管理命令:"
    if command -v pm2 &> /dev/null; then
        echo "  • 查看日志: pm2 logs qiguan-backend"
        echo "  • 重启服务: pm2 restart qiguan-backend"
        echo "  • 查看状态: pm2 status"
    else
        echo "  • 查看日志: tail -f ${APP_DIR}/qiguan.log"
        echo "  • 重启服务: pkill -f 'node index.js' && cd ${APP_DIR} && nohup node index.js > qiguan.log &"
    fi
    echo ""
    echo "💡 P0+P1重构亮点:"
    echo "  ✅ 纯MySQL架构 (移除SQLite, -48%代码量)"
    echo "  ✅ 统一错误处理 (asyncHandler)"
    echo "  ✅ SQL注入防护 (排序字段白名单)"
    echo "  ✅ 查询缓存系统 (categories接口)"
    echo "  ✅ responseHelper工具库 (10个方法)"
    echo "  ✅ TDSQL-C连接池优化"
    echo ""
    echo "📂 备份位置: ${BACKUP_DIR}"
    echo "⏰ 部署时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
}

# 主流程
main() {
    echo "开始部署流程..."
    echo ""
    
    check_prerequisites
    backup_current_version
    pull_latest_code
    install_dependencies
    setup_environment
    build_frontend
    test_database_connection
    start_service
    health_check
    show_summary
    
    exit 0
}

# 执行主函数
main "$@"