# v4 系统化修复 - 部署检查清单

> **版本**: v4.0  
> **日期**: 2026-04-16  
> **部署脚本**: `docs/deploy-v4.sh`  
> **目标服务器**: 121.41.22.238  

---

## 📋 部署前检查 (Pre-Deployment)

### ✅ 前置条件确认
- [ ] **本地测试完成** - Task 4所有测试用例通过
- [ ] **前端构建成功** - `qiguanqianduan/dist/` 目录存在且包含完整构建产物
  - [ ] index.html 存在
  - [ ] assets/js/ 目录包含所有JS文件（版本号: 1776281258577-cyxunm）
  - [ ] assets/styles/ 目录包含所有CSS文件
- [ ] **后端代码就绪** - 所有修改文件已保存
  - [ ] `index.js` - 中间件增强版本
  - [ ] `routes/coupons.js` - validateArray导入修复
  - [ ] `routes/categories.js` - 如有修改
  - [ ] `db_unified.js` - 连接池优化版本
  - [ ] `utils/errorHandler.js` - 错误处理更新
  - [ ] `.env.production` - 生产环境配置
- [ ] **SSH连接可用** - 可通过SSH连接到生产服务器
  - [ ] IP地址: 121.41.22.238
  - [ ] SSH端口: 22 (或自定义端口)
  - [ ] 认证方式: 密钥/密码已配置
- [ ] **数据库备份完成** - MySQL数据库已执行备份
- [ ] **磁盘空间充足** - 服务器可用空间 > 5GB

### 🔧 工具准备
- [ ] Git Bash / WSL / Linux终端 (用于执行bash脚本)
- [ ] curl 命令可用 (用于健康检查)
- [ ] 浏览器开发者工具 (Chrome DevTools)

---

## 🚀 部署步骤 (Deployment Steps)

### 步骤1: 执行备份 ⏱️ 预计时间: 2-3分钟
```bash
cd e:/1/绮管后台/docs
bash deploy-v4.sh --backup-only
```

**验证项**:
- [ ] 备份目录创建成功 (`/tmp/qiguan-backup-v4-*`)
- [ ] 前端文件备份完成
- [ ] 后端关键文件备份完成
- [ ] PM2状态已记录

**⚠️ 注意事项**:
- 备份路径会自动保存到 `.last-backup-dir.txt`
- 如果备份失败，禁止继续部署

---

### 步骤2: 上传前端 ⏱️ 预计时间: 3-5分钟
```bash
# 自动执行（包含在deploy命令中）
```

**上传内容**:
| 文件类型 | 数量 | 说明 |
|---------|------|------|
| HTML | 1 | index.html |
| JS文件 | ~15 | 包含安全函数的format.js等 |
| CSS文件 | ~12 | 各页面样式 |
| 其他资源 | 2 | vite.svg等 |

**验证项**:
- [ ] 远程 `/www/wwwroot/qiguan/dist/index.html` 已更新
- [ ] 远程JS文件版本号正确 (1776281258577-cyxunm)
- [ ] 文件完整性校验通过

---

### 步骤3: 上传后端 ⏱️ 预计时间: 1-2分钟
```bash
# 自动执行（包含在deploy命令中）
```

**上传文件列表**:
| 文件 | 大小(约) | 关键改动 |
|------|---------|---------|
| index.js | 15KB | 中间件增强 + DB初始化优化 |
| routes/coupons.js | 20KB | ✅ **validateArray导入修复(致命bug)** |
| routes/categories.js | 15KB | 参数验证加固 |
| db_unified.js | 25KB | 连接池优化 + 重连机制 |
| utils/errorHandler.js | 5KB | 错误响应格式统一 |
| .env.production | 3KB | 生产配置(含DB密码) |

**验证项**:
- [ ] 所有文件上传成功
- [ ] 文件权限正确 (644 for files, 755 for dirs)
- [ ] npm依赖安装无错误

---

### 步骤4: 重启服务 ⏱️ 预计时间: 30秒-1分钟
```bash
# 自动执行（包含在deploy命令中）
```

**操作内容**:
- [ ] PM2停止旧进程
- [ ] PM2启动新进程 (qiguan-backend)
- [ ] Nginx配置重载
- [ ] PM2状态保存

**验证项**:
- [ ] PM2进程状态显示 `online`
- [ ] 无错误日志输出
- [ ] 进程内存使用正常 (< 500MB)

---

### 步骤5: 健康检查 ⏱️ 预计时间: 1分钟
```bash
# 自动执行（包含在deploy命令中）

# 或手动执行:
bash deploy-v4.sh --verify
```

**自动检查项**:
- [ ] API健康端点返回 200 OK
  - [ ] https://qimengzhiyue.cn/api/v1/health
  - [ ] https://api.qimengzhiyue.cn/api/v1/health
- [ ] PM2进程运行正常
- [ ] 前端页面可访问

---

## 🧪 部署后验证 (Post-Deployment Verification)

### 浏览器测试准备
1. **清除浏览器缓存**
   - Chrome: `Ctrl + Shift + Delete` → 清除缓存
   - 或强制刷新: `Ctrl + Shift + R` (Windows/Linux) / `Cmd + Shift + R` (Mac)
   
2. **打开DevTools**
   - 按 `F12` 或右键 → 检查
   - 切换到 Console 和 Network 标签页

### 功能验证清单

#### ✅ 核心页面访问测试
| 页面 | URL | 预期结果 | 实际结果 |
|------|-----|---------|---------|
| 产品管理 | https://www.qimengzhiyue.cn/admin/products | 正常加载，列表显示 | □ 通过 |
| 分类管理 | https://www.qimengzhiyue.cn/admin/categories | 正常加载，树形结构 | □ 通过 |
| 优惠券管理 | https://www.qimengzhiyue.cn/admin/coupons | **正常加载，无500错误** | □ 通过 |
| 订单管理 | https://www.qimengzhiyue.cn/admin/orders | 正常加载 | □ 通过 |
| 用户管理 | https://www.qimengzhiyue.cn/admin/users | 正常加载 | □ 通过 |
| Dashboard | https://www.qimengzhiyue.cn/admin/dashboard | 数据展示正常 | □ 通过 |

#### ✅ Console控制台检查
- [ ] **0个JavaScript错误** (红色错误信息)
- [ ] 无 `TypeError: undefined is not a function` 
- [ ] 无 `Cannot read property of undefined`
- [ ] 无 `toLocaleUpperCase is not a function` ❌ **此问题应已修复**

#### ✅ Network网络请求检查
- [ ] **无失败的API请求** (红色的失败请求)
- [ ] API响应时间 < 3秒 (正常范围)
- [ ] 无 `NET::ERR_CONNECTION_REFUSED`
- [ ] 无 `502 Bad Gateway`
- [ ] 无 `503 Service Unavailable`

#### ✅ 功能交互测试
- [ ] **产品列表**: 分页、搜索、筛选功能正常
- [ ] **产品编辑**: 打开编辑弹窗无报错
- [ ] **分类管理**: 添加/编辑/删除分类正常
- [ ] **优惠券列表**: **加载无500错误** ✅ **核心修复点**
- [ ] **优惠券操作**: 创建/编辑/删除优惠券正常
- [ ] **数据导出**: Excel导出功能正常

#### ✅ 边缘情况测试
- [ ] **空数据处理**: 空列表页面显示友好提示
- [ ] **异常字符**: 特殊字符输入不导致崩溃
- [ ] **网络中断**: 断网后恢复显示友好错误
- [ ] **长时间操作**: 页面不卡顿，无内存泄漏

---

## 🔄 回滚条件与流程 (Rollback)

### 触发回滚的情况
立即回滚如果出现以下任一情况:

| 条件 | 阈值 | 严重程度 |
|------|------|---------|
| 核心页面不可用 | > 2分钟 | 🔴 致命 |
| HTTP 5xx错误率 | > 5% | 🔴 致命 |
| PM2频繁重启 | > 3次/分钟 | 🔴 致命 |
| 数据库连接失败 | 连续3次 | 🟠 严重 |
| 前端白屏 | 主要页面 | 🟠 严重 |
| 功能回归 | 已修复问题重现 | 🟡 警告 |

### 回滚操作步骤
```bash
# 1. 执行回滚脚本
cd e:/1/绮管后台/docs
bash deploy-v4.sh --rollback

# 2. 等待回滚完成 (约2分钟)

# 3. 验证系统恢复
bash deploy-v4.sh --verify

# 4. 通知相关人员
```

### 回滚后验证
- [ ] 系统恢复到部署前状态
- [ ] 所有核心功能正常
- [ ] 用户数据无丢失
- [ ] 记录回滚原因和时间

---

## 📊 部署监控指标

### 关键指标监控 (部署后24小时)
| 指标 | 正常范围 | 告警阈值 |
|------|---------|---------|
| API响应时间 (P95) | < 1000ms | > 3000ms |
| 错误率 | < 1% | > 5% |
| CPU使用率 | < 70% | > 90% |
| 内存使用率 | < 80% | > 95% |
| 数据库连接数 | < 15 | > 18 (pool=20) |
| PM2重启次数 | 0 | > 3/hour |

### 日志监控位置
- **应用日志**: `pm2 logs qiguan-backend`
- **Nginx日志**: `/www/wwwlogs/*.log`
- **系统日志**: `/var/log/messages`

---

## 📞 应急联系

### 出现问题时
1. **首先尝试回滚**: `bash deploy-v4.sh --rollback`
2. **查看日志**: `pm2 logs --lines 100`
3. **联系开发团队**: 提供错误截图和日志

### 部署签名
| 角色 | 姓名 | 时间 | 签名 |
|------|------|------|------|
| 执行人 | _______ | _______ | _______ |
| 审核人 | _______ | _______ | _______ |
| 批准人 | _______ | _______ | _______ |

---

## 📝 部署历史记录

| 版本 | 日期 | 操作人 | 状态 | 备注 |
|------|------|--------|------|------|
| v4.0 | 2026-04-16 | _______ | ⏳ 待执行 | 系统化修复: toLocaleUpperCase + 500错误 + NETWORK_ERROR |

---

## ✅ 最终确认

**在点击"开始部署"前，请确认以上所有前置条件已完成:**

- [ ] 我已阅读并理解本检查清单的所有项目
- [ ] 本地测试全部通过
- [ ] 数据库已备份
- [ ] 团队成员已通知部署计划
- [ ] 我准备好处理可能的回滚

**执行部署命令**:
```bash
cd e:/1/绮管后台/docs
bash deploy-v4.sh
```

---

*文档版本: v4.0 | 最后更新: 2026-04-16 | 维护者: 开发团队*
