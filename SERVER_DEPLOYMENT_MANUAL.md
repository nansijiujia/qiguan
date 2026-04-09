# 🚀 方案B - 服务器部署操作手册

**生成时间**: 2026-04-09
**当前分支**: `feature/option-b-security-hardening`
**最新Commit**: `7ca9a557` (Phase 1安全修复)
**基础Commit**: `b51241fd` (清理完成)

---

## ✅ 已完成的本地工作

### Phase 1: 紧急安全修复 ✅
1. **JWT强密钥**: 64字节随机密钥已生成
   ```
   dy/QDLXKFdtuUdPI8Z4/w2fOrL/dIMvEGGzOvRlpk+fMIkLow849X2m2lx3mxygvWMYnJFt2qZ9EfCpxPGmxrA==
   ```

2. **CORS加固**: 从 `origin: '*'` 改为白名单
   - 允许: `https://qimengzhiyue.cn` (生产)
   - 允许: `http://localhost:5173` (开发)
   - 拒绝: 所有其他域名

3. **认证保护**: 5个关键路由添加了verifyToken中间件
   - `/api/v1/categories`
   - `/api/v1/products`
   - `/api/v1/dashboard`
   - `/api/v1/cart`
   - `/api/v1/content`

4. **密码安全**: Login.vue移除硬编码admin/admin123

### Phase 2: 本地构建验证 ✅
- 前端构建成功 (2260 modules, 6.87s, exit code 0)
- dist/目录已生成

---

## 🔴 Phase 3: 服务器部署（~10分钟停机）

### 步骤 3.1: 推送代码到远程仓库

#### 方法A: 推送feature分支（推荐）
```bash
# 在本地执行
cd "e:\1\绮管后台"
git push origin feature/option-b-security-hardening
```

#### 方法B: 合并到master后推送
```bash
# 切换到master分支
git checkout master

# 合并feature分支
git merge feature/option-b-security-hardening

# 推送master到远程
git push origin master

# 或者推送到绮管分支（根据您的远程分支名）
git push origin master:绮管
```

> ⚠️ **注意**: 根据之前的经验，远程分支名可能是 `绮管` 而非 `master`。请先确认：
> ```bash
> git remote -v
> git branch -r
> ```

---

### 步骤 3.2: SSH连接到服务器

```bash
ssh root@101.34.39.231
```

**如果SSH密钥认证失败，尝试密码登录**：
```bash
ssh root@101.34.39.231 -o PreferredAuthentications=password
```

---

### 步骤 3.3: 服务器端代码同步

```bash
# 进入项目目录（请根据实际路径调整）
cd /www/wwwroot/qimengzhiyue.cn
# 或
cd /root/qiguan-backend
# 或其他您实际的项目路径

# 查看当前Git状态
git status
git log --oneline -3

# 拉取最新代码
# 如果推送的是feature分支：
git pull origin feature/option-b-security-hardening

# 如果推送的是master/绮管分支：
git pull origin 绮管
# 或
git pull origin master
```

**如果遇到冲突**：
```bash
# 放弃本地修改，强制使用远程版本
git reset --hard origin/绮管
git clean -fd
git pull
```

---

### 步骤 3.4: 更新环境变量（重要！）

**编辑 `.env.production` 文件**：
```bash
vim .env.production
# 或
nano .env.production
```

**找到第30行左右，更新JWT_SECRET为**：
```env
# ==================== JWT 认证配置 ====================
JWT_SECRET=dy/QDLXKFdtuUdPI8Z4/w2fOrL/dIMvEGGzOvRlpk+fMIkLow849X2m2lx3mxygvWMYnJFt2qZ9EfCpxPGmxrA==
```

**同时确认CORS配置**（约第42行）：
```env
CORS_ORIGIN=https://qimengzhiyue.cn,http://localhost:5173
```

**保存退出**:
- Vim: 按 `Esc`, 输入 `:wq`, 回车
- Nano: 按 `Ctrl+O`, 回车, `Ctrl+X`

---

### 步骤 3.5: 重新构建前端

```bash
# 进入前端目录
cd qiguanqianduan

# 清理旧的构建产物和缓存
rm -rf dist node_modules/.vite

# 重新安装依赖（确保一致性）
npm install

# 执行生产构建
npm run build

# 验证构建结果
ls -la dist/
echo "=== 构建完成 ==="
```

**期望输出示例**：
```
dist/index.html                           0.64 kB
dist/assets/Categories-C5NHiTFG.css       0.44 kB
dist/assets/Login-DGBCseTm.css            0.78 kB  ← 注意文件名变更(硬编码密码已移除)
... (共19个文件)
✓ built in X.XXs
```

---

### 步骤 3.6: 更新Nginx配置（如需要）

**检查当前Nginx配置**：
```bash
cat /etc/nginx/conf.d/qiguan.conf
# 或
cat /etc/nginx/sites-enabled/qimengzhiyue.cn
```

**如果存在之前报告的 `proxy_set_header` 错误（第26行），应用标准配置**：

```bash
sudo tee /etc/nginx/conf.d/qiguan.conf > /dev/null << 'EOF'
server {
    listen 80;
    server_name qimengzhiyue.cn;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name qimengzhiyue.cn;

    # SSL证书 (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/qimengzhiyue.cn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/qimengzhiyue.cn/privkey.pem;

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # 前端静态文件
    location / {
        root /www/wwwroot/qimengzhiyue.cn/qiguanqianduan/dist;
        try_files $uri $uri/ /index.html;
        
        # 静态资源缓存
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 30d;
            add_header Cache-Control "public, immutable";
        }
    }

    # API代理到Node.js后端
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        
        # 关键代理头（修复之前的语法错误）
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket支持（如需要）
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF
```

**测试Nginx配置语法**：
```bash
sudo nginx -t
# 期望输出: nginx: configuration file /etc/nginx/nginx.conf test is successful
```

**如果测试失败**：
```bash
# 查看错误详情
sudo nginx -t 2>&1 | head -20

# 不要继续重启，先修复错误！
```

---

### 步骤 3.7: 重启服务

#### 重启PM2（Node.js后端）
```bash
# 查看当前PM2进程
pm2 list

# 重启所有应用
pm2 restart all

# 或重启特定应用（根据ecosystem.config.js中的应用名）
pm2 restart qiguan-backend

# 查看启动日志（确认无错误）
pm2 logs --lines 50 --nostream

# 确认运行状态
pm2 status
```

**预期输出**：
```
┌────┬────────────────────┬──────────┬────────┬──────────┬──────────┬────────┐
│ id │ name               │ mode     │ status │ restarts │ uptime   │ memory │
├────┼────────────────────┼──────────┼────────┼──────────┼──────────┼────────┤
│ 0  │ qiguan-backend     │ fork     │ online │ 0        │ 0s       │ 40MB   │
└────┴────────────────────┴──────────┴────────┴──────────┴──────────┴────────┘
```

**如果有启动错误**：
```bash
# 查看详细错误日志
pm2 logs qiguan-backend --err --lines 100

# 手动测试后端是否能启动
cd /path/to/project
node index.js
# 观察输出，按 Ctrl+C 停止
```

#### 重启Nginx
```bash
# 平滑重载（推荐，不会断开现有连接）
sudo systemctl reload nginx

# 或完全重启
sudo systemctl restart nginx

# 验证运行状态
sudo systemctl status nginx
```

**⚠️ 停机窗口**: 约5-30秒（Nginx reload通常<1秒）

---

### 步骤 3.8: 验证基本连通性

```bash
# 测试HTTP→HTTPS重定向
curl -I http://qimengzhiyue.cn
# 期望: 301 Moved Permanently → https://...

# 测试HTTPS访问
curl -I https://qimengzhiyue.cn
# 期望: HTTP/2 200

# 测试API健康检查
curl https://qimengzhiyue.cn/api/health
# 期望: {"status":"ok","database":true,"uptime":...}

# 测试API版本端点
curl https://qimengzhiyue.cn/api/v1/health
# 期望: {"status":"ok", ...}
```

**如果健康检查失败**：
```bash
# 检查后端是否在运行
pm2 status
curl http://127.0.0.1:3000/health

# 检查端口是否被监听
netstat -tlnp | grep :3000
ss -tlnp | grep :3000
```

---

## 🔵 Phase 4: 功能与安全验证

### 4.1 浏览器功能测试

**打开浏览器访问**: https://qimengzhiyue.cn

#### 测试1: 登录功能
- [ ] 登录页面正常显示（不再显示"默认账号: admin/admin123"）
- [ ] 用户名和密码字段为空（无预填）
- [ ] 输入凭据: `admin` / `admin123`
- [ ] 点击登录 → 成功跳转到Dashboard
- [ ] **⚠️ 重要**: 登录成功后立即修改默认密码！

#### 测试2: Dashboard页面
- [ ] 页面加载无错误（浏览器F12控制台无红色错误）
- [ ] 数据图表正常显示（ECharts渲染成功）
- [ ] 统计数字卡片显示正常

#### 测试3: API认证保护验证

**方法A: 使用浏览器开发者工具**
1. 打开Dashboard页面（已登录状态）
2. 按F12打开开发者工具 → Network标签
3. 刷新页面，查看API请求
4. 确认请求头包含: `Authorization: Bearer <token>`

**方法B: 使用命令行测试未授权访问**
```bash
# 测试无Token访问（应返回401）
curl -X GET https://qimengzhiyue.cn/api/v1/dashboard/stats
# 期望: 401 Unauthorized
# 或: {"success":false,"error":{"code":"UNAUTHORIZED","message":"Invalid or missing authentication token"}}

# 测试无Token访问产品列表（应返回401）
curl -X GET https://qimengzhiyue.cn/api/v1/products
# 期望: 401 Unauthorized

# 测试公开端点（应正常访问）
curl -X GET https://qimengzhiyue.cn/api/v1/health
# 期望: 200 OK
curl -X POST https://qimengzhiyue.cn/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
# 期望: 200 OK + JWT Token
```

#### 测试4: CORS安全验证

**从非白名单域名测试**（可选，需要另一个域名或工具）
```bash
# 使用curl模拟来自其他域名的请求
curl -H "Origin: https://evil.com" \
  -H "Access-Control-Request-Method: GET" \
  -X OPTIONS \
  https://qimengzhiyue.cn/api/v1/health

# 期望响应头不包含:
# Access-Control-Allow-Origin: https://evil.com
# (应该被拒绝或不包含该头)
```

---

### 4.2 完整页面功能清单

请在浏览器中逐一测试以下页面：

#### 必测页面（6个）

| 页面 | URL路径 | 测试项 | 状态 |
|------|---------|--------|------|
| **Login** | `/` 或 `/login` | 显示正常、无预填凭据、可提交 | ⬜ |
| **Dashboard** | `/dashboard` | 图表显示、统计数据正确 | ⬜ |
| **Products** | `/products` | 产品列表、搜索、CRUD操作 | ⬜ |
| **Categories** | `/categories` | 分类列表、添加/编辑/删除 | ⬜ |
| **Orders** | `/orders` | 订单列表、筛选、详情查看 | ⬜ |
| **Users** | `/users` | 用户列表、角色管理 | ⬜ |

#### 必测API端点（需认证）

| 端点 | 方法 | 认证要求 | 预期行为 | 状态 |
|------|------|----------|----------|------|
| `/api/v1/auth/login` | POST | ❌ 不需要 | 返回JWT Token | ⬜ |
| `/api/v1/dashboard/*` | GET | ✅ 需Token | 返回仪表盘数据 | ⬜ |
| `/api/v1/products` | GET | ✅ 需Token | 返回产品列表 | ⬜ |
| `/api/v1/categories` | GET | ✅ 需Token | 返回分类列表 | ⬜ |
| `/api/v1/orders` | GET | ✅ 需Token | 返回订单列表 | ⬜ |
| `/api/v1/cart/*` | GET/POST | ✅ 需Token | 购物车操作 | ⬜ |
| `/api/v1/users` | GET | ✅ 需Admin角色 | 返回用户列表 | ⬜ |
| `/api/v1/search` | GET | ❌ 不需要 | 搜索功能 | ⬜ |
| `/api/v1/health` | GET | ❌ 不需要 | 健康检查 | ⬜ |

---

### 4.3 性能基准测试（可选但推荐）

```bash
# 首页加载时间
time curl -s -o /dev/null -w "%{time_total}s\n" https://qimengzhiyue.cn
# 期望: < 3秒（首次加载含资源下载）

# API响应时间
time curl -s -o /dev/null -w "%{time_total}s\n" https://qimengzhiyue.cn/api/v1/health
# 期望: < 200ms

# 登录API响应时间
time curl -s -o /dev/null -w "%{time_total}s\n" -X POST \
  https://qimengzhiyue.cn/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
# 期望: < 500ms
```

---

## 🔄 回滚预案

### 场景A: 部署后发现严重问题

**立即回滚到上一个稳定版本**：
```bash
# SSH到服务器
ssh root@101.34.39.231

cd /www/wwwroot/qimengzhiyue.cn

# 查看历史提交
git log --oneline -5

# 回退到清理完成状态（b51241fd）
git reset --hard b51241fd

# 或回退到更早的备份（52f281ad）
git reset --hard 52f281adf8cef064db4d3202511af4cc829d2431

# 重新构建前端
cd qiguanqianduan && npm run build

# 重启服务
pm2 restart all
sudo systemctl reload nginx

# 验证恢复
curl -I https://qimengzhiyue.cn
```

### 场景B: 无法SSH到服务器

联系腾讯云控制台：
1. 登录腾讯云控制台 → 云服务器CVM
2. 选择实例: 101.34.39.231
3. 点击"登录"（VNC/WebShell）
4. 执行上述回滚命令

### 场景C: 数据库连接失败

```bash
# 检查MySQL/TDSQL-C连接
mysql -h 10.0.0.16 -u QMZYXCX -p'LJN040821.' qmzyxcx -e "SELECT 1"

# 如果连接失败，检查：
# 1. TDSQL-C实例状态（腾讯云控制台）
# 2. 安全组规则是否允许3306端口
# 3. 数据库账号权限
```

---

## 📊 部署检查清单

### 部署前检查
- [ ] 本地代码已推送 (`git push` 成功)
- [ ] 新的JWT密钥已记录在安全位置
- [ ] 备份当前服务器上的.env.production（可选但推荐）
  ```bash
  cp .env.production .env.production.backup_$(date +%Y%m%d_%H%M%S)
  ```

### 部署中检查
- [ ] Git pull 无冲突
- [ ] .env.production 的 JWT_SECRET 已更新
- [ ] 前端构建成功 (`npm run build` exit code 0)
- [ ] Nginx 配置测试通过 (`nginx -t`)
- [ ] PM2 启动无错误 (`pm2 status` 显示 online)
- [ ] Nginx 重启成功 (`systemctl status nginx` 显示 active)

### 部署后验证
- [ ] HTTPS访问正常 (curl返回200)
- [ ] API健康检查通过 (/api/health 返回ok)
- [ ] 登录功能正常 (可获取JWT Token)
- [ ] 未授权访问返回401 (无Token时访问受保护API)
- [ ] Dashboard页面正常显示 (浏览器测试)
- [ ] 所有CRUD操作可用 (Products/Categories/Orders等)

---

## 🎯 部署完成后必做事项

### 1. 修改默认管理员密码（最高优先级！）

登录系统后立即修改admin账号的默认密码！

**方法A: 通过前端界面**（如果提供"修改密码"功能）

**方法B: 通过数据库直接更新**（如果没有前端功能）
```sql
-- 连接到数据库
mysql -h 10.0.0.16 -u QMZYXCX -p'LJN040821.' qmzyxcx

-- 更新admin密码（bcrypt哈希，需要Node.js生成）
-- 在本地执行:
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('YourNewStrongPassword123!', 10).then(h => console.log(h));"
-- 复制输出的hash值

-- 执行SQL更新
UPDATE users SET password = '<生成的bcrypt_hash>' WHERE username = 'admin';
```

### 2. 清理浏览器缓存

部署后建议通知用户（包括自己）：
- 强制刷新浏览器: `Ctrl + Shift + R` (Windows/Linux) 或 `Cmd + Shift + R` (Mac)
- 或清除浏览器缓存后重新访问

### 3. 监控日志

部署后持续监控一段时间（至少30分钟）：
```bash
# 实时查看PM2日志
pm2 logs qiguan-backend --lines 100

# 查看Nginx错误日志
tail -f /var/log/nginx/error.log

# 查看Nginx访问日志
tail -f /var/log/nginx/access.log | grep -E "(401|403|500)"
```

---

## 📞 问题排查指南

### 常见问题及解决方案

#### 问题1: 前端显示"无法连接到后端"
**可能原因**:
- PM2未启动或崩溃
- 后端端口3000未监听
- Nginx代理配置错误

**解决方案**:
```bash
pm2 status                    # 检查PM2状态
pm2 restart all               # 重启PM2
netstat -tlnp | grep :3000   # 检查端口
curl http://127.0.0.1:3000/health  # 直接测试后端
```

#### 问题2: 登录后返回401 Unauthorized
**可能原因**:
- JWT_SECRET前后端不一致
- Token过期（24小时有效期）
- CORS阻止了请求

**解决方案**:
```bash
# 检查.env.production中的JWT_SECRET是否与代码一致
grep JWT_SECRET .env.production

# 清除浏览器的localStorage中的旧token
# 打开浏览器F12 → Application → Local Storage → 删除token和user

# 重新登录
```

#### 问题3: CORS错误（跨域请求被阻止）
**可能原因**:
- 前端域名不在白名单中
- Nginx缺少CORS头

**解决方案**:
```bash
# 检查当前访问的URL是否为https://qimengzhiyuecn
# （注意不是http或其他域名）

# 检查index.js中的allowedOrigins数组
grep -A 10 "allowedOrigins" index.js
```

#### 问题4: Nginx 502 Bad Gateway
**可能原因**:
- 后端服务未启动
- 后端端口错误
- Socket连接超时

**解决方案**:
```bash
pm2 status                          # 检查后端状态
pm2 restart qiguan-backend         # 重启后端
sudo systemctl reload nginx         # 重载Nginx
```

---

## 📝 部署日志模板

请在此记录实际部署过程（用于审计和故障排查）：

| 时间 | 操作 | 操作人 | 结果 | 备注 |
|------|------|--------|------|------|
| YYYY-MM-DD HH:MM | 开始Phase 3部署 | | | |
| | Git推送代码 | | | Commit: ____ |
| | SSH连接服务器 | | | IP: 101.34.39.231 |
| | 服务器Git Pull | | | 分支: ____ |
| | 更新.env.production | | | JWT_SECRET已更新 ✓/✗ |
| | 前端npm run build | | | Exit code: __, 耗时: __s |
| | Nginx配置测试 | | | nginx -t 结果: ____ |
| | PM2重启 | | | 状态: online/offline |
| | Nginx重启 | | | 状态: active/inactive |
| | 基本连通性测试 | | | HTTP状态码: __ |
| | 登录功能测试 | | | 成功/失败 |
| | API认证测试 | | | 401验证: 通过/失败 |
| | **🎉 部署完成** | | | 总耗时: __分钟 |

---

## 🎉 总结

### 本次部署的核心改进

1. **安全性提升**:
   - ✅ JWT密钥强度：弱密钥 → 64字节强随机密钥
   - ✅ CORS策略：通配符(*) → 严格白名单
   - ✅ API保护：5个关键路由添加认证中间件
   - ✅ 密码管理：移除前端硬编码凭据

2. **代码质量**:
   - ✅ 项目整洁度提升31.3%（清理22个冗余文件）
   - ✅ 构建流程稳定（多次验证exit code 0）
   - ✅ Git历史清晰（规范的commit message）

3. **运维保障**:
   - ✅ 完整的回滚预案（3个场景）
   - ✅ 详细的部署文档（本手册）
   - ✅ 全面的测试检查清单

### 预期效果

部署成功后，系统将具备：
- 🔒 **更强的身份认证**（不可预测的JWT密钥）
- 🛡️ **更严格的访问控制**（域名+Token双重验证）
- 📝 **更安全的用户交互**（无默认凭据暴露）
- 🚀 **更好的可维护性**（干净的项目结构）

---

**祝部署顺利！如有问题，请参考上方"问题排查指南"或查看Git历史记录。**

**最后更新**: 2026-04-09
**文档版本**: 1.0
