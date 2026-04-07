#!/bin/bash

# 创建Git仓库
echo "创建Git仓库..."
mkdir -p /home/git
cd /home/git
git init --bare repo.git

# 创建自动部署脚本
echo "创建自动部署脚本..."
cat > repo.git/hooks/post-receive << 'EOF'
#!/bin/bash
GIT_WORK_TREE=/root/绮管后台 git checkout -f
cd /root/绮管后台
npm install
npm run build
npm run start
echo "部署完成！"
EOF

# 设置执行权限
chmod +x repo.git/hooks/post-receive

# 安装依赖
echo "安装依赖..."
yum install -y epel-release
yum install -y certbot python3-certbot-nginx nginx

# 申请证书
echo "申请证书..."
certbot certonly --standalone -d qimengzhiyue.cn

# 配置Nginx
echo "配置Nginx..."
cat > /etc/nginx/conf.d/ecommerce.conf << 'EOF'
server {
    listen 80;
    server_name qimengzhiyue.cn;
    return 301 https://$host$request_uri;
}
server {
    listen 443 ssl;
    server_name qimengzhiyue.cn;
    
    ssl_certificate /etc/letsencrypt/live/qimengzhiyue.cn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/qimengzhiyue.cn/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# 重启Nginx
echo "重启Nginx..."
systemctl restart nginx
systemctl enable nginx

echo "服务器配置完成！"
