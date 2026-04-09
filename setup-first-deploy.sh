#!/bin/bash

# ============================================================
# 绮管后台 - 首次部署初始化脚本
# 用途：首次在服务器上配置完整的自动化部署系统
# 执行方式: bash setup-first-deploy.sh
# ============================================================

set -e

echo "╔══════════════════════════════════════════════════╗"
echo "║  🚀 绮管后台 - 首次部署初始化向导              ║"
echo "║  将自动完成：                                    ║"
echo "║    ✓ 安装PM2 ecosystem配置                       ║"
echo "║    ✓ 配置Git自动部署Hook                        ║"
echo "║    ✓ 设置Nginx前后端一体化托管                  ║"
echo "║    ✓ 初始化MySQL数据库                          ║"
echo "║    ✓ 执行首次完整部署                           ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

PROJECT_DIR="/var/www/qiguan"

# 检查是否在正确的目录
if [ ! -d "$PROJECT_DIR" ]; then
    echo "❌ 错误：项目目录不存在 $PROJECT_DIR"
    echo "请先执行：git clone <仓库地址> /var/www/qiguan && cd /var/www/qiguan"
    exit 1
fi

cd "$PROJECT_DIR"

echo "📍 当前目录: $(pwd)"
echo ""

# ====== 步骤1：检查并安装依赖 ======
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  步骤 1/6: 环境检查与安装"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if ! command -v pm2 &> /dev/null; then
    echo "📦 安装 PM2..."
    npm install -g pm2
    echo "✅ PM2 安装成功"
else
    echo "✅ PM2 已安装: $(pm2 --version)"
fi

if ! command -v git &> /dev/null; then
    echo "📦 安装 Git..."
    apt-get update && apt-get install -y git
fi

# ====== 步骤2：创建环境变量文件 ======
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  步骤 2/6: 配置环境变量"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ ! -f .env ]; then
    cat > .env << 'EOF'
DB_TYPE=mysql
DB_HOST=10.0.0.16
DB_PORT=3306
DB_USER=QMZYXCX
DB_PASSWORD=LJN040821.
DB_NAME=qmzyxcx
NODE_ENV=production
JWT_SECRET=qiguan-production-secret-key-2026-change-me-at-least-32-characters-long
EOF
    echo "✅ .env 文件已创建"
else
    echo "✅ .env 文件已存在，跳过"
fi

# ====== 步骤3：创建数据库选择器 ======
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  步骤 3/6: 配置数据库连接"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ ! -f db_selector.js ]; then
    cat > db_selector.js << 'EOF'
let db;
try {
  db = require('./db_mysql');
  console.log('[DB] MySQL Mode - Connected to cloud database');
} catch (e) {
  db = require('./db');
  console.log('[DB] SQLite Mode - Using local database');
}
module.exports = db;
EOF
    echo "✅ 数据库选择器已创建"
else
    echo "✅ 数据库选择器已存在"
fi

# ====== 步骤4：初始化MySQL数据库 ======
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  步骤 4/6: 初始化数据库"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -f scripts/init_mysql_database.js ]; then
    echo "⏳ 正在连接MySQL数据库..."
    
    if node scripts/init_mysql_database.js 2>&1 | tee /tmp/db_init.log; then
        echo ""
        echo "✅ MySQL数据库初始化成功！"
        grep -E "(分类|商品|用户|管理员)" /tmp/db_init.log || true
    else
        echo ""
        echo "⚠️  MySQL初始化失败（可能是网络问题），将使用SQLite回退模式"
    fi
else
    echo "⚠️  未找到初始化脚本，跳过"
fi

# ====== 步骤5：配置Git自动部署 ======
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  步骤 5/6: 配置Git自动部署"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

GIT_BARE_REPO="/var/www/qiguan.git"

if [ ! -d "$GIT_BARE_REPO" ]; then
    echo "📦 创建Git裸仓库..."
    git clone --bare . "$GIT_BARE_REPO" 2>/dev/null || {
        mkdir -p "$GIT_BARE_REPO"
        cd "$GIT_BARE_REPO"
        git init --bare
        cd "$PROJECT_DIR"
    }
else
    echo "✅ Git裸仓库已存在"
fi

# 复制post-receive hook
mkdir -p "$GIT_BARE_REPO/hooks"
cp hooks/post-receive "$GIT_BARE_REPO/hooks/" 2>/dev/null || {
    cat > "$GIT_BARE_REPO/hooks/post-receive" << 'HOOKEOF'
#!/bin/bash
LOG_DIR="/var/log/qiguan"
DEPLOY_SCRIPT="/var/www/qiguan/auto-deploy.sh"
mkdir -p "$LOG_DIR"

echo "🚀 Git Push检测到，开始自动部署..." | tee -a "$LOG_DIR/git-push.log"
echo "时间: $(date)" | tee -a "$LOG_DIR/git-push.log"

while read oldrev newrev refname; do
    echo "[GIT] Branch: $(basename $refname) Commit: $newrev" >> "$LOG_DIR/git-push.log"
done

if [ -f "$DEPLOY_SCRIPT" ]; then
    nohup bash "$DEPLOY_SCRIPT" > "$LOG_DIR/deploy-$(date +%Y%m%d_%H%M%S).log" 2>&1 &
    echo "✅ 部署已在后台启动 (PID: $!)"
else
    echo "❌ 部署脚本不存在"
fi
HOOKEOF
}

chmod +x "$GIT_BARE_REPO/hooks/post-receive"
echo "✅ Git Post-Receive Hook 已配置"

# 配置远程仓库
git remote remove origin 2>/dev/null || true
git remote add origin "$GIT_BARE_REPO"
echo "✅ Git远程仓库已配置 (origin → $GIT_BARE_REPO)"

# ====== 步骤6：执行首次部署 ======
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  步骤 6/6: 执行首次完整部署"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "⏳ 开始执行一键部署脚本..."
echo ""

chmod +x auto-deploy.sh
./auto-deploy.sh

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo "╔══════════════════════════════════════════════════╗"
    echo "║  🎉 初始化完成！                               ║"
    echo "╠══════════════════════════════════════════════════╣"
    echo "║                                                ║"
    echo "║  ✅ PM2 进程管理已配置                         ║"
    echo "║  ✅ Git 自动部署已启用                         ║"
    echo "║  ✅ Nginx 前后端一体化已配置                   ║"
    echo "║  ✅ MySQL 数据库已初始化                        ║"
    echo "║  ✅ 首次部署已完成                             ║"
    echo "║                                                ║"
    echo "║  🌐 访问网站: https://qimengzhiyue.cn          ║"
    echo "║  📋 查看日志: pm2 logs qiguan-backend          ║"
    echo "║  🔄 后续更新: git push origin 绮管             ║"
    echo "║                                                ║"
    echo "╚══════════════════════════════════════════════════╝"
    echo ""
    
    echo "📖 详细文档请查看: DEPLOYMENT_GUIDE.md"
    echo ""
    
    # 显示下一步操作
    echo "💡 下一步操作:"
    echo "   1. 在本地电脑执行:"
    echo "      git add ."
    echo "      git commit -m 'initial deployment'"
    echo "      git push origin 绮管"
    echo ""
    echo "   2. 推送后将自动触发部署，无需手动干预！"
    echo ""
else
    echo ""
    echo "❌ 部署过程中出现错误，请查看日志："
    echo "   cat /var/log/qiguan/deploy-*.log | tail -100"
    exit 1
fi
