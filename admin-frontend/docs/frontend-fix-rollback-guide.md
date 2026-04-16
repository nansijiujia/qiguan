# 回滚操作指南

## 文档版本: v1.0
## 适用版本: v4.0.1-fix
## 创建日期: 2026-04-16
**重要**: 请在执行回滚前仔细阅读本文档，必要时联系技术负责人。

---

## 🚨 回滚前必读

### 回滚决策树

```
发现问题
    │
    ├─► 是否影响核心业务流程？
    │       │
    │       ├─ 是 → 【紧急回滚】→ 立即执行场景2
    │       │
    │       └─ 否 → 继续评估
    │               │
    │               ├─► 影响范围 < 10%用户？
    │               │       │
    │               │       ├─ 是 → 【局部修复】→ 考虑场景1或热修复
    │               │       │
    │               │       └─ 否 → 【计划内回滚】→ 选择合适时间窗口
    │               │
    │               └─► 能否快速定位问题文件？
    │                       │
    │                       ├─ 是 → 【单文件回滚】→ 场景1
    │                       │
    │                       └─ 否 → 【完整回滚】→ 场景2
    │
    ▼
准备回滚操作...
```

### 回滚前检查清单 ✅

- [ ] **确认备份存在**: `dist-backup-20260416-015827` 目录完整
- [ ] **通知相关人员**: 产品经理、运维团队、客服团队（预计影响时长）
- [ ] **选择维护窗口**: 建议低峰期（凌晨2:00-6:00或周末）
- [ ] **数据库备份**: 如涉及后端变更需备份数据库
- [ ] **记录当前版本**: 截图/保存当前线上版本信息
- [ ] **准备回滚脚本**: 提前测试回滚命令
- [ ] **告知用户**: 如预计超过5分钟，提前发公告
- [ ] **监控就绪**: 确保日志/监控系统正常运行

---

## 📂 备份信息

### 本次备份详情

| 属性 | 值 |
|------|-----|
| **备份目录** | `dist-backup-20260416-015827` |
| **备份时间** | 2026-04-16 01:58:27 (UTC+8) |
| **备份类型** | 完整dist目录 |
| **备份大小** | ~3.23 MB |
| **包含文件** | 33个文件 (1 HTML + 11 CSS + 21 JS) |
| **对应版本** | v4.0.1-fix (修复前版本) |
| **存储位置** | 项目根目录下 |

### 验证备份完整性

```bash
# 方法1: 检查文件数量
dir dist-backup-20260416-015827 /s /b | find /c /v ""

# 应该输出: 34 (33个文件 + 1行统计)

# 方法2: 检查关键文件是否存在
Test-Path dist-backup-20260416-015827\index.html           # 应该返回 True
Test-Path dist-backup-20260416-015827\assets\js\index-*.js  # 应该返回 True
Test-Path dist-backup-20260416-015827\assets\css\index-*.css # 应该返回 True
```

---

## 🔧 场景1: 单个文件回滚

### 适用情况
- 已明确问题所在的具体文件
- 只需回滚1-2个文件的修改
- 其他功能正常，无需全面回退

### 操作步骤

#### Step 1: 定位问题文件

```bash
# 示例: 回滚 Users.vue 的修改
# 确认问题文件路径
src/views/Users.vue
```

#### Step 2: 从Git历史获取旧版本

```bash
# 查看该文件的提交历史
git log --oneline -10 src/views/Users.vue

# 选择修复前的commit hash（示例: abc1234）
git show abc1234:src/views/Users.vue > src/views/Users.vue.rollback
```

#### Step 3: 验证回滚文件

```bash
# 对比差异
git diff src/views/Users.vue src/views/Users.vue.rollback

# 确认无误后替换
cp src/views/Users.vue.rollback src/views/Users.vue
rm src/views/Users.vue.rollback
```

#### Step 4: 重新构建

```bash
# 清理旧的构建产物
Remove-Item -Recurse -Force dist

# 重新构建
npm run build

# 验证构建成功 (Exit code should be 0)
echo $LASTEXITCODE
```

#### Step 5: 部署到服务器

```bash
# 方式A: 使用scp上传整个dist目录
scp -r dist/* user@server:/var/www/admin/dist/

# 方式B: 如果只更新单个文件
scp dist/assets/js/Users-*.js user@server:/var/www/admin/dist/assets/js/
```

#### Step 6: 重启服务（如果需要）

```bash
# 如果使用了PM2管理Node.js后端
ssh user@server "pm2 restart backend"

# 如果是Nginx静态托管，通常无需重启
# Nginx会自动读取新文件
```

#### Step 7: 验证回滚效果

```bash
# 访问受影响页面
curl -I https://qimengzhiyue.cn/admin/users

# 检查HTTP状态码应为200
# 检查页面内容是否恢复正常
```

---

## 🔧 场景2: 完整回滚到修复前版本

### 适用情况
- 无法定位具体问题文件
- 多个模块相互影响
- 需要完全恢复到修复前状态
- 紧急情况下的最快恢复方案

### 操作步骤

#### Step 1: 准备回滚环境

```bash
# 进入项目目录
cd e:\1\绮管后台\qiguanqianduan

# 确认当前Git状态（应该干净）
git status

# 确认备份存在
Test-Path dist-backup-20260416-015827
# 输出: True
```

#### Step 2: 停止当前服务（可选但推荐）

```bash
# 如果本地开发服务器正在运行
# Ctrl+C 停止 vite dev server

# 如果已经部署到服务器
ssh user@server "pm2 stop backend"  # 或停止Nginx
```

#### Step 3: 执行回滚

```bash
# 方法A: 使用备份目录直接替换（推荐，最快速）

# 备份当前的dist（以防万一）
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
Rename-Item dist "dist-pre-rollback-$timestamp"

# 从备份恢复
Copy-Item -Path "dist-backup-20260416-015827" -Destination "dist" -Recurse

Write-Host "✅ 已从备份 dist-backup-20260416-015827 恢复"
```

```bash
# 方法B: 使用Git回滚到指定commit（更彻底）

# 查看最近的提交历史
git log --oneline -10

# 找到修复前的commit（假设为 def5678）
git checkout def5678 -- .

# 或者回滚所有修改（危险！会丢失未提交的工作）
# git checkout -- .
# git clean -fd

# 重新构建
npm run build
```

#### Step 4: 验证回滚后的构建产物

```bash
# 检查dist目录
Get-ChildItem dist -Recurse -File | Measure-Object | Select-Object Count
# 应该输出: 33

# 检查关键文件
Test-Path dist\index.html                    # True
Test-Path dist\assets\js\vue-vendor-*.js     # True
Test-Path dist\assets\css\index-*.css         # True

# 检查index.html内容
Get-Content dist\index.html | Select-String "modulepreload"
# 应该能看到资源引用
```

#### Step 5: 部署回滚版本到服务器

```bash
# 上传整个dist目录到服务器
scp -r dist/* user@101.34.39.231:/www/wwwroot/qiguan/admin/dist/

# 或者使用rsync（更快，支持增量）
rsync -avz --delete dist/ user@101.34.39.231:/www/wwwroot/qiguan/admin/dist/
```

#### Step 6: 重启服务

```bash
# SSH到服务器重启后端服务
ssh -i "e:\1\qimengzhiyue.pem" root@101.34.39.231 "
  cd /www/wwwroot/qiguan && 
  pm2 restart backend && 
  sleep 3 && 
  pm2 status
"
```

#### Step 7: 全面验证

```bash
# 7.1 健康检查
curl -I https://qimengzhiyue.cn/api/v1/health
# 期望: HTTP/1.1 200 OK

# 7.2 前端页面可访问性
curl -s -o /dev/null -w "%{http_code}" https://qimengzhiyue.cn/admin/
# 期望: 200

# 7.3 关键页面验证
$pages = @("/admin/login", "/admin/dashboard", "/admin/products", "/admin/orders", "/admin/users")
foreach ($page in $pages) {
  $code = curl -s -o /dev/null -w "%{http_code}" "https://qimengzhiyue.cn$page"
  Write-Host "$page : $code"
}
# 所有页面应返回200

# 7.4 功能验证（手动或自动化测试）
# - 登录功能正常
# - 商品列表加载正常
# - 订单查看正常
# - 用户管理正常（特别是之前有问题的Users.vue）
```

---

## 🔧 场景3: Git版本回滚（高级）

### 适用情况
- 需要回滚到特定的历史版本
- 备份目录损坏或丢失
- 需要完全撤销某次提交的所有更改

### 操作步骤

#### Step 1: 查看版本历史

```bash
# 查看图形化提交历史（推荐使用Git GUI工具）
git log --graph --oneline --all -20

# 或者查看详细提交信息
git log -p -10
```

#### Step 2: 选择目标版本

```bash
# 列出最近的tag（如果有）
git tag -l | Sort-Object LastWriteTime -Descending | Select-Object -First 10

# 找到修复前的commit hash
# 例如: a1b2c3d (修复前的最后一个稳定版本)
```

#### Step 3: 执行回滚

```bash
# 方式A: soft回滚（保留工作区修改，可重新提交）
git reset --soft a1b2c3d

# 方式B: mixed回滚（默认，保留文件但取消暂存）
git reset --mixed a1b2c3d

# 方式C: hard回滚（彻底丢弃所有修改，⚠️危险）
git reset --hard a1b2c3d

# 推荐: 先用mixed回滚，确认后再决定是否hard
```

#### Step 4: 强制推送到远程（谨慎！）

```bash
# ⚠️ 这会覆盖远程仓库的历史，需团队知情同意
git push --force-with-lease origin main

# 或者创建回滚分支
git checkout -b rollback-to-a1b2c3d
git push origin rollback-to-a1b2c3d
```

#### Step 5: 重新构建和部署

```bash
npm run build
# ... 同场景2的Step 5-7 ...
```

---

## 🔄 回滚后验证清单

### 必须验证的项目

#### 基础设施验证
- [ ] 服务器响应正常（HTTP 200）
- [ ] 静态资源加载无404
- [ ] API接口正常响应
- [ ] SSL证书有效
- [ ] CDN缓存已刷新（如有）

#### 功能验证（核心流程）
- [ ] **登录流程**: 输入账号密码 → 登录成功 → 跳转Dashboard
- [ ] **仪表盘**: 数据正常加载，图表显示
- [ ] **商品管理**: 列表加载、搜索、添加、编辑、删除
- [ ] **订单管理**: 列表加载、状态筛选、订单详情
- [ ] **用户管理**: ⭐ 重点验证Users.vue页面正常
- [ ] **分类管理**: CRUD操作正常
- [ ] **客户资料**: 列表展示正常
- [ ] **优惠券管理**: 功能正常
- [ ] **内容管理**: 编辑器正常
- [ ] **系统设置**: 参数读取/保存正常

#### 边界场景验证
- [ ] 弱网环境（Chrome Network Throttling 3G）
- [ ] 异常数据处理（null/undefined字段）
- [ ] HTTP错误场景（断网模拟）
- [ ] 页面刷新（F5/Ctrl+F5）
- [ ] 路由跳转（前进/后退/直接输入URL）

#### 性能验证
- [ ] 首屏加载时间 < 4秒（3G网络）
- [ ] 无内存泄漏（Chrome DevTools Performance Monitor）
- [ ] Console无红色错误（允许黄色警告）
- [ ] Lighthouse分数 > 80（Performance）

---

## 🆘 紧急回滚SOP（Standard Operating Procedure）

### 触发条件（满足任一即启动）
- ❌ 核心业务流程完全不可用（如无法登录）
- ❌ 错误率突增 > 10%（对比基线）
- ❌ 用户大量投诉（>50个/小时）
- ❌ 数据损坏或丢失风险
- ❌ 安全漏洞被利用

### 紧急回滚命令速查

```bash
# 一键回滚脚本（复制粘贴即可执行）

# ===== 开始紧急回滚 =====
Write-Host "🚨 [EMERGENCY] Starting emergency rollback..." -ForegroundColor Red

# 1. 确认备份
if (-not (Test-Path "dist-backup-20260416-015827")) {
  Write-Host "❌ Backup not found! Aborting." -ForegroundColor Red
  exit 1
}

# 2. 时间戳备份当前版本
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
if (Test-Path "dist") {
  Rename-Item "dist" "dist-emergency-$ts"
  Write-Host "📦 Current version backed up as: dist-emergency-$ts"
}

# 3. 恢复备份
Copy-Item -Path "dist-backup-20260416-015827" -Destination "dist" -Recurse
Write-Host "✅ Restored from backup: dist-backup-20260416-015827"

# 4. 部署到服务器
Write-Host "🚀 Deploying to server..."
scp -r dist/* root@101.34.39.231:/www/wwwroot/qiguan/admin/dist/

# 5. 重启服务
ssh -i "e:\1\qimengzhiyue.pem" root@101.34.39.231 "pm2 restart backend"

# 6. 验证
Start-Sleep -Seconds 5
$status = curl -s -o /dev/null -w "%{http_code}" https://qimengzhiyue.cn/admin/
if ($status -eq "200") {
  Write-Host "✅ Rollback successful! Server responding with 200" -ForegroundColor Green
} else {
  Write-Host "⚠️ Server returned status: $status. Manual check required!" -ForegroundColor Yellow
}

Write-Host "🏁 [EMERGENCY] Rollback completed at $(Get-Date)" -ForegroundColor Cyan
# ===== 结束紧急回滚 =====
```

### 紧急联系人

| 角色 | 姓名 | 联系方式 | 职责 |
|------|------|----------|------|
| 技术负责人 | - | - | 最终决策 |
| 前端开发 | - | - | 执行回滚 |
| 运维工程师 | - | - | 服务器操作 |
| 产品经理 | - | - | 用户沟通 |
| 客服主管 | - | - | 用户安抚 |

---

## 📊 回滚报告模板

每次回滚操作完成后，请填写此报告：

```markdown
## 回滚操作报告

**操作时间**: YYYY-MM-DD HH:mm:ss
**操作人**: [姓名]
**回滚原因**: [简述]
**回滚类型**: ☐ 单文件  ☐ 完整  ☐ 紧急

### 执行过程
1. [步骤描述]
2. [步骤描述]
...

### 验证结果
- [ ] 基础设施: 正常/异常
- [ ] 核心功能: 正常/异常
- [ ] 性能指标: [数据]

### 影响评估
- 影响用户数: 约 [数字] 人
- 影响时长: [时长]
- 数据损失: 有/无（如有，详述）

### 经验教训
- [本次回滚的根因分析]
- [如何避免再次发生]

### 后续行动
- [ ] [行动计划1]
- [ ] [行动计划2]
```

---

## 💡 最佳实践与预防措施

### 如何减少回滚需求

1. **灰度发布**
   - 先发布给1%用户观察24小时
   - 逐步扩大到10%、50%、100%
   - 使用Feature Flag控制功能开关

2. **A/B测试**
   - 新旧版本并行运行
   - 数据驱动决策
   - 快速回退到对照组

3. **自动化测试**
   - 单元测试覆盖率 > 80%
   - E2E测试覆盖核心流程
   - CI/CD流水线强制测试通过

4. **监控告警**
   - 实时错误率监控（Sentry）
   - 性能指标监控（New Relic/Datadog）
   - 用户行为分析（Mixpanel）

5. **特性开关（Feature Flags）**
   - 每个新功能可独立关闭
   - 无需回滚整个版本
   - 即时生效

---

## 📚 相关文档

- [问题分析报告](./frontend-fix-analysis.md) - 了解本次修复的问题背景
- [变更日志](./frontend-fix-changelog.md) - 查看详细的修改记录
- [测试报告](./frontend-fix-test-report.md) - 查看测试覆盖情况
- Vite官方文档: https://vitejs.dev/guide/
- Vue Router文档: https://router.vuejs.org/

---

## 📞 获取帮助

如果在回滚过程中遇到问题：

1. **查阅本文档** - 检查是否有对应的场景说明
2. **查看Git日志** - `git reflog` 可以找回丢失的提交
3. **联系团队成员** - 不要独自操作生产环境
4. **保留现场** - 在解决问题前不要随意删除文件
5. **记录操作** - 每一步操作都要记录，便于复盘

---

**文档最后更新**: 2026-04-16 01:58:27  
**文档维护者**: Frontend Team  
**下次审查日期**: 2026-05-16（一个月后）
