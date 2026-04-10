# 后台系统冒烟测试手册 (v4.0.0)

## 📖 文档信息
- **版本**: v4.0.0
- **适用环境**: 生产环境部署后验证
- **执行时机**: deploy.sh Step 9 自动执行 / 手动补测
- **预计耗时**: 5-10分钟
- **通过标准**: 6/6 全部通过 → ✅ 准予上线

---

## 🎯 测试目标

冒烟测试（Smoke Test）用于快速验证系统核心功能是否正常工作，**不是完整的功能测试**，而是确保"系统没有完全坏掉"。

### 测试范围
1. 基础设施健康检查
2. 认证系统可用性
3. 核心API响应
4. 进程稳定性

### 不在范围内
- 完整业务流程测试
- 性能压力测试
- 安全渗透测试
- UI/UX细节检查

---

## 📋 测试前准备

### 环境要求
- [ ] 部署脚本 `deploy.sh` 执行完毕无报错
- [ ] PM2进程状态显示 online
- [ ] Nginx已重载配置
- [ ] 数据库连接正常

### 工具准备
```bash
# 安装curl（如未安装）
sudo apt-get install curl  # Ubuntu/Debian
sudo yum install curl      # CentOS

# 安装jq（JSON处理工具，可选但推荐）
sudo apt-get install jq    # Ubuntu/Debian
sudo yum install jq        # CentOS
```

### 浏览器准备
- [ ] 清除浏览器缓存（Ctrl+Shift+R 强制刷新）
- [ ] 打开浏览器开发者工具（F12）→ Console标签页
- [ ] 准备记录测试结果

---

## ✅ 必须通过的6项测试 (P0 Critical)

---

### Test #1: 健康检查接口

**目的**: 验证Node.js进程正常运行且可响应  
**优先级**: 🔴 P0 Critical  
**URL**: `GET https://qimengzhiyue.cn/health`  
**预期结果**: HTTP 200 + JSON格式响应

#### 预期响应示例
```json
{
  "status": "healthy",
  "timestamp": "2026-04-10T08:30:00.000Z",
  "uptime": 1234.567,
  "version": "v4.0.0",
  "environment": "production",
  "database": "connected",
  "memory": {
    "rss": "85MB",
    "heapUsed": "45MB",
    "heapTotal": "60MB"
  }
}
```

#### 执行命令
```bash
# 方式1: 使用curl
curl -s http://localhost:3000/health | jq .

# 方式2: 检查HTTP状态码
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health
# 期望输出: 200

# 方式3: 检查响应时间
curl -s -o /dev/null -w "HTTP状态: %{http_code}\n响应时间: %{time_total}s\n" http://localhost:3000/health
```

#### 通过标准
- ✅ HTTP状态码 = 200
- ✅ Content-Type 包含 `application/json`
- ✅ 响应体包含 `"status":"healthy"` 或 `"status":"ok"`
- ✅ 响应时间 < 3秒
- ✅ 不是HTML页面（不包含 `<html>` 标签）

#### 失败判定
- ❌ 返回HTML/Vue SPA页面
- ❌ HTTP 404 / 500 / 502 / 503 / 504
- ❌ 超时 (>10秒)
- ❌ 返回空响应或错误JSON

#### 常见问题排查
| 问题现象 | 可能原因 | 解决方案 |
|---------|---------|---------|
| 返回HTML页面 | Nginx路由配置问题 | 检查 `nginx/conf.d/ecommerce_health_fix.conf` |
| 连接被拒绝 | Node.js未启动 | `pm2 list` 检查进程状态 |
| 超时无响应 | 应用卡死 | `pm2 logs` 查看错误日志 |
| 500错误 | 代码异常 | 检查 routes/health.js |

---

### Test #2: 登录功能

**目的**: 验证认证系统工作正常  
**优先级**: 🔴 P0 Critical  
**URL**: `POST https://qimengzhiyue.cn/api/v1/auth/login`  
**请求体**:
```json
{
  "username": "admin",
  "password": "admin123"
}
```

#### 预期响应示例
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "username": "admin",
      "role": "admin",
      "email": "admin@example.com"
    }
  },
  "message": "登录成功"
}
```

#### 执行命令
```bash
# 发送登录请求
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq .

# 仅检查是否包含token
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | grep -q '"token"' && echo "✅ 登录成功" || echo "❌ 登录失败"
```

#### 通过标准
- ✅ HTTP状态码 = 200
- ✅ 响应包含 `"success": true`
- ✅ 响应包含 `token` 字段（JWT格式，长字符串）
- ✅ 响应包含用户信息（id, username, role等）

#### 失败判定
- ❌ HTTP 401 (密码错误)
- ❌ HTTP 500 (服务器内部错误)
- ❌ 无token返回
- ❌ 用户信息缺失

#### 常见问题排查
| 问题现象 | 可能原因 | 解决方案 |
|---------|---------|---------|
| 401 Unauthorized | 密码错误或用户不存在 | 检查数据库users表 |
| 500 Server Error | JWT密钥未配置 | 检查 .env.production 的 JWT_SECRET |
| 连接超时 | 数据库查询慢 | 检查数据库连接池状态 |

---

### Test #3: 首页加载

**目的**: 验证前端资源正确部署且可访问  
**优先级**: 🔴 P0 Critical  
**URL**: `GET https://qimengzhiyue.cn/` 或 `GET https://qimengzhiyue.cn/index.html`

#### 检查项清单
- [ ] **HTTP状态码**: 200
- [ ] **页面标题**: 显示 "绮管后台" 或类似标题
- [ ] **左侧导航栏可见**:
  - Dashboard（仪表盘）
  - 商品管理
  - 分类管理
  - 订单管理
  - 用户管理
  - 其他菜单项...
- [ ] **Dashboard区域加载**:
  - 至少显示4个统计卡片（总用户、总商品、总订单、总收入）
  - 或者显示加载中的占位符/骨架屏
- [ ] **无JavaScript控制台错误**:
  - 打开 F12 → Console 标签
  - 不应有红色错误信息
  - 允许少量警告（黄色），但不能有错误（红色）

#### 执行步骤
```bash
# 1. 检查静态资源可访问性
curl -s -o /dev/null -w "%{http_code}" https://qimengzhiyue.cn/
# 期望: 200

# 2. 检查index.html内容
curl -s https://qimengzhiyue.cn/ | head -20
# 应包含: <!DOCTYPE html>, <title>绮管后台</title>

# 3. 检查关键JS/CSS文件是否存在
curl -s -o /dev/null -w "%{http_code}" https://qimengzhiyue.cn/assets/index-xxxxx.js
curl -s -o /dev/null -w "%{http_code}" https://qimengzhiyue.cn/assets/index-xxxxx.css
# 期望: 200 (注意: xxxx 是实际hash值，需从index.html中提取)
```

#### 浏览器手动测试
1. 打开 Chrome/Firefox 浏览器
2. 访问 `https://qimengzhiyue.cn/`
3. 按 `Ctrl+Shift+R` 强制刷新（清除缓存）
4. 检查上述所有检查项

#### 通过标准
- ✅ 页面完全加载，无白屏
- ✅ 导航栏和主要内容可见
- ✅ Console无红色错误
- ✅ 页面可在30秒内完全渲染

#### 失败判定
- ❌ 白屏或空白页面
- ❌ Console有JavaScript运行时错误
- ❌ 关键资源404（JS/CSS/图片）
- ❌ 页面加载超过60秒
- ❌ 样式错乱（CSS未加载）

#### 常见问题排查
| 问题现象 | 可能原因 | 解决方案 |
|---------|---------|---------|
| 白屏 | JS加载失败或执行错误 | F12查看Console和网络请求 |
| 样式丢失 | CSS路径错误或404 | 检查dist目录结构 |
| API请求跨域 | CORS配置问题 | 检查 index.js 中 cors 配置 |
| 图片不显示 | 路径错误或Nginx配置 | 检查静态资源路径映射 |

---

### Test #4: 商品列表API

**目的**: 验证商品数据可正常读取（核心业务数据）  
**优先级**: 🔴 P0 Critical  
**URL**: `GET https://qimengzhiyue.cn/api/v1/products?page=1&pageSize=10`

#### 预期响应示例
```json
{
  "success": true,
  "data": {
    "list": [
      {
        "id": 1,
        "name": "iPhone 15 Pro Max",
        "price": 8999.00,
        "stock": 100,
        "status": "active",
        "category_name": "手机数码",
        "stock_status": "充足"
      },
      // ... 更多商品
    ],
    "pagination": {
      "total": 156,
      "totalPages": 16,
      "page": 1,
      "limit": 10
    }
  },
  "responseTime": 45
}
```

#### 执行命令
```bash
# 获取商品列表
curl -s "http://localhost:3000/api/v1/products?page=1&pageSize=5" | jq '.success, .data.list | length, .data.pagination.total'

# 快速检查
curl -sf "http://localhost:3000/api/v1/products?page=1&pageSize=5" | grep -q '"success":true' && \
echo "✅ 商品列表API正常" || echo "❌ 商品列表API异常"

# 检查返回的商品数量
PRODUCTS_COUNT=$(curl -sf "http://localhost:3000/api/v1/products?page=1&pageSize=5" | jq '.data.list | length')
echo "返回商品数量: $PRODUCTS_COUNT"
```

#### 通过标准
- ✅ HTTP状态码 = 200
- ✅ `"success": true`
- ✅ `data.list` 是非空数组（如果数据库有商品数据）
- ✅ `data.pagination` 包含 total, page, limit 字段
- ✅ 每个商品对象包含 id, name, price, stock 等关键字段
- ✅ 响应时间 < 2秒

#### 失败判定
- ❌ 返回空数组（如有数据应该返回数据）
- ❌ 缺少必要字段（id, name, price等）
- ❌ HTTP 500 错误
- ❌ 响应时间 > 5秒

#### 常见问题排查
| 问题现象 | 可能原因 | 解决方案 |
|---------|---------|---------|
| 空数组 | 数据库无商品数据 | 先初始化测试数据 |
| 500错误 | SQL语法错误 | 检查 products 表结构 |
| 超时 | 数据库查询慢 | 添加索引或优化SQL |

---

### Test #5: 分类数据API

**目的**: 验证分类数据一致性（小程序端依赖此接口！）  
**优先级**: 🔴 P0 Critical  
**URL**: `GET https://qimengzhiyue.cn/api/v1/categories`

#### 为什么这个测试很重要？
⚠️ **分类数据是前后端联调的关键点！**
- 小程序首页展示分类导航
- 商品筛选依赖分类ID
- 如果分类数据不一致，会导致：
  - 小程序显示空白分类
  - 商品无法按分类筛选
  - 用户购物体验严重受损

#### 预期响应示例
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "手机数码",
      "sort_order": 1,
      "status": "active",
      "product_count": 45
    },
    {
      "id": 2,
      "name": "电脑办公",
      "sort_order": 2,
      "status": "active",
      "product_count": 32
    },
    // ... 更多分类
  ]
}
```

#### 执行命令
```bash
# 获取分类列表
curl -s "http://localhost:3000/api/v1/categories" | jq '.'

# 检查分类数量
CATEGORIES_COUNT=$(curl -sf "http://localhost:3000/api/v1/categories" | jq '.data | length')
echo "分类总数: $CATEGORIES_COUNT"

# 列出所有分类名称
curl -sf "http://localhost:3000/api/v1/categories" | jq -r '.data[].name'
```

#### 验证方法（重要！）
1. **记录后台返回的分类列表**:
   ```bash
   curl -sf "http://localhost:3000/api/v1/categories" | jq -r '.data[] | "\(.id) \(.name) \(.sort_order)"'
   ```

2. **对比小程序端显示的分类**:
   - 打开微信小程序
   - 进入首页
   - 查看"全部分类"区域
   - 确认分类名称和顺序与后台一致

3. **检查数据一致性**:
   - 分类数量一致？
   - 分类名称一致？
   - 排序顺序一致？

#### 通过标准
- ✅ HTTP状态码 = 200
- ✅ 返回非空数组（至少有几个主要分类）
- ✅ 每个分类包含 id, name, status 字段
- ✅ 与小程序端显示的分类**完全一致**

#### 失败判定
- ❌ 返回空数组（数据库无分类数据）
- ❌ 分类数量与小程序不一致
- ❌ 分类名称或排序不一致
- ❌ 缺少关键字段

#### 常见问题排查
| 问题现象 | 可能原因 | 解决方案 |
|---------|---------|---------|
| 分类为空 | 未导入分类数据 | 执行 database/init_data.sql |
| 排序不一致 | sort_order字段未设置 | 更新categories表的sort_order |
| 名称不一致 | 数据不同步 | 统一数据源 |

---

### Test #6: PM2进程健康

**目的**: 验证应用进程稳定运行  
**优先级**: 🔴 P0 Critical  
**命令**: `pm2 list` 或 `pm2 show qiguan-backend`

#### 预期输出示例
```
┌────┬──────────────────┬──────────┬─────────┬────────┬─────────┐
│ id │ name             │ mode     │ status  │ restart│ uptime  │
├────┼──────────────────┼──────────┼─────────┼────────┼─────────┤
│ 0  │ qiguan-backend   │ fork     │ online  │ 0      │ 2m 30s  │
└────┴──────────────────┴──────────┴─────────┴────────┴─────────┘
```

#### 执行命令
```bash
# 1. 查看PM2进程列表
pm2 list

# 2. 查看详细状态
pm2 show qiguan-backend

# 3. 查看实时日志（最后20行）
pm2 logs qiguan-backend --lines 20 --nostream

# 4. 监控面板（交互式，按q退出）
pm2 monit
```

#### 检查项清单
- [ ] **status = online** (不是 errored, stopped, stopping)
- [ ] **restart次数** = 0 或 < 3次/小时 (频繁重启说明有问题)
- [ ] **uptime** > 1分钟 (说明稳定运行，不是刚重启又崩溃)
- [ ] **CPU使用率** < 80% (`pm2 show qiguan-backend` 查看)
- [ ] **内存占用** < 256MB (根据ecosystem.config.js的max_memory_restart配置)
- [ ] **无异常日志** (ERROR/FATAL级别的错误)

#### 执行脚本（自动化检查）
```bash
#!/bin/bash
# PM2健康检查脚本

echo "=== PM2 Process Health Check ==="

# 检查进程状态
STATUS=$(pm2 list | grep qiguan-backend | awk '{print $9}')
UPTIME=$(pm2 list | grep qiguan-backend | awk '{print $10}')
RESTARTS=$(pm2 list | grep qiguan-backend | awk '{print $8}')

if [ "$STATUS" = "online" ]; then
  echo "✅ Status: $STATUS"
else
  echo "❌ Status: $STATUS (expected: online)"
  exit 1
fi

if [ "$RESTARTS" -lt 3 ]; then
  echo "✅ Restarts: $RESTARTS (< 3 is good)"
else
  echo "⚠️  Restarts: $RESTARTS (frequent restarts detected!)"
fi

echo "✅ Uptime: $UPTIME"

# 检查内存使用
MEMORY=$(pm2 show qiguan-backend | grep "heap usage" | awk '{print $4}')
echo "📊 Memory: ${MEMORY:-unknown}"

echo ""
echo "=== Check Complete ==="
```

#### 通过标准
- ✅ status = online
- ✅ restart < 3次
- ✅ uptime > 1分钟
- ✅ CPU < 80%
- ✅ 内存 < 256MB
- ✅ 日志无FATAL错误

#### 失败判定
- ❌ status = errored / stopped
- ❌ restart >= 3次（频繁崩溃重启）
- ❌ uptime < 1分钟（启动后立即退出）
- ❌ 内存持续增长接近限制
- ❌ CPU 100%持续超过1分钟

#### 常见问题排查
| 问题现象 | 可能原因 | 解决方案 |
|---------|---------|---------|
| status=errored | 启动失败 | pm2 logs 查看启动错误 |
| 频繁restart | 内存泄漏或未捕获异常 | 检查代码是否有内存泄漏 |
| 高CPU占用 | 死循环或密集计算 | 检查最近代码变更 |
| 高内存占用 | 内存泄漏 | 重启PM2并监控内存趋势 |

---

## 📊 测试结果记录表

| Test ID | 测试项       | URL                              | 结果         | 响应时间 | 备注 |
|---------|-------------|----------------------------------|--------------|----------|------|
| T1      | 健康检查     | GET /health                      | □通过 □失败  | ___ms    | |
| T2      | 登录API      | POST /auth/login                 | □通过 □失败  | ___ms    | |
| T3      | 首页加载     | GET /                            | □通过 □失败  | ___ms    | |
| T4      | 商品列表     | GET /products                    | □通过 □失败  | ___ms    | |
| T5      | 分类数据     | GET /categories                  | □通过 □失败  | ___ms    | |
| T6      | PM2进程     | pm2 list                         | □通过 □失败  | -        | |

### 结果统计
- **通过数**: ____/6
- **失败数**: ____/6
- **总体结果**:
  - [ ] **✅ 准予上线** (6/6 全部通过)
  - [ ] **⚠️ 有条件上线** (≥5/6 通过，需修复后补测)
  - [ ] **🔴 阻断上线** (<5/6 通过，必须修复后重新部署)

---

## 🔄 回滚决策树

```
测试结果
  ├── 6/6 通过 → ✅ 部署成功，通知相关方
  ├── 5/6 通过
  │   └── 失败的是T1(健康检查)或T2(登录)?
  │       ├── 是 → ⚠️ 有条件上线（核心功能受损）
  │       └── 否 → ✅ 可以上线（非核心功能后续修复）
  ├── 4/6 通过
  │   └── 核心功能(T1,T2,T4)都通过?
  │       ├── 是 → ⚠️ 需评估风险后决定
  │       └── 否 → 🔴 建议回滚
  └── <4/6 通过 → 🔴 立即回滚！
      └── 执行: ./deploy.sh --rollback
```

---

## 🐛 常见问题速查

### Q1: 所有测试都超时
**可能原因**: Node.js进程未启动或端口未监听
**解决方案**:
```bash
pm2 list              # 检查进程状态
pm2 logs --lines 50   # 查看日志
netstat -tlnp | grep 3000  # 检查端口
```

### Q2: T1返回HTML而非JSON
**可能原因**: Nginx将/health路由到前端SPA
**解决方案**:
1. 检查Nginx配置: `cat nginx/conf.d/ecommerce_health_fix.conf`
2. 确认包含 `location = /health` 精确匹配
3. 重载Nginx: `nginx -t && systemctl reload nginx`

### Q3: T2登录失败401
**可能原因**: 数据库用户表无admin账号或密码错误
**解决方案**:
```bash
mysql -u root -p qmzyxcx -e "SELECT id, username FROM users WHERE username='admin'"
# 如果无结果，需要插入管理员账号
```

### Q4: T3前端白屏
**可能原因**: 构建产物缺失或JS执行错误
**解决方案**:
1. 检查dist目录: `ls -lh qiguanqianduan/dist/`
2. 检查网络请求: F12 → Network标签
3. 查看Console错误: F12 → Console标签

### Q5: T4/T5返回空数组
**可能原因**: 数据库无测试数据
**解决方案**:
```bash
mysql -u root -p qmzyxcx < database/init_data.sql
```

### Q6: PM2频繁重启
**可能原因**: 未捕获异常导致进程崩溃
**解决方案**:
```bash
pm2 logs qiguan-backend --lines 100  # 查看崩溃前的错误日志
# 根据错误信息修复代码
```

---

## 📝 测试报告模板

```markdown
# 冒烟测试报告

**测试时间**: YYYY-MM-DD HH:MM:SS
**测试人**: _______________
**部署版本**: commit _________
**测试环境**: 生产环境 (qimengzhiyue.cn)

## 测试结果汇总

| 测试项 | 结果 | 响应时间 | 截图/证据 |
|--------|------|----------|-----------|
| T1 健康检查 | ✅/❌ | ___ms | |
| T2 登录API | ✅/❌ | ___ms | |
| T3 首页加载 | ✅/❌ | ___ms | |
| T4 商品列表 | ✅/❌ | ___ms | |
| T5 分类数据 | ✅/❌ | ___ms | |
| T6 PM2进程 | ✅/❌ | - | |

**结论**: ✅ 准予上线 / ⚠️ 有条件上线 / 🔴 不予上线

**备注**:
_______________________________________________

**签字**: _______________ 日期: _______
```

---

## 🎓 附录：高级用法

### 自动化测试脚本
可以将以下命令保存为 `run_smoke_test.sh` 并执行：

```bash
#!/bin/bash
# 一键冒烟测试脚本

PASS=0
FAIL=0

test_api() {
  local name=$1
  local url=$2
  local method=$3
  local data=$4

  if [ "$method" = "GET" ]; then
    response=$(curl -sf "$url")
  else
    response=$(curl -sf -X POST "$url" -H "Content-Type: application/json" -d "$data")
  fi

  if [ $? -eq 0 ] && echo "$response" | grep -q '"success"'; then
    echo "✅ $name"
    ((PASS++))
  else
    echo "❌ $name"
    ((FAIL++))
  fi
}

echo "=== 开始冒烟测试 ==="
test_api "健康检查" "http://localhost:3000/health" "GET" ""
test_api "登录API" "http://localhost:3000/api/v1/auth/login" 'POST' '{"username":"admin","password":"admin123"}'
test_api "商品列表" "http://localhost:3000/api/v1/products?page=1&pageSize=5" "GET" ""
test_api "分类数据" "http://localhost:3000/api/v1/categories" "GET" ""

echo ""
echo "=== 测试完成 ==="
echo "通过: $PASS/4, 失败: $FAIL/4"
```

### 性能基线记录
建议每次部署后记录性能数据，形成基线：

```bash
# 创建性能基线文件
cat > performance_baseline_$(date +%Y%m%d).log << EOF
=== Performance Baseline $(date) ===

[Health Check]
Response Time: $(curl -s -o /dev/null -w "%{time_total}" http://localhost:3000/health)s

[Login API]
Response Time: $(curl -s -o /dev/null -w "%{time_total}" -X POST http://localhost:3000/api/v1/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}')s

[Products API]
Response Time: $(curl -s -o /dev/null -w "%{time_total}" "http://localhost:3000/api/v1/products?page=1&pageSize=10")s

[Categories API]
Response Time: $(curl -s -o /dev/null -w "%{time_total}" http://localhost:3000/api/v1/categories)s

[PM2 Memory]
$(pm2 show qiguan-backend | grep "heap usage")

EOF
```

---

**文档维护**: AI Assistant
**最后更新**: 2026-04-10
**版本历史**:
- v1.0 (2026-04-09): 初始版本
- v2.0 (2026-04-10): 增加P0问题验证、详细排查指南
