# 绮管电商后台部署指南

## 🔧 部署前准备

### 1. 本地验证
确保所有修复已完成：
- ✅ `request.js` 响应拦截器返回值已修复
- ✅ 前端路由 `base` 配置已统一为 `/admin`
- ✅ `API_BASE_URL` 配置已修复为 `/api`
- ✅ 前端已重新构建
- ✅ 数据库模块已统一

### 2. 服务器环境要求
- **Node.js**: >= 14.x
- **PM2**: 已安装 (`npm install -g pm2`)
- **Nginx**: 已配置
- **Git**: 已安装
- **MySQL/TDSQL-C**: 已配置

## 🚀 部署步骤

### 步骤 1: 上传代码到服务器

1. **本地压缩代码**:
   ```bash
   cd e:\1\绮管后台
   tar -czf qiguan-backend-deploy.tar.gz . --exclude=node_modules --exclude=data/*.db --exclude=.env --exclude=logs --exclude=backups
   ```

2. **上传到服务器** (使用 scp 或其他方式):
   ```bash
   scp qiguan-backend-deploy.tar.gz root@your-server:/www/wwwroot/
   ```

3. **服务器解压**:
   ```bash
   ssh root@your-server
   cd /www/wwwroot/
   tar -xzf qiguan-backend-deploy.tar.gz -C qiguan-backend/
   ```

### 步骤 2: 执行部署脚本

1. **进入项目目录**:
   ```bash
   cd /www/wwwroot/qiguan-backend
   ```

2. **设置执行权限**:
   ```bash
   chmod +x deploy.sh
   ```

3. **执行部署**:
   ```bash
   ./deploy.sh
   ```

   部署脚本会自动执行以下操作：
   - 环境预检
   - 创建备份
   - 拉取最新代码
   - 安装依赖
   - 构建前端
   - 重启服务
   - 执行冒烟测试

### 步骤 3: 验证部署

1. **检查服务状态**:
   ```bash
   pm2 status
   pm2 logs qiguan-backend --lines 50
   ```

2. **测试登录功能**:
   - 访问：`https://admin.qimengzhiyue.cn/admin/login`
   - 用户名：`admin`
   - 密码：`admin123`

3. **验证核心API**:
   ```bash
   # 健康检查
   curl http://localhost:3000/health
   
   # 登录测试
   curl -X POST http://localhost:3000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"admin123"}'
   ```

## 🔧 手动部署（如果自动脚本失败）

### 1. 安装依赖
```bash
cd /www/wwwroot/qiguan-backend
npm install

cd qiguanqianduan
npm install
npm run build
cd ..
```

### 2. 启动服务
```bash
npm install -g pm2
pm start  # 或 pm2 start index.js --name qiguan-backend
pm save
```

### 3. 配置 Nginx
确保 Nginx 配置正确指向 `dist` 目录：
```nginx
server {
    listen 80;
    server_name admin.qimengzhiyue.cn;
    
    location / {
        root /www/wwwroot/qiguan-backend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 📝 部署验证清单

- [ ] 前端页面可正常访问 (`/admin/login`)
- [ ] 登录功能正常（admin/admin123）
- [ ] 健康检查接口正常 (`/health`)
- [ ] API 接口可正常访问
- [ ] PM2 进程运行正常
- [ ] Nginx 配置正确

## 🔄 回滚操作

如果部署失败，使用以下命令回滚：
```bash
./deploy.sh --rollback
```

## 📞 故障排查

1. **前端白屏**：检查 `dist` 目录是否存在，Nginx 配置是否正确
2. **API 500 错误**：检查 PM2 日志，查看具体错误信息
3. **登录失败**：检查数据库连接，验证用户凭据
4. **404 错误**：检查路由配置和 Nginx 规则

## 📊 监控命令

```bash
# 查看实时日志
pm logs qiguan-backend --lines 100

# 监控进程
pm monit

# 重启服务
pm restart qiguan-backend
```

---

**部署完成后，请访问 https://admin.qimengzhiyue.cn/admin/login 测试登录功能。**
