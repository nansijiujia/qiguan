# 绮管电商后台部署步骤

## 🎯 核心修复总结

已完成以下关键修复：
1. **修复 request.js 响应拦截器** - 正确返回响应数据
2. **统一前端路由配置** - base 配置为 `/admin`
3. **修复 API_BASE_URL** - 配置为 `/api`
4. **重新构建前端** - 产物已更新到 dist 目录
5. **统一数据库模块** - 创建 db_unified.js 支持多数据库

## 🚀 部署步骤

### 步骤 1: 上传代码到服务器

1. **本地压缩代码**:
   ```bash
   cd e:\1\绮管后台
   tar -czf qiguan-backend-deploy.tar.gz . --exclude=node_modules --exclude=data/*.db --exclude=.env --exclude=logs --exclude=backups
   ```

2. **上传到服务器**:
   ```bash
   scp qiguan-backend-deploy.tar.gz root@your-server:/www/wwwroot/
   ```

3. **服务器解压**:
   ```bash
   ssh root@your-server
   cd /www/wwwroot/
   tar -xzf qiguan-backend-deploy.tar.gz -C qiguan-backend/
   ```

### 步骤 2: 执行部署

1. **进入项目目录**:
   ```bash
   cd /www/wwwroot/qiguan-backend
   ```

2. **执行部署脚本**:
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```

### 步骤 3: 验证部署

1. **检查服务状态**:
   ```bash
   pm2 status
   pm2 logs qiguan-backend --lines 50
   ```

2. **测试登录**:
   - 访问: `https://admin.qimengzhiyue.cn/admin/login`
   - 用户名: `admin`
   - 密码: `admin123`

3. **验证API**:
   ```bash
   # 健康检查
   curl http://localhost:3000/health
   
   # 登录测试
   curl -X POST http://localhost:3000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"admin123"}'
   ```

## 🔧 手动部署（备用方案）

1. **安装依赖**:
   ```bash
   cd /www/wwwroot/qiguan-backend
   npm install
   
   cd qiguanqianduan
   npm install
   npm run build
   cd ..
   ```

2. **启动服务**:
   ```bash
   npm install -g pm2
   pm2 start index.js --name qiguan-backend
   pm2 save
   ```

3. **Nginx配置**:
   确保 Nginx 配置正确指向 `dist` 目录

## 📝 测试凭据

- **用户名**: admin
- **密码**: admin123

## 🔄 回滚操作

```bash
./deploy.sh --rollback
```

## 📞 故障排查

- **前端白屏**: 检查 dist 目录和 Nginx 配置
- **API 500 错误**: 查看 PM2 日志
- **登录失败**: 检查数据库连接
- **404 错误**: 检查路由配置

## 📊 监控命令

```bash
# 查看日志
pm logs qiguan-backend --lines 100

# 监控进程
pm monit

# 重启服务
pm restart qiguan-backend
```

---

**部署完成后，请访问 https://admin.qimengzhiyue.cn/admin/login 测试登录功能。**
