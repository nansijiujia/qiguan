#!/bin/bash

# ============================================================
# 绮管后台 - 一键修复部署脚本
# 用途: 修复所有已知问题并重新部署
# 执行方式: bash fix_and_deploy.sh
# ============================================================

set -e

echo "=========================================="
echo "🔧 绮管后台 - 一键修复部署脚本"
echo "时间: $(date)"
echo "=========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_DIR="/var/www/qiguan"  # 修改为你的实际路径
BACKEND_DIR="$PROJECT_DIR"
FRONTEND_DIR="$PROJECT_DIR/qiguanqianduan"

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# ==================== 步骤1: 备份当前数据 ====================
echo "=========================================="
echo "📦 步骤1/7: 备份当前数据"
echo "=========================================="

if [ -d "$BACKEND_DIR/data" ]; then
    cp -r "$BACKEND_DIR/data" "$BACKEND_DIR/data_backup_$(date +%Y%m%d_%H%M%S)"
    print_success "数据备份完成"
else
    print_warning "未找到数据目录，跳过备份"
fi

# ==================== 步骤2: 拉取最新代码 ====================
echo ""
echo "=========================================="
echo "📥 步骤2/7: 拉取最新代码"
echo "=========================================="

cd "$BACKEND_DIR"
git stash || true
git pull origin 绮管
print_success "代码拉取完成"

# ==================== 步骤3: 配置环境变量（关键！）====================
echo ""
echo "=========================================="
echo "⚙️  步骤3/7: 配置环境变量"
echo "=========================================="

cd "$BACKEND_DIR"

# 创建 .env 文件（如果不存在或强制覆盖）
cat > .env << 'EOF'
# ============================================================
# 绮管电商后台 - 生产环境配置（自动生成）
# ============================================================

# 应用基础配置
PORT=3000
NODE_ENV=production
DEBUG=false
LOG_LEVEL=warn

# ==================== 数据库配置 ====================
# ⚠️ 关键：使用MySQL而非SQLite！
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

# SQLite备用路径（如果MySQL连接失败会回退）
DB_PATH=./data/database.sqlite

# ==================== JWT认证配置 ====================
JWT_SECRET=qiguan-production-secret-key-2026-change-me
JWT_EXPIRES_IN=24h
JWT_ALGORITHM=HS256
JWT_ISSUER=qiguan-api
JWT_AUDIENCE=https://api.qimengzhiyue.cn

# ==================== 服务器配置 ====================
HOST=localhost
CORS_ORIGIN=*
TRUST_PROXY=true

# ==================== 功能开关 ====================
USE_MOCK_DATA=false
ENABLE_SWAGGER=true
EOF

print_success "环境变量配置完成"
print_warning "已设置 DB_TYPE=mysql (关键修改!)"

# ==================== 步骤4: 初始化MySQL数据库 ====================
echo ""
echo "=========================================="
echo "🗄️  步骤4/7: 初始化MySQL数据库"
echo "=========================================="

cd "$BACKEND_DIR"

if [ -f "scripts/init_mysql_database.js" ]; then
    print_status "正在连接MySQL数据库..."
    
    if node scripts/init_mysql_database.js; then
        print_success "MySQL数据库初始化成功"
    else
        print_error "MySQL初始化失败，检查网络和权限"
        print_warning "将回退到SQLite模式..."
        
        # 回退到SQLite
        sed -i 's/DB_TYPE=mysql/DB_TYPE=sqlite/' .env
        print_warning "已切换到SQLite模式"
    fi
else
    print_warning "未找到初始化脚本，跳过"
fi

# ==================== 步骤5: 安装依赖 ====================
echo ""
echo "=========================================="
echo "📦 步骤5/7: 安装后端依赖"
echo "=========================================="

cd "$BACKEND_DIR"
npm install --production
print_success "后端依赖安装完成"

# ==================== 步骤6: 构建前端项目 ====================
echo ""
echo "=========================================="
echo "🎨 步骤6/7: 构建前端项目"
echo "=========================================="

if [ -d "$FRONTEND_DIR" ]; then
    cd "$FRONTEND_DIR"
    
    # 安装前端依赖
    npm install
    
    # 构建生产版本
    if npm run build; then
        print_success "前端构建成功"
        print_status "构建产物位置: $FRONTEND_DIR/dist/"
    else
        print_error "前端构建失败"
        exit 1
    fi
else
    print_error "前端目录不存在: $FRONTEND_DIR"
    exit 1
fi

# ==================== 步骤7: 重启服务 ====================
echo ""
echo "=========================================="
echo "🔄 步骤7/7: 重启服务"
echo "=========================================="

cd "$BACKEND_DIR"

# 使用PM2重启
if command -v pm2 &> /dev/null; then
    pm2 restart qiguan-backend || pm2 start index.js --name qiguan-backend
    print_success "PM2服务重启完成"
    
    # 显示状态
    sleep 2
    pm2 status
    pm2 logs qiguan-backend --lines 20 --nostream
else
    print_warning "PM2未安装，尝试直接启动..."
    
    # 杀死旧进程
    pkill -f "node index.js" || true
    sleep 1
    
    # 启动新进程（后台运行）
    nohup node index.js > /var/log/qiguan-backend.log 2>&1 &
    print_success "服务已在后台启动"
fi

# ==================== 验证 ====================
echo ""
echo "=========================================="
echo "✅ 部署完成 - 开始验证"
echo "=========================================="
echo ""

sleep 3

# 测试API是否正常
print_status "测试API连接..."

if curl -s http://localhost:3000/api/v1/health | grep -q '"status"'; then
    print_success "API服务正常运行 ✅"
else
    print_error "API服务异常 ❌"
    print_warning "请查看日志: pm2 logs qiguan-backend"
fi

# 显示数据库类型
print_status "检查数据库配置..."
if grep -q "DB_TYPE=mysql" "$BACKEND_DIR/.env"; then
    print_success "数据库类型: MySQL ✅"
else
    print_warning "数据库类型: SQLite (回退模式)"
fi

echo ""
echo "=========================================="
echo "🎊 所有步骤执行完成!"
echo "=========================================="
echo ""
echo "📋 后续操作:"
echo "   1. 访问 https://qimengzhiyue.cn/dashboard 验证"
echo "   2. 检查仪表盘是否不再显示模拟数据"
echo "   3. 测试添加分类功能"
echo "   4. 查看日志: pm2 logs qiguan-backend"
echo ""
echo "⚠️  如果还有问题，请检查:"
echo "   - PM2日志: pm2 logs qiguan-backend --lines 50"
echo "   - Nginx日志: tail -f /var/log/nginx/error.log"
echo "   - 数据库连接: node -e \"require('./db_mysql').initPool().then(() => console.log('OK')).catch(e => console.error(e.message))\""
echo ""
