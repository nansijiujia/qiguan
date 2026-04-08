#!/bin/bash

# ============================================================
# 绮管电商后台 - 部署前环境检查脚本
# ============================================================
# 功能:
#   - 检查Node.js版本 (要求 >=18.x)
#   - 检查npm是否可用
#   - 检查PM2是否安装
#   - 检查端口3000和8080是否被占用
#   - 检查磁盘空间 (至少需要500MB)
#   - 检查内存可用空间 (至少需要256MB)
#   - 检查.env文件是否存在且包含必需变量
#   - 输出彩色状态报告
#
# 用法:
#   bash scripts/pre_deploy_check.sh [选项]
#
# 选项:
#   -h, --help          显示帮助信息
#   -v, --verbose       显示详细信息 (默认)
#   -q, --quiet         静默模式，仅显示错误
#   --fix               尝试自动修复问题 (实验性功能)
#
# 返回值:
#   0 - 所有检查通过
#   1 - 存在错误或警告
#
# 作者: 绮管技术团队
# 日期: 2026-04-08
# 版本: v1.0
# ============================================================

set -e

# ==================== 配置区 ====================
WORK_DIR="/var/www/qiguan"
NODE_PATH="/usr/local/node"
export PATH="$NODE_PATH/bin:$PATH"

# 要求的最低版本
MIN_NODE_VERSION=18
MIN_NPM_VERSION=6
MIN_DISK_SPACE_MB=500
MIN_MEM_MB=256

# 需要检查的端口
CHECK_PORTS=(3000 8080)

# 必需的环境变量
REQUIRED_ENV_VARS=("PORT" "NODE_ENV" "JWT_SECRET")

# 日志文件
LOG_FILE="/var/log/qiguan/pre_deploy_check.log"
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
VERBOSE=true
AUTO_FIX=false
TOTAL_CHECKS=0
PASSED_CHECKS=0
WARNING_CHECKS=0
FAILED_CHECKS=0
ERRORS=()
WARNINGS=()
# ================================================

# ==================== 工具函数 ====================

# 显示帮助信息
show_help() {
    cat << EOF
${BOLD}绮管电商后台 - 部署前环境检查工具${NC}

${CYAN}用法:${NC}
    $0 [选项]

${CYAN}选项:${NC}
    -h, --help      显示此帮助信息
    -v, --verbose   显示详细输出 (默认模式)
    -q, --quiet     静默模式，仅显示错误和警告
    --fix           尝试自动修复问题 (实验性功能)

${CYAN}检查项目:${NC}
    ✅ Node.js 版本 (>= ${MIN_NODE_VERSION}.x)
    ✅ npm 可用性 (>= ${MIN_NPM_VERSION}.x)
    ✅ PM2 安装状态
    ✅ 端口占用检查 (${CHECK_PORTS[*]})
    ✅ 磁盘空间 (>= ${MIN_DISK_SPACE_MB}MB)
    ✅ 内存空间 (>= ${MIN_MEM_MB}MB)
    ✅ .env 文件及必需变量

${CYAN}示例:${NC}
    $0                    # 执行完整检查
    $0 -q                 # 静默模式
    $0 --fix              # 尝试自动修复

${CYAN}返回码:${NC}
    0 - 所有检查通过
    1 - 存在错误或警告

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
    
    if [ "$VERBOSE" = true ] || [ "$level" = "ERROR" ] || [ "$level" = "WARNING" ]; then
        case $level in
            "INFO")    echo -e "${GREEN}[✓]${NC} ${message}" ;;
            "WARN")    echo -e "${YELLOW}[!]${NC} ${message}" ;;
            "ERROR")   echo -e "${RED}[✗]${NC} ${message}" ;;
            "SUCCESS") echo -e "${GREEN}[OK]${NC} ${message}" ;;
            "HEADER")  echo -e "\n${BOLD}${CYAN}━━━ ${message} ━━━${NC}" ;;
        esac
    fi
    
    # 写入日志文件
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $message" >> "$LOG_FILE"
}

# 记录检查结果
record_result() {
    local status="$1"
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    case $status in
        "PASS")
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
            ;;
        "WARN")
            WARNING_CHECKS=$((WARNING_CHECKS + 1))
            ;;
        "FAIL")
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
            ;;
    esac
}

# 版本比较函数
version_gte() {
    # 返回 0 如果 $1 >= $2
    local v1=$1
    local v2=$2
    
    # 移除 'v' 前缀
    v1=$(echo "$v1" | sed 's/^v//')
    v2=$(echo "$v2" | sed 's/^v//')
    
    # 使用 sort -V 进行版本比较
    [ "$(printf '%s\n' "$v2" "$v1" | sort -V | head -n1)" = "$v2" ]
}
# ================================================

# ==================== 检查函数 ====================

# 1. 检查Node.js版本
check_nodejs() {
    log "HEADER" "Node.js 环境检查"
    
    if command -v node &> /dev/null; then
        local node_version=$(node --version)
        local major_version=$(echo "$node_version" | cut -d'.' -f1 | tr -d 'v')
        
        if version_gte "$node_version" "${MIN_NODE_VERSION}.0.0"; then
            log "INFO" "Node.js 版本: ${node_version} ✓ (要求 >= ${MIN_NODE_VERSION}.x)"
            record_result "PASS"
            
            # 显示详细信息
            if [ "$VERBOSE" = true ]; then
                log "INFO" "Node.js 路径: $(which node)"
                log "INFO" "Node.js 详细版本: $(node -v)"
            fi
            
            return 0
        else
            log "ERROR" "Node.js 版本过低: ${node_version} (要求 >= ${MIN_NODE_VERSION}.x)"
            record_result "FAIL"
            ERRORS+=("Node.js版本过低: ${node_version}")
            return 1
        fi
    else
        log "ERROR" "Node.js 未找到或未安装"
        record_result "FAIL"
        ERRORS+=("Node.js未安装")
        
        if [ "$AUTO_FIX" = true ]; then
            log "WARN" "尝试自动安装Node.js..."
            # TODO: 自动安装逻辑
        fi
        
        return 1
    fi
}

# 2. 检查npm
check_npm() {
    log "HEADER" "npm 包管理器检查"
    
    if command -v npm &> /dev/null; then
        local npm_version=$(npm --version)
        
        if version_gte "$npm_version" "${MIN_NPM_VERSION}.0.0"; then
            log "INFO" "npm 版本: ${npm_version} ✓ (要求 >= ${MIN_NPM_VERSION}.x)"
            record_result "PASS"
            
            if [ "$VERBOSE" = true ]; then
                log "INFO" "npm 路径: $(which npm)"
                log "INFO" "npm 全局包目录: $(npm root -g)"
                log "INFO" "npm 缓存目录: $(npm config get cache)"
            fi
            
            return 0
        else
            log "ERROR" "npm 版本过低: ${npm_version} (要求 >= ${MIN_NPM_VERSION}.x)"
            record_result "FAIL"
            ERRORS+=("npm版本过低: ${npm_version}")
            return 1
        fi
    else
        log "ERROR" "npm 未找到或未安装"
        record_result "FAIL"
        ERRORS+=("npm未安装")
        return 1
    fi
}

# 3. 检查PM2
check_pm2() {
    log "HEADER" "PM2 进程管理器检查"
    
    if command -v pm2 &> /dev/null; then
        local pm2_version=$(pm2 --version 2>/dev/null || echo "unknown")
        log "INFO" "PM2 版本: ${pm2_version} ✓"
        record_result "PASS"
        
        if [ "$VERBOSE" = true ]; then
            log "INFO" "PM2 路径: $(which pm2)"
            log "INFO" "PM2 主目录: $(pm2 root 2>/dev/null || echo 'unknown')"
            
            # 显示PM2进程列表
            if pm2 list &> /dev/null; then
                log "INFO" "当前PM2进程:"
                pm2 list 2>/dev/null | while read line; do
                    log "INFO" "  $line"
                done
            else
                log "WARN" "无法获取PM2进程列表"
            fi
        fi
        
        return 0
    else
        log "ERROR" "PM2 未安装或不在PATH中"
        record_result "FAIL"
        ERRORS+=("PM2未安装")
        
        if [ "$AUTO_FIX" = true ]; then
            log "WARN" "尝试全局安装PM2..."
            npm install -g pm2 && log "INFO" "PM2安装成功" || log "ERROR" "PM2安装失败"
        fi
        
        return 1
    fi
}

# 4. 检查端口占用
check_ports() {
    log "HEADER" "端口占用检查"
    
    local all_clear=true
    
    for port in "${CHECK_PORTS[@]}"; do
        if netstat -tlnp 2>/dev/null | grep -q ":${port} " || \
           ss -tlnp 2>/dev/null | grep -q ":${port} "; then
            local process_info=$(netstat -tlnp 2>/dev/null | grep ":${port} " | awk '{print $7}' || \
                                ss -tlnp 2>/dev/null | grep ":${port}" | awk '{print $6}')
            
            log "WARN" "端口 ${port} 已被占用 (进程: ${process_info:-unknown})"
            WARNINGS+=("端口${port}被占用")
            record_result "WARN"
            all_clear=false
        else
            log "INFO" "端口 ${port}: 空闲 ✓"
        fi
    done
    
    if [ "$all_clear" = true ]; then
        record_result "PASS"
        return 0
    else
        return 1
    fi
}

# 5. 检查磁盘空间
check_disk_space() {
    log "HEADER" "磁盘空间检查"
    
    local available_mb
    local total_mb
    local used_percent
    
    # 获取磁盘信息 (兼容Linux)
    if df -BM "$WORK_DIR" &> /dev/null; then
        available_mb=$(df -BM "$WORK_DIR" | awk 'NR==2 {print $4}' | tr -d 'M')
        total_mb=$(df -BM "$WORK_DIR" | awk 'NR==2 {print $2}' | tr -d 'M')
        used_percent=$(df -BM "$WORK_DIR" | awk 'NR==2 {print $5}' | tr -d '%')
    elif df -h "$WORK_DIR" &> /dev/null; then
        available_mb=$(df -h "$WORK_DIR" | awk 'NR==2 {print $4}')
        total_mb=$(df -h "$WORK_DIR" | awk 'NR==2 {print $2}')
        used_percent=$(df -h "$WORK_DIR" | awk 'NR==2 {print $5}' | tr -d '%')
    else
        log "ERROR" "无法获取磁盘信息"
        record_result "FAIL"
        ERRORS+=("无法获取磁盘信息")
        return 1
    fi
    
    if [ "$available_mb" -ge "$MIN_DISK_SPACE_MB" ] 2>/dev/null; then
        log "INFO" "磁盘空间充足: ${available_mb}MB 可用 / 总计 ${total_mb}MB (使用率: ${used_percent}%) ✓"
        log "INFO" "满足最低要求: >= ${MIN_DISK_SPACE_MB}MB"
        record_result "PASS"
        return 0
    else
        log "ERROR" "磁盘空间不足: ${available_mb:-未知}MB 可用 (要求 >= ${MIN_DISK_SPACE_MB}MB)"
        record_result "FAIL"
        ERRORS+=("磁盘空间不足: ${available_mb:-未知}MB")
        return 1
    fi
}

# 6. 检查内存空间
check_memory() {
    log "HEADER" "内存空间检查"
    
    local total_mem
    local used_mem
    local free_mem
    local available_mem
    
    if free -m &> /dev/null; then
        total_mem=$(free -m | awk '/Mem:/ {print $2}')
        used_mem=$(free -m | awk '/Mem:/ {print $3}')
        free_mem=$(free -m | awk '/Mem:/ {print $4}')
        available_mem=$(free -m | awk '/Mem:/ {print $7}')
    else
        log "WARN" "无法获取内存信息 (free命令不可用)"
        record_result "WARN"
        WARNINGS+=("无法获取内存信息")
        return 1
    fi
    
    log "INFO" "内存状态:"
    log "INFO" "  总计: ${total_mem}MB"
    log "INFO" "  已用: ${used_mem}MB"
    log "INFO" "  空闲: ${free_mem}MB"
    log "INFO" "  可用: ${available_mem}MB"
    
    if [ "$available_mem" -ge "$MIN_MEM_MB" ] 2>/dev/null; then
        log "INFO" "内存充足: ${available_mem}MB 可用 ✓ (要求 >= ${MIN_MEM_MB}MB)"
        record_result "PASS"
        return 0
    else
        log "WARN" "内存较低: ${available_mem}MB 可用 (建议 >= ${MIN_MEM_MB}MB)"
        WARNINGS+=("内存较低: ${available_mem}MB")
        record_result "WARN"
        return 1
    fi
}

# 7. 检查.env文件
check_env_file() {
    log "HEADER" "环境配置文件检查 (.env)"
    
    if [ ! -f "$WORK_DIR/.env" ]; then
        log "ERROR" ".env 文件不存在: ${WORK_DIR}/.env"
        record_result "FAIL"
        ERRORS+=(".env文件不存在")
        
        if [ "$AUTO_FIX" = true ]; then
            log "WARN" "尝试从 .env.example 创建 .env 文件..."
            if [ -f "$WORK_DIR/.env.example" ]; then
                cp "$WORK_DIR/.env.example" "$WORK_DIR/.env"
                log "INFO" ".env 文件已从模板创建，请手动配置必要变量"
            else
                log "ERROR" ".env.example 模板也不存在"
            fi
        fi
        
        return 1
    fi
    
    log "INFO" ".env 文件存在 ✓"
    
    # 检查文件权限
    local file_perms=$(stat -c %a "$WORK_DIR/.env" 2>/dev/null || stat -f %Lp "$WORK_DIR/.env")
    if [ "$file_perms" = "600" ] || [ "$file_perms" = "640" ]; then
        log "INFO" "文件权限正确: ${file_perms} ✓"
    else
        log "WARN" "建议设置文件权限为 600 (当前: ${file_perms})"
        WARNINGS+=(".env权限不安全: ${file_perms}")
    fi
    
    # 检查必需的环境变量
    log "INFO" "检查必需的环境变量..."
    local missing_vars=()
    local all_present=true
    
    for var in "${REQUIRED_ENV_VARS[@]}"; do
        if grep -q "^${var}=" "$WORK_DIR/.env"; then
            local value=$(grep "^${var}=" "$WORK_DIR/.env" | cut -d'=' -f2-)
            # 脱敏显示值 (隐藏敏感信息)
            if [ "$var" = "JWT_SECRET" ] || [ "$var" = "SECRET_KEY" ]; then
                log "INFO" "  ✓ ${var}=****(已配置)"
            else
                log "INFO" "  ✓ ${var}=${value}"
            fi
        else
            log "ERROR" "  ✗ ${var}=未配置"
            missing_vars+=("$var")
            all_present=false
        fi
    done
    
    if [ "$all_present" = true ]; then
        log "INFO" "所有必需变量已配置 ✓"
        record_result "PASS"
        return 0
    else
        log "ERROR" "缺少必需变量: ${missing_vars[*]}"
        record_result "FAIL"
        ERRORS+=("缺少环境变量: ${missing_vars[*]}")
        return 1
    fi
}

# 8. 检查Git仓库状态 (可选)
check_git_status() {
    log "HEADER" "Git 仓库状态检查 (可选)"
    
    if [ -d "$WORK_DIR/.git" ]; then
        local current_branch=$(cd "$WORK_DIR" && git branch --show-current 2>/dev/null || echo "unknown")
        local last_commit=$(cd "$WORK_DIR" && git log -1 --format="%h - %an: %s" 2>/dev/null || echo "unknown")
        local is_clean=$(cd "$WORK_DIR" && git status --porcelain 2>/dev/null | wc -l)
        
        log "INFO" "当前分支: ${current_branch}"
        log "INFO" "最近提交: ${last_commit}"
        
        if [ "$is_clean" -eq 0 ]; then
            log "INFO" "工作区干净 ✓"
        else
            log "WARN" "工作区有 ${is_clean} 个未提交更改"
            WARNINGS+=("Git工作区不干净")
        fi
        
        record_result "PASS"
        return 0
    else
        log "WARN" "不是Git仓库或.git目录不存在"
        record_result "WARN"
        WARNINGS+=("非Git仓库")
        return 1
    fi
}

# 9. 检查网络连接 (可选)
check_network() {
    log "HEADER" "网络连接检查 (可选)"
    
    # 测试DNS解析
    if ping -c 1 -W 2 registry.npmjs.org &> /dev/null || \
       nslookup registry.npmjs.org &> /dev/null; then
        log "INFO" "DNS解析正常 ✓ (registry.npmjs.org)"
    else
        log "WARN" "DNS解析可能有问题"
        WARNINGS+=("DNS解析异常")
    fi
    
    # 测试npm registry连接
    if curl -s --connect-timeout 5 https://registry.npmjs.org/ > /dev/null 2>&1; then
        log "INFO" "npm registry 连接正常 ✓"
        record_result "PASS"
        return 0
    else
        log "WARN" "无法连接到 npm registry"
        WARNINGS+=("网络连接问题")
        record_result "WARN"
        return 1
    fi
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
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -q|--quiet)
                VERBOSE=false
                shift
                ;;
            --fix)
                AUTO_FIX=true
                shift
                ;;
            *)
                echo "未知参数: $1"
                show_help
                ;;
        esac
    done
}

# 显示摘要报告
show_summary() {
    echo ""
    echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
    echo -e "${BOLD}              检查结果摘要${NC}"
    echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${BOLD}总检查项:${NC}    ${TOTAL_CHECKS}"
    echo -e "  ${GREEN}✓ 通过:${NC}       ${PASSED_CHECKS}"
    echo -e "  ${YELLOW}! 警告:${NC}       ${WARNING_CHECKS}"
    echo -e "  ${RED}✗ 失败:${NC}       ${FAILED_CHECKS}"
    echo ""
    
    if [ ${#ERRORS[@]} -gt 0 ]; then
        echo -e "${RED}${BOLD}错误列表:${NC}"
        for error in "${ERRORS[@]}"; do
            echo -e "  ${RED}•${NC} ${error}"
        done
        echo ""
    fi
    
    if [ ${#WARNINGS[@]} -gt 0 ]; then
        echo -e "${YELLOW}${BOLD}警告列表:${NC}"
        for warning in "${WARNINGS[@]}"; do
            echo -e "  ${YELLOW}•${NC} ${warning}"
        done
        echo ""
    fi
    
    # 最终判定
    if [ $FAILED_CHECKS -eq 0 ]; then
        if [ $WARNING_CHECKS -eq 0 ]; then
            echo -e "${GREEN}${BOLD}🎉 所有检查通过！可以安全部署。${NC}"
            echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
            echo ""
            return 0
        else
            echo -e "${YELLOW}${BOLD}⚠️  存在警告项，但可以继续部署。${NC}"
            echo -e "${YELLOW}   建议解决警告后再部署以获得最佳体验。${NC}"
            echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
            echo ""
            return 0
        fi
    else
        echo -e "${RED}${BOLD}❌ 存在错误项，请修复后再尝试部署！${NC}"
        echo -e "${RED}   部署可能会失败或导致服务异常。${NC}"
        echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
        echo ""
        return 1
    fi
}

# 主函数
main() {
    # 解析参数
    parse_args "$@"
    
    # 创建日志目录
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # 显示标题
    echo ""
    echo -e "${BOLD}${PURPLE}╔════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${PURPLE}║   绮管电商后台 - 部署前环境检查工具    ║${NC}"
    echo -e "${BOLD}${PURPLE}╚════════════════════════════════════════╝${NC}"
    echo -e "${CYAN}检查时间: $(date '+%Y-%m-%d %H:%M:%S')${NC}"
    echo -e "${CYAN}工作目录: ${WORK_DIR}${NC}"
    echo -e "${CYAN}Node路径: ${NODE_PATH}${NC}"
    echo ""
    
    # 执行所有检查
    check_nodejs || true
    check_npm || true
    check_pm2 || true
    check_ports || true
    check_disk_space || true
    check_memory || true
    check_env_file || true
    check_git_status || true
    check_network || true
    
    # 显示摘要并返回结果
    show_summary
}

# 执行主函数
main "$@"
