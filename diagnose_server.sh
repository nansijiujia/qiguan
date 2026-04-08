#!/bin/bash

# ============================================================
# 绮管后台 - 服务器快速诊断脚本
# ============================================================
# 用途: 快速检查服务器环境、数据库、前端构建、API和PM2状态
# 使用: bash diagnose_server.sh [选项]
#   -v, --verbose    显示详细信息
#   -q, --quiet      仅显示错误
#   -h, --help       显示帮助信息
#
# 作者: 绮管技术团队
# 版本: 1.0.0
# 日期: 2026-04-09
# ============================================================

set -e

# ==================== 配置变量 ====================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"
ENV_FILE="${PROJECT_DIR}/.env"
FRONTEND_DIR="${PROJECT_DIR}/qiguanqianduan"
DIST_DIR="${FRONTEND_DIR}/dist"
API_BASE="http://localhost:3000"
VERBOSE=false
QUIET=false

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# 计数器
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
WARNING_TESTS=0

# 结果数组
declare -a RESULTS=()

# ==================== 工具函数 ====================

usage() {
    cat << EOF
${BOLD}绮管后台 - 服务器诊断工具${NC}

用法: $0 [选项]

选项:
  -v, --verbose    显示详细输出信息
  -q, --quiet      仅显示错误和失败项
  -h, --help       显示此帮助信息

示例:
  bash diagnose_server.sh              # 标准诊断
  bash diagnose_server.sh -v           # 详细诊断模式
  bash diagnose_server.sh -q           # 安静模式(仅错误)

EOF
    exit 0
}

log_info() {
    if [ "$QUIET" = false ]; then
        echo -e "${BLUE}[INFO]${NC} $1"
    fi
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_fail() {
    echo -e "${RED}[✗]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

log_section() {
    if [ "$QUIET" = false ]; then
        echo ""
        echo -e "${BOLD}${CYAN}═══ $1 ═══${NC}"
        echo ""
    fi
}

log_verbose() {
    if [ "$VERBOSE" = true ] && [ "$QUIET" = false ]; then
        echo -e "  ${CYAN}→${NC} $1"
    fi
}

add_result() {
    local status=$1
    local test_name=$2
    local detail=$3
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    case $status in
        "PASS")
            PASSED_TESTS=$((PASSED_TESTS + 1))
            log_success "$test_name"
            ;;
        "FAIL")
            FAILED_TESTS=$((FAILED_TESTS + 1))
            log_fail "$test_name"
            ;;
        "WARN")
            WARNING_TESTS=$((WARNING_TESTS + 1))
            log_warning "$test_name"
            ;;
    esac
    
    if [ -n "$detail" ] && [ "$VERBOSE" = true ]; then
        log_verbose "$detail"
    fi
    
    RESULTS+=("$status|$test_name|$detail")
}

check_command() {
    if command -v "$1" &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# 脱敏密码/密钥
mask_sensitive_value() {
    local value="$1"
    local len=${#value}
    
    if [ $len -le 4 ]; then
        echo "***"
    elif [ $len -le 8 ]; then
        echo "${value:0:2}***"
    else
        echo "${value:0:4}****${value: -4}"
    fi
}

# ==================== 解析参数 ====================

while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -q|--quiet)
            QUIET=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "未知参数: $1"
            usage
            ;;
    esac
done

# ==================== 主程序开始 ====================

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║     ${CYAN}绮管后台 - 服务器诊断报告${NC}               ║${NC}"
echo -e "${BOLD}║     ${CYAN}Server Diagnostics Report${NC}                  ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo -e "${BOLD}时间: $(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo ""

# ============================================================
# 1. 环境变量检查
# ============================================================

log_section "1️⃣  环境变量检查"

# 检查 .env 文件是否存在
if [ -f "$ENV_FILE" ]; then
    add_result "PASS" ".env 文件存在" "路径: $ENV_FILE"
    
    # 显示环境变量内容（脱敏）
    log_info "环境变量配置 (敏感信息已脱敏):"
    log_info "─────────────────────────────────────"
    
    while IFS='=' read -r key value; do
        # 跳过空行和注释
        [[ -z "$key" || "$key" =~ ^# ]] && continue
        
        # 脱敏处理
        case $key in
            *PASSWORD*|*SECRET*|*KEY*|*TOKEN*)
                masked=$(mask_sensitive_value "$value")
                log_verbose "  ${key}=${masked}"
                ;;
            *)
                log_verbose "  ${key}=${value}"
                ;;
        esac
    done < <(grep -E '^[A-Z_]+=' "$ENV_FILE" | head -30)
    
    log_info "─────────────────────────────────────"
    
else
    add_result "FAIL" ".env 文件不存在" "请创建 .env 文件 (可从 .env.example 复制)"
fi

# 检查关键环境变量
if [ -f "$ENV_FILE" ]; then
    # DB_TYPE
    if grep -q "^DB_TYPE=" "$ENV_FILE"; then
        DB_TYPE=$(grep "^DB_TYPE=" "$ENV_FILE" | cut -d'=' -f2)
        add_result "PASS" "DB_TYPE 已配置" "值: $DB_TYPE"
    else
        add_result "WARN" "DB_TYPE 未配置" "将使用默认值 (sqlite/mysql)"
    fi
    
    # JWT_SECRET
    if grep -q "^JWT_SECRET=" "$ENV_FILE"; then
        JWT_SECRET=$(grep "^JWT_SECRET=" "$ENV_FILE" | cut -d'=' -f2)
        JWT_LEN=${#JWT_SECRET}
        
        if [ $JWT_LEN -ge 32 ]; then
            add_result "PASS" "JWT_SECRET 已配置" "长度: ${JWT_LEN} 字符 ✓"
        else
            add_result "FAIL" "JWT_SECRET 长度不足" "当前: ${JWT_LEN} 字符, 要求 ≥ 32 字符"
        fi
    else
        add_result "FAIL" "JWT_SECRET 未配置" "这是必需的安全配置项!"
    fi
    
    # PORT
    if grep -q "^PORT=" "$ENV_FILE"; then
        PORT=$(grep "^PORT=" "$ENV_FILE" | cut -d'=' -f2)
        API_BASE="http://localhost:${PORT}"
        add_result "PASS" "PORT 已配置" "API地址: $API_BASE"
    else
        add_result "WARN" "PORT 未配置" "将使用默认端口 3000"
    fi
    
    # NODE_ENV
    if grep -q "^NODE_ENV=" "$ENV_FILE"; then
        NODE_ENV=$(grep "^NODE_ENV=" "$ENV_FILE" | cut -d'=' -f2)
        add_result "PASS" "NODE_ENV 已配置" "运行环境: $NODE_ENV"
        
        if [ "$NODE_ENV" = "production" ] && [ "$DEBUG" = "true" ]; then
            add_result "WARN" "生产环境开启调试" "建议设置 DEBUG=false"
        fi
    else
        add_result "WARN" "NODE_ENV 未配置" "建议明确指定运行环境"
    fi
    
    # 其他重要变量检查
    for var in DB_HOST DB_NAME DB_USER APP_NAME LOG_LEVEL; do
        if grep -q "^${var}=" "$ENV_FILE"; then
            value=$(grep "^${var}=" "$ENV_FILE" | cut -d'=' -f2)
            add_result "PASS" "$var 已配置" "值: $value"
        else
            log_verbose "$var 未配置 (可选)"
        fi
    done
fi

# ============================================================
# 2. 数据库连接测试
# ============================================================

log_section "2️⃣  数据库连接测试"

# 检查 mysql2 模块是否安装
if [ -f "${PROJECT_DIR}/node_modules/mysql2/package.json" ]; then
    MYSQL2_INSTALLED=true
    log_info "检测到 mysql2 模块已安装"
else
    MYSQL2_INSTALLED=false
fi

if [ -f "${PROJECT_DIR}/node_modules/better-sqlite3/package.json" ]; then
    SQLITE_INSTALLED=true
    log_info "检测到 better-sqlite3 模块已安装"
else
    SQLITE_INSTALLED=false
fi

# 根据 DB_TYPE 进行测试
if [ -f "$ENV_FILE" ] && grep -q "^DB_TYPE=mysql" "$ENV_FILE"; then
    # MySQL 连接测试
    if [ "$MYSQL2_INSTALLED" = true ]; then
        log_info "正在测试 MySQL 连接..."
        
        # 提取 MySQL 配置
        DB_HOST_VAL=$(grep "^DB_HOST=" "$ENV_FILE" | cut -d'=' -f2 || echo "localhost")
        DB_PORT_VAL=$(grep "^DB_PORT=" "$ENV_FILE" | cut -d'=' -f2 || echo "3306")
        DB_NAME_VAL=$(grep "^DB_NAME=" "$ENV_FILE" | cut -d'=' -f2 || echo "qiguan")
        DB_USER_VAL=$(grep "^DB_USER=" "$ENV_FILE" | cut -d'=' -f2 || echo "root")
        DB_PASS_VAL=$(grep "^DB_PASSWORD=" "$ENV_FILE" | cut -d'=' -f2 || echo "")
        
        # 使用 mysql 命令行测试连接
        if check_command mysql; then
            if mysql -h"$DB_HOST_VAL" -P"$DB_PORT_VAL" -u"$DB_USER_VAL" -p"$DB_PASS_VAL" -e "SELECT 1;" "$DB_NAME_VAL" &>/dev/null; then
                add_result "PASS" "MySQL 连接成功" "主机: ${DB_HOST_VAL}:${DB_PORT_VAL}, 数据库: ${DB_NAME_VAL}"
                
                # 获取数据库信息
                TABLE_COUNT=$(mysql -h"$DB_HOST_VAL" -P"$DB_PORT_VAL" -u"$DB_USER_VAL" -p"$DB_PASS_VAL" -e "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema='${DB_NAME_VAL}';" "$DB_NAME_VAL" -N 2>/dev/null || echo "N/A")
                log_verbose "数据表数量: $TABLE_COUNT"
            else
                add_result "FAIL" "MySQL 连接失败" "请检查数据库配置和网络连接"
            fi
        else
            # 尝试使用 Node.js 测试
            log_info "mysql 命令未找到, 尝试使用 Node.js 测试..."
            
            cat > /tmp/test_mysql.js << 'EOF'
const mysql = require('mysql2/promise');
require('dotenv').config();

async function test() {
    try {
        const conn = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'qiguan'
        });
        
        const [rows] = await conn.execute('SELECT 1 AS test');
        await conn.end();
        console.log('SUCCESS');
        process.exit(0);
    } catch (err) {
        console.error('ERROR:', err.message);
        process.exit(1);
    }
}

test();
EOF
            
            if cd "$PROJECT_DIR" && node /tmp/test_mysql.js 2>&1 | grep -q "SUCCESS"; then
                add_result "PASS" "MySQL 连接成功 (Node.js)" "通过 mysql2 模块验证"
            else
                ERROR_MSG=$(cd "$PROJECT_DIR" && node /tmp/test_mysql.js 2>&1 | grep "ERROR:" || echo "未知错误")
                add_result "FAIL" "MySQL 连接失败" "$ERROR_MSG"
            fi
            
            rm -f /tmp/test_mysql.js
        fi
    else
        add_result "WARN" "mysql2 模块未安装" "无法进行 MySQL 连接测试"
    fi
elif [ -f "$ENV_FILE" ] && grep -q "^DB_TYPE=sqlite" "$ENV_FILE"; then
    # SQLite 连接测试
    if [ "$SQLITE_INSTALLED" = true ]; then
        log_info "正在测试 SQLite 连接..."
        
        DB_PATH_VAL=$(grep "^DB_PATH=" "$ENV_FILE" | cut -d'=' -f2 || echo "./data/ecommerce.db")
        
        # 检查数据库文件是否存在
        if [ -f "$DB_PATH_VAL" ]; then
            FILE_SIZE=$(stat -c%s "$DB_PATH_VAL" 2>/dev/null || stat -f%z "$DB_PATH_VAL" 2>/dev/null || echo "0")
            
            if [ "$FILE_SIZE" -gt 100 ]; then
                add_result "PASS" "SQLite 数据库文件存在" "路径: $DB_PATH_VAL, 大小: $((FILE_SIZE/1024))KB"
                
                # 测试读取
                cat > /tmp/test_sqlite.js << EOF
const Database = require('better-sqlite3');
try {
    const db = new Database('${DB_PATH_VAL}');
    const result = db.prepare('SELECT 1 AS test').get();
    console.log('SUCCESS');
    db.close();
    process.exit(0);
} catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
}
EOF
                
                if node /tmp/test_sqlite.js 2>&1 | grep -q "SUCCESS"; then
                    add_result "PASS" "SQLite 连接正常" "数据库可读写"
                else
                    ERROR_MSG=$(node /tmp/test_sqlite.js 2>&1 | grep "ERROR:" || echo "未知错误")
                    add_result "FAIL" "SQLite 连接失败" "$ERROR_MSG"
                fi
                
                rm -f /tmp/test_sqlite.js
            else
                add_result "WARN" "SQLite 数据库文件过小" "可能未初始化, 大小: ${FILE_SIZE} bytes"
            fi
        else
            add_result "FAIL" "SQLite 数据库文件不存在" "路径: $DB_PATH_VAL"
        fi
    else
        add_result "WARN" "better-sqlite3 模块未安装" "无法进行 SQLite 连接测试"
    fi
else
    add_result "WARN" "无法确定数据库类型" "DB_TYPE 未正确配置"
fi

# ============================================================
# 3. 前端构建版本检查
# ============================================================

log_section "3️⃣  前端构建版本检查"

# 检查 dist 目录
if [ -d "$DIST_DIR" ]; then
    add_result "PASS" "前端构建目录存在" "路径: $DIST_DIR"
    
    # 列出目录内容
    DIST_ITEMS=$(ls -la "$DIST_DIR" 2>/dev/null | wc -l)
    log_verbose "包含 $((DIST_ITEMS-1)) 个项目"
    
    # 检查 assets 目录
    if [ -d "${DIST_DIR}/assets" ]; then
        add_result "PASS" "assets 目录存在" "路径: ${DIST_DIR}/assets"
        
        # 查找 Dashboard 相关 JS 文件
        DASHBOARD_JS=$(find "${DIST_DIR}/assets" -name "*Dashboard*" -o -name "*dashboard*" 2>/dev/null | head -5)
        
        if [ -n "$DASHBOARD_JS" ]; then
            DASHBOARD_COUNT=$(echo "$DASHBOARD_JS" | wc -l)
            add_result "PASS" "找到 Dashboard 相关文件" "共 ${DASHBOARD_COUNT} 个文件"
            
            log_verbose "Dashboard 文件列表:"
            while IFS= read -r file; do
                log_verbose "  • $(basename "$file") ($(du -h "$file" | cut -f1))"
            done <<< "$DASHBOARD_JS"
            
            # 搜索假数据
            FAKE_DATA_FOUND=""
            for js_file in $DASHBOARD_JS; do
                if [ -f "$js_file" ]; then
                    for fake_val in "1234" "567" "89432" "8901"; do
                        if grep -q "$fake_val" "$js_file" 2>/dev/null; then
                            LINE_NUM=$(grep -n "$fake_val" "$js_file" | head -1 | cut -d':' -f1)
                            FAKE_DATA_FOUND="${FAKE_DATA_FOUND}\n  - 发现假数据 '${fake_val}' 在 $(basename "$js_file"):${LINE_NUM}"
                        fi
                    done
                fi
            done
            
            if [ -n "$FAKE_DATA_FOUND" ]; then
                add_result "FAIL" "⚠️  检测到假数据!" "生产环境不应包含假数据:${FAKE_DATA_FOUND}"
            else
                add_result "PASS" "✓ 未发现假数据" "Dashboard 构建版本干净"
            fi
        else
            add_result "WARN" "未找到 Dashboard 相关JS文件" "可能需要重新构建前端"
            
            # 列出所有 JS 文件供参考
            ALL_JS=$(find "${DIST_DIR}/assets" -name "*.js" 2>/dev/null | head -10)
            if [ -n "$ALL_JS" ]; then
                log_verbose "现有JS文件:"
                while IFS= read -r file; do
                    log_verbose "  • $(basename "$file")"
                done <<< "$ALL_JS"
            fi
        fi
    else
        add_result "FAIL" "assets 目录不存在" "前端可能构建不完整"
    fi
    
    # 检查 index.html
    if [ -f "${DIST_DIR}/index.html" ]; then
        add_result "PASS" "index.html 存在" "入口文件正常"
    else
        add_result "FAIL" "index.html 不存在" "前端构建缺失关键文件"
    fi
    
else
    add_result "FAIL" "前端构建目录不存在" "请执行: npm run build 或 npm run build:frontend"
    log_info "提示: 可在项目根目录运行构建命令"
fi

# ============================================================
# 4. API 响应测试
# ============================================================

log_section "4️⃣  API 响应测试"

# 检查 curl 是否可用
if ! check_command curl; then
    add_result "FAIL" "curl 命令不可用" "无法进行 API 测试"
else
    log_info "正在测试 API 端点 (基础URL: ${API_BASE})..."
    
    # 测试 products API
    log_info "测试 Products API..."
    PRODUCTS_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" --connect-timeout 5 --max-time 10 "${API_BASE}/api/v1/products" 2>&1) || true
    PRODUCTS_HTTP_CODE=$(echo "$PRODUCTS_RESPONSE" | grep "HTTP_CODE:" | cut -d':' -f2)
    PRODUCTS_BODY=$(echo "$PRODUCTS_RESPONSE" | grep -v "HTTP_CODE:")
    
    if [ -n "$PRODUCTS_HTTP_CODE" ]; then
        if [ "$PRODUCTS_HTTP_CODE" -eq 200 ] || [ "$PRODUCTS_HTTP_CODE" -eq 201 ]; then
            add_result "PASS" "GET /api/v1/products" "HTTP ${PRODUCTS_HTTP_CODE} OK"
            log_verbose "响应预览: $(echo "$PRODUCTS_BODY" | head -c 200)..."
        elif [ "$PRODUCTS_HTTP_CODE" -eq 401 ] || [ "$PRODUCTS_HTTP_CODE" -eq 403 ]; then
            add_result "WARN" "GET /api/v1/products" "HTTP ${PRODUCTS_HTTP_CODE} (需要认证)"
        else
            add_result "FAIL" "GET /api/v1/products" "HTTP ${PRODUCTS_HTTP_CODE}"
            log_verbose "响应: $(echo "$PRODUCTS_BODY" | head -c 300)"
        fi
    else
        add_result "FAIL" "GET /api/v1/products" "无响应 (服务未启动或网络问题)"
    fi
    
    # 测试 dashboard overview API
    log_info "测试 Dashboard Overview API..."
    DASHBOARD_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" --connect-timeout 5 --max-time 10 "${API_BASE}/api/v1/dashboard/overview" 2>&1) || true
    DASHBOARD_HTTP_CODE=$(echo "$DASHBOARD_RESPONSE" | grep "HTTP_CODE:" | cut -d':' -f2)
    DASHBOARD_BODY=$(echo "$DASHBOARD_RESPONSE" | grep -v "HTTP_CODE:")
    
    if [ -n "$DASHBOARD_HTTP_CODE" ]; then
        if [ "$DASHBOARD_HTTP_CODE" -eq 200 ] || [ "$DASHBOARD_HTTP_CODE" -eq 201 ]; then
            add_result "PASS" "GET /api/v1/dashboard/overview" "HTTP ${DASHBOARD_HTTP_CODE} OK"
            log_verbose "响应预览: $(echo "$DASHBOARD_BODY" | head -c 200)..."
        elif [ "$DASHBOARD_HTTP_CODE" -eq 401 ] || [ "$DASHBOARD_HTTP_CODE" -eq 403 ]; then
            add_result "WARN" "GET /api/v1/dashboard/overview" "HTTP ${DASHBOARD_HTTP_CODE} (需要认证)"
        else
            add_result "FAIL" "GET /api/v1/dashboard/overview" "HTTP ${DASHBOARD_HTTP_CODE}"
            log_verbose "响应: $(echo "$DASHBOARD_BODY" | head -c 300)"
        fi
    else
        add_result "FAIL" "GET /api/v1/dashboard/overview" "无响应 (服务未启动或网络问题)"
    fi
    
    # 测试 categories API
    log_info "测试 Categories API..."
    CATEGORIES_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" --connect-timeout 5 --max-time 10 "${API_BASE}/api/v1/categories" 2>&1) || true
    CATEGORIES_HTTP_CODE=$(echo "$CATEGORIES_RESPONSE" | grep "HTTP_CODE:" | cut -d':' -f2)
    CATEGORIES_BODY=$(echo "$CATEGORIES_RESPONSE" | grep -v "HTTP_CODE:")
    
    if [ -n "$CATEGORIES_HTTP_CODE" ]; then
        if [ "$CATEGORIES_HTTP_CODE" -eq 200 ] || [ "$CATEGORIES_HTTP_CODE" -eq 201 ]; then
            add_result "PASS" "GET /api/v1/categories" "HTTP ${CATEGORIES_HTTP_CODE} OK"
            log_verbose "响应预览: $(echo "$CATEGORIES_BODY" | head -c 200)..."
        elif [ "$CATEGORIES_HTTP_CODE" -eq 401 ] || [ "$CATEGORIES_HTTP_CODE" -eq 403 ]; then
            add_result "WARN" "GET /api/v1/categories" "HTTP ${CATEGORIES_HTTP_CODE} (需要认证)"
        else
            add_result "FAIL" "GET /api/v1/categories" "HTTP ${CATEGORIES_HTTP_CODE}"
            log_verbose "响应: $(echo "$CATEGORIES_BODY" | head -c 300)"
        fi
    else
        add_result "FAIL" "GET /api/v1/categories" "无响应 (服务未启动或网络问题)"
    fi
    
    # 测试健康检查端点 (如果有)
    HEALTH_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" --connect-timeout 3 --max-time 5 "${API_BASE}/health" 2>&1) || true
    HEALTH_HTTP_CODE=$(echo "$HEALTH_RESPONSE" | grep "HTTP_CODE:" | cut -d':' -f2)
    
    if [ -n "$HEALTH_HTTP_CODE" ] && [ "$HEALTH_HTTP_CODE" -eq 200 ]; then
        add_result "PASS" "GET /health" "HTTP ${HEALTH_HTTP_CODE} 服务健康"
    fi
fi

# ============================================================
# 5. PM2 状态检查
# ============================================================

log_section "5️⃣  PM2 进程管理检查"

if check_command pm2; then
    log_info "PM2 状态概览:"
    
    # 获取 PM2 状态
    PM2_STATUS=$(pm2 list 2>&1) || true
    
    if echo "$PM2_STATUS" | grep -q "online\|stopped"; then
        add_result "PASS" "PM2 已安装并运行" "进程管理器正常"
        
        if [ "$QUIET" = false ]; then
            echo "$PM2_STATUS" | head -20
            echo ""
        fi
        
        # 检查是否有 qiguan 相关进程
        if echo "$PM2_STATUS" | grep -qi "qiguan\|ecommerce\|backend"; then
            QIGUAN_PROCESS=$(echo "$PM2_STATUS" | grep -i "qiguan\|ecommerce\|backend" | head -1)
            PROCESS_STATUS=$(echo "$QIGUAN_PROCESS" | awk '{print $9}')
            
            if [ "$PROCESS_STATUS" = "online" ]; then
                add_result "PASS" "绮管后台进程在线" "状态: running"
            elif [ "$PROCESS_STATUS" = "stopped" ]; then
                add_result "FAIL" "绮管后台进程已停止" "请执行: pm2 start index.js"
            else
                add_result "WARN" "绮管后台进程状态异常" "状态: ${PROCESS_STATUS:-unknown}"
            fi
        else
            add_result "WARN" "未发现绮管后台进程" "可能未在 PM2 中注册"
        fi
    else
        add_result "WARN" "PM2 无活动进程" "应用可能以其他方式运行"
    fi
    
    # 检查最近错误日志
    log_info "最近20行错误日志:"
    
    PM2_ERRORS=$(pm2 logs --lines 20 --nostream --err 2>&1) || true
    
    if [ -z "$PM2_ERRORS" ] || echo "$PM2_ERRORS" | grep -q "No stream"; then
        add_result "PASS" "PM2 错误日志" "近期无错误"
    else
        ERROR_LINES=$(echo "$PM2_ERRORS" | grep -i "error\|fail\|exception" | wc -l)
        
        if [ "$ERROR_LINES" -gt 0 ]; then
            add_result "WARN" "PM2 错误日志 (${ERROR_LINES}条)" "建议检查日志详情"
            
            if [ "$VERBOSE" = true ] || [ "$FAILED_TESTS" -gt 0 ]; then
                log_verbose "错误日志摘要:"
                echo "$PM2_ERRORS" | tail -10 | while IFS= read -r line; do
                    log_verbose "  $line"
                done
            fi
        else
            add_result "PASS" "PM2 错误日志" "日志中无明显错误"
        fi
    fi
    
    # PM2 信息
    PM2_VERSION=$(pm2 --version 2>/dev/null || echo "unknown")
    log_verbose "PM2 版本: $PM2_VERSION"
    
else
    add_result "WARN" "PM2 未安装或不在PATH中" "无法检查进程状态"
    log_info "如需使用 PM2, 请执行: npm install -g pm2"
    
    # 尝试检查 Node.js 进程
    if pgrep -f "node.*index.js" > /dev/null 2>&1; then
        add_result "PASS" "Node.js 进程运行中" "(非PM2管理)"
    else
        add_result "WARN" "未检测到 Node.js 应用进程" "服务可能未启动"
    fi
fi

# ============================================================
# 生成诊断报告摘要
# ============================================================

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║         📊 诊断报告摘要                      ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""

# 统计信息
echo -e "${BOLD}统计信息:${NC}"
echo -e "  总测试数: ${TOTAL_TESTS}"
echo -e "  ${GREEN}✓ 通过: ${PASSED_TESTS}${NC}"
echo -e "  ${RED}✗ 失败: ${FAILED_TESTS}${NC}"
echo -e "  ${YELLOW}! 警告: ${WARNING_TESTS}${NC}"
echo ""

# 通过率计算
if [ $TOTAL_TESTS -gt 0 ]; then
    PASS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    echo -e "  通过率: ${PASS_RATE}%"
    echo ""
fi

# 整体评估
echo -e "${BOLD}整体评估:${NC}"

if [ $FAILED_TESTS -eq 0 ] && [ $WARNING_TESTS -eq 0 ]; then
    echo -e "  ${GREEN}🎉 所有检查通过! 系统运行正常.${NC}"
    EXIT_CODE=0
elif [ $FAILED_TESTS -eq 0 ] && [ $WARNING_TESTS -gt 0 ]; then
    echo -e "  ${YELLOW}⚠️  有 ${WARNING_TESTS} 个警告项, 但无严重错误.${NC}"
    echo -e "  ${YELLOW}   建议查看警告详情并进行优化.${NC}"
    EXIT_CODE=1
elif [ $FAILED_TESTS -le 2 ]; then
    echo -e "  ${RED}❌ 发现 ${FAILED_TESTS} 个严重问题, 需要立即修复.${NC}"
    echo -e "  ${RED}   请参考上方 [✗] 标记的项目进行处理.${NC}"
    EXIT_CODE=2
else
    echo -e "  ${RED}🔴 发现 ${FAILED_TESTS} 个严重问题! 系统可能存在重大故障.${NC}"
    echo -e "  ${RED}   强烈建议逐一修复所有失败项后再继续.${NC}"
    EXIT_CODE=3
fi

echo ""

# 失败项汇总
if [ $FAILED_TESTS -gt 0 ]; then
    echo -e "${BOLD}📋 需要关注的问题:${NC}"
    echo "─────────────────────────────────"
    for result in "${RESULTS[@]}"; do
        status=$(echo "$result" | cut -d'|' -f1)
        test_name=$(echo "$result" | cut -d'|' -f2)
        detail=$(echo "$result" | cut -d'|' -f3)
        
        if [ "$status" = "FAIL" ]; then
            echo -e "  ${RED}• ${test_name}${NC}"
            if [ -n "$detail" ] && [ "$VERBOSE" = true ]; then
                echo -e "    ${CYAN}→ ${detail}${NC}"
            fi
        fi
    done
    echo ""
fi

# 建议操作
echo -e "${BOLD}💡 建议操作:${NC}"
echo "─────────────────────────────────"

if [ ! -f "$ENV_FILE" ]; then
    echo -e "  1. 创建 .env 文件: cp .env.example .env && vim .env"
fi

if [ ! -d "$DIST_DIR" ]; then
    echo -e "  2. 构建前端: npm run build:frontend"
fi

if [ $FAILED_TESTS -gt 0 ]; then
    echo -e "  3. 修复上述 ${RED}[✗]${NC} 标记的问题"
fi

if ! check_command pm2; then
    echo -e "  4. 安装 PM2: npm install -g pm2"
fi

echo -e "  5. 查看详细日志: pm2 logs"
echo -e "  6. 重启服务: pm2 restart all"
echo ""

# 结束信息
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}诊断完成时间: $(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo -e "${CYAN}如需帮助, 请查阅 docs/ 目录下的文档${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

exit $EXIT_CODE
