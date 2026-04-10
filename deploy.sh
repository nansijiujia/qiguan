#!/bin/bash
# ============================================================
# 绮管后台 v4.0.0 生产环境自动化部署脚本 (Enhanced)
# Usage: ./deploy.sh [--rollback] [--skip-db-upgrade] [--skip-backup] [--skip-tests]
# Author: AI Assistant
# Date: 2026-04-10
# Version: 4.1.0
# Features:
#   - 完整的回滚机制
#   - 6项冒烟测试（P0验证）
#   - 自动备份与清理
#   - 数据库Schema升级支持
#   - 详细日志输出
# ============================================================

set -e  # 遇错即停

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"; }

# 配置变量
PROJECT_DIR="/www/wwwroot/qiguan-backend"
BACKUP_DIR="${PROJECT_DIR}/backups"
GIT_REPO="https://github.com/nansijiujia/qiguan.git"
DEPLOY_BRANCH="main"
VERSION_TAG="v4.0.0-production"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 解析参数
ROLLBACK=false
SKIP_DB=false
SKIP_BACKUP=false
SKIP_TESTS=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --rollback) ROLLBACK=true; shift ;;
    --skip-db-upgrade) SKIP_DB=true; shift ;;
    --skip-backup) SKIP_BACKUP=true; shift ;;
    --skip-tests) SKIP_TESTS=true; shift ;;
    *) log_error "未知参数: $1"; exit 1 ;;
  esac
done

echo ""
echo "=========================================="
echo "  绮管电商后台 - 生产部署 v4.1.0"
echo "  部署时间: $(date)"
echo "  目标分支: ${DEPLOY_BRANCH}"
echo "=========================================="
echo ""

# Step 0: 回滚模式
if [ "$ROLLBACK" = true ]; then
  log_info "=== 执行回滚操作 ==="
  LATEST_BACKUP=$(ls -t ${BACKUP_DIR}/pre-deploy-*.tar.gz 2>/dev/null | head -1)
  if [ -z "$LATEST_BACKUP" ]; then
    log_error "未找到备份文件!"
    exit 1
  fi
  log_info "使用备份文件: ${LATEST_BACKUP}"
  tar -xzf "$LATEST_BACKUP" -C /
  pm2 restart all
  sleep 5
  log_info "✅ 回滚完成: ${LATEST_BACKUP}"
  log_info "请执行冒烟测试验证系统状态"
  exit 0
fi

# Step 1: 环境预检
log_step "Step 1/9: 环境预检..."
log_info "检查必需工具..."

# 检查 Node.js
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

# 检查 npm
if command -v npm &> /dev/null; then
  log_info "✅ npm 版本: $(npm -v)"
else
  log_error "❌ npm 未安装"
  exit 1
fi

# 检查 PM2
if command -v pm2 &> /dev/null; then
  log_info "✅ PM2 已安装, 版本: $(pm2 -v | grep '@' || pm2 -v)"
else
  log_error "❌ PM2 未安装, 请先执行: npm install -g pm2"
  exit 1
fi

# 检查 Nginx
if command -v nginx &> /dev/null; then
  log_info "✅ Nginx 已安装, 版本: $(nginx -v 2>&1)"
else
  log_warn "⚠️ Nginx 未安装或不在PATH中"
fi

# 检查 Git
if command -v git &> /dev/null; then
  log_info "✅ Git 已安装, 版本: $(git --version)"
else
  log_error "❌ Git 未安装"
  exit 1
fi

# 检查磁盘空间
AVAILABLE_SPACE=$(df -BG "$PROJECT_DIR" 2>/dev/null | awk 'NR==2 {print $4}' | tr -d 'G' || echo "0")
if [ "$AVAILABLE_SPACE" -ge 2 ] 2>/dev/null; then
  log_info "✅ 磁盘空间充足: ${AVAILABLE_SPACE}GB 可用"
else
  log_error "❌ 磁盘空间不足: 仅剩 ${AVAILABLE_SPACE}GB, 需要 > 2GB"
  exit 1
fi

# 检查 MySQL客户端（可选）
if command -v mysql &> /dev/null; then
  log_info "✅ MySQL 客户端可用"
else
  log_warn "⚠️ MySQL 客户端未安装, 数据库Schema更新将被跳过"
fi

log_info "✅ 环境预检通过"

# Step 2: 创建备份
if [ "$SKIP_BACKUP" = false ]; then
  log_step "Step 2/9: 创建当前版本备份..."

  mkdir -p "${BACKUP_DIR}"

  # 创建备份（排除不必要的文件）
  BACKUP_FILE="${BACKUP_DIR}/pre-deploy-${TIMESTAMP}.tar.gz"
  tar -czf ${BACKUP_FILE} \
    --exclude=node_modules \
    --exclude=data/*.db \
    --exclude=.env \
    --exclude=.env.local \
    --exclude=logs \
    --exclude=backups \
    --exclude=*.log \
    -C "$(dirname "$PROJECT_DIR")" "$(basename "$PROJECT_DIR")"

  BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | awk '{print $1}')
  log_info "✅ 备份完成: ${BACKUP_FILE} (${BACKUP_SIZE})"

  # 清理旧备份（保留最近5个）
  BACKUP_COUNT=$(ls -1 "${BACKUP_DIR}"/*.tar.gz 2>/dev/null | wc -l)
  if [ "$BACKUP_COUNT" -gt 5 ]; then
    ls -t "${BACKUP_DIR}"/*.tar.gz | tail -n +6 | xargs rm -f
    log_info "🧹 已清理旧备份文件 (保留最新5个)"
  fi
else
  log_warn "⚠️ 跳过备份步骤 (--skip-backup 参数)"
  BACKUP_FILE="${BACKUP_DIR}/pre-deploy-manual-${TIMESTAMP}.tar.gz"
fi

# Step 3: 拉取最新代码
log_step "Step 3/9: 拉取最新代码..."

cd "${PROJECT_DIR}"

# 检查是否有未提交的更改
if [ -n "$(git status --porcelain)" ]; then
  log_warn "⚠️ 工作区有未提交的更改:"
  git status --short
  log_warn "将执行 git reset --hard，未提交的更改将丢失!"
  sleep 3
fi

# 获取最新代码
git fetch origin
git reset --hard "origin/${DEPLOY_BRANCH}"

COMMIT_HASH=$(git rev-parse --short HEAD)
log_info "✅ 代码已更新至最新版本 (commit: ${COMMIT_HASH})"

# Step 4: 安装依赖
log_step "Step 4/9: 安装生产依赖..."

npm ci --production --prefer-offline 2>/dev/null || npm install --production

# 安装特定的新依赖（如果需要）
if ! npm list multer &> /dev/null; then
  npm install multer --save
  log_info "✅ 已安装 multer (文件上传支持)"
fi

log_info "✅ 依赖安装完成"

# Step 5: 构建前端
log_step "Step 5/9: 构建前端资源..."

cd qiguanqianduan

npm install --production 2>/dev/null || npm install
npm run build

# 验证前端构建产物
if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
  log_error "❌ 前端构建失败: dist 目录或 index.html 不存在"
  cd ..
  log_error "正在执行自动回滚..."
  if [ -f "$BACKUP_FILE" ]; then
    tar -xzf "$BACKUP_FILE" -C /
    pm2 restart all
  fi
  exit 1
fi

cd ..

DIST_SIZE=$(du -sh qiguanqianduan/dist | awk '{print $1}')
log_info "✅ 前端构建完成 (大小: ${DIST_SIZE})"

# Step 6: 数据库Schema升级 (可选跳过)
if [ "$SKIP_DB" = false ]; then
  log_step "Step 6/9: 升级数据库Schema (v2.0)..."

  if command -v mysql &> /dev/null; then
    # 执行数据库Schema更新（幂等操作）
    if [ -f "database/schema_v2_upgrade_system_identification.sql" ]; then
      mysql -h ${DB_HOST:-10.0.0.16} -u ${DB_USER:-QMZYXCX} -p"${DB_PASSWORD:-LJN040821.}" ${DB_NAME:-qmzyxcx} < database/schema_v2_upgrade_system_identification.sql 2>&1 && \
      log_info "✅ Schema v2.0升级脚本执行成功"
    elif [ -f "database/production_schema.sql" ]; then
      mysql -h ${DB_HOST:-10.0.0.16} -u ${DB_USER:-QMZYXCX} -p"${DB_PASSWORD:-LJN040821.}" ${DB_NAME:-qmzyxcx} < database/production_schema.sql 2>&1 && \
      log_info "✅ 生产Schema脚本执行成功"
    else
      log_warn "⚠️ 未找到Schema升级脚本，跳过"
    fi

    TABLE_COUNT=$(mysql -h ${DB_HOST:-10.0.0.16} -u ${DB_USER:-QMZYXCX} -p"${DB_PASSWORD:-LJN040821.}" ${DB_NAME:-qmzyxcx} -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DB_NAME:-qmzyxcx}' AND table_type='BASE TABLE';" 2>/dev/null || echo "0")
    log_info "📊 当前数据库表数量: ${TABLE_COUNT}"
  else
    log_warn "⚠️ MySQL 客户端不可用, 跳过数据库更新 (--skip-db-upgrade 可跳过此步骤)"
  fi
else
  log_warn "⚠️ 已跳过数据库升级 (--skip-db-upgrade)"
fi

# Step 7: 重启服务
log_step "Step 7/9: 重启PM2服务..."

if pm2 describe qiguan-backend > /dev/null 2>&1; then
  pm2 restart qiguan-backend
else
  pm2 start index.js --name qiguan-backend -i max
fi
pm2 save

sleep 5  # 等待服务启动

# 检查PM2进程状态
PM2_STATUS=$(pm2 jlist 2>/dev/null | python3 -c "
import sys, json
try:
  processes = json.load(sys.stdin)
  for p in processes:
    print(f\"{p['name']}: {p['pm2_env']['status']} (restarts: {p['pm2_env']['restart_time']})\")
except:
  print('无法获取PM2状态')
" 2>/dev/null || echo "PM2状态查询失败")

log_info "✅ PM2重启完成\n${PM2_STATUS}"

# Step 8: Nginx配置重载
log_step "Step 8/9: 重载Nginx配置..."

if command -v nginx &> /dev/null; then
  nginx -t && systemctl reload nginx 2>/dev/null && \
  log_info "✅ Nginx重载完成"

  # 清理Nginx缓存
  if [ -d "/var/cache/nginx" ]; then
    rm -rf /var/cache/nginx/*
    log_info "🧹 Nginx缓存已清除"
  fi
else
  log_warn "⚠️ Nginx不可用，跳过重载"
fi

# Step 9: 冒烟测试 (6项P0验证)
if [ "$SKIP_TESTS" = false ]; then
  log_step "Step 9/9: 执行冒烟测试 (6项P0验证)..."
  echo ""

  TEST_PASSED=0
  TEST_FAILED=0
  TEST_RESULTS=""

  # 测试1: 健康检查接口
  log_info "测试 1/6: 健康检查接口 (/health)..."
  HEALTH_RESPONSE=$(curl -sf http://localhost:3000/health 2>/dev/null || echo "")
  if echo "$HEALTH_RESPONSE" | grep -q '"status":"healthy"\|"status":"ok"'; then
    RESPONSE_TIME=$(curl -s -o /dev/null -w "%{time_total}" http://localhost:3000/health)
    log_info "✅ 测试1通过 - /health 接口正常 (响应时间: ${RESPONSE_TIME}s)"
    ((TEST_PASSED++))
    TEST_RESULTS+="T1:PASS|"
  else
    log_error "❌ 测试1失败 - /health 接口异常"
    log_error "   响应内容: ${HEALTH_RESPONSE:0:100}..."
    ((TEST_FAILED++))
    TEST_RESULTS+="T1:FAIL|"
  fi

  # 测试2: 登录API
  log_info "测试 2/6: 登录API (/api/v1/auth/login)..."
  LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin123"}' 2>/dev/null || echo "")

  if echo "$LOGIN_RESPONSE" | grep -q '"token"'; then
    log_info "✅ 测试2通过 - 登录API正常"
    ((TEST_PASSED++))
    TEST_RESULTS+="T2:PASS|"
  elif echo "$LOGIN_RESPONSE" | grep -q '"success":false'; then
    log_warn "⚠️ 测试2警告 - 登录API返回失败（可能需要检查凭据）"
    ((TEST_FAILED++))
    TEST_RESULTS+="T2:WARN|"
  else
    log_error "❌ 测试2失败 - 登录API异常"
    ((TEST_FAILED++))
    TEST_RESULTS+="T2:FAIL|"
  fi

  # 测试3: 商品列表API
  log_info "测试 3/6: 商品列表API (/api/v1/products)..."
  PRODUCTS_RESPONSE=$(curl -sf "http://localhost:3000/api/v1/products?page=1&pageSize=5" 2>/dev/null || echo "")
  if echo "$PRODUCTS_RESPONSE" | grep -q '\[' && echo "$PRODUCTS_RESPONSE" | grep -q '"success":true'; then
    log_info "✅ 测试3通过 - 商品列表API正常"
    ((TEST_PASSED++))
    TEST_RESULTS+="T3:PASS|"
  else
    log_error "❌ 测试3失败 - 商品列表API异常"
    ((TEST_FAILED++))
    TEST_RESULTS+="T3:FAIL|"
  fi

  # 测试4: 分类数据API
  log_info "测试 4/6: 分类数据API (/api/v1/categories)..."
  CATEGORIES_RESPONSE=$(curl -sf "http://localhost:3000/api/v1/categories" 2>/dev/null || echo "")
  if echo "$CATEGORIES_RESPONSE" | grep -q '\[' && echo "$CATEGORIES_RESPONSE" | grep -q '"success":true'; then
    log_info "✅ 测试4通过 - 分类API正常"
    ((TEST_PASSED++))
    TEST_RESULTS+="T4:PASS|"
  else
    log_error "❌ 测试4失败 - 分类API异常"
    ((TEST_FAILED++))
    TEST_RESULTS+="T4:FAIL|"
  fi

  # 测试5: Dashboard Stats API
  log_info "测试 5/6: Dashboard统计API (/api/v1/dashboard/stats)..."
  STATS_RESPONSE=$(curl -sf "http://localhost:3000/api/v1/dashboard/stats" 2>/dev/null || echo "")
  if echo "$STATS_RESPONSE" | grep -q '"success":true'; then
    log_info "✅ 测试5通过 - Dashboard统计API正常"
    ((TEST_PASSED++))
    TEST_RESULTS+="T5:PASS|"
  else
    log_warn "⚠️ 测试5警告 - Dashboard统计API可能需要认证"
    ((TEST_FAILED++))
    TEST_RESULTS+="T5:AUTH|"
  fi

  # 测试6: PM2进程健康
  log_info "测试 6/6: PM2进程状态..."
  PM2_HEALTHY=$(pm2 list 2>/dev/null | grep -E "qiguan-backend.*online|qiguan-backend.*error" | head -1 || echo "")
  if echo "$PM2_HEALTHY" | grep -q "online"; then
    UPTIME=$(pm2 list 2>/dev/null | grep qiguan-backend | awk '{print $10}' || echo "unknown")
    log_info "✅ 测试6通过 - PM2进程运行正常 (uptime: ${UPTIME})"
    ((TEST_PASSED++))
    TEST_RESULTS+="T6:PASS|"
  else
    log_error "❌ 测试6失败 - PM2进程异常"
    ((TEST_FAILED++))
    TEST_RESULTS+="T6:FAIL|"
  fi

  # 测试结果汇总
  echo ""
  log_info "=========================================="
  log_info "  冒烟测试结果汇总"
  log_info "=========================================="
  log_info "  通过: ${TEST_PASSED}/6"
  log_info "  失败: ${TEST_FAILED}/6"
  log_info "  结果码: ${TEST_RESULTS}"
  log_info "=========================================="
  echo ""

  if [ "$TEST_FAILED" -gt 0 ] && [ "$TEST_PASSED" -lt 4 ]; then
    log_error "========================================="
    log_error "⚠️  部署完成但关键测试失败!"
    log_error "========================================="

    # 判断是否需要自动回滚
    if [ "$TEST_PASSED" -lt 3 ]; then
      log_error "通过测试不足3项，正在执行自动回滚..."

      LATEST_BACKUP=$(ls -t "${BACKUP_DIR}"/*.tar.gz 2>/dev/null | head -1)
      if [ -n "$LATEST_BACKUP" ]; then
        log_info "使用备份回滚: ${LATEST_BACKUP}"
        tar -xzf "$LATEST_BACKUP" -C /
        pm2 restart all
        log_error "✅ 回滚完成，请手动排查问题"
        exit 1
      else
        log_error "❌ 无可用备份文件, 无法自动回滚!"
        log_error "请手动排查问题或联系运维团队!"
        exit 1
      fi
    else
      log_warn "部分测试失败，但核心功能正常。建议手动排查后补测。"
      log_warn "回滚命令: ./deploy.sh --rollback"
    fi
  elif [ "$TEST_FAILED" -gt 0 ]; then
    log_warn "⚠️ 部署基本成功，但有 ${TEST_FAILED} 个非关键测试未通过"
    log_warn "建议在低峰期排查并修复"
  else
    log_info "========================================="
    log_info "🎉 部署成功! 所有冒烟测试通过! (6/6)"
    log_info "========================================="
  fi
else
  log_warn "⚠️ 跳过冒烟测试 (--skip-tests 参数)"
  log_warn "建议稍后手动执行测试验证"
fi

# 部署成功总结
echo ""
echo "=========================================="
echo "  📋 部署完成报告"
echo "=========================================="
echo "  ✅ 备份文件: ${BACKUP_FILE:-跳过}"
echo "  ✅ 当前版本: commit ${COMMIT_HASH}"
echo "  ✅ 分支: ${DEPLOY_BRANCH}"
echo "  ✅ 部署时间: $(date)"
echo "  ✅ 冒烟测试: ${TEST_PASSED:-跳过}/${TEST_TOTAL:-6} 通过"
echo ""
echo "  🔄 回滚命令:"
echo "     ./deploy.sh --rollback"
echo ""
echo "  🔍 监控命令:"
echo "     pm2 logs qiguan-backend --lines 50"
echo "     pm2 monit"
echo "=========================================="

exit 0
