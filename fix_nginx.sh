#!/bin/bash
# ============================================================
# 绮管后台 - 删除Nginx默认测试页面并配置正确站点
# 使用方法: 
#   1. 通过腾讯云WebShell登录服务器
#   2. 上传此脚本或直接复制粘贴执行
# ============================================================

echo "=========================================="
echo "  绮管后台 - Nginx 配置修复工具"
echo "  执行时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="
echo ""

# ---- 1. 备份当前Nginx配置 ----
echo "[1/7] 备份当前Nginx配置..."
BACKUP_DIR="/etc/nginx/backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r /etc/nginx/conf.d/* "$BACKUP_DIR/" 2>/dev/null || true
cp /etc/nginx/nginx.conf "$BACKUP_DIR/" 2>/dev/null || true
echo "✓ 配置已备份到 $BACKUP_DIR"

# ---- 2. 查找并删除Nginx默认测试页面 ----
echo ""
echo "[2/7] 查找并删除Nginx默认测试页面..."

DEFAULT_PAGES=$(find /usr/share/nginx /var/www/html /etc/nginx -name "index.html" -o -name "nginx.html" 2>/dev/null | grep -v "admin\|qiguan")

if [ -n "$DEFAULT_PAGES" ]; then
    echo "发现以下默认页面:"
    echo "$DEFAULT_PAGES"
    for page in $DEFAULT_PAGES; do
        if grep -q "OpenCloudOS\|Welcome to nginx\|nginx test page" "$page" 2>/dev/null; then
            echo "  → 删除: $page"
            rm -f "$page"
        fi
    done
    echo "✓ 默认测试页面已删除"
else
    echo "✓ 未找到默认测试页面"
fi

# ---- 3. 禁用默认站点配置 ----
echo ""
echo "[3/7] 禁用Nginx默认站点..."

if [ -f /etc/nginx/conf.d/default.conf ]; then
    mv /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.disabled
    echo "✓ default.conf 已禁用"
fi

if [ -f /etc/nginx/sites-enabled/default ]; then
    mv /etc/nginx/sites-enabled/default /etc/nginx/sites-enabled/default.disabled
    echo "✓ sites-enabled/default 已禁用"
fi

# ---- 4. 创建项目目录结构 ----
echo ""
echo "[4/7] 创建项目目录..."
mkdir -p /var/www/admin/dist
mkdir -p /var/www/certbot
mkdir -p /etc/nginx/ssl
echo "✓ 目录已创建"

# ---- 5. 部署优化的Nginx配置 ----
echo ""
echo "[5/7] 部署Nginx配置文件..."

cat > /etc/nginx/conf.d/qiguan.conf << 'EOF'
# ============================================================
# 绮管电商 - Nginx 配置
# ============================================================

upstream backend_api {
    server 127.0.0.1:3000;
    keepalive 32;
}

gzip on;
gzip_vary on;
gzip_comp_level 6;
gzip_min_length 1000;
gzip_types text/plain text/css application/json application/javascript text/xml;

server {
    listen 80;
    server_name qimengzhiyue.cn admin.qimengzhiyue.cn www.qimengzhiyue.cn api.qimengzhiyue.cn;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name qimengzhiyue.cn www.qimengzhiyue.cn api.qimengzhiyue.cn;

    ssl_certificate /etc/nginx/ssl/qimengzhiyue.cn_bundle.crt;
    ssl_certificate_key /etc/nginx/ssl/qimengzhiyue.cn.key;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Strict-Transport-Security "max-age=63072000" always;

    location /api/ {
        proxy_pass http://backend_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50m;
    }

    location /admin {
        alias /var/www/admin/dist;
        try_files $uri $uri/ /index.html;
    }

    location /admin/api/ {
        proxy_pass http://backend_api/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50m;
    }

    location ~ /\. {
        deny all;
    }
}

server {
    listen 443 ssl http2;
    server_name admin.qimengzhiyue.cn;

    ssl_certificate /etc/nginx/ssl/qimengzhiyue.cn_bundle.crt;
    ssl_certificate_key /etc/nginx/ssl/qimengzhiyue.cn.key;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    root /var/www/admin/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://backend_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50m;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location ~ /\. {
        deny all;
    }
}
EOF

echo "✓ Nginx配置已部署到 /etc/nginx/conf.d/qiguan.conf"

# ---- 6. 测试Nginx配置 ----
echo ""
echo "[6/7] 测试Nginx配置语法..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✓ Nginx配置语法正确"
else
    echo "✗ Nginx配置有误，请检查上述错误信息"
    exit 1
fi

# ---- 7. 重启Nginx服务 ----
echo ""
echo "[7/7] 重启Nginx服务..."
systemctl restart nginx && systemctl enable nginx
echo "✓ Nginx已重启并设置为开机启动"

# ---- 完成 ----
echo ""
echo "=========================================="
echo "  ✅ 修复完成！"
echo "=========================================="
echo ""
echo "📋 后续验证步骤:"
echo "  1. 访问 https://www.qimengzhiyue.cn (不应再显示测试页面)"
echo "  2. 访问 https://admin.qimengzhiyue.cn/admin (后台系统)"
echo "  3. 访问 https://api.qimengzhiyue.cn/api/v1/health (API健康检查)"
echo ""
echo "⚠️ 注意事项:"
echo "  - 如果看到'502 Bad Gateway'，说明Node.js后端服务未启动"
echo "  - 如果看到SSL证书错误，需要先申请或上传证书文件"
echo "  - 需要将前端构建产物上传到 /var/www/admin/dist/ 目录"
echo ""

# 显示当前Nginx状态
echo "📊 当前Nginx状态:"
systemctl status nginx --no-pager | head -5
