#!/bin/bash

echo "========================================="
echo "  绮管后台 - 服务器自动部署配置脚本"
echo "========================================="

echo ""
echo "[1/7] 创建Git裸仓库..."
mkdir -p /home/git
cd /home/git
git init --bare repo.git

echo ""
echo "[2/7] 创建post-receive自动部署钩子..."
cat > repo.git/hooks/post-receive << 'HOOK'
#!/bin/bash
DEPLOY_DIR=/root/绮管后台
FRONTEND_DIR=$DEPLOY_DIR/qiguanqianduan
WEB_ROOT=/var/www/qimengzhiyue

echo ">>> 开始自动部署..."

echo ">>> 拉取最新代码..."
GIT_WORK_TREE=$DEPLOY_DIR git checkout -f

echo ">>> 安装后端依赖..."
cd $DEPLOY_DIR
npm install --production

echo ">>> 安装前端依赖并构建..."
cd $FRONTEND_DIR
npm install
npm run build

echo ">>> 部署前端静态文件..."
mkdir -p $WEB_ROOT
rm -rf $WEB_ROOT/*
cp -r $FRONTEND_DIR/dist/* $WEB_ROOT/

echo ">>> 设置文件权限..."
chown -R nginx:nginx $WEB_ROOT
chmod -R 755 $WEB_ROOT

echo ">>> 重启后端服务（pm2）..."
cd $DEPLOY_DIR
pm2 restart ecommerce-backend || pm2 start index.js --name ecommerce-backend

echo ">>> 重载Nginx..."
nginx -s reload

echo ">>> 部署完成！"
HOOK

chmod +x repo.git/hooks/post-receive
echo "post-receive钩子已创建并设置执行权限"

echo ""
echo "[3/7] 安装EPEL仓库和基础依赖..."
yum install -y epel-release

echo ""
echo "[4/7] 安装Nginx和Certbot..."
yum install -y nginx certbot python3-certbot-nginx

echo ""
echo "[5/7] 申请Let's Encrypt SSL证书..."
echo "注意：申请前请确保域名 qimengzhiyue.cn 已解析到此服务器IP"
echo "如果80端口被占用，请先停止相关服务"
certbot certonly --standalone -d qimengzhiyue.cn

echo ""
echo "[6/7] 配置Nginx反向代理..."
cat > /etc/nginx/conf.d/ecommerce.conf << 'NGINX'
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

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    root /var/www/qimengzhiyue;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

echo ""
echo "[7/7] 启动并启用Nginx..."
nginx -t
systemctl restart nginx
systemctl enable nginx

echo ""
echo "========================================="
echo "  服务器配置完成！"
echo "========================================="
echo ""
echo "后续步骤："
echo "  1. 在服务器上手动部署一次：cd /root/绮管后台 && npm install --production"
echo "  2. 安装pm2: npm install -g pm2"
echo "  3. 启动后端: pm2 start index.js --name ecommerce-backend"
echo "  4. 设置pm2开机自启: pm2 startup && pm2 save"
echo "  5. 在本地执行: git push production master 即可自动部署"
echo ""
