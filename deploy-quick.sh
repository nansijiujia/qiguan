#!/bin/bash
# 绮管后台一键部署脚本
# 使用方法: bash deploy-quick.sh

set -e

echo "=========================================="
echo "  绮管电商后台 - 一键部署脚本"
echo "  部署时间: $(date)"
echo "=========================================="

PROJECT_DIR="/www/wwwroot/qiguan-backend"
BACKUP_DIR="${PROJECT_DIR}/backups"

# Step 1: 创建备份
echo ""
echo "[1/5] 创建备份..."
mkdir -p "${BACKUP_DIR}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
if [ -d "${PROJECT_DIR}/dist" ]; then
    tar -czf "${BACKUP_DIR}/pre-deploy-${TIMESTAMP}.tar.gz" \
        --exclude=node_modules \
        --exclude=data/*.db \
        --exclude=.env \
        --exclude=logs \
        --exclude=backups \
        -C "${PROJECT_DIR}" .
    echo "✅ 备份完成: ${BACKUP_DIR}/pre-deploy-${TIMESTAMP}.tar.gz"
else
    echo "⚠️ 首次部署，跳过备份"
fi

# Step 2: 解压部署包
echo ""
echo "[2/5] 解压部署包..."
cd "${PROJECT_DIR}"

# 查找部署包
DEPLOY_ZIP=$(find . -maxdepth 1 -name "qiguan-backend-deploy.zip" | head -1)

if [ -z "$DEPLOY_ZIP" ]; then
    echo "❌ 未找到部署包 qiguan-backend-deploy.zip"
    echo "请先将部署包上传到 ${PROJECT_DIR} 目录"
    exit 1
fi

echo "找到部署包: ${DEPLOY_ZIP}"
unzip -o "$DEPLOY_ZIP" -d ./temp_deploy
echo "✅ 解压完成"

# Step 3: 复制文件
echo ""
echo "[3/5] 更新文件..."

# 复制核心文件
cp -f ./temp_deploy/index.js ./
cp -f ./temp_deploy/package.json ./
cp -f ./temp_deploy/db_unified.js ./

# 复制目录
if [ -d "./temp_deploy/routes" ]; then
    rm -rf ./routes
    cp -r ./temp_deploy/routes ./
fi

if [ -d "./temp_deploy/config" ]; then
    rm -rf ./config
    cp -r ./temp_deploy/config ./
fi

if [ -d "./temp_deploy/middleware" ]; then
    rm -rf ./middleware
    cp -r ./temp_deploy/middleware ./
fi

if [ -d "./temp_deploy/utils" ]; then
    rm -rf ./utils
    cp -r ./temp_deploy/utils ./
fi

# 复制前端构建产物
if [ -d "./temp_deploy/dist" ]; then
    rm -rf ./dist
    cp -r ./temp_deploy/dist ./
    echo "✅ 前端构建产物已更新"
fi

# 复制前端源码（用于后续构建）
if [ -d "./temp_deploy/qiguanqianduan" ]; then
    if [ -d "./qiguanqianduan/dist" ]; then
        rm -rf ./qiguanqianduan/dist
    fi
    cp -r ./temp_deploy/qiguanqianduan/dist ./qiguanqianduan/ 2>/dev/null || true
    
    # 更新关键配置文件
    if [ -f "./temp_deploy/qiguanqianduan/src/utils/request.js" ]; then
        cp -f ./temp_deploy/qiguanqianduan/src/utils/request.js ./qiguanqianduan/src/utils/
    fi
    if [ -f "./temp_deploy/qiguanqianduan/vite.config.js" ]; then
        cp -f ./temp_deploy/qiguanqianduan/vite.config.js ./qiguanqianduan/
    fi
    if [ -f "./temp_deploy/qiguanqianduan/.env.production" ]; then
        cp -f ./temp_deploy/qiguanqianduan/.env.production ./qiguanqianduan/
    fi
    echo "✅ 前端配置已更新"
fi

# 清理临时目录
rm -rf ./temp_deploy
rm -f "$DEPLOY_ZIP"

echo "✅ 文件更新完成"

# Step 4: 安装依赖
echo ""
echo "[4/5] 安装依赖..."
npm install --production 2>&1 | tail -5
echo "✅ 依赖安装完成"

# Step 5: 重启服务
echo ""
echo "[5/5] 重启服务..."
if pm2 describe qiguan-backend > /dev/null 2>&1; then
    pm2 restart qiguan-backend
else
    pm2 start index.js --name qiguan-backend
fi
pm2 save
sleep 3
echo "✅ 服务已重启"

# 验证部署
echo ""
echo "=========================================="
echo "  部署验证"
echo "=========================================="

sleep 2

# 测试健康检查
HEALTH=$(curl -sf http://localhost:3000/health 2>/dev/null || echo "")
if echo "$HEALTH" | grep -q '"status"'; then
    echo "✅ 健康检查通过"
else
    echo "⚠️ 健康检查接口可能需要几秒钟启动"
fi

# 显示PM2状态
echo ""
pm2 status

echo ""
echo "=========================================="
echo "  🎉 部署完成！"
echo "=========================================="
echo ""
echo "请访问以下地址测试："
echo "  前端地址: https://admin.qimengzhiyue.cn/admin/login"
echo "  用户名: admin"
echo "  密码: admin123"
echo ""
echo "监控命令:"
echo "  pm2 logs qiguan-backend --lines 50"
echo "  pm monit"
echo ""
echo "回滚命令:"
echo "  cd ${PROJECT_DIR}"
echo "  tar -xzf ${BACKUP_DIR}/pre-deploy-${TIMESTAMP}.tar.gz -C /"
echo "  pm2 restart qiguan-backend"
echo "=========================================="
