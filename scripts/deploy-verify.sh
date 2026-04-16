#!/bin/bash
# 部署验证脚本 - 检查部署后的完整性和正确性
# 用途: 验证静态资源存在性、MIME类型、API连通性等
# 作者: 自动生成
# 日期: 2026-04-14

set -o pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 默认配置
DEFAULT_URL="https://www.qimengzhiyue.cn"
DEFAULT_DIST_PATH="./dist"
VERBOSE=false
URL=""
DIST_PATH=""

# 统计变量
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
TEST_RESULTS=()

# 显示帮助信息
show_help() {
    cat << EOF
🚀 部署验证工具

用法: $0 [选项]

选项:
    --url <url>          指定要测试的URL (默认: ${DEFAULT_URL})
    --dist-path <path>   指定本地dist目录路径 (默认: ${DEFAULT_DIST_PATH})
    --verbose            显示详细输出
    --help               显示帮助信息

示例:
    $0                                    # 使用默认配置验证
    $0 --url https://example.com         # 测试指定URL
    $0 --verbose                         # 显示详细输出
    $0 --dist-path ./build/dist          # 指定dist路径

退出码:
    0 - 所有检查通过
    1 - 存在失败的检查项
EOF
}

# 解析命令行参数
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --url)
                URL="$2"
                shift 2
                ;;
            --dist-path)
                DIST_PATH="$2"
                shift 2
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                echo -e "${RED}❌ 未知参数: $1${NC}"
                show_help
                exit 1
                ;;
        esac
    done

    # 设置默认值
    URL="${URL:-$DEFAULT_URL}"
    DIST_PATH="${DIST_PATH:-$DEFAULT_DIST_PATH}"
}

# 记录测试结果
record_test() {
    local test_name="$1"
    local passed="$2"
    local detail="${3:-}"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    if [ "$passed" = true ]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        TEST_RESULTS+=("✅|$test_name|通过")
        if [ "$VERBOSE" = true ] && [ -n "$detail" ]; then
            echo -e "   ${GREEN}详情: $detail${NC}"
        fi
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        TEST_RESULTS+=("❌|$test_name|失败")
        if [ -n "$detail" ]; then
            echo -e "   ${RED}原因: $detail${NC}"
        fi
    fi
}

# 输出测试状态
print_test_status() {
    local test_num="$1"
    local total="$2"
    local test_name="$3"
    local passed="$4"

    printf "[%d/%d] " "$test_num" "$total"

    if [ "$passed" = true ]; then
        echo -e "${GREEN}✅${NC} $test_name ... ${GREEN}通过${NC}"
    else
        echo -e "${RED}❌${NC} $test_name ... ${RED}失败${NC}"
    fi
}

# 检查1: index.html 存在性检查
check_index_html_exists() {
    local test_num=1
    local total=5
    local test_name="index.html 存在性检查"

    print_test_status "$test_num" "$total" "$test_name" false > /dev/null

    if [ ! -f "$DIST_PATH/index.html" ]; then
        print_test_status "$test_num" "$total" "$test_name" false
        record_test "$test_name" false "文件不存在: $DIST_PATH/index.html"
        return 1
    fi

    # 检查文件大小（至少应该有内容）
    local file_size
    file_size=$(stat -f%z "$DIST_PATH/index.html" 2>/dev/null || stat -c%s "$DIST_PATH/index.html" 2>/dev/null || echo 0)

    if [ "$file_size" -lt 100 ]; then
        print_test_status "$test_num" "$total" "$test_name" false
        record_test "$test_name" false "文件过小 (${file_size} bytes)，可能不完整"
        return 1
    fi

    print_test_status "$test_num" "$total" "$test_name" true
    record_test "$test_name" true "文件大小: ${file_size} bytes"
    return 0
}

# 检查2: 关键JS文件检查
check_js_files() {
    local test_num=2
    local total=5
    local test_name="关键JS文件检查"
    local js_count=0
    local js_found=0
    local missing_files=()

    # 从index.html中提取JS文件引用
    local js_files
    js_files=$(grep -oE 'src="[^"]*\.js"' "$DIST_PATH/index.html" 2>/dev/null | sed 's/src="//;s/"//' || true)

    if [ -z "$js_files" ]; then
        # 如果无法解析，使用默认的关键文件名模式
        js_files=$(find "$DIST_PATH/assets" -name "*.js" -type f 2>/dev/null | head -10 | xargs -I{} basename {} || true)
    fi

    if [ -z "$js_files" ]; then
        print_test_status "$test_num" "$total" "$test_name" false
        record_test "$test_name" false "未找到任何JS文件引用"
        return 1
    fi

    while IFS= read -r js_file; do
        [ -z "$js_file" ] && continue
        js_count=$((js_count + 1))

        # 处理相对路径
        local full_path
        if [[ "$js_file" == /* ]]; then
            full_path="${DIST_PATH}${js_file}"
        elif [[ "$js_file" == ./assets/* ]] || [[ "$js_file" == assets/* ]]; then
            full_path="${DIST_PATH}/${js_file#./}"
        else
            full_path="${DIST_PATH}/assets/${js_file}"
        fi

        if [ -f "$full_path" ]; then
            js_found=$((js_found + 1))
            [ "$VERBOSE" = true ] && echo -e "   ${GREEN}✓${NC} 找到: $js_file"
        else
            missing_files+=("$js_file")
            [ "$VERBOSE" = true ] && echo -e "   ${RED}✗${NC} 缺失: $js_file"
        fi
    done <<< "$js_files"

    if [ $js_found -eq $js_count ] && [ $js_count -gt 0 ]; then
        print_test_status "$test_num" "$total" "$test_name" true
        record_test "$test_name" true "找到 ${js_found}/${js_count} 个JS文件"
        return 0
    else
        print_test_status "$test_num" "$total" "$test_name" false
        record_test "$test_name" false "只找到 ${js_found}/${js_count} 个JS文件，缺失: ${missing_files[*]}"
        return 1
    fi
}

# 检查3: CSS文件检查
check_css_files() {
    local test_num=3
    local total=5
    local test_name="CSS文件检查"
    local css_count=0
    local css_found=0
    local missing_files=()

    # 从index.html中提取CSS文件引用
    local css_files
    css_files=$(grep -oE 'href="[^"]*\.css"' "$DIST_PATH/index.html" 2>/dev/null | sed 's/href="//;s/"//' || true)

    if [ -z "$css_files" ]; then
        # 如果无法解析或没有CSS引用，也算通过（有些项目可能内联CSS）
        print_test_status "$test_num" "$total" "$test_name" true
        record_test "$test_name" true "未找到外部CSS引用（可能使用内联样式）"
        return 0
    fi

    while IFS= read -r css_file; do
        [ -z "$css_file" ] && continue
        css_count=$((css_count + 1))

        # 处理相对路径
        local full_path
        if [[ "$css_file" == /* ]]; then
            full_path="${DIST_PATH}${css_file}"
        elif [[ "$css_file" == ./assets/* ]] || [[ "$css_file" == assets/* ]]; then
            full_path="${DIST_PATH}/${css_file#./}"
        else
            full_path="${DIST_PATH}/assets/${css_file}"
        fi

        if [ -f "$full_path" ]; then
            css_found=$((css_found + 1))
            [ "$VERBOSE" = true ] && echo -e "   ${GREEN}✓${NC} 找到: $css_file"
        else
            missing_files+=("$css_file")
            [ "$VERBOSE" = true ] && echo -e "   ${RED}✗${NC} 缺失: $css_file"
        fi
    done <<< "$css_files"

    if [ $css_found -eq $css_count ] && [ $css_count -gt 0 ]; then
        print_test_status "$test_num" "$total" "$test_name" true
        record_test "$test_name" true "找到 ${css_found}/${css_count} 个CSS文件"
        return 0
    else
        print_test_status "$test_num" "$total" "$test_name" false
        record_test "$test_name" false "只找到 ${css_found}/${css_count} 个CSS文件，缺失: ${missing_files[*]}"
        return 1
    fi
}

# 检查4: MIME类型验证
check_mime_types() {
    local test_num=4
    local total=5
    local test_name="MIME类型验证"
    local mime_checks=0
    local mime_passed=0
    local mime_errors=()
    local has_curl=false

    # 检查curl是否可用
    if command -v curl &> /dev/null; then
        has_curl=true
    else
        print_test_status "$test_num" "$total" "$test_name" false
        record_test "$test_name" false "curl命令不可用，无法进行MIME类型检查"
        return 1
    fi

    # 获取所有资源文件
    local all_resources=""
    all_resources+=$(grep -oE '(src|href)="[^"]*\.(js|css)"' "$DIST_PATH/index.html" 2>/dev/null | sed 's/(src|href)="//;s/"//' || true)

    if [ -z "$all_resources" ]; then
        print_test_status "$test_num" "$total" "$test_name" true
        record_test "$test_name" true "无外部资源需要验证MIME类型"
        return 0
    fi

    while IFS= read -r resource; do
        [ -z "$resource" ] && continue
        mime_checks=$((mime_checks + 1))

        # 构建完整URL
        local resource_url="${URL}${resource}"

        # 获取Content-Type头
        local content_type
        content_type=$(curl -sI "$resource_url" 2>/dev/null | grep -i "^content-type:" | cut -d':' -f2- | tr -d '\r\n' | awk '{print $1}' | tr -d ';')

        if [ -z "$content_type" ]; then
            mime_errors+=("$resource (无响应)")
            continue
        fi

        # 根据文件扩展名验证MIME类型
        local expected_type=""
        if [[ "$resource" == *.js ]]; then
            expected_type="application/javascript"
        elif [[ "$resource" == *.css ]]; then
            expected_type="text/css"
        fi

        if [ -n "$expected_type" ]; then
            if [[ "$content_type" == *"$expected_type"* ]]; then
                mime_passed=$((mime_passed + 1))
                [ "$VERBOSE" = true ] && echo -e "   ${GREEN}✓${NC} $resource -> $content_type"
            else
                # 特别检测是否返回了HTML（404页面等）
                if [[ "$content_type" == *"text/html"* ]]; then
                    mime_errors+=("$resource (返回HTML而非$expected_type，可能404)")
                else
                    mime_errors+=("$resource (期望:$expected_type, 实际:$content_type)")
                fi
            fi
        else
            mime_passed=$((mime_passed + 1)) # 无法判断的类型默认通过
        fi
    done <<< "$all_resources"

    if [ ${#mime_errors[@]} -eq 0 ] && [ $mime_checks -gt 0 ]; then
        print_test_status "$test_num" "$total" "$test_name" true
        record_test "$test_name" true "MIME类型验证通过 (${mime_passed}/${mime_checks})"
        return 0
    else
        print_test_status "$test_num" "$total" "$test_name" false
        record_test "$test_name" false "MIME类型错误: ${mime_errors[*]} (${mime_passed}/${mime_checks} 通过)"
        return 1
    fi
}

# 检查5: API连通性和HTML完整性测试
check_api_connectivity() {
    local test_num=5
    local total=5
    local test_name="API连通性测试"
    local has_curl=false
    local api_errors=()

    # 检查curl是否可用
    if ! command -v curl &> /dev/null; then
        print_test_status "$test_num" "$total" "$test_name" false
        record_test "$test_name" false "curl命令不可用"
        return 1
    fi

    # 测试主域名可访问性
    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 --max-time 30 "$URL" 2>/dev/null)

    if [ -z "$http_code" ] || [ "$http_code" = "000" ]; then
        api_errors+=("主域名不可达")
    elif [ "$http_code" != "200" ] && [ "$http_code" != "304" ]; then
        api_errors+=("主域名返回HTTP $http_code")
    else
        [ "$VERBOSE" = true ] && echo -e "   ${GREEN}✓${NC} 主域名响应正常 (HTTP $http_code)"
    fi

    # 获取HTML内容并验证结构
    local html_content
    html_content=$(curl -s --connect-timeout 10 --max-time 30 "$URL" 2>/dev/null)

    if [ -z "$html_content" ]; then
        api_errors+=("无法获取HTML内容")
    else
        # 检查基本HTML结构
        if ! echo "$html_content" | grep -qi "<html"; then
            api_errors+=("HTML结构不完整：缺少<html标签")
        else
            [ "$VERBOSE" = true ] && echo -e "   ${GREEN}✓${NC} HTML结构正常"
        fi

        # 检查是否有app挂载点（Vue/React应用）
        if echo "$html_content" | grep -q 'id="app"'; then
            [ "$VERBOSE" = true ] && echo -e "   ${GREEN}✓${NC} 找到应用挂载点 id='app'"
        elif echo "$html_content" | grep -q 'id="root"'; then
            [ "$VERBOSE" = true ] && echo -e "   ${GREEN}✓${NC} 找到应用挂载点 id='root'"
        else
            # 这不是错误，只是警告
            [ "$VERBOSE" = true ] && echo -e "   ${YELLOW}⚠${NC} 未找到常见应用挂载点"
        fi

        # 检查是否有基本的meta标签
        if echo "$html_content" | grep -qi "<meta"; then
            [ "$VERBOSE" = true ] && echo -e "   ${GREEN}✓${NC} 包含meta标签"
        fi
    fi

    # 测试健康检查端点（如果有的话）
    local health_url="${URL%/}/api/health"
    local health_code
    health_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 --max-time 10 "$health_url" 2>/dev/null)

    if [ -n "$health_code" ] && [ "$health_code" != "000" ]; then
        [ "$VERBOSE" = true ] && echo -e "   ${GREEN}✓${NC} 健康检查端点可达 (HTTP $health_code)"
    else
        [ "$VERBOSE" = true ] && echo -e "   ${YELLOW}⚠${NC} 健康检查端点不可达（可选）"
    fi

    if [ ${#api_errors[@]} -eq 0 ]; then
        print_test_status "$test_num" "$total" "$test_name" true
        record_test "$test_name" true "所有连接测试通过"
        return 0
    else
        print_test_status "$test_num" "$total" "$test_name" false
        record_test "$test_name" false "${api_errors[*]}"
        return 1
    fi
}

# 生成最终报告
generate_report() {
    local success_rate=0
    if [ $TOTAL_TESTS -gt 0 ]; then
        success_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    fi

    echo ""
    echo "========================================"
    echo "  📊 结果汇总"
    echo "========================================"
    echo -e "总测试数: ${BLUE}$TOTAL_TESTS${NC}"
    echo -e "通过: ${GREEN}$PASSED_TESTS${NC} ❌ 失败: ${RED}$FAILED_TESTS${NC}"
    echo -e "成功率: ${success_rate}%"
    echo ""

    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}✅ 所有检查通过！部署成功。${NC}"
    else
        echo -e "${RED}❌ 发现 $FAILED_TESTS 个问题，请检查上方详细信息。${NC}"
        echo ""
        echo -e "${YELLOW}失败项目:${NC}"
        for result in "${TEST_RESULTS[@]}"; do
            IFS='|' read -r icon name status <<< "$result"
            if [ "$icon" = "❌" ]; then
                echo -e "  ${RED}$icon $name - $status${NC}"
            fi
        done
    fi
    echo "========================================"
    echo ""

    # 返回适当的退出码
    if [ $FAILED_TESTS -eq 0 ]; then
        return 0
    else
        return 1
    fi
}

# 主函数
main() {
    parse_args "$@"

    echo "========================================"
    echo "  🚀 部署验证报告"
    echo "========================================"
    echo ""
    echo -e "📅 时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo -e "🌐 目标: ${BLUE}$URL${NC}"
    echo -e "📁 本地路径: ${DIST_PATH}"
    echo ""

    # 执行所有检查
    check_index_html_exists
    check_js_files
    check_css_files
    check_mime_types
    check_api_connectivity

    # 生成最终报告并返回退出码
    generate_report
    exit $?
}

# 执行主函数
main "$@"
