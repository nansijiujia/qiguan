#!/bin/bash
# ============================================================
# 绮管电商 - 上线前冒烟测试脚本
# 用途: 自动化测试所有核心功能
# 使用: chmod +x smoke_test.sh && ./smoke_test.sh
# ============================================================

set -e

# 配置
BASE_URL="https://qimengzhiyue.cn/api/v1"
ADMIN_URL="https://admin.qimengzhiyue.cn"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
PASS_COUNT=0
FAIL_COUNT=0

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_pass() {
  echo -e "${GREEN}✅ $1${NC}"
  ((PASS_COUNT++))
}

log_fail() {
  echo -e "${RED}❌ $1${NC}"
  ((FAIL_COUNT++))
}

log_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

log_warn() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║          🚀 绮管电商上线前冒烟测试                    ║"
echo "║          测试时间: $TIMESTAMP                ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ============================================
# 测试1: Health检查端点
# ============================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  系统健康检查"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1.1 后端Health端点
if curl -sf "$BASE_URL/health/health" > /dev/null 2>&1; then
  log_pass "后端API Health端点响应正常"
else
  log_fail "后端API Health端点无响应"
fi

# 1.2 根路径Health
if curl -sf "https://qimengzhiyue.cn/health" > /dev/null 2>&1; then
  log_pass "根路径 /health 可访问"
else
  log_fail "根路径 /health 无响应"
fi

# 1.3 数据库连接测试
DB_HEALTH=$(curl -s "$BASE_URL/health/db-test" 2>/dev/null)
if echo "$DB_HEALTH" | grep -q '"success":true'; then
  log_pass "数据库连接正常"
else
  log_warn "数据库连接测试未通过 (可能需要认证)"
fi

echo ""

# ============================================
# 测试2: 用户认证系统
# ============================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  用户认证系统"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 2.1 管理员登录
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Qm@2026#Admin!Secure"}')

if echo "$LOGIN_RESPONSE" | grep -q '"success":true'; then
  log_pass "管理员登录成功"
  TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
  log_info "JWT Token已获取 (${TOKEN:0:20}...)"
else
  log_fail "管理员登录失败"
  log_warn "响应: $LOGIN_RESPONSE"
  TOKEN=""
fi

echo ""

# ============================================
# 测试3: 核心业务API (需要Token)
# ============================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  核心业务API测试"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -n "$TOKEN" ]; then
  AUTH_HEADER="Authorization: Bearer ${TOKEN}"

  # 3.1 商品列表
  PRODUCTS=$(curl -sf "$BASE_URL/products" -H "$AUTH_HEADER")
  if [ $? -eq 0 ] && [ -n "$PRODUCTS" ]; then
    PRODUCT_COUNT=$(echo $PRODUCTS | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))" 2>/dev/null || echo "?")
    log_pass "商品列表获取成功 ($PRODUCT_COUNT 个商品)"
  else
    log_fail "商品列表获取失败"
  fi

  # 3.2 分类列表
  CATEGORIES=$(curl -sf "$BASE_URL/categories" -H "$AUTH_HEADER")
  if [ $? -eq 0 ] && [ -n "$CATEGORIES" ]; then
    CAT_COUNT=$(echo $CATEGORIES | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))" 2>/dev/null || echo "?")
    log_pass "分类列表获取成功 ($CAT_COUNT 个分类)"
  else
    log_fail "分类列表获取失败"
  fi

  # 3.3 订单列表
  ORDERS=$(curl -sf "$BASE_URL/orders" -H "$AUTH_HEADER")
  if [ $? -eq 0 ]; then
    ORDER_COUNT=$(echo $ORDERS | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))" 2>/dev/null || echo "?")
    log_pass "订单列表获取成功 ($ORDER_COUNT 个订单)"
  else
    log_fail "订单列表获取失败"
  fi

  # 3.4 用户列表 (需要admin权限)
  USERS=$(curl -sf "$BASE_URL/admin/users" -H "$AUTH_HEADER")
  if [ $? -eq 0 ]; then
    USER_COUNT=$(echo $USERS | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))" 2>/dev/null || echo "?")
    log_pass "用户列表获取成功 ($USER_COUNT 个用户)"
  else
    log_warn "用户列表获取失败 (可能权限不足)"
  fi

  # 3.5 优惠券列表
  COUPONS=$(curl -sf "$BASE_URL/coupons" -H "$AUTH_HEADER")
  if [ $? -eq 0 ]; then
    COUPON_COUNT=$(echo $COUPONS | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))" 2>/dev/null || echo "?")
    log_pass "优惠券列表获取成功 ($COUPON_COUNT 张优惠券)"
  else
    log_fail "优惠券列表获取失败"
  fi

  # 3.6 仪表盘数据
  DASHBOARD=$(curl -sf "$BASE_URL/dashboard/overview" -H "$AUTH_HEADER")
  if [ $? -eq 0 ]; then
    log_pass "仪表盘数据获取成功"
  else
    log_fail "仪表盘数据获取失败"
  fi

  # 3.7 购物车功能测试
  CART_ADD=$(curl -s -X POST "$BASE_URL/cart/cart" \
    -H "$AUTH_HEADER" \
    -H "Content-Type: application/json" \
    -d '{"productId":1,"quantity":1}')
  
  if echo "$CART_ADD" | grep -q '"success":true'; then
    log_pass "购物车添加商品成功"
    
    # 获取购物车
    CART_GET=$(curl -sf "$BASE_URL/cart/cart" -H "$AUTH_HEADER")
    if [ $? -eq 0 ]; then
      log_pass "购物车列表获取成功"
    else
      log_fail "购物车列表获取失败"
    fi
    
    # 清空购物车 (清理测试数据)
    CART_CLEAR=$(curl -s -X DELETE "$BASE_URL/cart/cart" -H "$AUTH_HEADER")
    if echo "$CART_CLEAR" | grep -q '"success":true'; then
      log_info "购物车已清空 (测试数据清理)"
    fi
  else
    log_fail "购物车添加商品失败"
  fi

else
  log_warn "⚠️ 跳过API测试 (无有效Token)"
fi

echo ""

# ============================================
# 测试4: 后台管理系统前端
# ============================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4️⃣  后台管理系统前端"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 4.1 HTTP访问
HTTP_CODE=$(curl -sI "http://admin.qimengzhiyue.cn" 2>/dev/null | head -1)
if echo "$HTTP_CODE" | grep -q "200"; then
  log_pass "后台HTTP访问正常"
else
  log_warn "后台HTTP访问异常: $HTTP_CODE"
fi

# 4.2 HTTPS访问
HTTPS_CODE=$(curl -skI "https://admin.qimengzhiyue.cn" 2>/dev/null | head -1)
if echo "$HTTPS_CODE" | grep -q "200"; then
  log_pass "后台HTTPS访问正常"
else
  log_fail "后台HTTPS访问异常: $HTTPS_CODE"
fi

# 4.3 SSL证书检查
SSL_INFO=$(openssl s_client -servername admin.qimengzhiyue.cn \
  -connect admin.qimengzhiyue.cn:443 </dev/null 2>&1)

if echo "$SSL_INFO" | grep -q "Verify return code: 0"; then
  log_pass "SSL证书验证通过"
else
  log_fail "SSL证书验证失败"
fi

# 4.4 检查页面内容是否为HTML
PAGE_CONTENT=$(curl -sk "https://admin.qimengzhiyue.cn" 2>/dev/null | head -c 500)
if echo "$PAGE_CONTENT" | grep -qi "<!DOCTYPE html\|<html"; then
  log_pass "返回有效的HTML页面"
  if echo "$PAGE_CONTENT" | grep -qi "vue\|app\|div id=\"app\""; then
    log_pass "检测到Vue SPA应用标识"
  else
    log_warn "可能不是Vue SPA应用"
  fi
else
  log_fail "页面内容异常"
fi

echo ""

# ============================================
# 测试5: 小程序API端点
# ============================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5️⃣  小程序API兼容性"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 5.1 商品分类别名路由
CAT_ALIAS=$(curl -sf "$BASE_URL/products/category" -H "$AUTH_HEADER")
if [ $? -eq 0 ]; then
  log_pass "小程序分类别名路由可用 (/api/v1/products/category)"
else
  log_warn "小程序分类别名路由不可用"
fi

# 5.2 CORS头部检查
CORS_HEADERS=$(curl -sI -X OPTIONS "$BASE_URL/health/health" \
  -H "Origin: https://qimengzhiyue.cn" \
  -H "Access-Control-Request-Method: GET" 2>/dev/null)

if echo "$CORS_HEADERS" | grep -qi "access-control-allow-origin"; then
  log_pass "CORS配置正确 (允许跨域请求)"
else
  log_warn "CORS配置可能有问题"
fi

echo ""

# ============================================
# 测试总结
# ============================================
TOTAL=$((PASS_COUNT + FAIL_COUNT))

echo "╔══════════════════════════════════════════════════════════╗"
echo "║                  📊 测试结果汇总                        ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  总测试数:   $TOTAL                                           ║"
echo "║  通过:       ${GREEN}${PASS_COUNT}${NC}                                          ║"
echo "║  失败:       ${RED}${FAIL_COUNT}${NC}                                          ║"
echo "╠══════════════════════════════════════════════════════════╣"

if [ $FAIL_COUNT -eq 0 ]; then
  echo "║  ${GREEN}状态: 🎉 全部通过! 系统可以上线!${NC}              ║"
elif [ $FAIL_COUNT -le 2 ]; then
  echo "║  ${YELLOW}状态: ⚠️ 基本就绪, 少量问题需确认${NC}           ║"
else
  echo "║  ${RED}状态: ❌ 存在问题, 建议修复后再上线${NC}            ║"
fi

echo "╠══════════════════════════════════════════════════════════╣"
echo "║  📋 下一步操作:                                        ║"
echo "║  1. 在浏览器中访问: https://admin.qimengzhiyue.cn        ║"
echo "║  2. 使用 admin / Qm@2026#Admin!Secure 登录              ║"
echo "║  3. 检查所有管理功能是否正常                            ║"
echo "║  4. 使用微信开发者工具测试小程序                       ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# 输出退出码
if [ $FAIL_COUNT -gt 0 ]; then
  exit 1
else
  exit 0
fi
