#!/bin/bash

# ============================================================
# 绮管电商后台 - 部署日志分析工具
# ============================================================
# 功能:
#   - 解析 deploy.log 日志文件
#   - 统计部署成功率/失败率
#   - 显示最近10次部署记录
#   - 分析平均部署时间
#   - 识别常见错误模式
#   - 生成简洁的报告输出
#
# 用法:
#   bash scripts/analyze_logs.sh [选项]
#
# 选项:
#   -h, --help          显示帮助信息
#   -s, --summary       显示部署统计摘要 (默认)
#   -r, --recent        显示最近N次部署记录
#   -e, --errors        分析错误模式
#   -t, --time          分析部署耗时趋势
#   -d, --detailed      详细报告 (包含所有信息)
#   --export FILE       导出报告到文件
#   --since DATE        分析指定日期之后的日志
#   --limit N           限制显示的记录数 (默认: 10)
#
# 示例:
#   bash scripts/analyze_logs.sh                  # 基本摘要
#   bash scripts/analyze_logs.sh -r               # 最近部署
#   bash scripts/analyze_logs.sh -e               # 错误分析
#   bash scripts/analyze_logs.sh -d               # 详细报告
#   bash scripts/analyze_logs.sh --export report.txt  # 导出报告
#
# 输出文件:
#   /var/log/qiguan/deploy.log        # 部署汇总日志
#   /var/log/qiguan/deploy/           # 单次部署详细日志
#   /var/log/qiguan/rollback.log     # 回滚日志
#   /var/log/qiguan/notification.log  # 通知日志
#
# 作者: 绮管技术团队
# 日期: 2026-04-08
# 版本: v1.0
# ============================================================

set -e

# ==================== 配置区 ====================
LOG_DIR="/var/log/qiguan/deploy"
DEPLOY_LOG="/var/log/qiguan/deploy.log"
ROLLBACK_LOG="/var/log/qiguan/rollback.log"
NOTIFICATION_LOG="/var/log/qiguan/notification.log"
DATE_FORMAT='+%Y-%m-%d %H:%M:%S'
DEFAULT_LIMIT=10
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

# ==================== 全局变量 ===================
ACTION="summary"
EXPORT_FILE=""
SINCE_DATE=""
LIMIT=$DEFAULT_LIMIT
# ================================================

# ==================== 工具函数 ====================

# 显示帮助信息
show_help() {
    cat << EOF
${BOLD}绮管电商后台 - 部署日志分析工具${NC}

${CYAN}用法:${NC}
    $0 [选项]

${CYAN}选项:${NC}
    -h, --help          显示此帮助信息
    -s, --summary       显示部署统计摘要 (默认模式)
    -r, --recent N      显示最近N次部署记录 (默认: 10)
    -e, --errors        分析常见错误模式
    -t, --time          分析部署耗时趋势和性能
    -d, --detailed      生成完整详细报告
    --export FILE       导出分析报告到指定文件
    --since DATE        仅分析指定日期后的日志 (格式: YYYY-MM-DD)
    --limit N           限制显示条数 (默认: ${DEFAULT_LIMIT})

${CYAN}示例:${NC}
    $0                              # 快速查看部署统计
    $0 -r 20                        # 查看最近20次部署
    $0 -e                           # 分析错误原因
    $0 -t                           # 查看部署耗时趋势
    $0 -d                           # 完整详细报告
    $0 -s --export report_$(date +%Y%m%d).txt  # 导出今日报告
    $0 --since 2026-04-01            # 分析本月数据

${CYAN}输出说明:${NC}
    • 成功率 = 成功次数 / 总次数 × 100%
    • 平均耗时 = 所有成功部署的总耗时 / 成功次数
    • P95/P99 耗时 = 排除最快5%/1%后的最慢耗时

${CYAN}作者:${NC} 绮管技术团队
${CYAN}日期:${NC} 2026-04-08
EOF
    exit 0
}

# 日志函数 (支持导出到文件)
log_output() {
    local message="$1"
    
    # 输出到控制台
    echo -e "$message"
    
    # 如果设置了导出文件，同时写入文件
    if [ -n "$EXPORT_FILE" ]; then
        # 移除ANSI颜色代码后写入
        echo -e "$message" | sed 's/\x1b\[[0-9;]*m//g' >> "$EXPORT_FILE"
    fi
}

# 格式化数字 (添加千位分隔符)
format_number() {
    printf "%'d" "$1" 2>/dev/null || echo "$1"
}

# 计算百分比
calc_percentage() {
    local part=$1
    local total=$2
    
    if [ "$total" -eq 0 ] 2>/dev/null; then
        echo "0.0"
        return
    fi
    
    awk "BEGIN {printf \"%.1f\", ($part / $total) * 100}"
}
# ================================================

# ==================== 数据收集函数 ====================

# 收集所有部署记录
collect_deployments() {
    local deployments=()
    
    if [ ! -f "$DEPLOY_LOG" ]; then
        log_output "${RED}部署日志文件不存在: ${DEPLOY_LOG}${NC}"
        return 1
    fi
    
    # 解析日志文件，提取关键信息
    while IFS= read -r line; do
        if [[ "$line" =~ \[SUCCESS\].*部署完成 ]] || \
           [[ "$line" =~ \[ERROR\].*部署失败 ]]; then
            
            local timestamp=$(echo "$line" | grep -o '\[20[0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]\]' | tr -d '[]')
            local status="unknown"
            
            if [[ "$line" =~ 部署完成 ]]; then
                status="success"
            elif [[ "$line" =~ 部署失败 ]]; then
                status="failure"
            fi
            
            deployments+=("${timestamp}|${status}")
        fi
    done < "$DEPLOY_LOG"
    
    echo "${deployments[@]}"
}

# 收集最近N次部署的详细信息
get_recent_deployments() {
    local count=${1:-$LIMIT}
    
    if [ ! -f "$DEPLOY_LOG" ]; then
        return 1
    fi
    
    # 获取最近的部署记录
    grep -E "(部署完成|部署失败)" "$DEPLOY_LOG" | tail -$count
}

# 提取部署耗时
extract_durations() {
    local durations=()
    
    if [ ! -f "$DEPLOY_LOG" ]; then
        return 1
    fi
    
    # 查找包含耗时的行
    while IFS= read -r line; do
        if [[ "$line" =~ 部署耗时.*([0-9]+)分([0-9]+)秒 ]]; then
            local minutes=${BASH_REMATCH[1]}
            local seconds=${BASH_REMATCH[2]}
            local total_seconds=$((minutes * 60 + seconds))
            durations+=("$total_seconds")
        elif [[ "$line" =~ 部署耗时.*([0-9]+)秒 ]]; then
            durations+=("${BASH_REMATCH[1]}")
        fi
    done < <(grep "部署耗时" "$DEPLOY_LOG")
    
    echo "${durations[@]}"
}

# 收集错误信息
collect_errors() {
    local errors=()
    
    if [ ! -f "$DEPLOY_LOG" ]; then
        return 1
    fi
    
    # 提取错误信息
    while IFS= read -r line; do
        if [[ "$line" =~ \[ERROR\] ]]; then
            errors+=("$line")
        fi
    done < "$DEPLOY_LOG"
    
    echo "${errors[@]}"
}
# ================================================

# ==================== 分析函数 ====================

# 生成统计摘要
show_summary() {
    log_output ""
    log_output "${BOLD}${PURPLE}╔════════════════════════════════════════╗${NC}"
    log_output "${BOLD}{PURPLE}║     绮管电商后台 - 部署统计摘要         ║${NC}"
    log_output "${BOLD}{PURPLE}╚════════════════════════════════════════╝${NC}"
    log_output ""
    
    # 检查日志文件是否存在
    if [ ! -f "$DEPLOY_LOG" ]; then
        log_output "${RED}❌ 部署日志文件不存在${NC}"
        log_output "${CYAN}路径: ${DEPLOY_LOG}${NC}"
        log_output "${YELLOW}提示: 请先执行至少一次部署以生成日志${NC}"
        return 1
    fi
    
    # 基本统计
    local total_lines=$(wc -l < "$DEPLOY_LOG" 2>/dev/null || echo 0)
    local success_count=$(grep -c "部署完成" "$DEPLOY_LOG" 2>/dev/null || echo 0)
    local failure_count=$(grep -c "部署失败" "$DEPLOY_LOG" 2>/dev/null || echo 0)
    local total_deploys=$((success_count + failure_count))
    
    # 计算成功率
    local success_rate=$(calc_percentage $success_count $total_deploys)
    local failure_rate=$(calc_percentage $failure_count $total_deploys)
    
    # 时间范围
    local first_entry=$(head -1 "$DEPLOY_LOG" 2>/dev/null | grep -o '\[20[0-9][0-9]-[0-9][0-9]-[0-9][0-9]' | tr -d '[' || echo "未知")
    local last_entry=$(tail -1 "$DEPLOY_LOG" 2>/dev/null | grep -o '\[20[0-9][0-9]-[0-9][0-9]-[0-9][0-9]' | tr -d '[' || echo "未知")
    
    # 输出基本统计
    log_output "${BOLD}${CYAN}📊 基本统计${NC}"
    log_output "─────────────────────────────────────"
    printf "  %-20s %s\n" "总部署次数:" "$(format_number $total_deploys)"
    printf "  %-20s ${GREEN}%s${NC}\n" "成功次数:" "$(format_number $success_count) ✓"
    printf "  %-20s ${RED}%s${NC}\n" "失败次数:" "$(format_number $failure_count) ✗"
    printf "  %-20s %s\n" "成功率:" "${success_rate}%"
    printf "  %-20s %s\n" "失败率:" "${failure_rate}%"
    printf "  %-20s %s\n" "日志总行数:" "$(format_number $total_lines)"
    log_output ""
    
    # 时间范围
    log_output "${BOLD}${CYAN}📅 时间范围${NC}"
    log_output "─────────────────────────────────────"
    printf "  %-20s %s\n" "首次部署:" "${first_entry}"
    printf "  %-20s %s\n" "最近部署:" "${last_entry}"
    log_output ""
    
    # 状态指示器
    log_output "${BOLD}${CYAN}📈 当前状态${NC}"
    log_output "─────────────────────────────────────"
    
    if [ "$total_deploys" -eq 0 ]; then
        log_output "  ${YELLOW}⚠️  暂无部署记录${NC}"
    elif [ $(echo "$success_rate >= 90" | bc -l 2>/dev/null || echo 0) -eq 1 ]; then
        log_output "  ${GREEN}✅ 优秀 - 成功率超过90%${NC}"
    elif [ $(echo "$success_rate >= 70" | bc -l 2>/dev/null || echo 0) -eq 1 ]; then
        log_output "  ${YELLOW}⚠️  一般 - 成功率在70%-90%之间${NC}"
    else
        log_output "  ${RED}❌ 需要关注 - 成功率低于70%${NC}"
    fi
    log_output ""
    
    # 最近状态 (连续成功/失败)
    local recent_status=$(tail -20 "$DEPLOY_LOG" 2>/dev/null | grep -E "(部署完成|部署失败)" | tail -1)
    if [[ "$recent_status" =~ 部署完成 ]]; then
        log_output "  ${GREEN}✅ 最近一次部署: 成功${NC}"
    elif [[ "$recent_status" =~ 部署失败 ]]; then
        log_output "  ${RED}✗ 最近一次部署: 失败${NC}"
    else
        log_output "  ${YELLOW}- 最近一次部署: 未知${NC}"
    fi
    log_output ""
}

# 显示最近部署记录
show_recent() {
    local count=${1:-$LIMIT}
    
    log_output ""
    log_output "${BOLD}${CYAN}━━━ 最近 ${count} 次部署记录 ━━━${NC}"
    log_output ""
    
    local recent_logs=$(get_recent_deployments $count)
    
    if [ -z "$recent_logs" ]; then
        log_output "${YELLOW}暂无部署记录${NC}"
        return
    fi
    
    # 表头
    printf "${BOLD}%-22s %-12s %-50s${NC}\n" "时间" "状态" "详情"
    log_output "──────────────────────────────────────────────────────────────────────"
    
    # 显示记录
    echo "$recent_logs" | while IFS= read -r line; do
        local timestamp=$(echo "$line" | grep -o '\[20[0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]\]' | tr -d '[]')
        local message=$(echo "$line" | sed 's/.*\] //')
        
        local status_icon=""
        local status_color=""
        
        if [[ "$message" =~ 部署完成 ]]; then
            status_icon="✅"
            status_color=$GREEN
        elif [[ "$message" =~ 部署失败 ]]; then
            status_icon="❌"
            status_color=$RED
        else
            status_icon="ℹ️"
            status_color=$BLUE
        fi
        
        # 截断过长的消息
        local display_msg="${message:0:47}"
        
        printf "%-22s ${status_color}%-12s${NC} %s\n" "${timestamp:-N/A}" "$status_icon" "$display_msg"
    done
    
    log_output ""
}

# 分析错误模式
analyze_errors() {
    log_output ""
    log_output "${BOLD}${RED}━━━ 错误模式分析 ━━━${NC}"
    log_output ""
    
    local error_lines=$(collect_errors)
    
    if [ -z "$error_lines" ]; then
        log_output "${GREEN}🎉 太棒了！未发现任何错误记录${NC}"
        return 0
    fi
    
    # 统计各类错误
    declare -A error_categories
    local total_errors=0
    
    for line in $error_lines; do
        # 分类错误类型
        local category="其他"
        
        if [[ "$line" =~ npm.*install.*失败|npm.*install.*超时 ]]; then
            category="npm安装失败"
        elif [[ "$line" =~ 构建.*失败|构建.*超时|build.*fail ]]; then
            category="项目构建失败"
        elif [[ "$line" =~ PM2.*失败|服务启动失败|pm2.*start ]]; then
            category="PM2服务异常"
        elif [[ "$line" =~ Node.js|node.*版本|NODE ]]; then
            category="Node.js环境问题"
        elif [[ "$line" =~ 磁盘空间|磁盘不足|disk.*space ]]; then
            category="磁盘空间不足"
        elif [[ "$line" =~ 内存|memory|MEM ]]; then
            category="内存不足"
        elif [[ "$line" =~ .env|环境变量|ENV ]]; then
            category="环境配置问题"
        elif [[ "$line" =~ 端口|port|PORT.*占用 ]]; then
            category="端口冲突"
        elif [[ "$line" =~ 权限|permission|Permission ]]; then
            category="权限问题"
        elif [[ "$line" =~ 网络|network|连接|connection ]]; then
            category="网络连接问题"
        elif [[ "$line" =~ Git|git.*checkout|检出 ]]; then
            category="Git操作失败"
        fi
        
        if [ -n "${error_categories[$category]}" ]; then
            error_categories[$category]=$((${error_categories[$category]} + 1))
        else
            error_categories[$category]=1
        fi
        
        total_errors=$((total_errors + 1))
    done
    
    # 输出错误分类统计
    log_output "${BOLD}错误分类统计 (共 ${total_errors} 条错误):${NC}"
    log_output ""
    
    # 按数量排序输出
    for category in "${!error_categories[@]}"; do
        echo "${error_categories[$category]}|$category"
    done | sort -rn | while IFS='|' read - count category; do
        local percentage=$(calc_percentage $count $total_errors)
        printf "  ${RED}•${NC} %-25s %4d 次 (%5.1f%%)\n" "$category" "$count" "$percentage"
    done
    
    log_output ""
    
    # 显示最常见的错误 (前5条)
    log_output "${BOLD}${YELLOW}最常见的错误示例 (Top 5):${NC}"
    log_output ""
    
    # 提取唯一错误并计数
    echo "$error_lines" | sort | uniq -c | sort -rn | head -5 | while read count line; do
        local error_msg=$(echo "$line" | sed 's/\[.*\] \[ERROR\] //' | cut -c1-80)
        printf "  ${RED}[%dx]${NC} %s\n" "$count" "$error_msg"
    done
    
    log_output ""
    
    # 改进建议
    log_output "${BOLD}${CYAN}💡 改进建议:${NC}"
    log_output ""
    
    if [ -n "${error_categories[npm安装失败]}" ]; then
        log_output "  • npm安装失败频繁, 建议:"
        log_output "    - 检查网络连接和镜像源配置"
        log_output "    - 使用 npm cache clean 清理缓存"
        log_output "    - 考虑使用 package-lock.json 锁定版本"
    fi
    
    if [ -n "${error_categories[项目构建失败]}" ]; then
        log_output "  • 构建失败较多, 建议:"
        log_output "    - 在本地先运行 npm run build 测试"
        log_output "    - 检查 TypeScript/编译错误"
        log_output "    - 查看 CI/CD 的构建日志获取详细信息"
    fi
    
    if [ -n "${error_categories[PM2服务异常]}" ]; then
        log_output "  • PM2服务异常, 建议:"
        log_output "    - 运行 pm2 logs 查看详细错误"
        log_output "    - 检查 ecosystem.config.js 配置"
        log_output "    - 确认端口未被占用"
    fi
    
    if [ -n "${error_categories[磁盘空间不足]}" ] || [ -n "${error_categories[内存不足]}" ]; then
        log_output "  • 资源不足, 建议:"
        log_output "    - 清理不必要的文件和旧日志"
        log_output "    - 升级服务器配置或优化应用"
        log_output "    - 设置磁盘/内存监控告警"
    fi
    log_output ""
}

# 分析部署耗时
analyze_time() {
    log_output ""
    log_output "${BOLD}${CYAN}━━━ 部署耗时分析 ━━━${NC}"
    log_output ""
    
    local durations_raw=$(extract_durations)
    
    if [ -z "$durations_raw" ]; then
        log_output "${YELLOW}暂无足够的耗时数据${NC}"
        log_output "${CYAN}提示: 至少需要1次成功的部署记录${NC}"
        return 1
    fi
    
    # 将时长转换为数组
    local durations=($durations_raw)
    local count=${#durations[@]}
    
    # 排序 (用于计算百分位数)
    local sorted_durations=$(printf '%s\n' "${durations[@]}" | sort -n)
    
    # 计算统计数据
    local total_time=0
    for dur in "${durations[@]}"; do
        total_time=$((total_time + dur))
    done
    
    local avg_time=$((total_time / count))
    local min_time=$(echo "$sorted_durations" | head -1)
    local max_time=$(echo "$sorted_durations" | tail -1)
    
    # 计算P95和P99
    local p95_index=$((count * 95 / 100))
    local p99_index=$((count * 99 / 100))
    local p95_time=$(echo "$sorted_durations" | sed -n "$((p95_index + 1))p")
    local p99_time=$(echo "$sorted_durations" | sed -n "$((p99_index + 1))p")
    
    # 格式化时间显示
    format_time() {
        local seconds=$1
        if [ $seconds -ge 3600 ]; then
            printf "%dh%dm%ds" $((seconds/3600)) $(((seconds%3600)/60)) $((seconds%60))
        elif [ $seconds -ge 60 ]; then
            printf "%dm%ds" $((seconds/60)) $((seconds%60))
        else
            printf "%ds" $seconds
        fi
    }
    
    # 输出统计数据
    log_output "${BOLD}基于最近 ${count} 次成功部署:${NC}"
    log_output ""
    printf "  %-20s %s\n" "平均耗时:" "$(format_time $avg_time)"
    printf "  %-20s %s\n" "最短耗时:" "${GREEN}$(format_time $min_time)${NC}"
    printf "  %-20s %s\n" "最长耗时:" "${RED}$(format_time $max_time)${NC}"
    printf "  %-20s %s\n" "P95 耗时:" "$(format_time $p95_time)"
    printf "  %-20s %s\n" "P99 耗时:" "$(format_time $p99_time)"
    printf "  %-20s %s\n" "总耗时:" "$(format_time $total_time)"
    log_output ""
    
    # 性能评估
    log_output "${BOLD}${CYAN}📊 性能评估:${NC}"
    log_output ""
    
    if [ $avg_time -le 120 ]; then
        log_output "  ${GREEN}✅ 优秀 - 平均部署时间 ≤ 2分钟${NC}"
    elif [ $avg_time -le 300 ]; then
        log_output "  ${YELLOW}⚠️  良好 - 平均部署时间在 2-5 分钟${NC}"
    elif [ $avg_time -le 600 ]; then
        log_output "  ${YELLOW}! 一般 - 平均部署时间在 5-10 分钟${NC}"
    else
        log_output "  ${RED}❌ 需要优化 - 平均部署时间 > 10分钟${NC}"
    fi
    
    # 目标对比
    log_output ""
    log_output "${BOLD}${CYAN}🎯 与目标值对比 (目标: <30秒回滚, <5分钟部署):${NC}"
    log_output ""
    
    if [ $avg_time -le 300 ]; then
        log_output "  ${GREEN}✅ 达到部署时间目标 (<5分钟)${NC}"
    else
        log_output "  ${RED}✗ 未达到部署时间目标${NC}"
        log_output "    建议: 优化依赖安装、增量构建、并行处理等"
    fi
    log_output ""
    
    # 趋势分析 (简单版: 对比前半段和后半段的平均值)
    if [ $count -ge 6 ]; then
        local half=$((count / 2))
        local first_half_avg=0
        local second_half_avg=0
        
        for ((i=0; i<half; i++)); do
            first_half_avg=$((first_half_avg + durations[i]))
        done
        first_half_avg=$((first_half_avg / half))
        
        for ((i=half; i<count; i++)); do
            second_half_avg=$((second_half_avg + durations[i]))
        done
        second_half_avg=$((second_half_avg + (count - half)))
        second_half_avg=$((second_half_avg / (count - half)))
        
        log_output "${BOLD}${CYAN}📈 趋势分析:${NC}"
        log_output ""
        
        local diff=$((second_half_avg - first_half_avg))
        if [ $diff -lt -30 ]; then
            log_output "  ${GREEN}↑ 性能提升中 (近期比早期快 ${#diff}秒)${NC}"
        elif [ $diff -gt 30 ]; then
            log_output "  ${RED}↓ 性能下降 (近期比早期慢 ${diff}秒)${NC}"
            log_output "    可能原因: 代码量增加、依赖增多、资源竞争"
        else
            log_output "  ${BLUE}→ 性能稳定 (变化在正常范围内)${NC}"
        fi
        log_output ""
    fi
}

# 生成完整详细报告
show_detailed_report() {
    # 初始化导出文件 (如果指定了)
    if [ -n "$EXPORT_FILE" ]; then
        echo "# 绮管电商后台 - 部署日志分析报告" > "$EXPORT_FILE"
        echo "# 生成时间: $(date "$DATE_FORMAT")" >> "$EXPORT_FILE"
        echo "# ==============================================" >> "$EXPORT_FILE"
        echo "" >> "$EXPORT_FILE"
    fi
    
    show_summary
    show_recent $LIMIT
    analyze_errors
    analyze_time
    
    # 回滚历史 (如果有)
    if [ -f "$ROLLBACK_LOG" ] && [ -s "$ROLLBACK_LOG" ]; then
        log_output ""
        log_output "${BOLD}${YELLOW}━━━ 最近回滚操作 ━━━${NC}"
        log_output ""
        tail -10 "$ROLLBACK_LOG" | while IFS= read -r line; do
            log_output "  $line"
        done
        log_output ""
    fi
    
    # 文件信息
    log_output "${BOLD}${CYAN}📁 日志文件信息:${NC}"
    log_output ""
    printf "  %-25s %s\n" "部署汇总日志:" "$DEPLOY_LOG"
    printf "  %-25s %s\n" "部署详细目录:" "$LOG_DIR"
    printf "  %-25s %s\n" "回滚日志:" "$ROLLBACK_LOG"
    printf "  %-25s %s\n" "通知日志:" "$NOTIFICATION_LOG"
    
    if [ -d "$LOG_DIR" ]; then
        local log_files=$(ls -1 "$LOG_DIR"/*.log 2>/dev/null | wc -l)
        local total_size=$(du -sh "$LOG_DIR" 2>/dev/null | awk '{print $1}')
        printf "  %-25s %s\n" "详细日志数量:" "$log_files 个文件"
        printf "  %-25s %s\n" "日志总大小:" "$total_size"
    fi
    log_output ""
    
    if [ -n "$EXPORT_FILE" ]; then
        log_output "${GREEN}✅ 报告已导出到: ${EXPORT_FILE}${NC}"
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
            -s|--summary)
                ACTION="summary"
                shift
                ;;
            -r|--recent)
                ACTION="recent"
                if [[ "$2" =~ ^[0-9]+$ ]]; then
                    LIMIT="$2"
                    shift 2
                else
                    shift
                fi
                ;;
            -e|--errors)
                ACTION="errors"
                shift
                ;;
            -t|--time)
                ACTION="time"
                shift
                ;;
            -d|--detailed)
                ACTION="detailed"
                shift
                ;;
            --export)
                EXPORT_FILE="$2"
                shift 2
                ;;
            --since)
                SINCE_DATE="$2"
                shift 2
                ;;
            --limit)
                LIMIT="$2"
                shift 2
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
    echo -e "${BOLD}{PURPLE}║   绮管电商后台 - 部署日志分析工具      ║${NC}"
    echo -e "${BOLD}{PURPLE}╚════════════════════════════════════════╝${NC}"
    echo -e "${CYAN}分析时间: $(date "$DATE_FORMAT")${NC}"
    echo -e "${CYAN}日志路径: ${DEPLOY_LOG}${NC}"
    echo ""
    
    # 根据action执行不同操作
    case $ACTION in
        "summary")
            show_summary
            ;;
        "recent")
            show_recent $LIMIT
            ;;
        "errors")
            analyze_errors
            ;;
        "time")
            analyze_time
            ;;
        "detailed")
            show_detailed_report
            ;;
    esac
    
    echo ""
    echo -e "${CYAN}提示: 使用 -h 参数查看更多选项和分析功能${NC}"
    echo ""
}

# 执行主函数
main "$@"
