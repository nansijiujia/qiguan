#!/bin/bash
# ============================================================
# 绮管电商后台 - 自动化部署脚本
# Version: 4.0.0
# Date: 2026-04-09
# Description: 生产环境自动化部署，包含备份、代码更新、依赖安装、构建、服务重启和冒烟测试
# Usage: ./deploy.sh [--skip-backup] [--skip-tests] [--branch <branch_name>]
# ============================================================

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"; }

# 配置项
PROJECT_DIR="/www/wwwroot/qiguan-backend"
BACKUP_DIR="${PROJECT_DIR}/backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
GIT_BRANCH="main"
SKIP_BACKUP=false
SKIP_TESTS=false

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-backup) SKIP_BACKUP=true; shift ;;
        --skip-tests) SKIP_TESTS=true; shift ;;
        --branch) GIT_BRANCH="$2"; shift 2 ;;
        *) log_warn "未知参数: $1"; shift ;;
    esac
done

echo "=========================================="
echo "  绮管电商后台 - 生产部署 v4.0.0"
echo "  部署时间: $(date)"
echo "  目标分支: ${GIT_BRANCH}"
echo "=========================================="

# Step 1: 环境检查
log_step "Step 1/9: 检查部署环境..."

# 检查 Node.js 版本 (需要 >= 14.x)
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 14 ]; then
        log_info "✅ Node.js 版本: $(node -v) (满足要求 >= 14.x)"
    else
        log_error "❌ Node.js 版本过低: $(node -v), 需要 >= 14.x"
        exit 1
    fi
else
    log_error "❌ Node.js 未安装"
    exit 1
fi

# 检查 npm 版本
if command -v npm &> /dev/null; then
    log_info "✅ npm 版本: $(npm -v)"
else
    log_error "❌ npm 未安装"
    exit 1
fi

# 检查 PM2 是否安装
if command -v pm2 &> /dev/null; then
    log_info "✅ PM2 已安装, 版本: $(pm2 -v | grep '@')"
else
    log_error "❌ PM2 未安装, 请先执行: npm install -g pm2"
    exit 1
fi

# 检查 MySQL 客户端是否可用
if command -v mysql &> /dev/null; then
    log_info "✅ MySQL 客户端可用"
else
    log_warn "⚠️ MySQL 客户端未安装, 数据库Schema更新将被跳过"
fi

# 检查 Git 是否配置
if git config user.name &> /dev/null && git config user.email &> /dev/null; then
    log_info "✅ Git 已配置 (用户: $(git config user.name))"
else
    log_warn "⚠️ Git 未配置用户信息"
fi

# 检查磁盘空间 (需要 > 2GB 可用)
AVAILABLE_SPACE=$(df -BG "$PROJECT_DIR" | awk 'NR==2 {print $4}' | tr -d 'G')
if [ "$AVAILABLE_SPACE" -ge 2 ]; then
    log_info "✅ 磁盘空间充足: ${AVAILABLE_SPACE}GB 可用"
else
    log_error "❌ 磁盘空间不足: 仅剩 ${AVAILABLE_SPACE}GB, 需要 > 2GB"
    exit 1
fi

log_info "✅ 环境检查通过"

# Step 2: 备份当前版本
if [ "$SKIP_BACKUP" = false ]; then
    log_step "Step 2/9: 备份当前版本..."
    
    mkdir -p "${BACKUP_DIR}"
    
    # 创建备份（排除不必要的文件）
    tar -czf "${BACKUP_DIR}/pre-deploy-${TIMESTAMP}.tar.gz" \
      --exclude='node_modules' \
      --exclude='data/*.db' \
      --exclude='.env' \
      --exclude='.env.local' \
      --exclude='logs' \
      --exclude='backups' \
      --exclude='*.log' \
      -C "$(dirname "$PROJECT_DIR")" "$(basename "$PROJECT_DIR")"
    
    BACKUP_SIZE=$(du -h "${BACKUP_DIR}/pre-deploy-${TIMESTAMP}.tar.gz" | awk '{print $1}')
    log_info "✅ 备份完成: ${BACKUP_DIR}/pre-deploy-${TIMESTAMP}.tar.gz (${BACKUP_SIZE})"
    
    # 清理旧备份（保留最近5个）
    BACKUP_COUNT=$(ls -1 "${BACKUP_DIR}"/*.tar.gz 2>/dev/null | wc -l)
    if [ "$BACKUP_COUNT" -gt 5 ]; then
        ls -t "${BACKUP_DIR}"/*.tail -n +6 | xargs rm -f
        log_info "🧹 已清理旧备份文件 (保留最新5个)"
    fi
else
    log_warn "⚠️ 跳过备份步骤 (--skip-backup 参数)"
fi

# Step 3: 拉取最新代码
log_step "Step 3/9: 拉取最新代码..."

cd "${PROJECT_DIR}"

# 检查是否有未提交的更改
if [ -n "$(git status --porcelain)" ]; then
    log_warn "⚠️ 工作区有未提交的更改:"
    git status --short
    read -p "是否继续? (yes/no): " CONTINUE_DEPLOY
    if [ "$CONTINUE_DEPLOY" != "yes" ]; then
        log_error "❌ 部署已取消"
        exit 1
    fi
fi

# 获取最新代码
git fetch origin
git reset --hard "origin/${GIT_BRANCH}"

COMMIT_HASH=$(git rev-parse --short HEAD)
log_info "✅ 代码已更新至最新版本 (commit: ${COMMIT_HASH})"

# Step 4: 安装依赖
log_step "Step 4/9: 安装生产依赖..."

npm install --production

# 安装特定的新依赖（如果需要）
if ! npm list multer &> /dev/null; then
    npm install multer --save
    log_info "✅ 已安装 multer (文件上传支持)"
fi

log_info "✅ 依赖安装完成"

# Step 5: 构建前端
log_step "Step 5/9: 构建前端资源..."

cd qiguanqianduan

npm install
npm run build

# 验证前端构建产物
if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
    log_error "❌ 前端构建失败: dist 目录或 index.html 不存在"
    cd ..
    exit 1
fi

cd ..

DIST_SIZE=$(du -sh qiguanqianduan/dist | awk '{print $1}')
log_info "✅ 前端构建完成 (大小: ${DIST_SIZE})"

# Step 6: 更新数据库
log_step "Step 6/9: 更新数据库Schema..."

if command -v mysql &> /dev/null; then
    # 执行数据库Schema更新（幂等操作）
    mysql -h 10.0.0.16 -u QMZYXCX -p'LJN040821.' qmzyxcx < database/production_schema.sql
    
    TABLE_COUNT=$(mysql -h 10.0.0.16 -u QMZYXCX -p'LJN040821.' qmzyxcx -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='qmzyxcx' AND table_type='BASE TABLE';")
    log_info "✅ 数据库Schema已更新 (当前表数量: ${TABLE_COUNT})"
else
    log_warn "⚠️ MySQL 客户端不可用, 跳过数据库更新"
fi

# Step 7: 重启服务
log_step "Step 7/9: 重启PM2服务..."

pm2 restart all
sleep 5

# 检查PM2进程状态
PM2_STATUS=$(pm2 jlist | python3 -c "
import sys, json
processes = json.load(sys.stdin)
for p in processes:
    print(f\"{p['name']}: {p['pm2_env']['status']} (restarts: {p['pm2_env']['restart_time']})\")
")

log_info "✅ 服务重启完成\n${PM2_STATUS}"

# Step 8: 清理缓存
log_step "Step 8/9: 清理Nginx缓存..."

if [ -d "/var/cache/nginx" ]; then
    rm -rf /var/cache/nginx/*
    nginx -t && systemctl reload nginx
    log_info "✅ Nginx缓存已清除并重新加载"
else
    log_warn "⚠️ Nginx缓存目录不存在 (/var/cache/nginx), 跳过清理"
fi

# Step 9: 冒烟测试
if [ "$SKIP_TESTS" = false ]; then
    log_step "Step 9/9: 执行冒烟测试..."
    
    TEST_PASSED=0
    TEST_FAILED=0
    
    # 测试健康检查
    log_info "测试 1/3: 健康检查..."
    HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" https://qimengzhiyue.cn/health || echo "000")
    if [ "$HEALTH_CHECK" = "200" ]; then
        log_info "✅ 健康检查通过 (HTTP ${HEALTH_CHECK})"
        ((TEST_PASSED++))
    else
        log_error "❌ 健康检查失败 (HTTP ${HEALTH_CHECK})"
        ((TEST_FAILED++))
    fi
    
    # 测试登录API
    log_info "测试 2/3: 登录API..."
    LOGIN_RESPONSE=$(curl -s -X POST https://qimengzhiyue.cn/api/v1/auth/login \
      -H "Content-Type: application/json" \
      -d '{"username":"admin","password":"admin123"}')
    
    if echo "$LOGIN_RESPONSE" | grep -q '"success":true'; then
        log_info "✅ 登录API测试通过"
        ((TEST_PASSED++))
    else
        log_warn "⚠️ 登录API测试未通过（可能需要检查凭据）"
        ((TEST_FAILED++))
    fi
    
    # 测试静态资源加载
    log_info "测试 3/3: 静态资源加载..."
    STATIC_CHECK=$(curl -s -o /dev/null -w "%{http_code}" https://qimengzhiyue.cn/index.html || echo "000")
    if [ "$STATIC_CHECK" = "200" ]; then
        log_info "✅ 静态资源加载正常 (HTTP ${STATIC_CHECK})"
        ((TEST_PASSED++))
    else
        log_error "❌ 静态资源加载失败 (HTTP ${STATIC_CHECK})"
        ((TEST_FAILED++))
    fi
    
    # 测试结果汇总
    log_info ""
    log_info "=========================================="
    log_info "  冒烟测试结果: 通过 ${TEST_PASSED}/3, 失败 ${TEST_FAILED}/3"
    log_info "=========================================="
    
    if [ "$TEST_FAILED" -gt 0 ]; then
        log_error "❌ 部署后冒烟测试未完全通过!"
        log_error "正在执行自动回滚..."
        
        # 自动回滚逻辑
        LATEST_BACKUP=$(ls -t "${BACKUP_DIR}"/*.tar.gz 2>/dev/null | head -1)
        if [ -n "$LATEST_BACKUP" ]; then
            log_info "使用备份回滚: ${LATEST_BACKUP}"
            bash rollback.sh "$LATEST_BACKUP"
            exit 1
        else
            log_error "❌ 无可用备份文件, 无法自动回滚!"
            log_error "请手动排查问题或联系运维团队!"
            exit 1
        fi
    fi
else
    log_warn "⚠️ 跳过冒烟测试 (--skip-tests 参数)"
fi

# 部署成功总结
echo ""
echo "=========================================="
echo "  🎉 部署完成！"
echo "=========================================="
echo "  备份文件: ${BACKUP_DIR}/pre-deploy-${TIMESTAMP}.tar.gz"
echo "  当前版本: commit ${COMMIT_HASH}"
echo "  分支: ${GIT_BRANCH}"
echo "  部署时间: $(date)"
echo "  回滚命令: bash rollback.sh ${BACKUP_DIR}/pre-deploy-${TIMESTAMP}.tar.gz"
echo "=========================================="

exit 0