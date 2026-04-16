# 绮管电商后台系统 - 运维监控指南

> **版本**: 2.0  
> **更新日期**: 2026-04-17  
> **适用环境**: 生产环境 / 预发布环境

---

## 📋 目录

1. [系统架构概览](#1-系统架构概览)
2. [前端错误捕获系统](#2-前端错误捕获系统)
3. [后端日志中间件](#3-后端日志中间件)
4. [PM2 进程管理](#4-pm2-进程管理)
5. [常见问题排查](#5-常见问题排查)
6. [性能指标解读](#6-性能指标解读)
7. [应急响应流程](#7-应急响应流程)
8. [日常维护清单](#8-日常维护清单)

---

## 1. 系统架构概览

### 1.1 监控组件

```
┌─────────────────────────────────────────────────────────────┐
│                    前端 (Vue 3 + Vite)                       │
│  ┌─────────────────┐  ┌──────────────────┐                  │
│  │ error-handler-   │  │ error-reporter   │                  │
│  │ enhanced.js      │  │ .js              │                  │
│  │ - JS运行时错误    │  │ - 错误上报服务    │                  │
│  │ - Promise异常     │  │ - 批量队列       │                  │
│  │ - Vue组件错误     │  │ - Beacon发送     │                  │
│  │ - 资源加载失败    │  └──────────────────┘                  │
│  │ - CSP违规检测     │                                        │
│  └─────────────────┘                                         │
└─────────────────────────────────────────────────────────────┘
                              ↓ HTTP API
┌─────────────────────────────────────────────────────────────┐
│                    后端 (Express.js)                          │
│  ┌──────────────────────┐  ┌─────────────────────────────┐  │
│  │ request-logger-      │  │ PM2 Process Manager         │  │
│  │ enhanced.js          │  │                             │  │
│  │ - requestId追踪      │  │ - 自动重启                 │  │
│  │ - 性能指标收集        │  │ - 内存限制 (512MB)          │  │
│  │ - 慢请求告警 (>2s)   │  │ - 日志轮转                 │  │
│  │ - 错误率统计          │  │ - 集群模式支持             │  │
│  └──────────────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↓ 日志文件
┌─────────────────────────────────────────────────────────────┐
│                    日志与监控系统                              │
│  logs/pm2-error.log  |  logs/pm2-out.log                    │
│  scripts/monitor.sh  |  /api/v1/health/metrics              │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 关键文件位置

| 组件 | 文件路径 | 说明 |
|------|---------|------|
| **前端错误处理器** | `admin-frontend/src/utils/error-handler-enhanced.js` | 全局错误捕获核心模块 |
| **后端日志中间件** | `middleware/request-logger-enhanced.js` | 请求日志和性能追踪 |
| **PM2 配置** | `ecosystem.config.js` | 生产环境进程管理配置 |
| **监控脚本** | `scripts/monitor.sh` | 系统健康检查脚本 |
| **健康检查路由** | `routes/health.js` | 包含 `/metrics` 端点 |

---

## 2. 前端错误捕获系统

### 2.1 错误类型覆盖

| 错误类型 | 捕获方式 | 触发场景 | 示例代码 |
|---------|---------|---------|---------|
| **JavaScript运行时错误** | `window.onerror` | 同步代码异常、语法错误 | `undefinedVar.prop` |
| **Promise未处理拒绝** | `unhandledrejection` | 异步操作失败未catch | `Promise.reject('err')` |
| **Vue组件错误** | `app.config.errorHandler` | 渲染错误、生命周期钩子异常 | 模板引用undefined变量 |
| **资源加载失败** | `error事件(捕获阶段)` | 图片/脚本/CSS加载失败 | `<img src="404.jpg">` |
| **CSP安全违规** | `securitypolicyviolation` | Content Security Policy违反 | 内联脚本执行 |

### 2.2 错误数据结构

```javascript
{
  errorId: "ERR_1709234567890_abc123",  // 唯一错误ID
  type: "JAVASCRIPT_ERROR",             // 错误类型
  message: "Cannot read property 'x' of undefined",
  stack: "Error: ... at Object.<anonymous> ...",
  source: "https://example.com/app.js",
  line: 42,
  column: 15,
  url: "https://admin.example.com/dashboard",
  userAgent: "Mozilla/5.0 ...",
  timestamp: "2026-04-17T10:30:00.000Z",
  env: "production"
}
```

### 2.3 批量上报机制

- **队列大小**: 最大50条错误
- **刷新间隔**: 每5秒自动批量上报
- **页面关闭**: 使用 `navigator.sendBeacon()` 保证数据不丢失
- **开发调试**: 
  ```javascript
  // 在浏览器控制台查看统计信息
  window.__ERROR_HANDLER_STATS()
  
  // 手动触发批量上传
  window.__FORCE_FLUSH_ERRORS()
  ```

### 2.4 开发 vs 生产行为差异

| 特性 | 开发环境 | 生产环境 |
|-----|---------|---------|
| 控制台详细堆栈 | ✅ 显示完整堆栈 | ❌ 仅显示摘要 |
| Promise默认阻止 | ❌ 不阻止（便于调试） | ✅ 阻止默认输出 |
| Console.error拦截 | ✅ 前100条全部记录 | ✅ 每10条采样记录 |
| 警告级别过滤 | ✅ 显示所有警告 | ⚠️ 仅显示关键警告 |

---

## 3. 后端日志中间件

### 3.1 日志格式

#### 请求开始日志
```
[REQUEST] 📥 GET /api/v1/products [req_1234567890_abcd]
{ ip: "192.168.1.100", contentType: "application/json" }
```

#### 响应完成日志
```
[RESPONSE] ✅ GET /api/v1/products -> 200 [156ms] [req_1234567890_abcd]
```

#### 慢请求告警
```
[SLOW_REQUEST] 🐢 慢请求警告 (>2000ms):
{ method: "POST", url: "/api/v1/orders", duration: "3542ms", statusCode: 200 }
```

#### 极慢请求告警
```
[CRITICAL_SLOW] 🔴 极慢请求 (>5s): { method: "POST", url: "/api/v1/orders", duration: "5678ms" }
```

#### 快速失败告警
```
[FAST_FAIL] ⚡ 快速失败 (<100ms): { method: "GET", url: "/api/v1/users", statusCode: 500 }
```

### 3.2 requestId 追踪系统

每个HTTP请求都会分配唯一的 `requestId`，贯穿整个请求生命周期：

```bash
# 在日志中搜索特定请求的所有日志
pm2 logs qimeng-api --grep "req_1234567890_abcd"

# 或使用grep命令
grep "req_1234567890_abcd" ./logs/pm2-out.log
```

**用途**:
- 追踪单个请求的完整生命周期
- 关联前后端错误日志
- 排查分布式调用链问题

### 3.3 敏感信息脱敏

以下请求头会被自动脱敏（生产环境）：
- `authorization` → `[REDACTED]`
- `cookie` → `[REDACTED]`
- `x-api-key` → `[REDACTED]`

### 3.4 性能指标端点

访问 `GET /api/v1/health/metrics` 获取实时指标：

```json
{
  "timestamp": "2026-04-17T10:30:00.000Z",
  "uptime": 3600.5,
  "pid": 12345,
  "node_version": "v18.17.0",
  "request_metrics": {
    "totalRequests": 15234,
    "errorResponses": 23,
    "slowRequests": 156,
    "errorRate": "0.15%",
    "slowRate": "1.02%",
    "slow_request_threshold_ms": 2000
  },
  "memory": {
    "rss_mb": 245,
    "heap_used_mb": 180,
    "heap_total_mb": 256,
    "external_mb": 12
  },
  "cpu": {
    "usage": { "user": 1234567, "system": 987654 }
  }
}
```

---

## 4. PM2 进程管理

### 4.1 启动和停止

```bash
# 启动生产环境
pm2 start ecosystem.config.js --env production

# 启动开发环境
pm2 start ecosystem.config.js --env development

# 零停机重启（推荐）
pm2 reload qimeng-api

# 强制重启
pm2 restart qimeng-api

# 停止服务
pm2 stop qimeng-api

# 删除进程
pm2 delete qimeng-api
```

### 4.2 日志查看

```bash
# 实时查看所有日志
pm2 logs qimeng-api

# 仅查看错误日志
pm2 logs qimeng-api --err

# 查看最近100行日志
pm2 logs qimeng-api --lines 100

# 清空所有日志
pm2 flush

# 导出最近1小时的错误日志到文件
pm2 logs qimeng-api --err --lines 0 --nostream 1h > errors_$(date +%Y%m%d).log

# 按关键词过滤
pm2 logs qimeng-api --grep "SLOW_REQUEST"
pm2 logs qimeng-api --grep "ERROR"
```

### 4.3 日志轮转配置

首次部署时需要安装并配置日志轮转插件：

```bash
# 安装 pm2-logrotate 插件
pm2 install pm2-logrotate

# 配置轮转参数
pm2 set pm2-logrotate:max_size 10M      # 单个日志文件最大10MB
pm2 set pm2-logrotate:retain 30         # 保留30个历史文件
pm2 set pm2-logrotate:compress true     # 压缩旧日志
pm2 set pm2-logrotate:dateFormat "YYYY-MM-DD_HH-mm-ss"

# 验证配置
pm2 conf
```

### 4.4 监控仪表盘

```bash
# 启动交互式监控界面（需要TUI终端）
pm2 monit

# 查看进程详细信息
pm2 show qimeng-api

# 查看进程列表
pm2 list
```

### 4.5 自动重启策略

| 配置项 | 当前值 | 说明 |
|-------|--------|------|
| `autorestart` | `true` | 崩溃后自动重启 |
| `max_restarts` | `10` | 1小时内最大重启次数 |
| `min_uptime` | `'10s'` | 最小稳定运行时间 |
| `restart_delay` | `4000ms` | 重启间隔延迟 |
| `max_memory_restart` | `'512M'` | 内存超限自动重启 |

**重启循环保护**: 如果进程在10秒内崩溃超过10次，PM2将停止尝试重启，避免无限重启循环。

---

## 5. 常见问题排查

### 5.1 错误码参考表

| 错误码/关键词 | 含义 | 常见原因 | 解决方案 |
|--------------|------|---------|---------|
| **ECONNREFUSED** | 连接被拒绝 | 端口未监听/防火墙 | 检查端口占用：`netstat -tlnp \| grep 3003` |
| **ENOTFOUND** | DNS解析失败 | 域名不存在/DNS故障 | 检查DNS配置：`nslookup your-domain.com` |
| **EADDRINUSE** | 地址已被占用 | 端口被其他进程占用 | 查找占用进程：`lsof -i :3003` |
| **ETIMEDOUT** | 连接超时 | 网络不通/目标无响应 | 检查网络连通性：`ping target-host` |
| **ENOMEM / FATAL ERROR: CALL_AND_RETRY_LAST** | 内存溢出 | 内存泄漏/大数据量处理 | 增加 `max_memory_restart` 或优化代码 |
| **EACCES** | 权限不足 | 文件权限/端口<1024 | 使用sudo或更改端口 |
| **DB_NOT_READY** | 数据库未就绪 | MySQL未启动/连接池耗尽 | 检查MySQL状态：`systemctl status mysql` |
| **PROTOCOL_CONNECTION_LOST** | 数据库连接丢失 | 网络中断/连接超时 | 检查数据库连接池配置 |
| **RATE_LIMITED** | 请求频率过高 | 触发限流规则 | 降低请求频率或调整限流阈值 |

### 5.2 典型问题排查步骤

#### 问题1: 服务无法启动

```bash
# 1. 检查PM2状态
pm2 list

# 2. 查看启动日志
pm2 logs qimeng-api --lines 50 --nostream

# 3. 检查端口占用
netstat -tlnp | grep 3003

# 4. 手动测试启动
NODE_ENV=production node index.js

# 5. 检查依赖完整性
npm ci --production
```

#### 问题2: 高内存占用

```bash
# 1. 查看当前内存使用
pm2 show qimeng-api | grep memory

# 2. 查看详细的V8堆快照（需开启--inspect）
curl http://localhost:3003/api/v1/health/metrics

# 3. 检查是否有内存泄漏
# 重启服务后持续观察内存增长趋势
pm2 restart qimeng-api
watch -n 5 'pm2 show qimeng-api | grep memory'

# 4. 如果确认泄漏，使用 heapdump 分析
npm install heapdump --save-dev
# 在代码中添加: require('heapdump').writeSnapshot('/tmp/')
```

#### 问题3: 慢请求频繁

```bash
# 1. 查看慢请求日志
pm2 logs qimeng-api --grep "SLOW_REQUEST" --lines 100 --nostream

# 2. 分析哪些接口最慢
grep "SLOW_REQUEST" ./logs/pm2-out.log | awk '{print $NF}' | sort | uniq -c | sort -rn | head -20

# 3. 检查数据库查询性能
# 在middleware中已集成慢查询告警

# 4. 使用性能分析工具
# 安装: npm install clinic.js -g
clinic doctor -- on-port 3003
```

#### 问题4: 频繁重启

```bash
# 1. 查看重启历史
pm2 prettylist | grep -A 10 qimeng-api

# 2. 检查最近错误日志
pm2 logs qimeng-api --err --lines 50 --nostream

# 3. 检查是否达到最大重启次数限制
pm2 list | grep qimeng-api

# 4. 如果是OOM导致的重启
dmesg | grep -i "out of memory" | tail -20

# 5. 临时解决方案：增加内存限制或降低负载
```

---

## 6. 性能指标解读

### 6.1 关键指标阈值

| 指标 | 正常范围 | 警告范围 | 危险范围 | 采集方式 |
|-----|---------|---------|---------|---------|
| **Response Time P50** | < 200ms | 200-500ms | > 500ms | `/metrics`端点计算 |
| **Response Time P99** | < 500ms | 500-1000ms | > 1000ms | APM工具或自定义 |
| **Error Rate** | < 1% | 1%-5% | > 5% | `errorResponses / totalRequests` |
| **Memory Usage** | < 256MB | 256-450MB | > 512MB | PM2或`/metrics` |
| **CPU Usage** | < 50% | 50%-80% | > 80% | `top`或PM2 |
| **Restart Count/hour** | 0 | 1-3次 | > 10次 | `pm2 list` |
| **Slow Request Rate** | < 5% | 5%-15% | > 15% | `slowRequests / totalRequests` |
| **Database Latency** | < 50ms | 50-200ms | > 200ms | 自定义中间件 |

### 6.2 性能基线建议

根据业务类型设定不同的SLA：

| 业务场景 | 可用性要求 | 响应时间要求 | 并发能力 |
|---------|-----------|------------|---------|
| **后台管理系统** | 99.5% | P95 < 800ms | 100 QPS |
| **API接口服务** | 99.9% | P99 < 500ms | 500 QPS |
| **高并发活动** | 99.99% | P99 < 200ms | 5000+ QPS |

### 6.3 监控面板推荐工具

- **免费方案**: PM2 Monit + 自定义脚本 (`scripts/monitor.sh`)
- **轻量级**: Prometheus + Grafana (开源)
- **企业级**: Datadog / New Relic / Sentry (商业)

---

## 7. 应急响应流程

### 7.1 服务宕机应急流程

```
发现宕机 → 检查PM2状态 → 查看错误日志 → 尝试重启 → 通知团队 → 根因分析
    ↓            ↓           ↓            ↓          ↓          ↓
  监控告警   pm2 list    pm2 logs --err  pm2 restart  钉钉/邮件  编写报告
```

**具体操作步骤**:

```bash
# Step 1: 确认宕机
curl -f http://localhost:3003/api/v1/health || echo "Service Down!"

# Step 2: 检查PM2状态
pm2 list

# Step 3: 查看最近错误
pm2 logs qimeng-api --err --lines 50 --nostream

# Step 4: 尝试快速恢复
pm2 restart qimeng-api && sleep 5 && curl http://localhost:3003/api/v1/health

# Step 5: 如果重启失败，手动测试
NODE_ENV=production node index.js &

# Step 6: 通知团队（示例：钉钉机器人）
curl -X POST 'https://oapi.dingtalk.com/robot/send?access_token=YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"msgtype":"text","text":{"content":"⚠️ 绮管后台服务宕机，正在紧急处理..."}}'
```

### 7.2 数据库连接失败应急流程

```bash
# 1. 检查MySQL服务状态
systemctl status mysql
# 或 Docker环境
docker ps | grep mysql

# 2. 测试数据库连通性
mysql -u root -p -e "SELECT 1"

# 3. 检查连接池状态
curl http://localhost:3003/api/v1/health/database

# 4. 查看数据库相关错误日志
pm2 logs qimeng-api --grep "DB_" --lines 30 --nostream

# 5. 重启数据库服务（如必要）
sudo systemctl restart mysql

# 6. 重启应用服务
pm2 restart qimeng-api
```

### 7.3 内存溢出(OOM)应急流程

```bash
# 1. 确认OOM
dmesg | grep -i "killed process" | tail -5
pm2 list | grep qimeng-api

# 2. 查看内存趋势（如果有历史数据）
pm2 show qimeng-api | grep memory

# 3. 临时措施：增加内存限制
# 编辑 ecosystem.config.js
# max_memory_restart: '1024M'
pm2 restart qimeng-api --update-env

# 4. 长期措施：
#    a) 使用heapdump分析内存泄漏
#    b) 优化代码（减少闭包、清理缓存）
#    c) 增加服务器内存或水平扩展
```

### 7.4 安全事件应急流程

如果发现可疑的攻击行为：

```bash
# 1. 查看最近的异常IP请求
grep -r "192.168.1.x" ./logs/pm2-out.log | tail -50

# 2. 检查限流触发情况
pm2 logs qimeng-api --grep "RATE_LIMITED" --lines 50 --nostream

# 3. 临时封禁IP（通过Nginx或防火墙）
# Nginx示例:
# deny 192.168.1.x;

# 4. 检查认证日志
pm2 logs qimeng-api --grep "auth\|login" --lines 100 --nostream

# 5. 通知安全团队
```

---

## 8. 日常维护清单

### 8.1 每日检查项 (Daily Checklist)

- [ ] 运行监控脚本: `./scripts/monitor.sh`
- [ ] 检查错误日志: `pm2 logs qimeng-api --err --lines 100`
- [ ] 确认服务可用性: `curl http://localhost:3003/api/v1/health`
- [ ] 查看内存使用: `pm2 show qimeng-api | grep memory`
- [ ] 检查磁盘空间: `df -h | grep '/$'`

### 8.2 每周维护任务 (Weekly Tasks)

- [ ] 日志轮转检查: `ls -lh ./logs/` (确保没有超大文件)
- [ ] PM2配置备份: `cp ecosystem.config.js backup/ecosystem.config.$(date +%Y%m%d).js`
- [ ] 依赖更新检查: `npm outdated`
- [ ] 性能报告生成: `./scripts/monitor.sh > reports/weekly_$(date +%Y%m%d).txt`
- [ ] 数据库备份验证: 确认自动备份成功

### 8.3 每月优化任务 (Monthly Optimization)

- [ ] PM2版本升级: `pm2 update`
- [ ] Node.js补丁更新: 检查安全公告
- [ ] 日志归档: 将旧日志压缩存档
- [ ] 容量规划评估: 根据业务增长预测资源需求
- [ ] 灾难恢复演练: 测试备份恢复流程

### 8.4 发布前检查清单 (Pre-deploy Checklist)

- [ ] 运行完整测试套件: `npm test`
- [ ] 备份当前版本: `git tag v$(date +%Y%m%d)-pre-release`
- [ ] 更新环境变量: `.env.production`
- [ ] 数据库迁移准备: 如有schema变更
- [ ] 回滚计划确认: 准备回滚脚本
- [ ] 通知相关人员: 发送发布通知
- [ ] 选择低峰时段: 建议凌晨2-4点
- [ ] 发布后验证: 运行健康检查和冒烟测试

---

## 📚 附录

### A. 有用的命令速查

```bash
# PM2常用命令
pm2 start ecosystem.config.js --env production  # 启动
pm2 reload qimeng-api                           # 零停机重启
pm2 restart qimeng-api                          # 强制重启
pm2 stop qimeng-api                             # 停止
pm2 delete qimeng-api                           # 删除
pm2 list                                        # 进程列表
pm2 show qimeng-api                             # 详细信息
pm2 monit                                       # 监控面板
pm2 logs qimeng-api                             # 实时日志
pm2 flush                                       # 清空日志
pm2 save                                        # 保存进程列表

# 系统诊断
top                                             # CPU/内存
htop                                            # 增强版top
free -h                                         # 内存详情
df -h                                           # 磁盘空间
netstat -tlnp                                   # 端口监听
lsof -i :3003                                   # 端口占用
uptime                                          # 系统负载
dmesg | tail                                    # 内核日志

# 网络测试
curl -I http://localhost:3003/api/v1/health     # HTTP头
ping google.com                                 # 网络连通性
nslookup example.com                            # DNS解析
traceroute example.com                          # 路由跟踪
```

### B. 配置文件模板

#### ecosystem.config.js 关键参数说明

```javascript
{
  instances: 1,              // 建议: 单实例用1,集群用'max'或CPU数
  exec_mode: 'fork',         // fork(单线程) 或 cluster(多核并行)
  max_memory_restart: '512M', // 根据服务器内存调整
  max_restarts: 10,          // 避免无限重启循环
  log_type: 'json',          // 便于ELK等日志系统解析
}
```

#### 环境变量配置 (.env.production)

```bash
# 必填项
NODE_ENV=production
PORT=3003
DATABASE_URL=mysql://user:pass@localhost:3306/qimeng
JWT_SECRET=your-super-secret-key-here

# 可选项
SLOW_REQUEST_THRESHOLD=2000   # 慢请求阈值(ms)
LOG_LEVEL=info               # 日志级别: debug/info/warn/error
CORS_ORIGIN=https://admin.yourdomain.com
```

### C. 联系方式与 escalation

| 角色 | 职责 | 联系方式 |
|-----|------|---------|
| **On-call工程师** | 第一响应人 | 手机/钉钉 |
| **Tech Lead** | 技术决策 | 钉钉/邮件 |
| **DBA** | 数据库问题 | 钉钉工单 |
| **DevOps** | 基础设施 | 钉钉群 |
| **安全团队** | 安全事件 | 安全邮箱 |

---

## 📝 文档变更记录

| 版本 | 日期 | 作者 | 变更内容 |
|-----|------|------|---------|
| 1.0 | 2026-01-01 | Initial | 初版创建 |
| 2.0 | 2026-04-17 | AI Assistant | 增强版监控系统集成 |

---

**文档维护者**: DevOps Team  
**最后审核**: 2026-04-17  
**下次审查**: 2026-05-17
