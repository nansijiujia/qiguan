#!/bin/bash
# ============================================================
# 紧急回滚脚本
# Version: 4.0.0
# Date: 2026-04-09
# Description: 生产环境紧急回滚，恢复到指定备份版本
# Usage: ./rollback.sh [backup_file.tar.gz]
# ============================================================

set -e

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

# 配置项
PROJECT_DIR="/www/wwwroot/qiguan-backend"
BACKUP_DIR="${PROJECT_DIR}/backups"
ROLLBACK_LOG="${PROJECT_DIR}/backups/rollback_history.log"

echo "=========================================="
echo "  绮管电商后台 - 紧急回滚工具 v4.0.0"
echo "  回滚时间: $(date)"
echo "=========================================="

# 参数处理：获取备份文件路径
if [ -z "$1" ]; then
    log_step "选择要回滚的备份文件..."
    
    # 列出可用的备份文件（按时间倒序）
    if [ -d "${BACKUP_DIR}" ] && ls "${BACKUP_DIR}"/*.tar.gz &> /dev/null; then
        echo ""
        echo "可用的备份文件 (按时间排序, 最新在前):"
        echo "----------------------------------------"
        ls -lht "${BACKUP_DIR}"/*.tar.gz 2>/dev/null | awk '{print NR".", $9, "("size")"}' | head -10
        echo "----------------------------------------"
        echo ""
        
        read -p "请输入要回滚的备份文件路径 (或输入序号): " USER_INPUT
        
        if [[ "$USER_INPUT" =~ ^[0-9]+$ ]]; then
            BACKUP_FILE=$(ls -t "${BACKUP_DIR}"/*.tar.gz 2>/dev/null | sed -n "${USER_INPUT}p")
            if [ -z "$BACKUP_FILE" ]; then
                log_error "❌ 序号 ${USER_INPUT} 无效, 超出范围"
                exit 1
            fi
        else
            BACKUP_FILE="$USER_INPUT"
        fi
    else
        log_error "❌ 备份目录不存在或无可用备份文件: ${BACKUP_DIR}"
        exit 1
    fi
else
    BACKUP_FILE="$1"
fi

# 验证备份文件是否存在
if [ ! -f "$BACKUP_FILE" ]; then
    log_error "❌ 备份文件不存在: $BACKUP_FILE"
    exit 1
fi

# 显示备份信息
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | awk '{print $1}')
BACKUP_DATE=$(stat -c '%y' "$BACKUP_FILE" | cut -d'.' -f1)

log_info "选择的备份文件: $BACKUP_FILE"
log_info "备份大小: ${BACKUP_SIZE}"
log_info "备份时间: ${BACKUP_DATE}"

# 安全确认
echo ""
echo "⚠️  警告: 即将执行紧急回滚操作!"
echo "=========================================="
echo "此操作将:"
echo "  1. 停止所有PM2服务进程"
echo "  2. 清理当前生产环境的代码文件"
echo "  3. 从备份恢复到之前的状态"
echo "  4. 重启PM2服务"
echo ""
echo "⚠️  注意: 此操作不可逆! 请确保已通知相关团队!"
echo "=========================================="
read -p "确认回滚? (输入 'yes' 确认): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    log_warn "已取消回滚操作"
    exit 0
fi

# 二次确认（防止误操作）
read -p "再次确认? (输入 'CONFIRM-ROLLBACK' 确认): " CONFIRM2

if [ "$CONFIRM2" != "CONFIRM-ROLLBACK" ]; then
    log_warn "二次确认未通过, 已取消回滚操作"
    exit 0
fi

# 记录回滚开始时间
ROLLBACK_START=$(date '+%Y-%m-%d %H:%M:%S')
echo "[${ROLLBACK_START}] 开始回滚操作, 目标备份: ${BACKUP_FILE}" >> "$ROLLBACK_LOG"

# Step 1: 停止服务
log_step "Step 1/5: 停止PM2服务..."

if pm2 list &> /dev/null; then
    pm2 stop all
    sleep 3
    log_info "✅ PM2服务已停止"
else
    log_warn "⚠️ PM2 未运行或未安装"
fi

# Step 2: 创建当前版本的快照备份（用于极端情况下的双重保险）
log_step "Step 2/5: 创建当前状态快照..."

SNAPSHOT_NAME="pre-rollback-snapshot-$(date +%Y%m%d-%H%M%S).tar.gz"
tar -czf "${BACKUP_DIR}/${SNAPSHOT_NAME}" \
  --exclude='node_modules' \
  --exclude='data/*.db' \
  --exclude='.env' \
  --exclude='logs' \
  --exclude='backups' \
  -C "$(dirname "$PROJECT_DIR")" "$(basename "$PROJECT_DIR")" 2>/dev/null || true

log_info "✅ 当前状态已快照保存为: ${BACKUP_DIR}/${SNAPSHOT_NAME}"

# Step 3: 清理当前文件（保留关键目录和配置）
log_step "Step 3/5: 清理当前代码文件..."

cd "${PROJECT_DIR}"

# 需要清理的文件和目录列表
CLEAN_LIST=(
    "qiguanqianduan/dist"
    "routes/*.js"
    "middleware/*.js"
    "index.js"
    "db_mysql.js"
    "db.js"
    "package.json"
    "package-lock.json"
    "ecosystem.config.js"
)

for item in "${CLEAN_LIST[@]}"; do
    if [ -e "$item" ]; then
        rm -rf "$item"
        log_info "  已删除: ${item}"
    fi
done

log_info "✅ 当前代码文件已清理完成"

# Step 4: 恢复备份
log_step "Step 4/5: 恢复备份文件..."

tar -xzf "$BACKUP_FILE" -C "$(dirname "$PROJECT_DIR")"

RESTORE_SIZE=$(du -sh "${PROJECT_DIR}" | awk '{print $1}')
log_info "✅ 备份恢复完成 (项目大小: ${RESTORE_SIZE})"

# Step 5: 重启服务并验证
log_step "Step 5/5: 重启PM2服务并验证..."

pm2 restart all
sleep 8

# 检查PM2进程状态
log_info "检查PM2进程状态..."
pm2 status

# 执行快速健康检查
log_info "执行健康检查..."
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" https://qimengzhiyue.cn/health || echo "000")

if [ "$HEALTH_CHECK" = "200" ]; then
    log_info "✅ 健康检查通过 (HTTP ${HEALTH_CHECK})"
else
    log_warn "⚠️ 健康检查返回 HTTP ${HEALTH_CHECK}, 服务可能需要更多启动时间"
    log_warn "建议等待30秒后手动验证: curl https://qimengzhiyue.cn/health"
fi

# 记录回滚完成
ROLLBACK_END=$(date '+%Y-%m-%d %H:%M:%S')
echo "[${ROLLBACK_END}] 回滚操作完成, 使用备份: ${BACKUP_FILE}, 健康检查: HTTP ${HEALTH_CHECK}" >> "$ROLLBACK_LOG"

# 输出最终结果
echo ""
echo "=========================================="
echo "  ✅ 回滚操作已完成!"
echo "=========================================="
echo "  使用的备份: ${BACKUP_FILE}"
echo "  快照保存: ${BACKUP_DIR}/${SNAPSHOT_NAME}"
echo "  回滚开始: ${ROLLBACK_START}"
echo "  回滚结束: ${ROLLBACK_END}"
echo "  健康状态: HTTP ${HEALTH_CHECK}"
echo ""
echo "  后续步骤:"
echo "  1. 验证系统功能是否正常 (登录、商品浏览、下单等)"
echo "  2. 检查日志是否有异常: pm2 logs --lines 50"
echo "  3. 通知相关人员回滚已完成"
echo "  4. 分析部署失败原因 (查看 deploy.sh 的错误输出)"
echo "=========================================="
echo ""
echo "  如需重新部署, 请运行:"
echo "  bash deploy.sh"
echo ""

exit 0