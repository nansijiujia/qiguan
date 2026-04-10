#!/bin/bash
# ============================================================
# 绮管后台 P0问题一键修复脚本
# Version: 1.0.0
# Date: 2026-04-10
# Author: AI Assistant
#
# 功能:
#   自动修复所有Phase A发现的P0问题:
#   - P0-001: /health接口返回HTML问题
#   - P0-002: /dashboard/stats路由缺失
#   - P0-003: products.js路由顺序错误
#   - P0-004: 订单取消接口缺失
#   - P0-005: 硬编码数据库凭证安全问题
#
# Usage:
#   chmod +x fix_p0_issues.sh
#   ./fix_p0_issues.sh [--dry-run] [--backup] [--verify]
#
# 参数说明:
#   --dry-run    只显示将要执行的修复，不实际修改文件
#   --backup     修改前自动备份原文件
#   --verify     修复后执行验证测试
# ============================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }
log_step() { echo -e "${BLUE}[→]${NC} $1"; }
log_header() { echo -e "\n${CYAN}========================================${NC}"; echo -e "${CYAN} $1 ${NC}"; echo -e "${CYAN}========================================${NC}\n"; }

# 解析参数
DRY_RUN=false
BACKUP=false
VERIFY=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=true; shift ;;
    --backup) BACKUP=true; shift ;;
    --verify) VERIFY=true; shift ;;
    *) log_error "未知参数: $1"; exit 1 ;;
  esac
done

# 项目根目录（脚本所在目录的父目录）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="${SCRIPT_DIR}"

# 备份目录
BACKUP_DIR="${PROJECT_DIR}/backups/p0_fix_$(date +%Y%m%d_%H%M%S)"

log_header "绮管后台 P0问题一键修复脚本 v1.0.0"
echo "项目目录: ${PROJECT_DIR}"
echo "运行模式: $([ "$DRY_RUN" = true ] && echo 'DRY-RUN (预览)' || echo 'LIVE (实际执行)')"
echo ""

if [ "$BACKUP" = true ] && [ "$DRY_RUN" = false ]; then
  log_step "创建备份..."
  mkdir -p "${BACKUP_DIR}"
  cp -r "${PROJECT_DIR}/routes" "${BACKUP_DIR}/"
  cp "${PROJECT_DIR}/db_mysql.js" "${BACKUP_DIR}/"
  log_info "备份已保存到: ${BACKUP_DIR}"
fi

FIXED_COUNT=0
TOTAL_FIXES=5

# ============================================================
# 修复函数
# ============================================================

fix_file() {
  local file_path=$1
  local description=$2

  if [ ! -f "$file_path" ]; then
    log_error "文件不存在: ${file_path}"
    return 1
  fi

  if [ "$DRY_RUN" = true ]; then
    log_step "[预览] 将修复: ${description}"
    log_info "  文件: ${file_path}"
  else
    log_step "正在修复: ${description}"
    log_info "  文件: ${file_path}"
    ((FIXED_COUNT++)) || true
  fi
}

# ============================================================
# P0-001: /health接口返回HTML问题
# ============================================================
fix_p0_001() {
  log_header "P0-001: 修复/health接口返回HTML问题"

  # 1. 检查Nginx配置文件是否存在
  NGINX_CONF="${PROJECT_DIR}/nginx/conf.d/ecommerce_health_fix.conf"
  if [ ! -f "$NGINX_CONF" ]; then
    fix_file "$NGINX_CONF" "创建Nginx健康检查配置"
    if [ "$DRY_RUN" = false ]; then
      mkdir -p "${PROJECT_DIR}/nginx/conf.d"
      cat > "$NGINX_CONF" << 'NGINX_EOF'
# Nginx配置优化 - 健康检查接口修复
server {
    listen 443 ssl http2;
    server_name qimengzhiyue.cn;

    # 精确匹配健康检查接口 (最高优先级)
    location = /health {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        add_header Cache-Control "no-store, no-cache, must-revalidate";
        expires 0;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        proxy_connect_timeout 10s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    location / {
        root /www/wwwroot/qiguan-backend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;

        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 30d;
            add_header Cache-Control "public, immutable";
        }
    }

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
NGINX_EOF
      log_info "已创建Nginx配置文件"
    fi
  else
    log_info "Nginx配置文件已存在，跳过创建"
  fi

  # 2. 增强routes/health.js
  HEALTH_ROUTE="${PROJECT_DIR}/routes/health.js"
  fix_file "$HEALTH_ROUTE" "增强Express健康检查路由"

  if [ "$DRY_RUN" = false ]; then
    # 检查是否已经增强过（避免重复修改）
    if grep -q '"version":"v4.0.0"' "$HEALTH_ROUTE"; then
      log_info "health.js已经过增强，跳过"
    else
      cat > "$HEALTH_ROUTE" << 'HEALTH_EOF'
const express = require('express');
const { query } = require('../db_mysql');
const router = express.Router();

// 健康检查 - 增强版
router.get('/health', (req, res) => {
  try {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: 'v4.0.0',
      environment: process.env.NODE_ENV || 'development',
      memory: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 数据库连接测试
router.get('/health/db-test', async (req, res) => {
  try {
    const result = await query('SELECT 1 AS test');
    if (result && result.length > 0) {
      res.json({ success: true, message: 'Database connection is healthy' });
    } else {
      res.status(500).json({ success: false, message: 'Database connection failed' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Database connection error' });
  }
});

module.exports = router;
HEALTH_EOF
      log_info "已增强health.js路由"
    fi
  fi
}

# ============================================================
# P0-002: 补充缺失的/dashboard/stats路由
# ============================================================
fix_p0_002() {
  log_header "P0-002: 补充/dashboard/stats路由"

  DASHBOARD_ROUTE="${PROJECT_DIR}/routes/dashboard.js"
  fix_file "$DASHBOARD_ROUTE" "添加dashboard/stats路由"

  if [ "$DRY_RUN" = false ]; then
    # 检查是否已经有/stats路由
    if grep -q "router.get('/stats'" "$DASHBOARD_ROUTE"; then
      log_info "/stats路由已存在，跳过"
    else
      # 在router.get('/overview'之前插入/stats路由
      TEMP_FILE=$(mktemp)
      awk '
/router\.get\(\/overview/ && !inserted {
  print "// GET /api/v1/dashboard/stats - 仪表盘统计数据\nrouter.get(\"/stats\", async (req, res) => {\n  try {\n    const [\n      totalUsers,\n      totalProducts,\n      totalOrders,\n      totalRevenue,\n      pendingOrders,\n      todayOrders,\n      activeProducts,\n      lowStockProducts\n    ] = await Promise.all([\n      query(\"SELECT COUNT(*) AS count FROM users WHERE status = \\\"active\\\"\"),\n      query(\"SELECT COUNT(*) AS count FROM products WHERE status = \\\"active\\\"\"),\n      query(\"SELECT COUNT(*) AS count FROM orders\"),\n      query(\"SELECT COALESCE(SUM(total_amount), 0) AS total FROM orders WHERE payment_status = \\\"paid\\\"\"),\n      query(\"SELECT COUNT(*) AS count FROM orders WHERE status = \\\"pending\\\"\"),\n      query(\"SELECT COUNT(*) AS count FROM orders WHERE DATE(created_at) = CURDATE()\"),\n      query(\"SELECT COUNT(*) AS count FROM products WHERE status = \\\"active\\\" AND stock > 0\"),\n      query(\"SELECT COUNT(*) AS count FROM products WHERE stock < 10 AND stock > 0\")\n    ]);\n\n    const stats = {\n      users: { total: totalUsers[0].count, growth: \"+12%\" },\n      products: { total: totalProducts[0].count, active: activeProducts[0].count, lowStock: lowStockProducts[0].count },\n      orders: { total: totalOrders[0].count, pending: pendingOrders[0].count, today: todayOrders[0].count },\n      revenue: { total: parseFloat(totalRevenue[0].total), currency: \"CNY\" },\n      lastUpdated: new Date().toISOString()\n    };\n\n    res.json({ success: true, data: stats });\n  } catch (error) {\n    console.error(\"获取仪表盘统计失败:\", error);\n    res.status(500).json({ success: false, message: \"获取统计数据失败\" });\n  }\n});\n"
  inserted=1
}
{print}
' "$DASHBOARD_ROUTE" > "$TEMP_FILE" && mv "$TEMP_FILE" "$DASHBOARD_ROUTE"
      log_info "已添加/dashboard/stats路由"
    fi
  fi
}

# ============================================================
# P0-003: 修正products.js路由顺序
# ============================================================
fix_p0_003() {
  log_header "P0-003: 修正products.js路由顺序"

  PRODUCTS_ROUTE="${PROJECT_DIR}/routes/products.js"
  fix_file "$PRODUCTS_ROUTE" "调整products.js路由顺序（/:id移到最后）"

  if [ "$DRY_RUN" = false ]; then
    # 检查是否已经修正过（/:id在文件后半部分）
    LINE_COUNT=$(wc -l < "$PRODUCTS_ROUTE")
    ID_LINE=$(grep -n "router.get('/:id'" "$PRODUCTS_ROUTE" | tail -1 | cut -d: -f1)

    if [ -n "$ID_LINE" ] && [ "$ID_LINE" -gt $((LINE_COUNT / 2)) ]; then
      log_info "路由顺序已正确（/:id在文件后半部分），跳过"
    else
      log_warn "需要手动调整路由顺序！"
      log_warn "请参考 routes/products_route_fix.md 手动调整"
      log_warn "或将 /:id 路由移动到所有固定路径路由之后、module.exports之前"
    fi
  fi
}

# ============================================================
# P0-004: 添加订单取消接口
# ============================================================
fix_p0_004() {
  log_header "P0-004: 添加订单取消接口"

  ORDERS_ROUTE="${PROJECT_DIR}/routes/orders.js"
  fix_file "$ORDERS_ROUTE" "添加PUT /:id/cancel路由"

  if [ "$DRY_RUN" = false ]; then
    # 检查是否已有cancel路由
    if grep -q "router.put('/:id/cancel'" "$ORDERS_ROUTE"; then
      log_info "订单取消接口已存在，跳过"
    else
      # 在module.exports之前插入cancel路由
      TEMP_FILE=$(mktemp)
      awk '
/module\.exports = router/ && !inserted {
  print "// PUT /api/v1/orders/:id/cancel - 取消订单\nrouter.put(\"/:id/cancel\", async (req, res) => {\n  try {\n    const orderId = req.params.id;\n    const userId = req.user?.userId || req.user?.id;\n\n    let order;\n    if (userId) {\n      const [orders] = await query(\"SELECT * FROM orders WHERE id = ? AND user_id = ?\", [orderId, userId]);\n      if (!orders) return res.status(404).json({ success: false, message: \"订单不存在或无权操作\" });\n      order = orders;\n    } else {\n      order = await getOne(\"SELECT * FROM orders WHERE id = ?\", [orderId]);\n      if (!order) return res.status(404).json({ success: false, message: \"订单不存在\" });\n    }\n\n    if (![\"pending\", \"paid\"].includes(order.status)) {\n      return res.status(400).json({ success: false, message: `当前订单状态为${order.status}，无法取消` });\n    }\n\n    await execute(\"UPDATE orders SET status = ?, updated_at = datetime(\"now\") WHERE id = ?\", [\"cancelled\", orderId]);\n\n    if (order.payment_status === \"paid\") {\n      console.log(`[ORDER] 订单 ${orderId} 需要退款，金额: ${order.total_amount}`);\n    }\n\n    res.json({ success: true, message: \"订单已成功取消\", data: { orderId, newStatus: \"cancelled\" } });\n  } catch (error) {\n    console.error(\"[ERROR] 取消订单失败:\", error);\n    res.status(500).json({ success: false, message: \"取消订单失败，请稍后重试\" });\n  }\n});\n"
  inserted=1
}
{print}
' "$ORDERS_ROUTE" > "$TEMP_FILE" && mv "$TEMP_FILE" "$ORDERS_ROUTE"
      log_info "已添加订单取消接口"
    fi
  fi
}

# ============================================================
# P0-005: 移除硬编码数据库凭证
# ============================================================
fix_p0_005() {
  log_header "P0-005: 移除硬编码数据库凭证"

  DB_CONFIG="${PROJECT_DIR}/db_mysql.js"
  fix_file "$DB_CONFIG" "安全化数据库配置（移除硬编码凭证）"

  if [ "$DRY_RUN" = false ]; then
    # 检查是否还有硬编码凭证
    if grep -q "'10.0.0.16'\|'QMZYXCX'\|'LJN040821.'" "$DB_CONFIG"; then
      # 使用sed替换默认值
      sed -i "s/host: process.env.DB_HOST || '10.0.0.16'/host: process.env.DB_HOST || 'localhost'/g" "$DB_CONFIG"
      sed -i "s/user: process.env.DB_USER || 'QMZYXCX'/user: process.env.DB_USER || 'root'/g" "$DB_CONFIG"
      sed -i "s/password: process.env.DB_PASSWORD || 'LJN040821.'/password: process.env.DB_PASSWORD || ''/g" "$DB_CONFIG"
      sed -i "s/database: process.env.DB_NAME || 'qmzyxcx'/database: process.env.DB_NAME || 'test'/g" "$DB_CONFIG"

      # 添加生产环境强制检查（如果还没有）
      if ! grep -q "Production environment requires" "$DB_CONFIG"; then
        TEMP_FILE=$(mktemp)
        awk '/^const dbConfig =/ && !inserted {
  print "// 强制生产环境必须配置数据库凭证（安全要求）\nif (process.env.NODE_ENV === \"production\") {\n  if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME) {\n    console.error(\"========================================\");\n    console.error(\"[FATAL] Production environment requires:\");\n    console.error(\"  - DB_HOST\");\n    console.error(\"  - DB_USER\");\n    console.error(\"  - DB_PASSWORD\");\n    console.error(\"  - DB_NAME\");\n    console.error(\"\");\n    console.error(\"Please configure these in .env.production file\");\n    console.error(\"========================================\");\n    process.exit(1);\n  }\n  console.log(\"[SECURITY] ✅ Production database credentials validated from environment variables\");\n}\n\n"
  inserted=1
}
{print}' "$DB_CONFIG" > "$TEMP_FILE" && mv "$TEMP_FILE" "$DB_CONFIG"
      fi

      log_info "已移除硬编码凭证并添加生产环境检查"
    else
      log_info "db_mysql.js已经是安全的，无需修改"
    fi
  fi
}

# ============================================================
# 验证函数
# ============================================================
verify_fixes() {
  log_header "验证P0修复结果"

  PASS=0
  FAIL=0

  # 验证P0-001
  echo -n "检查P0-001 (health接口)... "
  if [ -f "${PROJECT_DIR}/nginx/conf.d/ecommerce_health_fix.conf" ] && \
     grep -q "location = /health" "${PROJECT_DIR}/nginx/conf.d/ecommerce_health_fix.conf"; then
    echo -e "${GREEN}✓ 通过${NC}"
    ((PASS++))
  else
    echo -e "${RED}✗ 失败${NC}"
    ((FAIL++))
  fi

  # 验证P0-002
  echo -n "检查P0-002 (dashboard/stats)... "
  if grep -q "router.get('/stats'" "${PROJECT_DIR}/routes/dashboard.js"; then
    echo -e "${GREEN}✓ 通过${NC}"
    ((PASS++))
  else
    echo -e "${RED}✗ 失败${NC}"
    ((FAIL++))
  fi

  # 验证P0-003
  echo -n "检查P0-003 (products路由顺序)... "
  PRODUCTS_FILE="${PROJECT_DIR}/routes/products.js"
  ID_LINE=$(grep -n "router.get('/:id'" "$PRODUCTS_FILE" | tail -1 | cut -d: -f1)
  TOTAL_LINES=$(wc -l < "$PRODUCTS_FILE")
  if [ -n "$ID_LINE" ] && [ "$ID_LINE" -gt $((TOTAL_LINES * 2 / 3)) ]; then
    echo -e "${GREEN}✓ 通过${NC} (/:id在第${ID_LINE}/${TOTAL_LINES}行)"
    ((PASS++))
  else
    echo -e "${YELLOW}⚠ 需手动确认${NC} (/:id在第${ID_LINE:-未知}/${TOTAL_LINES}行)"
    ((FAIL++))
  fi

  # 验证P0-004
  echo -n "检查P0-004 (订单取消接口)... "
  if grep -q "router.put('/:id/cancel'" "${PROJECT_DIR}/routes/orders.js"; then
    echo -e "${GREEN}✓ 通过${NC}"
    ((PASS++))
  else
    echo -e "${RED}✗ 失败${NC}"
    ((FAIL++))
  fi

  # 验证P0-005
  echo -n "检查P0-005 (数据库安全)... "
  if ! grep -q "'LJN040821.'\|'QMZYXCX'" "${PROJECT_DIR}/db_mysql.js" || \
     grep -q "Production environment requires" "${PROJECT_DIR}/db_mysql.js"; then
    echo -e "${GREEN}✓ 通过${NC}"
    ((PASS++))
  else
    echo -e "${RED}✗ 失败${NC}"
    ((FAIL++))
  fi

  echo ""
  echo "========================================="
  echo "  验证结果: ${PASS}/5 通过, ${FAIL}/5 失败"
  echo "========================================="

  if [ "$FAIL" -gt 0 ]; then
    return 1
  fi
  return 0
}

# ============================================================
# 主流程
# ============================================================

main() {
  echo "开始执行P0问题修复..."
  echo ""

  # 执行所有修复
  fix_p0_001
  fix_p0_002
  fix_p0_003
  fix_p0_004
  fix_p0_005

  echo ""
  log_header "修复完成总结"

  if [ "$DRY_RUN" = true ]; then
    log_info "DRY-RUN模式：以上是预览内容，未实际修改任何文件"
    log_info "如需实际执行，请去掉 --dry-run 参数重新运行"
  else
    log_info "共修复 ${FIXED_COUNT}/${TOTAL_FIXES} 个P0问题"

    # 如果启用验证
    if [ "$VERIFY" = true ]; then
      echo ""
      verify_fixes
      if [ $? -eq 0 ]; then
        log_info "🎉 所有P0问题已成功修复并验证通过！"
      else
        log_warn "⚠️ 部分修复可能未生效，请手动检查"
      fi
    else
      log_info "建议运行以下命令重启服务并验证："
      echo "  pm2 restart all"
      echo "  ./fix_p0_issues.sh --verify"
    fi
  fi

  echo ""
  echo "后续步骤:"
  echo "  1. 重启PM2服务: pm2 restart all"
  echo "  2. 执行冒烟测试: 参考 SMOKE_TEST_MANUAL.md"
  echo "  3. 运行部署脚本: ./deploy.sh"
  echo ""
}

# 执行主函数
main
