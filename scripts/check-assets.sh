#!/bin/bash
# 资产检查脚本 - 验证HTML引用的所有静态资源是否完整
# 用途: 扫描index.html中的资源引用，验证文件存在性
# 作者: 自动生成
# 日期: 2026-04-14

set -o pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 默认配置
DEFAULT_DIST_PATH="./dist"
DIST_PATH=""
OUTPUT_FORMAT="text"  # text 或 json
JSON_OUTPUT=""

# 统计变量
TOTAL_ASSETS=0
FOUND_ASSETS=0
MISSING_ASSETS=0
ASSET_LIST=()

# 显示帮助信息
show_help() {
    cat << EOF
📦 资产检查工具

用法: $0 [选项]

选项:
    --path <path>        指定dist目录路径 (默认: ${DEFAULT_DIST_PATH})
    --format <format>    输出格式: text|json (默认: text)
    --help               显示帮助信息

示例:
    $0                                    # 使用默认配置检查当前目录的dist
    $0 --path ./build/dist               # 检查指定目录
    $0 --format json                     # 以JSON格式输出（用于CI/CD）
    $0 --path ./dist --format json       # 指定目录并以JSON输出

退出码:
    0 - 所有资源文件都存在
    1 - 存在缺失的资源文件

支持的资源类型:
    - JavaScript 文件 (.js)
    - CSS 样式表 (.css)
    - 图片文件 (.png, .jpg, .jpeg, .gif, .svg, .ico, .webp)
    - 字体文件 (.woff, .woff2, .ttf, .eot, .otf)
    - 其他媒体文件 (.mp4, .webm, .mp3 等)

注意:
    此脚本只检查本地文件系统中的资源存在性
    如需检查远程服务器上的资源，请使用 deploy-verify.sh
EOF
}

# 解析命令行参数
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --path|-p)
                DIST_PATH="$2"
                shift 2
                ;;
            --format|-f)
                OUTPUT_FORMAT="$2"
                if [[ "$OUTPUT_FORMAT" != "text" && "$OUTPUT_FORMAT" != "json" ]]; then
                    echo -e "${RED}❌ 不支持的输出格式: $OUTPUT_FORMAT (支持: text, json)${NC}"
                    exit 1
                fi
                shift 2
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
    DIST_PATH="${DIST_PATH:-$DEFAULT_DIST_PATH}"
}

# 判断资源类型
get_asset_type() {
    local file_path="$1"
    local extension="${file_path##*.}"
    extension=$(echo "$extension" | tr '[:upper:]' '[:lower:]')

    case "$extension" in
        js)
            echo "JavaScript"
            ;;
        css)
            echo "CSS"
            ;;
        png|jpg|jpeg|gif|svg|ico|webp|bmp)
            echo "图片"
            ;;
        woff|woff2|ttf|eot|otf)
            echo "字体"
            ;;
        mp4|webm|ogg|avi|mov)
            echo "视频"
            ;;
        mp3|wav|ogg|flac|aac)
            echo "音频"
            ;;
        json|xml)
            echo "数据"
            ;;
        *)
            echo "其他"
            ;;
    esac
}

# 从HTML中提取所有资源引用
extract_assets_from_html() {
    local html_file="$1"
    local assets=()

    # 检查文件是否存在
    if [ ! -f "$html_file" ]; then
        echo -e "${RED}❌ HTML文件不存在: $html_file${NC}" >&2
        return 1
    fi

    echo -e "${CYAN}📄 正在解析: $html_file${NC}" >&2

    # 提取src属性（script、img、iframe、video、audio、source、embed等）
    local src_assets
    src_assets=$(grep -oE 'src="[^"]*"' "$html_file" 2>/dev/null | sed 's/src="//;s/"//' | grep -v '^data:' | grep -v '^#' || true)

    # 提取href属性（link样式表等）
    local href_assets
    href_assets=$(grep -oE 'href="[^"]*"' "$html_file" 2>/dev/null | sed 's/href="//;s/"//' | grep -E '\.(css|ico|png|jpg|svg)$' || true)

    # 合并所有资源
    all_assets=$(echo -e "$src_assets\n$href_assets" | grep -v '^$' | sort -u || true)

    if [ -z "$all_assets" ]; then
        echo -e "${YELLOW}⚠ 未在HTML中找到任何本地资源引用${NC}" >&2
        return 0
    fi

    # 过滤出本地资源（以/开头或相对路径）
    while IFS= read -r asset; do
        [ -z "$asset" ] && continue

        # 跳过外部URL、data URI、锚点链接
        if [[ "$asset" == http://* ]] || [[ "$asset" == https://* ]] || \
           [[ "$asset" == data:* ]] || [[ "$asset" == \#* ]] || \
           [[ "$asset" == mailto:* ]] || [[ "$asset" == javascript:* ]]; then
            continue
        fi

        # 只保留看起来像静态资源的路径（包含扩展名或在assets目录下）
        if [[ "$asset" == *.* ]] || [[ "$asset" == */assets/* ]] || \
           [[ "$asset" == */static/* ]] || [[ "$asset" == */public/* ]]; then
            assets+=("$asset")
        fi
    done <<< "$all_assets"

    printf '%s\n' "${assets[@]}"
}

# 验证单个资源文件是否存在
verify_asset_exists() {
    local asset_path="$1"
    local full_path=""

    # 构建完整路径
    if [[ "$asset_path" == /* ]]; then
        # 绝对路径（相对于网站根目录）
        full_path="${DIST_PATH}${asset_path}"
    elif [[ "$asset_path" == ./* ]]; then
        # 相对路径
        full_path="${DIST_PATH}/${asset_path#./}"
    else
        # 其他相对路径
        full_path="${DIST_PATH}/${asset_path}"
    fi

    # 规范化路径（处理 .. 和 .）
    full_path=$(cd "$(dirname "$full_path")" && pwd)/$(basename "$full_path" 2>/dev/null || echo "$full_path")

    if [ -f "$full_path" ]; then
        echo "EXISTS|$asset_path|$full_path"
        return 0
    else
        echo "MISSING|$asset_path|$full_path"
        return 1
    fi
}

# 生成文本格式报告
generate_text_report() {
    echo ""
    echo "========================================"
    echo "  📦 资产完整性报告"
    echo "========================================"
    echo ""
    echo -e "📅 时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo -e "📁 目录: ${BLUE}$DIST_PATH${NC}"
    echo ""

    # 分类统计
    local js_count=0 css_count=0 img_count=0 font_count=0 other_count=0
    local js_found=0 css_found=0 img_found=0 font_found=0 other_found=0

    for asset_info in "${ASSET_LIST[@]}"; do
        IFS='|' read -r status asset_path full_path <<< "$asset_info"
        local asset_type
        asset_type=$(get_asset_type "$asset_path")

        TOTAL_ASSETS=$((TOTAL_ASSETS + 1))

        case "$asset_type" in
            "JavaScript")
                js_count=$((js_count + 1))
                [ "$status" = "EXISTS" ] && js_found=$((js_found + 1))
                ;;
            "CSS")
                css_count=$((css_count + 1))
                [ "$status" = "EXISTS" ] && css_found=$((css_found + 1))
                ;;
            "图片")
                img_count=$((img_count + 1))
                [ "$status" = "EXISTS" ] && img_found=$((img_found + 1))
                ;;
            "字体")
                font_count=$((font_count + 1))
                [ "$status" = "EXISTS" ] && font_found=$((font_found + 1))
                ;;
            *)
                other_count=$((other_count + 1))
                [ "$status" = "EXISTS" ] && other_found=$((other_found + 1))
                ;;
        esac

        if [ "$status" = "EXISTS" ]; then
            FOUND_ASSETS=$((FOUND_ASSETS + 1))
        else
            MISSING_ASSETS=$((MISSING_ASSETS + 1))
        fi
    done

    # 输出详细列表
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  📋 资源清单详情"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    local current_type=""
    for asset_info in "${ASSET_LIST[@]}"; do
        IFS='|' read -r status asset_path full_path <<< "$asset_info"
        local asset_type
        asset_type=$(get_asset_type "$asset_path")

        # 类型分组标题
        if [ "$current_type" != "$asset_type" ]; then
            current_type="$asset_type"
            echo -e "${CYAN}▶ $asset_type 资源:${NC}"
        fi

        # 状态图标和颜色
        if [ "$status" = "EXISTS" ]; then
            local file_size
            file_size=$(stat -f%z "$full_path" 2>/dev/null || stat -c%s "$full_path" 2>/dev/null || echo "?")
            echo -e "  ${GREEN}✅${NC} $asset_path (${file_size} bytes)"
        else
            echo -e "  ${RED}❌${NC} $asset_path ${RED}[缺失]${NC}"
        fi
    done

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  📊 统计摘要"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    # 按类型显示统计
    [ $js_count -gt 0 ] && echo -e "  JavaScript: ${GREEN}$js_found${NC}/$js_count"
    [ $css_count -gt 0 ] && echo -e "  CSS:       ${GREEN}$css_found${NC}/$css_count"
    [ $img_count -gt 0 ] && echo -e "  图片:      ${GREEN}$img_found${NC}/$img_count"
    [ $font_count -gt 0 ] && echo -e "  字体:      ${GREEN}$font_found${NC}/$font_count"
    [ $other_count -gt 0 ] && echo -e "  其他:      ${GREEN}$other_found${NC}/$other_count"

    echo ""
    echo "----------------------------------------"
    echo -e "  总计: ${BLUE}$TOTAL_ASSETS${NC} 个资源"
    echo -e "  ${GREEN}✅ 存在: $FOUND_ASSETS${NC}"
    echo -e "  ${RED}❌ 缺失: $MISSING_ASSETS${NC}"

    if [ $TOTAL_ASSETS -gt 0 ]; then
        local success_rate=$((FOUND_ASSETS * 100 / TOTAL_ASSETS))
        echo -e "  完整性: ${success_rate}%"
    fi
    echo "----------------------------------------"
    echo ""

    # 最终结论
    if [ $MISSING_ASSETS -eq 0 ]; then
        if [ $TOTAL_ASSETS -eq 0 ]; then
            echo -e "${YELLOW}⚠️ 未发现需要检查的资源文件${NC}"
        else
            echo -e "${GREEN}✅ 所有资源文件完整！可以安全部署。${NC}"
        fi
        return 0
    else
        echo -e "${RED}❌ 发现 $MISSING_ASSETS 个缺失资源！请检查构建过程。${NC}"

        # 列出所有缺失的资源
        echo ""
        echo -e "${RED}缺失资源列表:${NC}"
        for asset_info in "${ASSET_LIST[@]}"; do
            IFS='|' read -r status asset_path full_path <<< "$asset_info"
            if [ "$status" = "MISSING" ]; then
                echo -e "  ${RED}✗ $asset_path${NC}"
                echo -e "     期望位置: $full_path"
            fi
        done
        return 1
    fi
}

# 生成JSON格式报告（用于CI/CD集成）
generate_json_report() {
    local timestamp
    timestamp=$(date '+%Y-%m-%dT%H:%M:%S')
    local success="true"
    [ $MISSING_ASSETS -gt 0 ] && success="false"

    # 开始构建JSON
    JSON_OUTPUT="{"
    JSON_OUTPUT+="\"timestamp\":\"$timestamp\","
    JSON_OUTPUT+="\"directory\":\"$DIST_PATH\","
    JSON_OUTPUT+="\"success\":$success,"
    JSON_OUTPUT+="\"summary\":{"
    JSON_OUTPUT+="\"total\":$TOTAL_ASSETS,"
    JSON_OUTPUT+="\"found\":$FOUND_ASSETS,"
    JSON_OUTPUT+="\"missing\":$MISSING_ASSETS"

    if [ $TOTAL_ASSETS -gt 0 ]; then
        local success_rate=$((FOUND_ASSETS * 100 / TOTAL_ASSETS))
        JSON_OUTPUT+=",\"successRate\":$success_rate"
    fi

    JSON_OUTPUT+="},"
    JSON_OUTPUT+="\"assets\":["

    local first=true
    for asset_info in "${ASSET_LIST[@]}"; do
        IFS='|' read -r status asset_path full_path <<< "$asset_info"
        local asset_type
        asset_type=$(get_asset_type "$asset_path")
        local exists="false"
        [ "$status" = "EXISTS" ] && exists="true"
        local file_size="null"

        if [ "$exists" = "true" ]; then
            file_size=$(stat -f%z "$full_path" 2>/dev/null || stat -c%s "$full_path" 2>/dev/null || echo "0")
        fi

        [ "$first" = true ] && first=false || JSON_OUTPUT+=","

        JSON_OUTPUT+="{"
        JSON_OUTPUT+="\"path\":\"$asset_path\","
        JSON_OUTPUT+="\"type\":\"$asset_type\","
        JSON_OUTPUT+="\"exists\":$exists,"

        if [ "$exists" = "true" ]; then
            JSON_OUTPUT+="\"size\":$file_size"
        else
            JSON_OUTPUT+="\"expectedPath\":\"$full_path\""
        fi

        JSON_OUTPUT+="}"
    done

    JSON_OUTPUT+="]"
    JSON_OUTPUT+="}"

    # 输出JSON（美化格式）
    echo "$JSON_OUTPUT" | python -m json.tool 2>/dev/null || echo "$JSON_OUTPUT"

    # 返回适当的退出码
    if [ $MISSING_ASSETS -eq 0 ]; then
        return 0
    else
        return 1
    fi
}

# 主函数
main() {
    parse_args "$@"

    # 检查dist目录是否存在
    if [ ! -d "$DIST_PATH" ]; then
        if [ "$OUTPUT_FORMAT" = "json" ]; then
            echo "{\"error\":\"目录不存在: $DIST_PATH\",\"success\":false}"
        else
            echo -e "${RED}❌ 错误: 目录不存在 - $DIST_PATH${NC}"
            echo -e "${YELLOW}提示: 请先运行构建命令生成dist目录${NC}"
        fi
        exit 1
    fi

    # 检查index.html是否存在
    local index_html="$DIST_PATH/index.html"
    if [ ! -f "$index_html" ]; then
        if [ "$OUTPUT_FORMAT" = "json" ]; then
            echo "{\"error\":\"index.html不存在: $index_html\",\"success\":false}"
        else
            echo -e "${RED}❌ 错误: index.html不存在 - $index_html${NC}"
            echo -e "${YELLOW}提示: 请确认构建已正确完成${NC}"
        fi
        exit 1
    fi

    # 根据输出格式显示标题
    if [ "$OUTPUT_FORMAT" = "text" ]; then
        echo "========================================"
        echo "  📦 资产完整性检查工具"
        echo "========================================"
    fi

    # 提取所有资源引用
    local extracted_assets
    extracted_assets=$(extract_assets_from_html "$index_html")

    if [ $? -ne 0 ]; then
        exit 1
    fi

    # 如果没有找到任何资源
    if [ -z "$extracted_assets" ]; then
        if [ "$OUTPUT_FORMAT" = "text" ]; then
            generate_text_report
        else
            ASSET_LIST=()
            generate_json_report
        fi
        exit $?
    fi

    # 验证每个资源
    while IFS= read -r asset; do
        [ -z "$asset" ] && continue
        local result
        result=$(verify_asset_exists "$asset")
        ASSET_LIST+=("$result")
    done <<< "$extracted_assets"

    # 生成报告
    if [ "$OUTPUT_FORMAT" = "text" ]; then
        generate_text_report
    else
        generate_json_report
    fi

    exit $?
}

# 执行主函数
main "$@"
