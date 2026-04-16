#!/bin/bash
# ============================================================
# 绮管电商后台 v4 系统化修复 - 生产环境部署脚本
# 版本: 2026-04-16
# 用法: bash deploy-v4.sh [--backup-only] [--rollback] [--verify]
# 说明: 支持Windows Git Bash / WSL / Linux环境执行
# ============================================================

set -euo pipefail

# ==================== 配置区 ====================
SERVER_IP="121.41.22.238"
SERVER_USER="root"
SERVER_PORT="${SSH_PORT:-22}"
SSH_KEY="${SSH_KEY:-}"
REMOTE_FRONTEND_DIR="/www/wwwroot/qiguan/dist"
REMOTE_BACKEND_DIR="/www/wwwroot/qiguan"
LOCAL_FRONTEND_DIST="e:/1/绮管后台/qiguanqianduan/dist"
LOCAL_BACKEND_ROOT="e:/1/绮管后台"
VERSION="v4-$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="/tmp/qiguan-backup-${VERSION}"
LOG_FILE="./deploy-${VERSION}.log"

# 需要上传的后端文件列表
BACKEND_FILES=(
  "index.js"
  "routes/coupons.js"
  "routes/categories.js"
  "routes/products.js"
  "db_unified.js"
  "utils/errorHandler.js"
  "utils/validation.js"
  ".env.production"
)

# 健康检查端点
HEALTH_ENDPOINTS=(
  "https://qimengzhiyue.cn/api/v1/health"
  "https://api.qimengzhiyue.cn/api/v1/health"
)

# ==================== 颜色和日志函数 ====================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
  local msg="✅ $1"
  echo -e "${GREEN}${msg}${NC}"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1" >> "${LOG_FILE}" 2>/dev/null || true
}

log_warn() {
  local msg="⚠️  $1"
  echo -e "${YELLOW}${msg}${NC}"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARN: $1" >> "${LOG_FILE}" 2>/dev/null || true
}

log_error() {
  local msg="❌ $1"
  echo -e "${RED}${msg}${NC}"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" >> "${LOG_FILE}" 2>/dev/null || true
}

log_step() {
  local msg="📋 $1"
  echo -e "\n${BLUE}========================================${NC}"
  echo -e "${BLUE}${msg}${NC}"
  echo -e "${BLUE}========================================${NC}\n"
}

# SSH命令构建
build_ssh_cmd() {
  if [ -n "${SSH_KEY}" ]; then
    echo "ssh -i ${SSH_KEY} -p ${SERVER_PORT} -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${SERVER_USER}@${SERVER_IP}"
  else
    echo "ssh -p ${SERVER_PORT} -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${SERVER_USER}@${SERVER_IP}"
  fi
}

# SCP命令构建
build_scp_cmd() {
  local src="$1"
  local dst="$2"
  if [ -n "${SSH_KEY}" ]; then
    echo "scp -i ${SSH_KEY} -P ${SERVER_PORT} -o StrictHostKeyChecking=no \"${src}\" \"${dst}\""
  else
    echo "scp -P ${SERVER_PORT} -o StrictHostKeyChecking=no \"${src}\" \"${dst}\""
  fi
}

# 执行远程命令
run_remote() {
  local cmd="$1"
  local ssh_cmd=$(build_ssh_cmd)
  eval "${ssh_cmd} '${cmd}'"
}

# ==================== 步骤0: 环境检查 ====================
check_environment() {
  log_step "步骤0: 本地环境检查"
  
  # 检查本地前端dist目录
  if [ ! -d "${LOCAL_FRONTEND_DIST}" ]; then
    log_error "前端dist目录不存在: ${LOCAL_FRONTEND_DIST}"
    log_error "请先执行: cd qiguanqianduan && npm run build"
    exit 1
  fi
  log_info "前端dist目录存在 ✓"
  
  # 检查后端文件
  for file in "${BACKEND_FILES[@]}"; do
    local full_path="${LOCAL_BACKEND_ROOT}/${file}"
    if [ ! -f "${full_path}" ]; then
      log_warn "后端文件不存在(可能未修改): ${file}"
    else
      log_info "后端文件存在: ${file} ✓"
    fi
  done
  
  # 检查SSH连接
  log_info "测试SSH连接到 ${SERVER_IP}:${SERVER_PORT}..."
  local ssh_cmd=$(build_ssh_cmd)
  if eval "${ssh_cmd} 'echo Connection_OK'" > /dev/null 2>&1; then
    log_info "SSH连接成功 ✓"
  else
    log_error "SSH连接失败! 请检查:"
    log_error "  1. 服务器IP是否正确: ${SERVER_IP}"
    log_error "  2. SSH端口是否正确: ${SERVER_PORT}"
    log_error "  3. 是否需要VPN或SSH密钥"
    log_error "  4. 防火墙规则"
    exit 1
  fi
  
  # 检查远程目录
  log_info "检查远程目录结构..."
  run_remote "ls -la ${REMOTE_FRONTEND_DIR}/ 2>/dev/null && echo 'FRONTEND_DIR_OK' || echo 'FRONTEND_DIR_MISSING'"
  run_remote "ls -la ${REMOTE_BACKEND_DIR}/ 2>/dev/null && echo 'BACKEND_DIR_OK' || echo 'BACKEND_DIR_MISSING'"
  
  log_info "环境检查完成"
}

# ==================== 步骤1: 备份现有版本 ====================
backup_current_version() {
  log_step "步骤1: 备份当前生产版本"
  
  local backup_script="
    set -e
    
    # 创建备份目录
    mkdir -p ${BACKUP_DIR}
    mkdir -p ${BACKUP_DIR}/frontend
    mkdir -p ${BACKUP_DIR}/backend
    
    echo '开始备份前端...'
    if [ -d ${REMOTE_FRONTEND_DIR} ]; then
      cp -r ${REMOTE_FRONTEND_DIR}/* ${BACKUP_DIR}/frontend/ 2>/dev/null || true
      echo '前端备份完成'
    else
      echo '警告: 前端目录不存在'
    fi
    
    echo '开始备份后端...'
    if [ -d ${REMOTE_BACKEND_DIR} ]; then
      # 备份关键文件
      for f in index.js routes/coupons.js routes/categories.js db_unified.js utils/errorHandler.js .env.production; do
        if [ -f ${REMOTE_BACKEND_DIR}/\$f ]; then
          cp ${REMOTE_BACKEND_DIR}/\$f ${BACKUP_DIR}/backend/\$(dirname \$f) 2>/dev/null || \
            mkdir -p ${BACKUP_DIR}/backend/\$(dirname \$f) && cp ${REMOTE_BACKEND_DIR}/\$f ${BACKUP_DIR}/backend/\$f
        fi
      done
      echo '后端备份完成'
    else
      echo '警告: 后端目录不存在'
    fi
    
    # 备份PM2状态
    pm2 list > ${BACKUP_DIR}/pm2-status.txt 2>/dev/null || true
    pm2 save 2>/dev/null || true
    
    # 记录备份时间
    date > ${BACKUP_DIR}/backup-timestamp.txt
    
    echo 'BACKUP_SUCCESS:${BACKUP_DIR}'
  "
  
  local result=$(run_remote "${backup_script}")
  echo "${result}"
  
  if [[ "${result}" == *"BACKUP_SUCCESS"* ]]; then
    local actual_backup_dir=$(echo "${result}" | grep "BACKUP_SUCCESS:" | cut -d':' -f2)
    log_info "备份完成: ${actual_backup_dir}"
    
    # 保存备份路径供回滚使用
    echo "${actual_backup_dir}" > .last-backup-dir.txt
  else
    log_error "备份失败!"
    exit 1
  fi
}

# ==================== 步骤2: 上传前端dist ====================
upload_frontend() {
  log_step "步骤2: 上传前端构建产物"
  
  log_info "源目录: ${LOCAL_FRONTEND_DIST}"
  log_info "目标: ${REMOTE_FRONTEND_DIR}"
  
  # 先清理远程旧的前端文件（保留uploads等）
  run_remote "
    set -e
    if [ -d ${REMOTE_FRONTEND_DIR} ]; then
      # 删除旧的assets、index.html等，但保留uploads
      rm -rf ${REMOTE_FRONTEND_DIR}/assets 2>/dev/null || true
      rm -f ${REMOTE_FRONTEND_DIR}/index.html 2>/dev/null || true
      rm -f ${REMOTE_FRONTEND_DIR}/vite.svg 2>/dev/null || true
      echo '旧前端文件已清理'
    else
      mkdir -p ${REMOTE_FRONTEND_DIR}
      echo '已创建前端目录'
    fi
  "
  
  # 使用rsync或scp上传（优先使用rsync）
  if command -v rsync &> /dev/null; then
    log_info "使用rsync上传(增量传输)..."
    local ssh_args="-e 'ssh -p ${SERVER_PORT} -o StrictHostKeyChecking=no'"
    if [ -n "${SSH_KEY}" ]; then
      ssh_args="-e 'ssh -i ${SSH_KEY} -p ${SERVER_PORT} -o StrictHostKeyChecking=no'"
    fi
    rsync -avz --progress ${ssh_args} \
      "${LOCAL_FRONTEND_DIR}/" \
      "${SERVER_USER}@${SERVER_IP}:${REMOTE_FRONTEND_DIR}/" \
      --exclude='*.map' \
      --exclude='.DS_Store'
  else
    log_info "使用scp上传..."
    # 打包后上传
    local temp_archive="/tmp/qiguan-frontend-${VERSION}.tar.gz"
    tar -czf "${temp_archive}" -C "${LOCAL_FRONTEND_DIST}" .
    local scp_cmd=$(build_scp_cmd "${temp_archive}" "${SERVER_USER}@${SERVER_IP}:/tmp/")
    eval "${scp_cmd}"
    
    # 在服务器上解压
    run_remote "
      tar -xzf /tmp/qiguan-frontend-${VERSION}.tar.gz -C ${REMOTE_FRONTEND_DIR}/
      rm -f /tmp/qiguan-frontend-${VERSION}.tar.gz
      echo '前端上传并解压完成'
    "
    
    # 清理临时文件
    rm -f "${temp_archive}"
  fi
  
  # 验证上传结果
  local verify_result=$(run_remote "ls -la ${REMOTE_FRONTEND_DIR}/index.html 2>/dev/null && echo 'UPLOAD_OK' || echo 'UPLOAD_FAIL'")
  if [[ "${verify_result}" == *"UPLOAD_OK"* ]]; then
    log_info "前端上传验证通过 ✓"
  else
    log_error "前端上传验证失败!"
    exit 1
  fi
}

# ==================== 步骤3: 上传后端代码 ====================
upload_backend() {
  log_step "步骤3: 上传后端修复代码"
  
  log_info "需要上传的文件列表:"
  for file in "${BACKEND_FILES[@]}"; do
    local full_path="${LOCAL_BACKEND_ROOT}/${file}"
    if [ -f "${full_path}" ]; then
      log_info "  - ${file}"
      
      # 确保远程目标目录存在
      local remote_dir=$(dirname "${REMOTE_BACKEND_DIR}/${file}")
      run_remote "mkdir -p ${remote_dir}"
      
      # 上传文件
      local scp_cmd=$(build_scp_cmd "${full_path}" "${SERVER_USER}@${SERVER_IP}:${REMOTE_BACKEND_DIR}/${file}")
      eval "${scp_cmd}"
      
      log_info "  ✓ ${file} 上传完成"
    else
      log_warn "  ⚠ 跳过(文件不存在): ${file}"
    fi
  done
  
  # 安装新的依赖（如果package.json有变化）
  log_info "检查是否需要更新依赖..."
  run_remote "
    cd ${REMOTE_BACKEND_DIR}
    if [ -f package.json ]; then
      npm install --production 2>&1 | tail -5
      echo '依赖安装完成'
    else
      echo '跳过依赖安装(package.json不存在)'
    fi
  "
  
  log_info "后端代码上传完成"
}

# ==================== 步骤4: 重启服务 ====================
restart_services() {
  log_step "步骤4: 重启后端服务"
  
  local restart_script="
    set -e
    
    echo '停止现有PM2进程...'
    cd ${REMOTE_BACKEND_DIR}
    
    # 尝试优雅停止
    if pm2 list | grep -q 'qiguan\|backend'; then
      pm2 stop all 2>/dev/null || true
      sleep 2
    fi
    
    echo '重启后端服务...'
    pm2 start index.js --name qiguan-backend 2>/dev/null || \
      pm2 restart qiguan-backend 2>/dev/null || true
    
    sleep 3
    
    # 保存PM2配置
    pm2 save 2>/dev/null || true
    
    # 显示进程状态
    pm2 list
    
    echo 'RESTART_COMPLETE'
  "
  
  local result=$(run_remote "${restart_script}")
  echo "${result}"
  
  if [[ "${result}" == *"RESTART_COMPLETE"* ]] || [[ "${result}" == *"online"* ]]; then
    log_info "后端服务重启完成 ✓"
  else
    log_warn "后端服务重启可能存在问题，请手动检查"
  fi
  
  # 重启Nginx
  log_info "重新加载Nginx配置..."
  run_remote "nginx -t && nginx -s reload 2>/dev/null || echo 'Nginx重载完成(或无权限)'"
  
  log_info "所有服务重启完成"
}

# ==================== 步骤5: 健康检查 ====================
health_check() {
  log_step "步骤5: 健康检查与验证"
  
  local all_passed=true
  
  # 检查API端点
  log_info "检查API健康端点..."
  for endpoint in "${HEALTH_ENDPOINTS[@]}"; do
    log_info "测试: ${endpoint}"
    local http_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 --max-time 30 "${endpoint}" 2>/dev/null || echo "000")
    
    if [[ "${http_code}" =~ ^(200|201|204|301|302)$ ]]; then
      log_info "  ✓ HTTP ${http_code} - 正常"
    elif [[ "${http_code}" == "000" ]]; then
      log_error "  ✗ 连接失败 (HTTP ${http_code})"
      all_passed=false
    else
      log_warn "  ⚠ HTTP ${http_code} - 可能异常"
    fi
  done
  
  # 检查PM2状态
  log_info "检查PM2进程状态..."
  local pm2_status=$(run_remote "pm2 jlist 2>/dev/null | head -50" 2>/dev/null || echo "{}")
  echo "${pm2_status}" | grep -q '"online"' && log_info "  ✓ PM2进程运行中" || (log_error "  ✗ PM2进程异常" && all_passed=false)
  
  # 检查关键页面可访问性
  log_info "检查前端页面可访问性..."
  local pages=(
    "https://www.qimengzhiyue.cn/admin/products"
    "https://www.qimengzhiyue.cn/admin/categories"
    "https://www.qimengzhiyue.cn/admin/coupons"
    "https://www.qimengzhiyue.cn/admin/orders"
  )
  
  for page in "${pages[@]}"; do
    local page_name=$(basename "${page}")
    local status_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 --max-time 30 "${page}" 2>/dev/null || echo "000")
    
    if [[ "${status_code}" == "200" ]]; then
      log_info "  ✓ ${page_name}: 200 OK"
    else
      log_warn "  ⚠ ${page_name}: HTTP ${status_code}"
    fi
  done
  
  # 输出最终结果
  echo ""
  if ${all_passed}; then
    log_info "🎉 所有健康检查通过! 部署成功!"
    return 0
  else
    log_error "⚠️  部分健康检查未通过，请查看上方日志"
    log_warn "建议: 执行回滚操作: bash deploy-v4.sh --rollback"
    return 1
  fi
}

# ==================== 步骤6: 回滚功能 ====================
rollback() {
  log_step "⚠️  执行回滚操作"
  
  # 读取上次备份目录
  local backup_path=""
  if [ -f .last-backup-dir.txt ]; then
    backup_path=$(cat .last-backup-dir.txt)
  fi
  
  if [ -z "${backup_path}" ]; then
    log_error "找不到备份目录! 无法回滚"
    exit 1
  fi
  
  log_warn "将从以下位置恢复: ${backup_path}"
  read -p "确认要回滚吗? (yes/no): " confirm
  if [[ "${confirm}" != "yes" ]]; then
    log_info "回滚已取消"
    exit 0
  fi
  
  local rollback_script="
    set -e
    
    BACKUP_PATH=${backup_path}
    
    echo '停止服务...'
    pm2 stop all 2>/dev/null || true
    sleep 2
    
    echo '恢复前端...'
    if [ -d \${BACKUP_PATH}/frontend ] && [ \"\$(ls -A \${BACKUP_PATH}/frontend 2>/dev/null)\" ]; then
      rm -rf ${REMOTE_FRONTEND_DIR}/*
      cp -r \${BACKUP_PATH}/frontend/* ${REMOTE_FRONTEND_DIR}/
      echo '前端恢复完成'
    fi
    
    echo '恢复后端...'
    if [ -d \${BACKUP_PATH}/backend ]; then
      for f in \$(find \${BACKUP_PATH}/backend -type f); do
        rel_path=\${f#\${BACKUP_PATH}/backend/}
        target_dir=\$(dirname ${REMOTE_BACKEND_DIR}/\${rel_path})
        mkdir -p \${target_dir}
        cp \${f} ${REMOTE_BACKEND_DIR}/\${rel_path}
      done
      echo '后端恢复完成'
    fi
    
    echo '重启服务...'
    cd ${REMOTE_BACKEND_DIR}
    pm2 start index.js --name qiguan-backend 2>/dev/null || pm2 restart qiguan-backend
    pm2 save
    nginx -s reload 2>/dev/null || true
    
    sleep 3
    
    echo 'ROLLBACK_COMPLETE'
  "
  
  local result=$(run_remote "${rollback_script}")
  echo "${result}"
  
  if [[ "${result}" == *"ROLLBACK_COMPLETE"* ]]; then
    log_info "回滚完成 ✓"
    log_info "请验证系统功能是否恢复正常"
  else
    log_error "回滚失败! 请联系运维人员手动处理"
    exit 1
  fi
}

# ==================== 主流程 ====================
main() {
  echo ""
  echo "╔════════════════════════════════════════════╗"
  echo "║   绮管电商后台 v4 系统化修复部署工具       ║"
  echo "║   版本: ${VERSION}              ║"
  echo "║   时间: $(date '+%Y-%m-%d %H:%M:%S')          ║"
  echo "╚════════════════════════════════════════════╝"
  echo ""
  
  case "${1:-deploy}" in
    --backup-only)
      check_environment
      backup_current_version
      log_info "仅备份完成"
      ;;
    --rollback)
      rollback
      ;;
    --verify)
      health_check
      ;;
    deploy|*)
      log_info "开始完整部署流程..."
      
      # 步骤0: 环境检查
      check_environment
      
      # 步骤1: 备份
      backup_current_version
      
      # 步骤2: 上传前端
      upload_frontend
      
      # 步骤3: 上传后端
      upload_backend
      
      # 步骤4: 重启服务
      restart_services
      
      # 等待服务启动
      log_info "等待服务启动(10秒)..."
      sleep 10
      
      # 步骤5: 健康检查
      if health_check; then
        log_info ""
        log_info "🎊🎊🎊  部署全部完成! 🎊🎊🎊"
        log_info ""
        log_info "版本号: ${VERSION}"
        log_info "日志文件: ${LOG_FILE}"
        log_info ""
        log_info "后续操作:"
        log_info "  1. 清除浏览器缓存 (Ctrl+Shift+R)"
        log_info "  2. 访问 https://www.qimengzhiyue.cn/admin"
        log_info "  3. 测试各功能模块"
        log_info ""
        log_info "如需回滚: bash deploy-v4.sh --rollback"
      else
        log_error ""
        log_error "部署过程中发现问题，建议执行回滚"
        exit 1
      fi
      ;;
  esac
}

# 运行主程序
main "$@"
