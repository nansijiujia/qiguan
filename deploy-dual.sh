#!/bin/bash
# ============================================================
# 绮管电商 - 一键部署脚本
# 用途: 在本地执行，自动完成构建、上传、部署全流程
# 
# 使用方法:
#   chmod +x deploy-dual.sh
#   ./deploy-dual.sh [环境]
#   ./deploy-dual.sh production  # 部署到生产环境
# ============================================================

set -e  # 遇到错误立即退出

# ==================== 配置区（根据实际情况修改） ====================
SERVER_USER="root"                    # 服务器用户名
SERVER_IP="101.34.39.231"            # 服务器IP地址
SERVER_PORT=22                        # SSH端口
REMOTE_DIR="/www/wwwroot/qiguan"      # 服务器上的项目目录

# 前端构建配置
FRONTEND_DIR="./qiguanqianduan"       # Vue前端目录
ADMIN_DIST_DIR="/var/www/admin/dist"  # 服务器上后台管理系统静态文件目录

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ==================== 步骤1: 环境检查 ====================
check_environment() {
    log_info "检查部署环境..."
    
    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安装"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        log_error "npm 未安装"
        exit 1
    fi
    
    if ! command -v scp &> /dev/null; then
        log_error "scp 未安装"
        exit 1
    fi
    
    if ! command -v ssh &> /dev/null; then
        log_error "ssh 未安装"
        exit 1
    fi
    
    log_info "✅ 环境检查通过"
}

# ==================== 步骤2: 构建前端项目 ====================
build_frontend() {
    log_info "开始构建后台管理系统..."
    
    cd "$FRONTEND_DIR"
    
    # 安装依赖
    npm install --production=false
    
    # 生产构建
    npm run build
    
    if [ ! -d "dist" ]; then
        log_error "前端构建失败，dist目录不存在"
        exit 1
    fi
    
    cd ..
    log_info "✅ 前端构建完成"
}

# ==================== 步骤3: 上传文件到服务器 ====================
upload_to_server() {
    log_info "上传文件到服务器 ${SERVER_IP}..."
    
    # 上传后端代码
    log_info "上传后端API代码..."
    rsync -avz \
        --exclude 'node_modules' \
        --exclude '.git' \
        --exclude 'data/*.db' \
        --exclude 'logs/*' \
        --exclude "$FRONTEND_DIR/node_modules" \
        --exclude "$FRONTEND_DIR/dist" \
        . "${SERVER_USER}@${SERVER_IP}:${REMOTE_DIR}/"
    
    # 单独上传前端构建产物
    log_info "上传前端构建产物..."
    ssh -p ${SERVER_PORT} ${SERVER_USER}@${SERVER_IP} "mkdir -p ${ADMIN_DIST_DIR}"
    scp -P ${SERVER_PORT} -r "${FRONTEND_DIR}/dist/"* "${SERVER_USER}@${SERVER_IP}:${ADMIN_DIST_DIR}/"
    
    log_info "✅ 文件上传完成"
}

# ==================== 步骤4: 服务器端操作 ====================
server_operations() {
    log_info "在服务器上执行部署操作..."
    
    ssh -p ${SERVER_PORT} ${SERVER_USER}@${SERVER_IP} << 'DEPLOY_SCRIPT'
set -e

cd /www/wwwroot/qiguan

echo "[INFO] 安装后端依赖..."
npm install --production

echo "[INFO] 重启后端服务..."
pm2 reload ecosystem.config.dual.js --env production || pm2 start ecosystem.config.dual.js --env production

echo "[INFO] 等待服务启动..."
sleep 5

echo "[INFO] 检查服务状态..."
pm2 status

echo "[INFO] 重载Nginx配置..."
nginx -t && systemctl reload nginx

echo "[INFO] 测试API健康检查..."
curl -f http://localhost:3000/health || echo "[WARN] 健康检查可能需要几秒钟"

echo "[INFO] ✅ 部署完成！"
DEPLOY_SCRIPT
}

# ==================== 步骤5: 部署验证 ====================
verify_deployment() {
    log_info "验证部署结果..."
    
    sleep 3
    
    # 检查后端API
    if curl -sf https://qimengzhiyue.cn/api/v1/health > /dev/null 2>&1; then
        log_info "✅ 后端API (https://qimengzhiyue.cn) 运行正常"
    else
        log_warn "⚠️ 后端API 可能还在启动中，请稍后手动验证"
    fi
    
    # 检查后台管理系统
    if curl -sfI https://admin.qimengzhiyue.cn > /dev/null 2>&1; then
        log_info "✅ 后台管理 (https://admin.qimengzhiyue.cn) 运行正常"
    else
        log_warn "⚠️ 后台管理系统可能还在启动中，请稍后手动验证"
    fi
}

# ==================== 主流程 ====================
main() {
    echo ""
    echo "========================================="
    echo "  绮管电商 - 一键部署工具"
    echo "  目标服务器: ${SERVER_IP}"
    echo "  部署时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "========================================="
    echo ""
    
    check_environment
    build_frontend
    upload_to_server
    server_operations
    verify_deployment
    
    echo ""
    log_info "🎉 部署成功！"
    echo ""
    echo "访问地址:"
    echo "  小程序API: https://qimengzhiyue.cn/api/v1/health"
    echo "  后台管理:  https://admin.qimengzhiyue.cn"
    echo ""
    echo "监控命令:"
    echo "  PM2状态:  ssh root@${SERVER_IP} 'pm2 status'"
    echo "  日志查看: ssh root@${SERVER_IP} 'pm2 logs qiguan-backend'"
    echo ""
}

# 执行主函数
main "$@"
