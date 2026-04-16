#!/bin/bash

# ============================================================
# PM2 进程健康检查与监控脚本
# @version 2.0
# @description 全面的系统监控、健康检查和告警通知
# ============================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置变量
APP_NAME="qimeng-api"
HEALTH_CHECK_URL="http://localhost:3003/api/v1/health"
METRICS_URL="http://localhost:3003/api/v1/health/metrics"
LOG_DIR="./logs"
ERROR_LOG="${LOG_DIR}/pm2-error.log"
OUT_LOG="${LOG_DIR}/pm2-out.log"

# 告警阈值
MAX_MEMORY_MB=512
MAX_CPU_PERCENT=80
MAX_RESTART_COUNT=10
SLOW_REQUEST_THRESHOLD_MS=2000
MIN_UPTIME_SECONDS=60

# 创建日志目录
mkdir -p "${LOG_DIR}"

# 辅助函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# ============================================================
# 1. PM2 进程状态检查
# ============================================================
check_pm2_status() {
    log_info "检查 PM2 进程状态..."
    
    if ! command -v pm2 &> /dev/null; then
        log_error "PM2 未安装！请先执行: npm install -g pm2"
        return 1
    fi
    
    local status_output=$(pm2 list 2>&1)
    
    if echo "$status_output" | grep -q "${APP_NAME}.*online"; then
        log_success "PM2 进程 ${APP_NAME} 运行正常 ✓"
        echo "$status_output" | grep "${APP_NAME}"
        return 0
    elif echo "$status_output" | grep -q "${APP_NAME}.*errored"; then
        log_error "PM2 进程 ${APP_NAME} 处于错误状态 ✗"
        return 1
    elif echo "$status_output" | grep -q "${APP_NAME}.*stopped"; then
        log_error "PM2 进程 ${APP_NAME} 已停止 ✗"
        return 1
    else
        log_warning "未找到进程 ${APP_NAME}"
        return 1
    fi
}

# ============================================================
# 2. HTTP 健康检查
# ============================================================
check_health_endpoint() {
    log_info "检查 HTTP 健康端点..."
    
    local http_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "${HEALTH_CHECK_URL}" 2>/dev/null || echo "000")
    
    if [ "$http_code" -eq 200 ]; then
        log_success "服务健康 (HTTP ${http_code}) ✓"
        
        local health_response=$(curl -s "${HEALTH_CHECK_URL}" 2>/dev/null)
        local db_status=$(echo "$health_response" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
        local uptime=$(echo "$health_response" | grep -o '"uptime":[0-9.]*' | cut -d':' -f2)
        local memory_rss=$(echo "$health_response" | grep -o '"rss":"[^"]*"' | head -1 | cut -d'"' -f4)
        
        echo "  数据库状态: ${db_status:-unknown}"
        echo "  运行时间: ${uptime:-unknown}s"
        echo "  内存使用: ${memory_rss:-unknown}"
        
        return 0
    else
        log_error "服务异常 (HTTP ${http_code}) ✗"
        return 1
    fi
}

# ============================================================
# 3. 性能指标检查
# ============================================================
check_performance_metrics() {
    log_info "获取性能指标..."
    
    local metrics_response=$(curl -s "${METRICS_URL}" 2>/dev/null)
    
    if [ -z "$metrics_response" ]; then
        log_warning "无法获取性能指标（端点可能不可用）"
        return 1
    fi
    
    local total_requests=$(echo "$metrics_response" | grep -o '"totalRequests":[0-9]*' | cut -d':' -f2)
    local error_count=$(echo "$metrics_response" | grep -o '"errorResponses":[0-9]*' | cut -d':' -f2)
    local slow_requests=$(echo "$metrics_response" | grep -o '"slowRequests":[0-9]*' | cut -d':' -f2)
    local heap_used_mb=$(echo "$metrics_response" | grep -o '"heap_used_mb":[0-9]*' | cut -d':' -f2)
    
    echo ""
    echo "📊 性能指标:"
    echo "  总请求数: ${total_requests:-N/A}"
    echo "  错误响应数: ${error_count:-N/A}"
    echo "  慢请求数: ${slow_requests:-N/A}"
    echo "  堆内存使用: ${heap_used_mb:-N/A} MB"
    
    # 内存告警
    if [ -n "$heap_used_mb" ] && [ "$heap_used_mb" -gt "$MAX_MEMORY_MB" ]; then
        log_error "内存使用超过阈值 (${heap_used_mb}MB > ${MAX_MEMORY_MB}MB) ⚠️"
    fi
    
    # 错误率告警
    if [ -n "$total_requests" ] && [ -n "$error_count" ] && [ "$total_requests" -gt 0 ]; then
        local error_rate=$((error_count * 100 / total_requests))
        if [ "$error_rate" -gt 10 ]; then
            log_error "错误率过高 (${error_rate}%) ⚠️"
        fi
    fi
    
    return 0
}

# ============================================================
# 4. 最近错误日志检查
# ============================================================
check_recent_errors() {
    log_info "检查最近错误日志..."
    
    if [ ! -f "${ERROR_LOG}" ]; then
        log_warning "错误日志文件不存在: ${ERROR_LOG}"
        return 0
    fi
    
    local recent_errors=$(tail -n 20 "${ERROR_LOG}" 2>/dev/null || echo "")
    
    if [ -z "$recent_errors" ]; then
        log_success "无最近错误日志 ✓"
        return 0
    fi
    
    local error_count=$(echo "$recent_errors" | wc -l)
    
    if [ "$error_count" -gt 0 ]; then
        echo ""
        echo "❌ 最近 ${error_count} 条错误日志:"
        echo "----------------------------------------"
        echo "$recent_errors" | tail -n 10
        echo "----------------------------------------"
        
        # 检查关键错误模式
        if echo "$recent_errors" | grep -qi "FATAL\|ECONNREFUSED\|ENOMEM\|out of memory"; then
            log_error "发现严重错误，需要立即处理！⚠️"
            return 1
        fi
        
        return 0
    fi
}

# ============================================================
# 5. 系统资源检查
# ============================================================
check_system_resources() {
    log_info "检查系统资源..."
    
    # CPU 使用率
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    
    # 内存使用情况
    local mem_info=$(free -h | grep Mem)
    local total_mem=$(echo "$mem_info" | awk '{print $2}')
    local used_mem=$(echo "$mem_info" | awk '{print $3}')
    local mem_percent=$(echo "$mem_info" | awk '{print $3/$2 * 100}' | cut -d'.' -f1)
    
    # 磁盘使用情况
    local disk_usage=$(df -h / | tail -1 | awk '{print $5}' | cut -d'%' -f1)
    
    echo ""
    echo "💻 系统资源:"
    echo "  CPU 使用率: ${cpu_usage:-N/A}%"
    echo "  内存使用: ${used_mem:-N/A} / ${total_mem:-N/A} (${mem_percent:-N/A}%)"
    echo "  磁盘使用: ${disk_usage:-N/A}%"
    
    # 资源告警
    if [ -n "$cpu_usage" ] && (( $(echo "$cpu_usage > $MAX_CPU_PERCENT" | bc -l) )); then
        log_warning "CPU 使用率过高 (${cpu_usage}%) ⚠️"
    fi
    
    if [ -n "$mem_percent" ] && [ "$mem_percent" -gt 90 ]; then
        log_error "内存使用率过高 (${mem_percent}%) ⚠️"
    fi
    
    if [ -n "$disk_usage" ] && [ "$disk_usage" -gt 90 ]; then
        log_error "磁盘使用率过高 (${disk_usage}%) ⚠️"
    fi
    
    return 0
}

# ============================================================
# 6. PM2 详细信息
# ============================================================
show_pm2_details() {
    log_info "显示 PM2 详细信息..."
    
    pm2 show "${APP_NAME}" 2>/dev/null || log_warning "无法获取详细信息"
}

# ============================================================
# 主函数
# ============================================================
main() {
    echo ""
    echo "=========================================="
    echo "  🎯 绮管电商后台系统监控报告"
    echo "  时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "=========================================="
    echo ""
    
    local overall_status=0
    
    # 执行各项检查
    check_pm2_status || overall_status=1
    echo ""
    
    check_health_endpoint || overall_status=1
    echo ""
    
    check_performance_metrics
    echo ""
    
    check_recent_errors || overall_status=1
    echo ""
    
    check_system_resources
    echo ""
    
    # 显示详细 PM2 信息（可选）
    if [ "$1" = "--verbose" ] || [ "$1" = "-v" ]; then
        show_pm2_details
        echo ""
    fi
    
    # 总结报告
    echo "=========================================="
    if [ $overall_status -eq 0 ]; then
        echo -e "${GREEN}✅ 所有检查通过 - 系统运行正常${NC}"
    else
        echo -e "${RED}❌ 发现问题 - 需要处理${NC}"
        echo ""
        echo "建议操作："
        echo "  1. 查看详细日志: pm2 logs ${APP_NAME} --err"
        echo "  2. 重启服务: pm2 restart ${APP_NAME}"
        echo "  3. 检查配置: cat ecosystem.config.js"
    fi
    echo "=========================================="
    echo ""
    
    return $overall_status
}

# 执行主函数
main "$@"
