#!/bin/bash

# ============================================================
# 绮管电商后台 - 环境配置初始化脚本
# ============================================================
# 功能:
#   - 从 .env.example 生成 .env 文件
#   - 交互式配置数据库连接参数
#   - 交互式配置 JWT 密钥
#   - 验证配置有效性
#   - 设置正确的文件权限 (chmod 600)
#
# 用法:
#   bash scripts/setup_env.sh [选项]
#
# 选项:
#   -h, --help          显示帮助信息
#   -i, --interactive    交互模式 (默认，逐步引导配置)
#   -q, --quick          快速模式 (使用默认值或随机值)
#   -r, --reset          重置现有配置 (会备份旧配置)
#   -v, --validate       仅验证当前配置有效性
#   --show               显示当前配置 (脱敏)
#
# 示例:
#   bash scripts/setup_env.sh              # 交互模式配置
#   bash scripts/setup_env.sh -q           # 快速模式 (使用默认值)
#   bash scripts/setup_env.sh -v           # 验证当前配置
#   bash scripts/setup_env.sh --show       # 查看当前配置
#
# 注意事项:
#   • 此脚本会修改项目根目录的 .env 文件
#   • 敏感信息 (密码、密钥) 会以安全方式处理
#   • 建议在首次部署时运行此脚本
#
# 作者: 绮管技术团队
# 日期: 2026-04-08
# 版本: v1.0
# ============================================================

set -e

# ==================== 配置区 ====================
WORK_DIR="/var/www/qiguan"
ENV_FILE="$WORK_DIR/.env"
ENV_EXAMPLE_FILE="$WORK_DIR/.env.example"
BACKUP_DIR="/var/www/qiguan/backups/env_backups"
DATE_FORMAT='+%Y-%m-%d %H:%M:%S'
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
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
MODE="interactive"
RESET_MODE=false
VALIDATE_ONLY=false
SHOW_CONFIG=false
# ================================================

# ==================== 工具函数 ====================

# 显示帮助信息
show_help() {
    cat << EOF
${BOLD}绮管电商后台 - 环境配置初始化工具${NC}

${CYAN}用法:${NC}
    $0 [选项]

${CYAN}选项:${NC}
    -h, --help          显示此帮助信息
    -i, --interactive    交互模式 (默认，逐步引导配置)
    -q, --quick          快速模式 (使用默认值或自动生成安全值)
    -r, --reset          重置现有配置 (会先备份旧配置)
    -v, --validate       仅验证当前配置是否有效
    --show               显示当前配置 (敏感信息已脱敏)

${CYAN}示例:${NC}
    $0                    # 交互式配置向导
    $0 -q                 # 快速配置 (使用智能默认值)
    $0 -v                 # 检查当前配置有效性
    $0 --show             # 查看当前配置 (密码隐藏)

${CYAN}配置项说明:${NC}
    • 数据库连接: MySQL/SQLite 连接参数
    • JWT密钥: 用于Token签名的安全密钥
    • 服务端口: 后端API监听端口
    • 环境变量: 开发/测试/生产环境标识

${CYAN}安全提示:${NC}
    • JWT_SECRET 至少32个字符
    • 数据库密码使用强密码
    • .env 文件权限设置为 600
    • 不要将 .env 提交到版本控制

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
    
    case $level in
        "INFO")    echo -e "${GREEN}[✓]${NC} ${message}" ;;
        "WARN")    echo -e "${YELLOW}[!]${NC} ${message}" ;;
        "ERROR")   echo -e "${RED}[✗]${NC} ${message}" ;;
        "SUCCESS") echo -e "${GREEN}[OK]${NC} ${message}" ;;
        "HEADER")  echo -e "\n${BOLD}${CYAN}━━━ ${message} ━━━${NC}" ;;
        "PROMPT")  echo -e "${BLUE}[?]${NC} ${message}" ;;
        *)         echo "$message" ;;
    esac
}

# 生成随机字符串
generate_random_string() {
    local length=$1
    if command -v openssl &> /dev/null; then
        openssl rand -base64 $length | tr -d '/+=' | head -c $length
    elif command -v /dev/urandom &> /dev/null; then
        cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c $length
    else
        # 备用方案: 使用时间戳+随机数
        echo "$(date +%s)$RANDOM$RANDOM" | md5sum | head -c $length
    fi
}

# 脱敏显示值
mask_sensitive_value() {
    local value="$1"
    local visible_chars=4
    
    if [ ${#value} -le $visible_chars ]; then
        echo "****"
    else
        echo "${value:0:$visible_chars}****"
    fi
}

# 备份现有配置
backup_existing_config() {
    if [ -f "$ENV_FILE" ]; then
        mkdir -p "$BACKUP_DIR"
        local backup_file="$BACKUP_DIR/env_backup_${TIMESTAMP}"
        
        cp "$ENV_FILE" "$backup_file"
        
        log "INFO" "已备份现有配置到: ${backup_file}"
        log "INFO" "如需恢复，请使用: cp ${backup_file} ${ENV_FILE}"
        return 0
    fi
    return 1
}

# 从模板创建新配置
create_from_template() {
    if [ ! -f "$ENV_EXAMPLE_FILE" ]; then
        log "ERROR" ".env.example 模板文件不存在"
        log "INFO" "请确保模板文件存在于: ${ENV_EXAMPLE_FILE}"
        return 1
    fi
    
    log "INFO" "从模板创建配置文件..."
    cp "$ENV_EXAMPLE_FILE" "$ENV_FILE"
    log "SUCCESS" "配置文件已创建: ${ENV_FILE}"
    return 0
}

# 设置文件权限
set_file_permissions() {
    chmod 600 "$ENV_FILE"
    local perms=$(stat -c %a "$ENV_FILE" 2>/dev/null || stat -f %Lp "$ENV_FILE")
    log "SUCCESS" "文件权限已设置为: ${perms} (仅所有者可读写)"
}
# ================================================

# ==================== 交互式配置函数 ====================

# 配置数据库连接
configure_database() {
    log "HEADER" "数据库配置"
    
    echo ""
    echo -e "${CYAN}请选择数据库类型:${NC}"
    echo "  1) MySQL (推荐生产环境)"
    echo "  2) SQLite (适合开发/小型部署)"
    echo "  0) 跳过 (使用默认值)"
    echo ""
    
    read -p "请输入选项 [1]: " db_choice
    db_choice=${db_choice:-1}
    
    case $db_choice in
        1)
            # MySQL 配置
            sed -i 's/^DB_TYPE=.*/DB_TYPE=mysql/' "$ENV_FILE"
            
            log "PROMPT" "MySQL 主机地址 [localhost]: "
            read db_host
            db_host=${db_host:-localhost}
            sed -i "s/^DB_HOST=.*/DB_HOST=${db_host}/" "$ENV_FILE"
            
            log "PROMPT" "MySQL 端口 [3306]: "
            read db_port
            db_port=${db_port:-3306}
            sed -i "s/^DB_PORT=.*/DB_PORT=${db_port}/" "$ENV_FILE"
            
            log "PROMPT" "数据库名称 [qiguan]: "
            read db_name
            db_name=${db_name:-qiguan}
            sed -i "s/^DB_NAME=.*/DB_NAME=${db_name}/" "$ENV_FILE"
            
            log "PROMPT" "数据库用户名 [root]: "
            read db_user
            db_user=${db_user:-root}
            sed -i "s/^DB_USER=.*/DB_USER=${db_user}/" "$ENV_FILE"
            
            log "PROMPT" "数据库密码 (留空使用默认): "
            read -s db_pass
            echo ""
            if [ -z "$db_pass" ]; then
                db_pass="your_secure_password_here"
                log "INFO" "使用默认密码 (请尽快修改!)"
            fi
            sed -i "s/^DB_PASSWORD=.*/DB_PASSWORD=${db_pass}/" "$ENV_FILE"
            
            log "SUCCESS" "MySQL 配置完成"
            ;;
        2)
            # SQLite 配置
            sed -i 's/^DB_TYPE=.*/DB_TYPE=sqlite/' "$ENV_FILE"
            sed -i 's/^DB_PATH=.*/DB_PATH=\/var\/www\/qiguan\/data\/ecommerce.db/' "$ENV_FILE"
            log "SUCCESS" "SQLite 配置完成"
            ;;
        0|*)
            log "INFO" "跳过数据库配置，使用默认值"
            ;;
    esac
    
    echo ""
}

# 配置JWT密钥
configure_jwt() {
    log "HEADER" "JWT 安全配置"
    
    echo ""
    log "INFO" "JWT (JSON Web Token) 用于用户认证和授权"
    log "INFO" "密钥长度建议 >= 32 个字符"
    echo ""
    
    log "PROMPT" "选择 JWT 密钥生成方式:"
    echo "  1) 自动生成强密钥 (推荐)"
    echo "  2) 手动输入密钥"
    echo "  0) 使用默认值"
    echo ""
    
    read -p "请输入选项 [1]: " jwt_choice
    jwt_choice=${jwt_choice:-1}
    
    case $jwt_choice in
        1)
            # 自动生成
            local jwt_secret=$(generate_random_string 48)
            sed -i "s/^JWT_SECRET=.*/JWT_SECRET=${jwt_secret}/" "$ENV_FILE"
            log "SUCCESS" "已生成安全的 JWT 密钥 (48字符)"
            log "INFO" "密钥预览: $(mask_sensitive_value "$jwt_secret")"
            ;;
        2)
            # 手动输入
            log "PROMPT" "请输入 JWT 密钥 (至少32个字符): "
            read -s jwt_secret
            echo ""
            
            if [ ${#jwt_secret} -lt 32 ]; then
                log "WARN" "密钥长度不足32个字符，安全性较低！"
                read -p "仍然继续? [y/N]: " confirm
                if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
                    configure_jwt  # 递归重新配置
                    return
                fi
            fi
            
            sed -i "s/^JWT_SECRET=.*/JWT_SECRET=${jwt_secret}/" "$ENV_FILE"
            log "SUCCESS" "JWT 密钥已设置"
            ;;
        0|*)
            log "INFO" "使用默认 JWT 密钥 (请尽快修改!)"
            ;;
    esac
    
    # JWT 过期时间
    echo ""
    log "PROMPT" "Token 过期时间 [24h]: "
    read jwt_expire
    jwt_expire=${jwt_expire:-24h}
    sed -i "s/^JWT_EXPIRES_IN=.*/JWT_EXPIRES_IN=${jwt_expire}/" "$ENV_FILE"
    
    echo ""
}

# 配置服务端口
configure_server() {
    log "HEADER" "服务器配置"
    
    echo ""
    log "PROMPT" "后端 API 端口 [3000]: "
    read api_port
    api_port=${api_port:-3000}
    sed -i "s/^PORT=.*/PORT=${api_port}/" "$ENV_FILE"
    
    # Node.js 环境
    echo ""
    echo -e "${CYAN}选择运行环境:${NC}"
    echo "  1) production (生产环境)"
    echo "  2) staging (测试环境)"
    echo "  3) development (开发环境)"
    echo ""
    
    read -p "请输入选项 [1]: " env_choice
    env_choice=${env_choice:-1}
    
    case $env_choice in
        1) node_env="production" ;;
        2) node_env="staging" ;;
        3) node_env="development" ;;
        *)  node_env="production" ;;
    esac
    
    sed -i "s/^NODE_ENV=.*/NODE_ENV=${node_env}/" "$ENV_FILE"
    
    log "SUCCESS" "服务器配置完成"
    echo ""
}

# 配置其他选项
configure_misc() {
    log "HEADER" "其他配置选项"
    
    # Debug 模式
    echo ""
    read -p "启用调试模式? [y/N]: " debug_mode
    if [[ "$debug_mode" =~ ^[Yy]$ ]]; then
        sed -i 's/^DEBUG=.*/DEBUG=true/' "$ENV_FILE"
        log "INFO" "Debug 模式已开启"
    else
        sed -i 's/^DEBUG=.*/DEBUG=false/' "$ENV_FILE"
        log "INFO" "Debug 模式已关闭"
    fi
    
    # 日志级别
    echo ""
    echo -e "${CYAN}日志级别:${NC}"
    echo "  1) error (仅错误)"
    echo "  2) warn (错误+警告)"
    echo "  3) info (常规信息)"
    echo "  4) debug (详细调试)"
    echo ""
    
    read -p "请选择 [3]: " log_level_choice
    log_level_choice=${log_level_choice:-3}
    
    case $log_level_choice in
        1) log_level="error" ;;
        2) log_level="warn" ;;
        3) log_level="info" ;;
        4) log_level="debug" ;;
        *)  log_level="info" ;;
    esac
    
    sed -i "s/^LOG_LEVEL=.*/LOG_LEVEL=${log_level}/" "$ENV_FILE"
    
    log "SUCCESS" "其他配置完成"
    echo ""
}
# ================================================

# ==================== 快速配置函数 ====================

quick_setup() {
    log "HEADER" "快速配置模式"
    log "INFO" "将使用默认值和自动生成的安全值..."
    echo ""
    
    # 从模板创建
    create_from_template || return 1
    
    # 自动生成 JWT 密钥
    local jwt_secret=$(generate_random_string 48)
    sed -i "s/^JWT_SECRET=.*/JWT_SECRET=${jwt_secret}/" "$ENV_FILE"
    log "INFO" "JWT 密钥: 已自动生成"
    
    # 自动生成数据库密码 (如果是MySQL)
    local db_password=$(generate_random_string 24)
    sed -i "s/^DB_PASSWORD=.*/DB_PASSWORD=${db_password}/" "$ENV_FILE"
    log "INFO" "数据库密码: 已自动生成"
    
    # 设置生产环境
    sed -i 's/^NODE_ENV=.*/NODE_ENV=production/' "$ENV_FILE"
    log "INFO" "运行环境: production"
    
    # 关闭debug
    sed -i 's/^DEBUG=.*/DEBUG=false/' "$ENV_FILE"
    
    log "SUCCESS" "快速配置完成！"
    echo ""
}
# ================================================

# ==================== 验证函数 ====================

validate_config() {
    log "HEADER" "验证配置有效性"
    
    local all_valid=true
    local warnings=0
    local errors=0
    
    # 检查文件是否存在
    if [ ! -f "$ENV_FILE" ]; then
        log "ERROR" ".env 文件不存在"
        return 1
    fi
    
    log "INFO" "检查配置文件: ${ENV_FILE}"
    echo ""
    
    # 1. 检查必需变量
    log "INFO" "检查必需的环境变量..."
    local required_vars=(
        "PORT"
        "NODE_ENV"
        "JWT_SECRET"
        "JWT_EXPIRES_IN"
    )
    
    for var in "${required_vars[@]}"; do
        if grep -q "^${var}=" "$ENV_FILE"; then
            local value=$(grep "^${var}=" "$ENV_FILE" | cut -d'=' -f2-)
            
            # 特殊检查
            case $var in
                "PORT")
                    if [[ "$value" =~ ^[0-9]+$ ]] && [ "$value" -ge 1024 ] && [ "$value" -le 65535 ]; then
                        log "INFO" "  ✓ PORT = ${value} (有效端口)"
                    else
                        log "ERROR" "  ✗ PORT = ${value} (无效端口号, 需要 1024-65535)"
                        errors=$((errors + 1))
                        all_valid=false
                    fi
                    ;;
                "NODE_ENV")
                    if [[ "$value" =~ ^(production|staging|development|test)$ ]]; then
                        log "INFO" "  ✓ NODE_ENV = ${value}"
                    else
                        log "WARN" "  ! NODE_ENV = ${value} (非标准值)"
                        warnings=$((warnings + 1))
                    fi
                    ;;
                "JWT_SECRET")
                    if [ ${#value} -ge 32 ]; then
                        log "INFO" "  ✓ JWT_SECRET = $(mask_sensitive_value "$value") (${#value}字符 ✓)"
                    elif [ "$value" = "your-super-secret-key-at-least-32-characters-long!!!" ] || \
                         [ "$value" = "your-secret-key" ]; then
                        log "ERROR" "  ✗ JWT_SECRET = 使用了不安全的默认值!"
                        errors=$((errors + 1))
                        all_valid=false
                    else
                        log "WARN" "  ! JWT_SECRET = $(mask_sensitive_value "$value") (长度不足32字符)"
                        warnings=$((warnings + 1))
                    fi
                    ;;
                *)
                    log "INFO" "  ✓ ${var} = 已配置"
                    ;;
            esac
        else
            log "ERROR" "  ✗ ${var} = 未配置"
            errors=$((errors + 1))
            all_valid=false
        fi
    done
    
    # 2. 检查数据库配置
    echo ""
    log "INFO" "检查数据库配置..."
    
    if grep -q "^DB_TYPE=" "$ENV_FILE"; then
        local db_type=$(grep "^DB_TYPE=" "$ENV_FILE" | cut -d'=' -f2)
        
        case $db_type in
            "mysql")
                local mysql_vars=("DB_HOST" "DB_PORT" "DB_NAME" "DB_USER" "DB_PASSWORD")
                for var in "${mysql_vars[@]}"; do
                    if grep -q "^${var}=" "$ENV_FILE"; then
                        local value=$(grep "^${var}=" "$ENV_FILE" | cut -d'=' -f2-)
                        
                        if [ "$var" = "DB_PASSWORD" ]; then
                            log "INFO" "  ✓ ${var} = $(mask_sensitive_value "$value")"
                        elif [ -z "$value" ]; then
                            log "WARN" "  ! ${var} = 空"
                            warnings=$((warnings + 1))
                        else
                            log "INFO" "  ✓ ${var} = ${value}"
                        fi
                    else
                        log "WARN" "  ! ${var} = 未配置"
                        warnings=$((warnings + 1))
                    fi
                done
                ;;
            "sqlite")
                if grep -q "^DB_PATH=" "$ENV_FILE"; then
                    local db_path=$(grep "^DB_PATH=" "$ENV_FILE" | cut -d'=' -f2)
                    log "INFO" "  ✓ DB_PATH = ${db_path}"
                    
                    # 检查目录是否存在
                    local db_dir=$(dirname "$db_path")
                    if [ -d "$db_dir" ]; then
                        log "INFO" "  ✓ 数据库目录存在"
                    else
                        log "WARN" "  ! 数据库目录不存在: ${db_dir}"
                        warnings=$((warnings + 1))
                    fi
                fi
                ;;
            *)
                log "WARN" "  ! DB_TYPE = ${db_type} (未知类型)"
                warnings=$((warnings + 1))
                ;;
        esac
    fi
    
    # 3. 检查文件权限
    echo ""
    log "INFO" "检查文件权限..."
    local file_perms=$(stat -c %a "$ENV_FILE" 2>/dev/null || stat -f %Lp "$ENV_FILE")
    
    if [ "$file_perms" = "600" ]; then
        log "INFO" "  ✓ 权限: ${file_perms} (安全 ✓)"
    else
        log "WARN" "  ! 权限: ${file_perms} (建议设置为 600)"
        warnings=$((warnings + 1))
    fi
    
    # 输出结果
    echo ""
    echo -e "${BOLD}${CYAN}═════════════════════════════════════════${NC}"
    echo -e "${BOLD}              验证结果摘要${NC}"
    echo -e "${BOLD}${CYAN}═════════════════════════════════════════${NC}"
    echo ""
    echo -e "  错误项:  ${RED}${errors}${NC}"
    echo -e "  警告项:  ${YELLOW}${warnings}${NC}"
    echo ""
    
    if [ "$all_valid" = true ] && [ $warnings -eq 0 ]; then
        echo -e "${GREEN}${BOLD}🎉 配置完全有效！可以安全使用。${NC}"
        return 0
    elif [ "$all_valid" = true ]; then
        echo -e "${YELLOW}${BOLD}⚠️  配置基本有效，但存在警告项。${NC}"
        echo -e "${YELLOW}   建议解决警告以获得最佳体验。${NC}"
        return 0
    else
        echo -e "${RED}${BOLD}❌ 存在错误项，配置无效！${NC}"
        echo -e "${RED}   请修复错误后重试。${NC}"
        return 1
    fi
}

# 显示当前配置 (脱敏)
show_current_config() {
    log "HEADER" "当前环境配置"
    
    if [ ! -f "$ENV_FILE" ]; then
        log "ERROR" ".env 文件不存在"
        return 1
    fi
    
    echo ""
    echo -e "${BOLD}${PURPLE}配置文件: ${ENV_FILE}${NC}"
    echo -e "${BOLD}最后修改: $(stat -c '%y' "$ENV_FILE" 2>/dev/null | cut -d'.' -f1)${NC}"
    echo -e "${BOLD}文件权限: $(stat -c '%a' "$ENV_FILE" 2>/dev/null || stat -f %Lp "$ENV_FILE")${NC}"
    echo ""
    printf "${BOLD}%-25s %-30s${NC}\n" "变量名" "值"
    printf "%s\n" "───────────────────────────────────────────────────────"
    
    # 读取并显示所有配置 (脱敏处理)
    while IFS= read -r line; do
        if [[ "$line" =~ ^[A-Z_]+= ]]; then
            local var_name=$(echo "$line" | cut -d'=' -f1)
            local var_value=$(echo "$line" | cut -d'=' -f2-)
            
            # 敏感字段脱敏
            case $var_name in
                *PASSWORD*|*SECRET*|*KEY*|*TOKEN*)
                    printf "%-25s %-30s\n" "$var_name" "$(mask_sensitive_value "$var_value")"
                    ;;
                *)
                    printf "%-25s %-30s\n" "$var_name" "$var_value"
                    ;;
            esac
        fi
    done < "$ENV_FILE"
    
    echo ""
    log "INFO" "提示: 敏感信息已用 **** 隐藏"
    echo ""
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
            -i|--interactive)
                MODE="interactive"
                shift
                ;;
            -q|--quick)
                MODE="quick"
                shift
                ;;
            -r|--reset)
                RESET_MODE=true
                shift
                ;;
            -v|--validate)
                VALIDATE_ONLY=true
                shift
                ;;
            --show)
                SHOW_CONFIG=true
                shift
                ;;
            *)
                echo -e "${RED}未知参数: $1${NC}"
                show_help
                ;;
        esac
    done
}

# 主函数
main() {
    # 解析参数
    parse_args "$@"
    
    # 显示标题
    echo ""
    echo -e "${BOLD}${PURPLE}╔════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${PURPLE}║   绮管电商后台 - 环境配置初始化工具     ║${NC}"
    echo -e "${BOLD}{PURPLE}╚════════════════════════════════════════╝${NC}"
    echo -e "${CYAN}执行时间: $(date "$DATE_FORMAT")${NC}"
    echo -e "${CYAN}工作目录: ${WORK_DIR}${NC}"
    echo ""
    
    # 仅显示配置
    if [ "$SHOW_CONFIG" = true ]; then
        show_current_config
        exit $?
    fi
    
    # 仅验证配置
    if [ "$VALIDATE_ONLY" = true ]; then
        validate_config
        exit $?
    fi
    
    # 检查是否需要重置
    if [ "$RESET_MODE" = true ] && [ -f "$ENV_FILE" ]; then
        log "WARN" "检测到 --reset 参数，将重置现有配置"
        backup_existing_config
        rm -f "$ENV_FILE"
    fi
    
    # 根据模式执行配置
    case $MODE in
        "interactive")
            log "INFO" "启动交互式配置向导..."
            echo ""
            
            # 如果.env已存在，询问是否覆盖
            if [ -f "$ENV_FILE" ]; then
                log "WARN" "检测到现有的 .env 文件"
                read -p "是否要覆盖现有配置? [y/N]: " overwrite
                if [[ ! "$overwrite" =~ ^[Yy]$ ]]; then
                    log "INFO" "取消操作"
                    exit 0
                fi
                backup_existing_config
            fi
            
            # 从模板创建
            create_from_template || exit 1
            
            # 逐步配置
            configure_database
            configure_jwt
            configure_server
            configure_misc
            
            # 设置权限
            set_file_permissions
            
            # 验证配置
            echo ""
            log "HEADER" "配置完成"
            validate_config
            ;;
        "quick")
            quick_setup
            set_file_permissions
            validate_config
            ;;
    esac
    
    # 最终提示
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}后续步骤:${NC}"
    echo -e "  1. 运行部署前检查: ${CYAN}bash scripts/pre_deploy_check.sh${NC}"
    echo -e "  2. 测试数据库连接: ${CYAN}npm run test:db${NC}"
    echo -e "  3. 启动服务:         ${CYAN}pm2 start ecosystem.config.js${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# 执行主函数
main "$@"
