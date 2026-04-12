#!/bin/bash
# ============================================================
# 绮管后台 - API紧急修复部署脚本
# 
# 功能: 将修复后的路由文件上传到服务器并重启PM2
# 使用: bash deploy_fix.sh
# 创建时间: 2026-04-12
# ============================================================

set -e

echo "============================================================"
echo "🚀 绮管后台 - API紧急修复部署"
echo "============================================================"
echo "⏰ 部署时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# 服务器配置
SERVER="root@qimengzhiyue.cn"
REMOTE_DIR="/www/wwwroot/qiguan/routes"

# 本地文件列表（修复的文件）
LOCAL_FILES=(
    "routes/products.js"
    "routes/orders.js"
    "routes/users.js"
    "routes/coupons.js"
)

echo "📦 开始上传修复文件..."
echo ""

# 上传每个修复的文件
for file in "${LOCAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "📤 上传: $file"
        scp "$file" "${SERVER}:${REMOTE_DIR}/$(basename $file)"
        if [ $? -eq 0 ]; then
            echo "   ✅ 上传成功"
        else
            echo "   ❌ 上传失败"
            exit 1
        fi
    else
        echo "❌ 文件不存在: $file"
        exit 1
    fi
done

echo ""
echo "♻️  正在重启后端服务..."

# SSH到服务器重启PM2
ssh ${SERVER} << 'EOF'
cd /www/wwwroot/qiguan

echo "停止当前服务..."
pm2 stop qiguan-backend || true

echo "重新启动服务..."
pm2 start ecosystem.config.js --env production || pm2 start index.js --name qiguan-backend

echo "等待服务启动..."
sleep 3

echo "检查服务状态..."
pm2 status qiguan-backend

echo ""
echo "查看最近日志..."
pm2 logs qiguan-backend --lines 20 --nostream

EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 部署完成！服务已成功重启"
else
    echo ""
    echo "❌ 部署失败！请检查日志"
    exit 1
fi

echo ""
echo "============================================================"
echo "🎯 下一步操作:"
echo "   1. 运行回归测试: node test_api_fix.js"
echo "   2. 检查PM2日志: pm2 logs qiguan-backend --lines 100"
echo "   3. 访问后台验证: https://qimengzhiyue.cn/admin"
echo "============================================================"
