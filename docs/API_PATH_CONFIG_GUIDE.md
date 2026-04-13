# API 路径配置规范

> **版本**: 1.0.0  
> **最后更新**: 2026-04-13  
> **适用项目**: 绮管电商后台管理系统

---

## 目录

1. [概述](#概述)
2. [核心概念](#核心概念)
3. [正确配置示例](#正确配置示例)
4. [完整请求链路](#完整请求链路)
5. [常见错误与解决方案](#常见错误与解决方案)
6. [案例研究：405 Method Not Allowed 错误](#案例研究405-method-not-allowed-错误)
7. [配置检查清单](#配置检查清单)
8. [最佳实践](#最佳实践)

---

## 概述

本文档详细说明了绮管电商后台管理系统的 API 路径配置规范，重点区分前端路由路径（`base`）和 API 基础路径（`VITE_API_BASE_URL`）的区别，防止因路径配置不一致导致的 405/404 等错误。

### 问题背景

在 2026-04-13 的部署过程中，系统出现了 **405 Method Not Allowed** 错误，根本原因是前端 `VITE_API_BASE_URL` 配置为 `/admin/api`，导致实际请求路径变为 `/admin/api/v1/auth/login`，而后端只注册了 `/api/v1/auth/login` 路由，造成路径不匹配。

---

## 核心概念

### 1. 前端路由路径 (`vite.config.js` 的 `base`)

**作用**: 定义前端应用的部署基础路径，影响：
- 静态资源（JS/CSS/图片）的加载路径
- Vue Router 的历史模式基路径
- 浏览器地址栏显示的 URL 前缀

**当前值**: `/admin`

**示例**:
```javascript
// vite.config.js
export default defineConfig({
  base: '/admin',  // ✅ 正确：仅用于前端路由
})
```

**影响范围**:
- 访问 URL: `https://admin.qimengzhiyue.cn/admin/login`
- 资源路径: `/admin/assets/index-xxx.js`
- Router 配置: `createWebHistory('/admin')`

### 2. API 基础路径 (`.env.production` 的 `VITE_API_BASE_URL`)

**作用**: 定义所有 API 请求的基础路径，用于 axios 实例的 `baseURL` 配置。

**当前值**: `/api`

**示例**:
```bash
# .env.production
VITE_API_BASE_URL=/api  # ✅ 正确：仅包含 API 前缀，不含 /admin
```

**关键规则**:
- ❌ **禁止**: 包含 `/admin` 前缀（如 `/admin/api`）
- ✅ **必须**: 仅设置为 `/api`
- ✅ **原因**: Nginx 会根据 `/api/` 路径规则代理到后端

### 3. 后端路由前缀

**作用**: Node.js 后端 Express/Koa 框架中注册的路由前缀。

**当前值**: `/api/v1`

**示例**:
```javascript
// index.js (后端主入口)
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/products', productRoutes)
```

### 4. 三者关系图

```
┌─────────────────────────────────────────────────────────────┐
│                      浏览器发起请求                          │
│                                                             │
│   URL: https://admin.qimengzhiyue.cn/api/v1/auth/login      │
│   Method: POST                                              │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Nginx 反向代理                            │
│                                                             │
│   匹配规则: location /api/ {                                │
│     proxy_pass http://backend_api;  → http://127.0.0.1:3000 │
│   }                                                         │
│                                                             │
│   转发目标: http://127.0.0.1:3000/api/v1/auth/login         │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  Node.js 后端服务                           │
│                                                             │
│   路由匹配: app.post('/api/v1/auth/login', handler)        │
│                                                             │
│   处理结果: 返回 JSON 响应 { token, user }                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 正确配置示例

### 1. 生产环境配置 (.env.production)

```bash
# ✅ 正确配置
VITE_API_BASE_URL=/api
VITE_APP_TITLE=绮管电商后台
VITE_APP_VERSION=3.0.0
VITE_APP_ENV=production
```

### 2. Vite 构建配置 (vite.config.js)

```javascript
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    },
    server: {
      port: 8080,
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL || 'http://localhost:3000',
          changeOrigin: true
        }
      }
    },
    base: '/admin',  // ✅ 仅用于前端路由
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false
    }
  }
})
```

### 3. HTTP 请求封装 (request.js)

```javascript
import axios from 'axios'

const service = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',  // ✅ 使用环境变量
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json;charset=UTF-8'
  }
})

// 请求拦截器 - 不修改 URL
service.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config  // ✅ 直接返回，不拼接额外路径
})

export default service
```

### 4. API 接口定义 (api/index.js)

```javascript
import request from '@/utils/request'

// ✅ 所有路径以 /v1/ 开头（不含 /api 或 /admin）
export const authApi = {
  login: (data) => request.post('/v1/auth/login', data),
  logout: () => request.post('/v1/auth/logout'),
  getUserInfo: () => request.get('/v1/auth/me')
}

export const productApi = {
  getList: (params) => request.get('/v1/products', { params }),
  add: (data) => request.post('/v1/products', data)
}
```

### 5. 开发环境配置 (.env.development)

```bash
# ✅ 开发环境使用完整 URL（含协议和端口）
VITE_API_BASE_URL=http://localhost:3000/api
```

**注意**: 开发环境需要完整 URL 是因为 Vite dev server 的 proxy 配置会处理 `/api` 前缀的转发。生产环境下使用相对路径 `/api` 即可，因为 Nginx 会负责代理。

---

## 完整请求链路

### 场景 1: 用户登录（生产环境）

```
1. 用户访问: https://admin.qimengzhiyue.cn/admin/login
   ↓
2. 前端加载: /admin/assets/index-xxx.js (base = /admin)
   ↓
3. 用户输入凭据并点击登录
   ↓
4. Axios 发起请求:
   - baseURL: /api (来自 VITE_API_BASE_URL)
   - path: /v1/auth/login
   - 完整URL: https://admin.qimengzhiyue.cn/api/v1/auth/login
   ↓
5. Nginx 匹配 location /api/ 规则:
   - 转发到: http://127.0.0.1:3000/api/v1/auth/login
   ↓
6. Node.js 后端处理:
   - 路由匹配: POST /api/v1/auth/login
   - 执行认证逻辑
   - 返回: { success: true, data: { token, user } }
   ↓
7. 前端接收响应，存储 token，跳转到 Dashboard
```

### 场景 2: 获取商品列表

```
1. Dashboard 页面调用: productApi.getList({ page: 1, size: 10 })
   ↓
2. Axios 构造请求:
   - baseURL: /api
   - path: /v1/products?page=1&size=10
   - 完整URL: GET https://admin.qimengzhiyue.cn/api/v1/products?page=1&size=10
   ↓
3. Nginx 代理到后端
   ↓
4. 后端返回商品列表数据
```

---

## 常见错误与解决方案

### ❌ 错误 1: VITE_API_BASE_URL 包含 /admin 前缀

**错误配置**:
```bash
# .env.production
VITE_API_BASE_URL=/admin/api  # ❌ 错误！
```

**导致的问题**:
- 请求 URL 变成: `https://admin.qimengzhiyue.cn/admin/api/v1/auth/login`
- Nginx 无法匹配正确的代理规则
- 可能返回 404 或被当作静态文件处理

**解决方案**:
```bash
VITE_API_BASE_URL=/api  # ✅ 移除 /admin 前缀
```

### ❌ 错误 2: 在请求拦截器中手动拼接路径

**错误代码**:
```javascript
service.interceptors.request.use((config) => {
  config.url = '/admin' + config.url  // ❌ 不要这样做！
  return config
})
```

**解决方案**:
```javascript
service.interceptors.request.use((config) => {
  // ✅ 只添加认证头，不修改 URL
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
```

### ❌ 错误 3: API 调用路径硬编码完整路径

**错误代码**:
```javascript
// api/index.js
export const authApi = {
  login: (data) => request.post('/api/v1/auth/login', data)  // ❌ 多余的 /api
}
```

**原因**: `request.js` 已经设置了 `baseURL: /api`，再写 `/api` 会导致双重前缀。

**解决方案**:
```javascript
export const authApi = {
  login: (data) => request.post('/v1/auth/login', data)  // ✅ 从 /v1/ 开始
}
```

### ❌ 错误 4: Nginx 配置路径不匹配

**错误配置**:
```nginx
location /admin/api/ {  # ❌ 与前端 baseURL 不匹配
    proxy_pass http://backend_api/;
}
```

**正确配置**:
```nginx
location /api/ {  # ✅ 与 VITE_API_BASE_URL 一致
    proxy_pass http://backend_api;
}
```

### ❌ 错误 5: 开发环境和生产环境配置混淆

**常见问题**: 将生产环境的相对路径 `/api` 用于开发环境，或反之。

**正确做法**:
```bash
# .env.development
VITE_API_BASE_URL=http://localhost:3000/api  # 完整 URL

# .env.production
VITE_API_BASE_URL=/api  # 相对路径
```

---

## 案例：405 Method Not Allowed 错误

### 问题现象

**时间**: 2026-04-13  
**环境**: 生产环境 (admin.qimengzhiyue.cn)  
**症状**: 
- 登录页面正常加载
- 输入凭据点击登录后控制台报错
- Network 面板显示: `405 Method Not Allowed`
- 请求 URL: `https://admin.qimengzhiyue.cn/admin/api/v1/auth/login`

### 根本原因分析

```
错误链路追踪:

1. .env.production 配置:
   VITE_API_BASE_URL=/admin/api  ← 🔴 错误源头

2. request.js 使用此配置:
   baseURL = '/admin/api'

3. API 调用:
   request.post('/v1/auth/login', data)
   
4. 实际请求 URL:
   /admin/api + /v1/auth/login = /admin/api/v1/auth/login
   
5. Nginx 处理:
   - 匹配不到 /api/ 规则（因为路径是 /admin/api/...）
   - 尝试匹配 /admin 规则 → 作为静态文件查找
   - 找不到文件 → 返回 405 或 404

6. 后端日志:
   - 未收到任何请求（Nginx 未成功转发）
   - 或收到的是 GET /admin/api/v1/auth/login（方法不对）
```

### 解决过程

#### Step 1: 定位问题

```bash
# 检查浏览器 Network 面板
Request URL: https://admin.qimengzhiyue.cn/admin/api/v1/auth/login
Method: POST
Status: 405 Method Not Allowed

# 发现 URL 中有多余的 /admin 前缀
```

#### Step 2: 修正配置

```bash
# 修改 qiguanqianduan/.env.production
- VITE_API_BASE_URL=/admin/api
+ VITE_API_BASE_URL=/api
```

#### Step 3: 重新构建和部署

```bash
cd qiguanqianduan
npm run build        # 重新构建
cp -r dist/* ../      # 复制到后端目录
git add .
git commit -m "fix: 修正 API 路径配置，移除多余的 /admin 前缀"
git push origin main  # 触发自动部署
```

#### Step 4: 验证修复

```bash
# 测试登录接口
curl -X POST https://admin.qimengzhiyue.cn/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 预期响应
{"success":true,"data":{"token":"xxx","user":{...}}}
```

### 经验教训

1. **明确职责分离**: `base` 用于前端路由，`VITE_API_BASE_URL` 用于 API 请求
2. **避免路径叠加**: 不要在多个地方重复添加相同的前缀
3. **自动化检测**: 使用配置检查脚本在部署前验证一致性
4. **文档化规范**: 编写本文档供团队成员参考

---

## 配置检查清单

### 部署前必查项

- [ ] `.env.production` 中 `VITE_API_BASE_URL=/api`（不是 `/admin/api`）
- [ ] `vite.config.js` 中 `base='/admin'`（仅用于前端路由）
- [ ] `src/utils/request.js` 使用 `import.meta.env.VITE_API_BASE_URL`
- [ ] `src/router/index.js` 使用 `createWebHistory('/admin')`
- [ ] 所有 API 调用路径从 `/v1/` 开始（不含 `/api` 或 `/admin`）
- [ ] Nginx 配置中 `location /api/` 代理到后端
- [ ] 开发环境 `.env.development` 使用完整 URL

### 自动化验证

运行配置检查脚本：

```bash
node scripts/check-api-config.js
```

预期输出：
```
✅ 配置检查通过
✅ 所有配置项一致，可以安全部署
```

如果发现问题：
```
❌ 发现配置问题：
   - VITE_API_BASE_URL 包含非法前缀: /admin/api
   - 建议: 修改为 /api
```

---

## 最佳实践

### 1. 环境变量命名规范

| 变量名 | 用途 | 示例值 |
|--------|------|--------|
| `VITE_API_BASE_URL` | API 请求基础路径 | `/api` |
| `VITE_APP_TITLE` | 应用标题 | 绮管电商后台 |
| `VITE_APP_VERSION` | 应用版本 | 3.0.0 |

### 2. 目录结构约定

```
qiguanqianduan/
├── .env.development      # 开发环境变量
├── .env.production       # 生产环境变量
├── vite.config.js        # Vite 配置（base 路径）
├── src/
│   ├── utils/
│   │   └── request.js    # HTTP 请求封装（读取 VITE_API_BASE_URL）
│   ├── api/
│   │   └── index.js      # API 接口定义（从 /v1/ 开始）
│   └── router/
│       └── index.js      # Vue Router（使用 base 路径）
```

### 3. Git 提交规范

修复配置问题时，提交信息应清晰说明：

```bash
git commit -m "fix(api-config): 修正 VITE_API_BASE_URL 为 /api，解决 405 错误"
```

### 4. CI/CD 集成建议

在部署流水线中加入配置检查步骤：

```yaml
# .github/workflows/deploy.yml
jobs:
  deploy:
    steps:
      - name: 检查 API 配置
        run: node scripts/check-api-config.js
      
      - name: 构建前端
        run: npm run build
      
      - name: 部署到生产
        # ... 部署逻辑
```

### 5. 监控和告警

建议在生产环境中监控以下指标：
- API 请求的 405/404 错误率
- 请求路径异常（包含 `/admin/api` 的请求）
- Nginx 错误日志中的路径相关警告

---

## 相关文件索引

| 文件 | 路径 | 说明 |
|------|------|------|
| 生产环境变量 | `qiguanqianduan/.env.production` | API 基础路径配置 |
| 开发环境变量 | `qiguanqianduan/.env.development` | 本地开发配置 |
| Vite 配置 | `qiguanqianduan/vite.config.js` | 构建和开发服务器配置 |
| 请求封装 | `qiguanqianduan/src/utils/request.js` | Axios 实例配置 |
| API 定义 | `qiguanqianduan/src/api/index.js` | 所有 API 接口 |
| 路由配置 | `qiguanqianduan/src/router/index.js` | Vue Router 配置 |
| Nginx 配置 | `nginx/conf.d/qiguan-dual-service.conf` | 反向代理规则 |
| 配置检查脚本 | `scripts/check-api-config.js` | 自动化验证工具 |
| 部署指南 | `docs/DEPLOYMENT_GUIDE.md` | 完整部署流程 |

---

## 版本历史

| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| 1.0.0 | 2026-04-13 | AI Assistant | 初始版本，基于 405 错误案例编写 |

---

## 联系方式

如有疑问或发现文档错误，请：
1. 查看相关源代码注释
2. 运行配置检查脚本验证
3. 参考 [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
