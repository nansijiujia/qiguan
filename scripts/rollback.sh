#!/bin/bash

# ============================================================
# 绮管电商后台 - 版本回滚脚本
# ============================================================
# 功能:
#   - 列出最近5个版本的备份
#   - 支持回滚到指定版本
#   - 回滚前确认提示
#   - 自动重启服务
#   - 回滚日志记录
#   - 30秒内完成回滚 (目标)
#
# 用法:
#   bash scripts/rollback.sh [选项] [版本号]
#
# 选项:
#   -h, --help          显示帮助信息
#   -l, --list          列出所有可用备份版本
#   --latest            回滚到最近的备份版本
#   --version VERSION   回滚到指定版本 (格式: YYYYMMDD_HHMMSS)
#   -y, --yes           跳过确认提示 (自动确认)
#   -f, --force         强制回滚 (即使服务正在运行)
#
# 示例:
#   bash scripts/rollback.sh --list                    # 查看备份列表
#   bash scripts/rollback.sh --latest                  # 回滚到最新版本
#   bash scripts/rollback.sh --version 20260408_143023 # 回滚到指定版本
#   bash scripts/rollback.sh --latest -y               # 自动确认回滚
#
# 返回值:
#   0 - 回滚成功
#   1 - 回滚失败
#
# 作者: 绮管技术团队
# 日期: 2026-04-08
# 版本: v1.0
# ============================================================

set -e

# ==================== 配置区 ====================
WORK_DIR="/var/www/qiguan"
BACKUP_DIR="/var/www/qiguan/backups"
LOG_FILE="/var/log/qiguan/rollback.log"
NODE_PATH="/usr/local/node"
export PATH="$NODE_PATH/bin:$PATH"

# PM2进程名
PM2_BACKEND="qiguan-backend"
PM2_FRONTEND="qiguan-frontend"

# 时间戳格式
DATE_FORMAT='+%Y-%m-%d %H:%M:%S'
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')

# 备份显示数量
SHOW_BACKUPS=5

# 超时设置 (秒)
TIMEOUT_ROLLBACK=30
# ================================================

# ==================== 颜色定义 ====================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color
# ================================================

# ==================== 全局变量 ====================
ACTION=""
TARGET_VERSION=""
SKIP_CONFIRM=false
FORCE_MODE=false
ROLLBACK_START_TIME=0
# ================================================

# ==================== 工具函数 ====================

# 显示帮助信息
show_help() {
    cat << EOF
${BOLD}绮管电商后台 - 版本回滚工具${NC}

${CYAN}用法:${NC}
    $0 [选项] [版本号]

${CYAN}选项:${NC}
    -h, --help          显示此帮助信息
    -l, --list          列出所有可用的备份版本
    --latest            回滚到最近的备份版本
    --version VERSION   回滚到指定版本 (格式: YYYYMMDD_HHMMSS)
    -y, --yes           跳过确认提示，自动执行回滚
    -f, --force         强制回滚，即使当前服务正在运行

${CYAN}示例:${NC}
    $0 --list                              # 查看所有备份
    $0 --latest                            # 快速回滚到最新版本
    $0 --version 20260408_143023           # 回滚到指定版本
    $0 --latest -y                         # 自动确认并回滚

${CYAN}说明:${NC}
    • 回滚操作会在30秒内完成
    • 回滚前会自动停止当前服务
    • 回滚后会自动重启PM2服务
    • 所有操作都会记录到日志文件

${CYAN}风险提示:${NC}
    • 回滚是不可逆操作（除非有更早的备份）
    • 建议在低峰期进行回滚操作
    • 回滚前请确保已通知相关用户

${CYAN}作者:${NC} 绮管技术团队
${CYAN}日期:${NC} 2026-04-08
EOF
    exit 0
}

# 日志函数
log() {
    local level=$1
    shift
    local message=$*
    local timestamp=$(date "$DATE_FORMAT")
    
    case $level in
        "INFO")    echo -e "${GREEN}[✓]${NC} ${message}" ;;
        "WARN")    echo -e "${YELLOW}[!]${NC} ${message}" ;;
        "ERROR")   echo -e "${RED}[✗]${NC} ${message}" ;;
        "SUCCESS") echo -e "${GREEN}[OK]${NC} ${message}" ;;
        "HEADER")  echo -e "\n${BOLD}${CYAN}━━━ ${message} ━━━${NC}" ;;
        "IMPORTANT") echo -e "${BOLD}${RED}[!]${NC} ${message}" ;;
        *)         echo "$message" ;;
    esac
    
    # 写入日志文件
    mkdir -p "$(dirname "$LOG_FILE")"
    echo "[${timestamp}] [${level}] $message" >> "$LOG_FILE"
}

# 确认提示函数
confirm_action() {
    local prompt="$1"
    
    if [ "$SKIP_CONFIRM" = true ]; then
        return 0
    fi
    
    echo ""
    echo -e "${YELLOW}${BOLD}${prompt}${NC}"
    read -p "请输入 'yes' 确认继续，或按任意键取消: " confirm
    
    if [ "$confirm" = "yes" ] || [ "$confirm" = "YES" ] || [ "$confirm" = "y" ]; then
        return 0
    else
        log "INFO" "用户取消操作"
        return 1
    fi
}

# 计算耗时
calculate_duration() {
    local start_time=$1
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    echo $duration
}

# 格式化时间显示
format_duration() {
    local seconds=$1
    if [ $seconds -lt 60 ]; then
        echo "${seconds}秒"
    elif [ $seconds -lt 3600 ]; then
        local minutes=$((seconds / 60))
        local secs=$((seconds % 60))
        echo "${minutes}分${secs}秒"
    else
        local hours=$((seconds / 3600))
        local minutes=$(((seconds % 3600) / 60))
        echo "${hours}小时${minutes}分"
    fi
}
# ================================================

# ==================== 核心功能函数 ====================

# 列出所有可用备份
list_backups() {
    log "HEADER" "可用的备份版本列表"
    
    if [ ! -d "$BACKUP_DIR" ]; then
        log "ERROR" "备份目录不存在: ${BACKUP_DIR}"
        return 1
    fi
    
    # 查找所有备份目录
    local backups=($(ls -1dt "$BACKUP_DIR"/[0-9]* 2>/dev/null | head -$SHOW_BACKUPS))
    
    if [ ${#backups[@]} -eq 0 ]; then
        log "WARN" "没有找到任何备份"
        log "INFO" "备份目录: ${BACKUP_DIR}"
        log "INFO" "可能原因:"
        log "INFO" "  • 尚未进行过部署"
        log "INFO" "  • 备份目录被清理或删除"
        return 1
    fi
    
    echo ""
    printf "${BOLD}%-25s %-20s %-15s %-10s${NC}\n" "版本号" "备份时间" "大小" "状态"
    printf "%s\n" "───────────────────────────────────────────────────────────────"
    
    local index=1
    for backup in "${backups[@]}"; do
        local version_name=$(basename "$backup")
        local backup_info_file="$backup/backup_info.txt"
        
        # 从backup_info.txt获取信息
        local backup_time="未知"
        local git_commit="未知"
        
        if [ -f "$backup_info_file" ]; then
            backup_time=$(grep "^备份时间:" "$backup_info_file" | cut -d' ' -f2-)
            git_commit=$(grep "^Git提交:" "$backup_info_file" | cut -d' ' -f2-)
        fi
        
        # 计算备份大小
        local size=$(du -sh "$backup" 2>/dev/null | awk '{print $1}')
        
        # 标记最新备份
        local marker=""
        if [ $index -eq 1 ]; then
            marker="${GREEN}(最新)${NC}"
        fi
        
        printf "%-25s %-20s %-15s %-10s\n" \
            "${version_name}" \
            "${backup_time}" \
            "${size}" \
            "${marker}"
        
        index=$((index + 1))
    done
    
    echo ""
    log "INFO" "共找到 ${#backups[@]} 个备份 (显示最近 ${SHOW_BACKUPS} 个)"
    echo ""
    
    # 显示使用示例
    echo -e "${CYAN}回滚命令示例:${NC}"
    echo "  回滚到最新版本:  $0 --latest"
    echo "  回滚到指定版本:  $0 --version $(basename ${backups[0]})"
    echo ""
    
    return 0
}

# 验证备份是否存在且有效
validate_backup() {
    local version="$1"
    local backup_path="$BACKUP_DIR/$version"
    
    # 检查备份目录是否存在
    if [ ! -d "$backup_path" ]; then
        log "ERROR" "备份不存在: ${version}"
        log "INFO" "可用备份列表:"
        list_backups
        return 1
    fi
    
    # 检查关键文件是否存在
    local required_files=("package.json" "index.js")
    for file in "${required_files[@]}"; do
        if [ ! -f "$backup_path/$file" ]; then
            log "WARN" "备份中缺少关键文件: ${file}"
        fi
    done
    
    # 检查备份完整性
    if [ ! -f "$backup_path/backup_info.txt" ]; then
        log "WARN" "缺少备份信息文件 (backup_info.txt)"
    fi
    
    log "SUCCESS" "备份验证通过: ${version}"
    return 0
}

# 执行回滚操作
perform_rollback() {
    local target_version="$1"
    local backup_path="$BACKUP_DIR/$target_version"
    
    ROLLBACK_START_TIME=$(date +%s)
    
    log "HEADER" "开始回滚操作"
    log "IMPORTANT" "⚠️  此操作将替换当前运行的代码版本！"
    echo ""
    
    # 显示将要执行的回滚信息
    echo -e "${BOLD}${PURPLE}回滚详情:${NC}"
    echo "  目标版本:     ${target_version}"
    echo "  备份路径:     ${backup_path}"
    echo "  工作目录:     ${WORK_DIR}"
    echo "  当前时间:     $(date "$DATE_FORMAT")"
    echo ""
    
    # 如果存在backup_info.txt，显示更多信息
    if [ -f "$backup_path/backup_info.txt" ]; then
        echo -e "${CYAN}备份信息:${NC}"
        cat "$backup_path/backup_info.txt" | while read line; do
            echo "  $line"
        done
        echo ""
    fi
    
    # 确认操作
    if ! confirm_action "确定要回滚到此版本吗？这将停止当前服务并恢复旧版本代码。"; then
        log "INFO" "回滚已取消"
        return 1
    fi
    
    # 步骤1: 停止当前服务
    log "HEADER" "步骤 1/5: 停止当前PM2服务"
    log "INFO" "正在停止 PM2 服务..."
    
    if pm2 stop all &> /dev/null; then
        log "SUCCESS" "PM2 服务已停止"
    else
        if [ "$FORCE_MODE" = true ]; then
            log "WARN" "强制模式: 忽略停止失败"
        else
            log "ERROR" "无法停止PM2服务"
            log "INFO" "尝试使用 -f 参数强制回滚"
            return 1
        fi
    fi
    
    # 步骤2: 创建当前版本备份 (安全措施)
    log "HEADER" "步骤 2/5: 创建紧急备份 (安全措施)"
    local emergency_backup="$BACKUP_DIR/emergency_before_rollback_${TIMESTAMP}"
    mkdir -p "$emergency_backup"
    
    cp -r "$WORK_DIR/package.json" "$emergency_backup/" 2>/dev/null || true
    cp -r "$WORK_DIR/index.js" "$emergency_backup/" 2>/dev/null || true
    cp -r "$WORK_DIR/.env" "$emergency_backup/" 2>/dev/null || true
    cp -r "$WORK_DIR/ecosystem.config.js" "$emergency_backup/" 2>/dev/null || true
    
    log "SUCCESS" "紧急备份已创建: emergency_before_rollback_${TIMESTAMP}"
    
    # 步骤3: 恢复备份文件
    log "HEADER" "步骤 3/5: 恢复备份文件"
    log "INFO" "正在从备份恢复文件..."
    
    # 清空工作目录中的关键文件和目录
    local items_to_restore=(
        "package.json"
        "package-lock.json"
        ".env"
        "ecosystem.config.js"
        "functions/"
        "routes/"
        "middleware/"
        "db.js"
        "index.js"
        "qiguanqianduan/dist"
    )
    
    for item in "${items_to_restore[@]}"; do
        if [ -e "$backup_path/$item" ]; then
            # 先删除现有文件/目录
            rm -rf "$WORK_DIR/$item" 2>/dev/null || true
            # 从备份复制
            cp -rf "$backup_path/$item" "$WORK_DIR/" 2>/dev/null && \
                log "INFO" "已恢复: ${item}" || \
                log "WARN" "恢复失败: ${item} (可能不存在于备份中)"
        fi
    done
    
    log "SUCCESS" "文件恢复完成"
    
    # 步骤4: 重启服务
    log "HEADER" "步骤 4/5: 重启PM2服务"
    log "INFO" "正在启动PM2服务..."
    
    cd "$WORK_DIR"
    
    if timeout "$TIMEOUT_ROLLBACK" pm2 restart all 2>&1; then
        log "SUCCESS" "PM2 restart 成功"
    elif timeout "$TIMEOUT_ROLLBACK" pm2 start ecosystem.config.js --env production 2>&1; then
        log "SUCCESS" "PM2 start 成功"
    else
        log "ERROR" "PM2 服务启动失败！"
        log "INFO" "尝试从紧急备份恢复..."
        
        # 尝试从紧急备份恢复
        for item in "${items_to_restore[@]}"; do
            if [ -e "$emergency_backup/$item" ]; then
                rm -rf "$WORK_DIR/$item" 2>/dev/null || true
                cp -rf "$emergency_backup/$item" "$WORK_DIR/" 2>/dev/null || true
            fi
        done
        
        pm2 start ecosystem.config.js --env production 2>&1 || true
        
        log "ERROR" "回滚失败！已尝试恢复到回滚前的状态"
        log "ERROR" "需要手动检查和修复！"
        return 1
    fi
    
    # 等待服务启动
    sleep 3
    
    # 步骤5: 验证服务状态
    log "HEADER" "步骤 5/5: 验证服务状态"
    
    local services_ok=true
    
    # 检查后端服务
    if pm2 list | grep -q "$PM2_BACKEND.*online"; then
        log "SUCCESS" "后端服务 (${PM2_BACKEND}) 运行正常 ✓"
    else
        log "WARN" "后端服务 (${PM2_BACKEND}) 状态异常"
        services_ok=false
    fi
    
    # 检查前端服务
    if pm2 list | grep -q "$PM2_FRONTEND.*online"; then
        log "SUCCESS" "前端服务 (${PM2_FRONTEND}) 运行正常 ✓"
    else
        log "WARN" "前端服务 (${PM2_FRONTEND}) 状态异常"
        services_ok=false
    fi
    
    # 计算总耗时
    local duration=$(calculate_duration $ROLLBACK_START_TIME)
    local duration_str=$(format_duration $duration)
    
    # 最终结果
    echo ""
    log "HEADER" "回滚完成"
    echo -e "${BOLD}${PURPLE}═════════════════════════════════════════${NC}"
    echo -e "${BOLD}             回滚结果报告${NC}"
    echo -e "${BOLD}${PURPLE}═════════════════════════════════════════${NC}"
    echo ""
    echo -e "  目标版本:  ${target_version}"
    echo -e "  执行耗时:  ${duration_str} (目标: <30秒)"
    echo -e "  服务状态:  $(if [ "$services_ok" = true ]; then echo -e '${GREEN}正常${NC}'; else echo -e '${YELLOW}部分异常${NC}'; fi)"
    echo -e "  日志文件:  ${LOG_FILE}"
    echo ""
    
    # 记录回滚日志
    cat >> "$LOG_FILE" << EOF
========================================
回滚操作完成
----------------------------------------
目标版本: ${target_version}
备份路径: ${backup_path}
执行耗时: ${duration_str}
服务状态: ${services_ok:-unknown}
操作时间: $(date "$DATE_FORMAT")
操作人: $(whoami)
========================================

EOF
    
    if [ "$services_ok" = true ]; then
        if [ $duration -le 30 ]; then
            log "SUCCESS" "🎉 回滚成功！耗时: ${duration_str} (符合<30秒目标)"
        else
            log "SUCCESS" "✅ 回滚成功！耗时: ${duration_str} (超出30秒目标)"
        fi
        
        # 发送通知 (可扩展)
        log "INFO" "建议通知相关人员回滚已完成"
        
        return 0
    else
        log "ERROR" "⚠️  回滚完成但服务状态异常！"
        log "ERROR" "请手动检查服务状态: pm2 status"
        log "ERROR" "如需进一步帮助，请查看日志: ${LOG_FILE}"
        return 1
    fi
}

# 快速回滚到最新版本
rollback_to_latest() {
    log "INFO" "查找最新的备份版本..."
    
    local latest_backup=$(ls -1dt "$BACKUP_DIR"/[0-9]* 2>/dev/null | head -1)
    
    if [ -z "$latest_backup" ]; then
        log "ERROR" "未找到任何备份"
        return 1
    fi
    
    local latest_version=$(basename "$latest_backup")
    log "INFO" "最新版本: ${latest_version}"
    
    perform_rollback "$latest_version"
}
# ================================================

# ==================== 主流程 ====================

# 解析命令行参数
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                ;;
            -l|--list)
                ACTION="list"
                shift
                ;;
            --latest)
                ACTION="latest"
                shift
                ;;
            --version)
                ACTION="version"
                if [ -z "$2" ] || [[ "$2" =~ ^- ]]; then
                    echo -e "${RED}错误: --version 需要指定版本号${NC}"
                    echo "用法: $0 --version YYYYMMDD_HHMMSS"
                    exit 1
                fi
                TARGET_VERSION="$2"
                shift 2
                ;;
            -y|--yes)
                SKIP_CONFIRM=true
                shift
                ;;
            -f|--force)
                FORCE_MODE=true
                shift
                ;;
            *)
                # 如果是位置参数 (版本号)
                if [[ "$1" =~ ^[0-9]{8}_[0-9]{6}$ ]]; then
                    ACTION="version"
                    TARGET_VERSION="$1"
                    shift
                else
                    echo -e "${RED}未知参数: $1${NC}"
                    show_help
                fi
                ;;
        esac
    done
    
    # 如果没有指定action，默认显示帮助
    if [ -z "$ACTION" ]; then
        show_help
    fi
}

# 主函数
main() {
    # 解析参数
    parse_args "$@"
    
    # 显示标题
    echo ""
    echo -e "${BOLD}${PURPLE}╔════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${PURPLE}║     绮管电商后台 - 版本回滚工具       ║${NC}"
    echo -e "${BOLD}${PURPLE}╚════════════════════════════════════════╝${NC}"
    echo -e "${CYAN}执行时间: $(date '+%Y-%m-%d %H:%M:%S')${NC}"
    echo -e "${CYAN}工作目录: ${WORK_DIR}${NC}"
    echo -e "${CYAN}备份目录: ${BACKUP_DIR}${NC}"
    echo ""
    
    # 根据action执行不同操作
    case $ACTION in
        "list")
            list_backups
            exit $?
            ;;
        "latest")
            rollback_to_latest
            exit $?
            ;;
        "version")
            # 验证备份
            if validate_backup "$TARGET_VERSION"; then
                perform_rollback "$TARGET_VERSION"
                exit $?
            else
                exit 1
            fi
            ;;
        *)
            show_help
            ;;
    esac
}

# 执行主函数
main "$@"
