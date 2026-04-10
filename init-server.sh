#!/bin/bash
# ============================================================
# 绮管电商 - 服务器环境初始化脚本（首次部署使用）
# 
# 使用方法:
#   1. 在本地下载此脚本
#   2. 上传到服务器: scp init-server.sh root@你的IP:/root/
#   3. SSH登录服务器执行: chmod +x init-server.sh && ./init-server.sh
#   
# 脚本功能:
#   - 安装Node.js、Nginx、PM2等必要软件
#   - 配置防火墙规则
#   - 创建目录结构
#   - 配置SSL证书
#   - 安全加固
# ============================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "\n${BLUE}========== $1 ==========${NC}\n"; }

# ==================== 步骤0: 系统检查 ====================
check_system() {
    log_step "步骤0: 系统环境检查"
    
    # 检查操作系统
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        log_info "操作系统: $NAME $VERSION"
        
        if [[ "$ID" != "ubuntu" && "$ID" != "debian" && "$ID" != "centos" ]]; then
            log_error "不支持的操作系统: $ID (仅支持Ubuntu/Debian/CentOS)"
            exit 1
        fi
    else
        log_error "无法检测操作系统"
        exit 1
    fi
    
    # 检查是否为root用户
    if [ "$EUID" -ne 0 ]; then
        log_error "请使用root用户执行此脚本"
        exit 1
    fi
    
    log_info "✅ 系统检查通过"
}

# ==================== 步骤1: 系统更新 ====================
update_system() {
    log_step "步骤1: 更新系统包"
    
    apt-get update && apt-get upgrade -y
    
    log_info "✅ 系统更新完成"
}

# ==================== 步骤2: 安装基础工具 ====================
install_base_tools() {
    log_step "步骤2: 安装基础工具"
    
    apt-get install -y \
        curl \
        wget \
        git \
        unzip \
        rsync \
        vim \
        htop \
        ufw \
        fail2ban \
        logrotate
    
    log_info "✅ 基础工具安装完成"
}

# ==================== 步骤3: 安装Node.js ====================
install_nodejs() {
    log_step "步骤3: 安装Node.js (LTS版本)"
    
    if command -v node &> /dev/null; then
        local current_version=$(node -v)
        log_info "Node.js已安装: $current_version"
        read -p "是否重新安装? (y/N): " reinstall
        if [[ ! "$reinstall" =~ ^[Yy]$ ]]; then
            return
        fi
    fi
    
    # 使用NodeSource安装LTS版本
    curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
    apt-get install -y nodejs
    
    # 验证安装
    node_version=$(node -v)
    npm_version=$(npm -v)
    log_info "✅ Node.js安装成功: v$node_version"
    log_info "✅ npm版本: $npm_version"
}

# ==================== 步骤4: 安装PM2 ====================
install_pm2() {
    log_step "步骤4: 安装PM2进程管理器"
    
    npm install -g pm2
    
    # 设置PM2开机自启
    pm2 startup systemd -u root --hp /root
    pm2 save
    
    log_info "✅ PM2安装并配置自启动完成"
}

# ==================== 步骤5: 安装和配置Nginx ====================
install_nginx() {
    log_step "步骤5: 安装Nginx"
    
    apt-get install -y nginx
    
    # 启动并设置开机自启
    systemctl start nginx
    systemctl enable nginx
    
    log_info "✅ Nginx安装完成"
}

# ==================== 步骤6: 创建目录结构 ====================
create_directories() {
    log_step "步骤6: 创建项目目录结构"
    
    mkdir -p /www/wwwroot/qiguan          # 后端代码目录
    mkdir -p /var/www/admin/dist         # 前端静态文件目录
    mkdir -p /var/log/qiguan             # 应用日志目录
    mkdir -p /etc/nginx/ssl              # SSL证书目录
    mkdir -p /var/www/certbot            # Let's Encrypt验证目录
    
    # 设置权限
    chown -R www-data:www-data /var/www/admin
    chmod -R 755 /var/log/qiguan
    
    log_info "✅ 目录结构创建完成"
    tree -L 3 /www /var/log/qiguan 2>/dev/null || ls -la /www /var/log/qiguan
}

# ==================== 步骤7: 配置防火墙 ====================
configure_firewall() {
    log_step "步骤7: 配置UFW防火墙"
    
    # 启用UFW
    ufw default deny incoming
    ufw default allow outgoing
    
    # 允许SSH（重要！先确保能访问）
    ufw allow 22/tcp comment 'SSH'
    
    # 允许HTTP/HTTPS
    ufw allow 80/tcp comment 'HTTP'
    ufw allow 443/tcp comment 'HTTPS'
    
    # 允许Node.js开发端口（可选）
    # ufw allow 3000/tcp comment 'Node.js API'
    
    # 启用防火墙
    echo "y" | ufw enable
    
    # 查看状态
    ufw status verbose
    
    log_info "✅ 防火墙配置完成"
}

# ==================== 步骤8: 配置Fail2Ban ====================
configure_fail2ban() {
    log_step "步骤8: 配置Fail2Ban防暴力破解"
    
    cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log
EOF
    
    systemctl restart fail2ban
    systemctl enable fail2ban
    
    log_info "✅ Fail2Ban配置完成"
}

# ==================== 步骤9: 上传SSL证书 ====================
setup_ssl_certificates() {
    log_step "步骤9: SSL证书配置"
    
    local ssl_dir="/etc/nginx/ssl"
    
    if [ -f "${ssl_dir}/qimengzhiyue.cn_bundle.pem" ] && [ -f "${ssl_dir}/qimengzhiyue.cn.key" ]; then
        log_info "SSL证书已存在，跳过上传"
        return
    fi
    
    log_warn "⚠️ 请手动将SSL证书文件上传到 ${ssl_dir}/ 目录:"
    echo ""
    echo "  文件列表:"
    echo "    1. qimengzhiyue.cn_bundle.pem (证书文件)"
    echo "    2. qimengzhiyue.cn.key      (私钥文件)"
    echo ""
    echo "  上传命令示例:"
    echo "    scp qimengzhiyue.cn_bundle.pem root@\$(hostname):${ssl_dir}/"
    echo "    scp qimengzhiyue.cn.key root@\$(hostname):${ssl_dir}/"
    echo ""
    read -p "证书是否已上传? (y/N): " cert_uploaded
    
    if [[ ! "$cert_uploaded" =~ ^[Yy]$ ]]; then
        log_warn "跳过SSL配置，稍后手动配置"
        return
    fi
    
    # 设置权限
    chmod 644 "${ssl_dir}/qimengzhiyue.cn_bundle.pem"
    chmod 600 "${ssl_dir}/qimengzhiyue.cn.key"
    
    log_info "✅ SSL证书配置完成"
}

# ==================== 步骤10: 部署Nginx配置 ====================
deploy_nginx_config() {
    log_step "步骤10: 部署Nginx配置"
    
    local nginx_conf="/etc/nginx/conf.d/qiguan.conf"
    
    if [ -f "./nginx/conf.d/qiguan-dual-service.conf" ]; then
        cp "./nginx/conf.d/qiguan-dual-service.conf" "$nginx_conf"
        log_info "从本地复制Nginx配置"
    else
        log_warn "未找到本地Nginx配置文件，请稍后手动部署"
        return
    fi
    
    # 测试配置语法
    nginx -t
    
    # 重载Nginx
    systemctl reload nginx
    
    log_info "✅ Nginx配置部署完成"
}

# ==================== 步骤11: 系统优化 ====================
system_optimization() {
    log_step "步骤11: 系统性能优化"
    
    # 内核参数优化
    cat >> /etc/sysctl.d/99-qiguan.conf << 'EOF'
# 网络优化
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_tw_reuse = 1
net.core.netdev_max_backlog = 65535

# 文件描述符限制
fs.file-max = 2097152
EOF
    
    sysctl -p /etc/sysctl.d/99-qiguan.conf
    
    # 文件描述符限制（针对当前会话和永久生效）
    ulimit -n 65535
    echo "* soft nofile 65535" >> /etc/security/limits.conf
    echo "* hard nofile 65535" >> /etc/security/limits.conf
    
    log_info "✅ 系统优化完成"
}

# ==================== 步骤12: 配置日志轮转 ====================
setup_logrotate() {
    log_step "步骤12: 配置日志轮转"
    
    cat > /etc/logrotate.d/qiguan << 'EOF'
/var/log/qiguan/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0644 www-data www-data
    sharedscripts
    postrotate
        [ -f /var/run/pm2.pid ] && pm2 reloadLogs > /dev/null 2>&1 || true
    endscript
}
EOF
    
    log_info "✅ 日志轮转配置完成"
}

# ==================== 步骤13: 显示部署摘要 ====================
show_summary() {
    log_step "🎉 初始化完成！部署摘要"
    
    echo ""
    echo "========================================="
    echo "  服务器信息"
    echo "========================================="
    echo "主机名: $(hostname)"
    echo "IP地址: $(hostname -I | awk '{print $1}')"
    echo "系统: $(cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)"
    echo ""
    echo "========================================="
    echo "  已安装服务"
    echo "========================================="
    echo "Node.js: $(node -v 2>/dev/null || echo '未安装')"
    echo "Nginx: $(nginx -v 2>&1 | cut -d'/' -f2)"
    echo "PM2: $(pm2 -v 2>/dev/null || echo '未安装')"
    echo ""
    echo "========================================="
    echo "  重要目录"
    echo "========================================="
    echo "后端代码: /www/wwwroot/qiguan"
    echo "前端静态: /var/www/admin/dist"
    echo "应用日志: /var/log/qiguan"
    echo "SSL证书: /etc/nginx/ssl"
    echo "Nginx日志: /var/log/nginx/"
    echo ""
    echo "========================================="
    echo "  下一步操作"
    echo "========================================="
    echo "1. 上传SSL证书到 /etc/nginx/ssl/"
    echo "2. 执行一键部署: ./deploy-dual.sh"
    echo "3. 配置DNS解析:"
    echo "   - A记录: qimengzhiyue.cn -> 服务器IP"
    echo "   - CNAME: admin.qimengzhiyue.cn -> qimengzhiyue.cn"
    echo "4. 访问测试:"
    echo "   https://qimengzhiyue.cn/api/v1/health"
    echo "   https://admin.qimengzhiyue.cn"
    echo ""
    echo "常用命令:"
    echo "  查看服务状态: pm2 status"
    echo "  查看日志:     pm2 logs qiguan-backend"
    echo "  重启服务:     pm2 restart all"
    echo "  重载Nginx:    systemctl reload nginx"
    echo "========================================="
    echo ""
}

# ==================== 主流程 ====================
main() {
    echo ""
    echo "███████╗ █████╗ ██╗     ██╗  ██╗██╗   ██╗██╗     "
    echo "╚══███╔╝██╔══██╗██║     ██║ ██╔╝██║   ██║██║     "
    echo "  ███╔╝ ███████║██║     █████╔╝ ██║   ██║██║     "
    echo " ███╔╝  ██╔══██║██║     ██╔═██╗ ██║   ██║██║     "
    echo "███████╗██║  ██║███████╗██║  ██╗╚██████╔╝███████╗"
    echo "╚══════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝"
    echo ""
    echo "  绮管电商 - 服务器环境初始化工具"
    echo "  时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    
    check_system
    update_system
    install_base_tools
    install_nodejs
    install_pm2
    install_nginx
    create_directories
    configure_firewall
    configure_fail2ban
    setup_ssl_certificates
    deploy_nginx_config
    system_optimization
    setup_logrotate
    show_summary
    
    log_info "🎊 服务器初始化完成！可以开始部署应用了。"
}

# 执行主函数
main "$@"
