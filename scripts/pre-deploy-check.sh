#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

check_pass() {
  echo -e "${GREEN}✓${NC} $1"
  ((PASS++))
}

check_fail() {
  echo -e "${RED}❌${NC} $1"
  ((FAIL++))
}

check_warn() {
  echo -e "${YELLOW}⚠️${NC} $1"
  ((WARN++))
}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=========================================="
echo "  Pre-Deploy Check - $(date '+%Y-%m-%d %H:%M:%S')"
echo "  Project Root: $PROJECT_ROOT"
echo "=========================================="

cd "$PROJECT_ROOT" || { check_fail "Cannot access project root: $PROJECT_ROOT"; exit 1; }

if [ -f ".env.production" ] && [ -s ".env.production" ]; then
  check_pass ".env.production exists and non-empty"
else
  check_fail ".env.production missing or empty - DEPLOYMENT BLOCKED"
fi

if [ -f ".env.production" ]; then
  source .env.production

  if [ "$DB_HOST" = "localhost" ] || [ -z "$DB_HOST" ]; then
    check_fail "DB_HOST is using default value: '${DB_HOST:-localhost}'"
  else
    check_pass "DB_HOST configured: $DB_HOST"
  fi

  if [ "$DB_USER" = "root" ] || [ -z "$DB_USER" ]; then
    check_fail "DB_USER is using default value: '${DB_USER:-root}' (security risk)"
  else
    check_pass "DB_USER configured: $DB_USER"
  fi

  if [ -z "$DB_PASSWORD" ]; then
    check_fail "DB_PASSWORD is empty - security risk"
  else
    check_pass "DB_PASSWORD is set (length: ${#DB_PASSWORD})"
  fi

  if [ "$DB_NAME" = "ecommerce" ]; then
    check_warn "DB_NAME is using default value: '$DB_NAME' (may conflict with dev DB)"
  elif [ -z "$DB_NAME" ]; then
    check_fail "DB_NAME is empty"
  else
    check_pass "DB_NAME configured: $DB_NAME"
  fi
fi

if [ -d "qiguanqianduan/dist" ] && [ -f "qiguanqianduan/dist/index.html" ]; then
  JS_COUNT=$(find qiguanqianduan/dist/assets/js -name "*.js" 2>/dev/null | wc -l)
  CSS_COUNT=$(find qiguanqianduan/dist/assets/css -name "*.css" 2>/dev/null | wc -l)
  
  if [ "$JS_COUNT" -gt 0 ] && [ "$CSS_COUNT" -gt 0 ]; then
    check_pass "Frontend dist files exist (index.html + ${JS_COUNT} JS + ${CSS_COUNT} CSS)"
  else
    check_warn "Frontend dist exists but may be incomplete (JS:${JS_COUNT}, CSS:${CSS_COUNT})"
  fi
else
  check_fail "Frontend build incomplete: dist/index.html missing"
fi

if command -v node &> /dev/null; then
  NODE_VERSION=$(node --version | sed 's/v//')
  NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
  
  if [ "$NODE_MAJOR" -ge 16 ]; then
    check_pass "Node.js version >= 16: v$NODE_VERSION"
  else
    check_fail "Node.js version too old: v$NODE_VERSION (requires >= 16)"
  fi
else
  check_fail "Node.js not found in PATH"
fi

if [ -d "node_modules" ]; then
  DEP_COUNT=$(ls node_modules 2>/dev/null | wc -l)
  check_pass "npm dependencies installed ($DEP_COUNT packages in node_modules)"
else
  check_fail "node_modules missing - run 'npm install' first"
fi

echo ""
echo "=========================================="
echo -e "Results: ${GREEN}$PASS passed${NC}, ${YELLOW}$WARN warnings${NC}, ${RED}$FAIL failed${NC}"
echo "=========================================="

if [ $FAIL -gt 0 ]; then
  echo -e "${RED}❌ Deployment BLOCKED - Fix failed checks above${NC}"
  exit 1
elif [ $WARN -gt 0 ]; then
  echo -e "${YELLOW}⚠️ Deployment allowed with warnings - Review warnings above${NC}"
  exit 0
else
  echo -e "${GREEN}✅ All checks passed - Ready to deploy${NC}"
  exit 0
fi
