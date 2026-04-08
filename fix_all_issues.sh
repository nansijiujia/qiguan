#!/bin/bash

# ============================================================
# 绮管后台一键修复部署脚本
# 功能：自动拉取代码、配置环境、安装依赖、构建前端、重启服务
# 作者：系统管理员
# 日期：2026-04-09
# ============================================================

set -e  # 遇到错误时退出，但关键命令会使用 || true 保护

# ==================== 颜色定义 ====================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ==================== 配置信息 ====================
PROJECT_DIR="/var/www/qiguan"
GIT_BRANCH="绮管"
DB_HOST="10.0.0.16"
DB_PORT="3306"
DB_USER="QMZYXCX"
DB_PASSWORD="LJN040821."
DB_NAME="qmzyxcx"
JWT_SECRET="qiguan_jwt_secret_key_2026_super_secure_random_string_for_production_environment_must_be_at_least_64_characters_long!"
BACKEND_PORT=3000
PM2_APP_NAME="qiguan-backend"

# ==================== 工具函数 ====================
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# 脱敏显示密码（只显示前3位和后3位）
mask_password() {
    local pass="$1"
    if [ ${#pass} -le 6 ]; then
        echo "***"
    else
        echo "${pass:0:3}***${pass: -3}"
    fi
}

# 记录开始时间
START_TIME=$(date +%s)
START_TIME_READABLE=$(date '+%Y-%m-%d %H:%M:%S')

echo -e "\n${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     绮管后台一键修复部署脚本 v1.0        ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo -e "\n${BLUE}开始时间：${NC}${START_TIME_READABLE}"
echo -e "${BLUE}目标目录：${NC}${PROJECT_DIR}"

# ============================================================
# 步骤 1: 环境准备 - 进入项目目录并拉取最新代码
# ============================================================
print_header "步骤 1/7: 环境准备"

if [ -d "$PROJECT_DIR" ]; then
    print_info "进入项目目录..."
    cd "$PROJECT_DIR" || { print_error "无法进入目录 $PROJECT_DIR"; exit 1; }
    print_success "已进入项目目录: $PROJECT_DIR"

    print_info "正在从 Git 拉取最新代码（分支: $GIT_BRANCH）..."
    if git pull origin "$GIT_BRANCH" 2>&1; then
        print_success "代码拉取成功"
    else
        print_warning "Git pull 失败，尝试继续执行..."
    fi
else
    print_error "项目目录不存在: $PROJECT_DIR"
    print_info "请先克隆项目或检查路径配置"
    exit 1
fi

# ============================================================
# 步骤 2: 配置环境变量（创建 .env 文件）
# ============================================================
print_header "步骤 2/7: 配置环境变量"

ENV_FILE=".env"
print_info "创建环境变量文件: $ENV_FILE"

cat > "$ENV_FILE" << EOF
# 数据库配置
DB_TYPE=mysql
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=${DB_NAME}

# 运行环境
NODE_ENV=production

# JWT 密钥（用于 token 签名和验证）
JWT_SECRET=${JWT_SECRET}

# 服务器端口
PORT=${BACKEND_PORT}
EOF

if [ -f "$ENV_FILE" ]; then
    print_success "环境变量文件创建成功"
    print_info "数据库主机: ${DB_HOST}"
    print_info "数据库端口: ${DB_PORT}"
    print_info "数据库用户: ${DB_USER}"
    print_info "数据库密码: $(mask_password "$DB_PASSWORD") (已脱敏)"
    print_info "数据库名称: ${DB_NAME}"
    print_info "JWT密钥长度: ${#JWT_SECRET} 字符"
else
    print_error "环境变量文件创建失败"
fi

# ============================================================
# 步骤 3: 安装依赖
# ============================================================
print_header "步骤 3/7: 安装依赖"

# 3.1 安装后端依赖
print_info "安装后端依赖（npm install --production）..."
if npm install --production 2>&1 | tail -20; then
    print_success "后端依赖安装完成"
else
    print_warning "后端依赖安装出现问题，继续尝试..."
fi

# 3.2 安装前端依赖
if [ -d "qiguanqianduan" ]; then
    print_info "进入前端目录并安装依赖..."
    cd qiguanqianduan || { print_warning "无法进入前端目录，跳过前端安装"; }
    
    if npm install 2>&1 | tail -20; then
        print_success "前端依赖安装完成"
    else
        print_warning "前端依赖安装出现问题，继续尝试..."
    fi
    
    cd .. || true
else
    print_warning "前端目录不存在，跳过前端依赖安装"
fi

# ============================================================
# 步骤 4: 强制重新构建前端（清除缓存）
# ============================================================
print_header "步骤 4/7: 强制重新构建前端"

if [ -d "qiguanqianduan" ]; then
    cd qiguanqianduan || { print_warning "无法进入前端目录"; }
    
    print_info "清除旧的构建产物和缓存..."
    
    # 删除 dist 目录
    if [ -d "dist" ]; then
        rm -rf dist && print_success "已删除 dist 目录" || print_warning "删除 dist 目录失败"
    else
        print_info "dist 目录不存在，无需删除"
    fi
    
    # 删除 node_modules（可选，如果依赖有问题）
    # rm -rf node_modules && print_success "已删除 node_modules" || print_warning "删除 node_modules 失败"
    
    # 删除 .vite 缓存
    if [ -d ".vite" ]; then
        rm -rf .vite && print_success "已删除 .vite 缓存" || print_warning "删除 .vite 缓存失败"
    else
        print_info ".vite 缓存不存在，无需删除"
    fi
    
    print_info "开始重新构建前端..."
    BUILD_START=$(date +%s)
    
    if npm run build 2>&1; then
        BUILD_END=$(date +%s)
        BUILD_DURATION=$((BUILD_END - BUILD_START))
        print_success "前端构建成功！耗时: ${BUILD_DURATION}秒"
        
        # 检查构建产物是否存在
        if [ -d "dist" ]; then
            DIST_SIZE=$(du -sh dist 2>/dev/null | cut -f1)
            print_info "构建产物大小: ${DIST_SIZE}"
        fi
    else
        print_error "前端构建失败！请检查上面的错误信息"
        print_warning "将继续执行后续步骤..."
    fi
    
    cd .. || true
else
    print_warning "前端目录不存在，跳过构建步骤"
fi

# ============================================================
# 步骤 5: 重启 PM2 服务
# ============================================================
print_header "步骤 5/7: 重启 PM2 服务"

# 检查 PM2 是否安装
if ! command -v pm2 &> /dev/null; then
    print_warning "PM2 未检测到，尝试全局安装..."
    npm install -g pm2 || print_error "PM2 安装失败"
fi

print_info "停止旧的后端进程（如果有）..."
pm2 delete "$PM2_APP_NAME" 2>/dev/null || true
print_success "已清理旧进程"

print_info "启动新的后端服务..."
print_info "应用名称: $PM2_APP_NAME"
print_info "使用 JWT_SECRET 启动..."

# 使用环境变量启动 PM2
export JWT_SECRET="$JWT_SECRET"
export NODE_ENV="production"

if pm2 start index.js --name "$PM2_APP_NAME" 2>&1; then
    print_success "PM2 服务启动命令已执行"
else
    print_error "PM2 服务启动失败"
fi

print_info "等待服务启动（3秒）..."
sleep 3

# 保存 PM2 进程列表
pm2 save 2>/dev/null || print_warning "PM2 save 失败（非致命）"

# ============================================================
# 步骤 6: 验证部署
# ============================================================
print_header "步骤 6/7: 验证部署"

echo -e "\n${YELLOW}=== API 健康检查 ===${NC}"
HEALTH_CHECK_URL="http://localhost:${BACKEND_PORT}/api/v1/health"
print_info "测试地址: $HEALTH_CHECK_URL"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$HEALTH_CHECK_URL" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "302" ]; then
    print_success "API 健康检查通过！状态码: $HTTP_CODE"
    
    # 显示部分响应内容
    RESPONSE=$(curl -s --connect-timeout 5 "$HEALTH_CHECK_URL" 2>/dev/null | head -c 200)
    if [ -n "$RESPONSE" ]; then
        print_info "API 响应: $RESPONSE"
    fi
else
    print_warning "API 健康检查返回状态码: $HTTP_CODE"
    print_warning "服务可能还在启动中，请稍后手动验证"
fi

echo -e "\n${YELLOW}=== PM2 进程状态 ===${NC}"
pm2 status 2>/dev/null || print_error "无法获取 PM2 状态"

echo -e "\n${YELLOW}=== 最近日志（最后15行）==="
pm2 logs "$PM2_APP_NAME" --lines 15 --nostream 2>/dev/null || print_warning "无法获取日志"

# ============================================================
# 步骤 7: 输出总结报告
# ============================================================
print_header "步骤 7/7: 部署总结报告"

END_TIME=$(date +%s)
END_TIME_READABLE=$(date '+%Y-%m-%d %H:%M:%S')
TOTAL_DURATION=$((END_TIME - START_TIME))

echo -e "\n${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}         📊 部署诊断摘要报告               ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}\n"

echo -e "${BLUE}⏰ 时间信息:${NC}"
echo -e "   开始时间: ${START_TIME_READABLE}"
echo -e "   结束时间: ${END_TIME_READABLE}"
echo -e "   总耗时:   ${TOTAL_DURATION} 秒\n"

echo -e "${BLUE}🔧 环境配置:${NC}"
echo -e "   项目目录: ${PROJECT_DIR}"
echo -e "   Git 分支: ${GIT_BRANCH}"
echo -e "   数据库:   ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo -e "   后端端口: ${BACKEND_PORT}"
echo -e "   PM2 名称: ${PM2_APP_NAME}\n"

echo -e "${BLUE}✅ 执行结果:${NC}"

# 检查各组件状态
if [ -f ".env" ]; then
    print_success "环境变量配置 (.env ✓)"
else
    print_error "环境变量配置 (.env ✗)"
fi

if pm2 list 2>/dev/null | grep -q "$PM2_APP_NAME"; then
    PM2_STATUS=$(pm2 list 2>/dev/null | grep "$PM2_APP_NAME" | awk '{print $9}')
    if [ "$PM2_STATUS" = "online" ]; then
        print_success "PM2 进程状态 ($PM2_APP_NAME: online ✓)"
    else
        print_warning "PM2 进程状态 ($PM2_APP_NAME: $PM2_STATUS ⚠)"
    fi
else
    print_error "PM2 进程未找到 ($PM2_APP_NAME ✗)"
fi

if [ "$HTTP_CODE" = "200" ]; then
    print_success "API 健康检查 (HTTP $HTTP_CODE ✓)"
elif [ "$HTTP_CODE" != "000" ]; then
    print_warning "API 健康检查 (HTTP $HTTP_CODE ⚠)"
else
    print_error "API 健康检查 (连接失败 ✗)"
fi

if [ -d "qiguanqianduan/dist" ]; then
    print_success "前端构建产物 (dist/ ✓)"
else
    print_warning "前端构建产物 (dist/ ⚠ 可能未构建)"
fi

echo -e "\n${GREEN}═══════════════════════════════════════════${NC}"
echo -e "\n${YELLOW}📌 下一步操作提示:${NC}\n"
echo -e "  1️⃣  访问 API 测试页面:"
echo -e "      ${BLUE}http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'YOUR_SERVER_IP'):${BACKEND_PORT}/api/v1/health${NC}\n"
echo -e "  2️⃣  如果使用 Nginx 反向代理，访问:"
echo -e "      ${BLUE}http://YOUR_DOMAIN/api/v1/health${NC}\n"
echo -e "  3️⃣  查看 PM2 实时日志:"
echo -e "      ${BLUE}pm2 logs $PM2_APP_NAME --lines 100${NC}\n"
echo -e "  4️⃣  监控 PM2 进程状态:"
echo -e "      ${BLUE}pm2 monit${NC}\n"
echo -e "  5️⃣  如遇问题，查看详细诊断:"
echo -e "      ${BLUE}pm2 describe $PM2_APP_NAME${NC}\n"

echo -e "${YELLOW}⚠️  常见问题排查:${NC}"
echo -e "  • 端口被占用: sudo lsof -i :${BACKEND_PORT} | grep LISTEN"
echo -e "  • 数据库连接失败: 检查 .env 中的 DB 配置是否正确"
echo -e "  • 权限问题: 确保 Node.js 和 PM2 有正确的执行权限"
echo -e "  • 前端空白页: 检查 qiguanqianduan/dist/index.html 是否存在\n"

echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✨ 脚本执行完毕！感谢使用 ✨            ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}\n"
