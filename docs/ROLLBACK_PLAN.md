# 绮管电商后台系统 - 回滚方案 (ROLLBACK PLAN)

**文档版本**: V1.0
**制定日期**: 2026-04-15
**关联文档**: [FIX_PLAN_V2.md](./FIX_PLAN_V2.md)
**适用范围**: P0故障修复的所有变更（Phase 1 + Phase 2）

---

## 📋 文档目的

本文档定义了在执行P0故障修复过程中，**当修复失败或引入新问题时的应急回滚流程**。

**核心目标**:
- ✅ 10分钟内恢复服务到修复前状态
- ✅ 数据零丢失
- ✅ 操作步骤清晰、可执行
- ✅ 支持部分回滚和完全回滚

---

## ⚠️ 回滚触发条件

### 自动触发（任一满足即自动告警）

| 监控指标 | 阈值 | 持续时间 | 严重级别 |
|---------|------|---------|---------|
| API错误率 | > 5% | 5分钟 | **P0-紧急** |
| 响应时间 P99 | > 5秒 | 5分钟 | **P0-紧急** |
| 数据库连接失败率 | > 10% | 2分钟 | **P0-紧急** |
| PM2重启频率 | > 3次/5分钟 | 持续 | **P0-紧急** |
| HTTP 503/500状态码 | > 20% | 3分钟 | **P1-高** |

### 手动触发（任一满足即可执行回滚）

- ❌ 用户反馈核心功能不可用（> 3个独立用户）
- ❌ 管理后台无法登录
- ❌ 数据显示异常或数据丢失
- ❌ 安全事件（如配置泄露）
- ❌ 技术负责人判断需要回滚

### 判断决策树

```
发现异常
   ↓
检查监控面板
   ↓
异常是否在以下列表中？
├─ 是 → 检查是否为已知限制（见第7节）
│      ├─ 是 → 记录观察，暂不回滚
│      └─ 否 ↓
└─ 否 ↓
评估影响范围
├─ 仅影响非核心功能 → P2处理，24h内修复
├─ 影响核心功能但可临时规避 → P1处理，准备回滚
└─ 核心功能完全不可用 → ★ 立即执行P0回滚 ★
```

---

## 🔄 回滚策略概览

### 三级回滚机制

```
Level 1: 快速回滚（推荐首选）
         时间: < 2分钟
         方法: PM2 restart + Git checkout
         适用: 代码层面的问题

Level 2: 配置回滚
         时间: < 5分钟
         方法: 从备份恢复配置文件
         适用: 配置文件导致的问题

Level 3: 完全回滚
         时间: < 10分钟
         方法: 恢复完整备份（代码+配置+数据库）
         适用: 严重故障或数据问题
```

### 回滚范围选择

| 场景 | 推荐级别 | 回滚范围 | 说明 |
|-----|---------|---------|------|
| deploy.js修改导致部署失败 | Level 1 | 仅deploy.js | 最小化影响 |
| domain.js重构导致配置加载错误 | Level 1 | domain.js + index.js | 配置相关文件 |
| db_unified.js增强导致数据库异常 | Level 2 | db_unified.js + 重启服务 | 可能需要清除连接池 |
| 多个文件修改导致系统性问题 | Level 3 | 全部文件 | 最安全但最慢 |
| 数据库结构变更导致数据异常 | Level 3 | 数据库备份恢复 | 必须DBA参与 |

---

## 📦 备份清单与位置

### 本地备份（创建于修复前）

**路径**: `E:\1\绮管后台\backup\pre-fix\`

```
backup/
└── pre-fix/
    ├── config/
    │   └── domain.js.orig              # 原始domain.js (修改前)
    ├── deploy.js.orig                   # 原始deploy.js (修改前)
    ├── db_unified.js.orig               # 原始db_unified.js (修改前)
    ├── index.js.orig                    # 原始index.js (修改前)
    ├── .env.production                  # 生产环境配置（已存在）
    └── checksums.md5                    # MD5校验值
```

### 服务器端快照（需要在生产服务器采集）

**采集时间**: 执行修复前立即采集

**路径**: `/tmp/pre-fix-backup.tar.gz`

**包含内容**:
```bash
/tmp/
├── pm2_status.txt                 # PM2进程列表
├── backend_detail.txt             # backend进程详情
├── nginx_full_config.conf         # Nginx完整配置
├── node_processes.txt             # Node.js进程列表
├── listening_ports.txt            # 监听端口列表
├── disk_usage.txt                 # 磁盘使用情况
└── pre-fix-backup.tar.gz          # 以上文件的打包压缩
```

### Git基线标签

```
Tag名称: v1.0.0-pre-fix
Commit Hash: [实际Git提交的Hash]
创建时间: 2026-04-15 HH:MM:SS
描述: Rollback baseline before P0 fix deployment
```

---

## 🚀 详细回滚步骤

### ⚡ Level 1: 快速回滚（< 2分钟）

#### 前提条件
- Git仓库可用且有 `v1.0.0-pre-fix` 标签
- SSH连接正常

#### 步骤

**Step 1: 停止当前服务（30秒）**
```bash
# SSH到生产服务器
ssh root@101.34.39.231

# 停止backend服务
pm2 stop backend

# 确认已停止
pm2 status
# 预期输出: backend │ stopped │ ...
echo "[$(date '+%H:%M:%S')] ✓ Service stopped"
```

**Step 2: 回滚代码（45秒）**
```bash
cd /www/wwwroot/qiguan

# 方法A: 使用Git标签回滚（推荐）
git fetch --tags
git checkout v1.0.0-pre-fix

# 如果Git不可用，使用方法B:
# scp -r local_backup/* /www/wwwroot/qiguan/

echo "[$(date '+%H:%M:%S')] ✓ Code rolled back to v1.0.0-pre-fix"
```

**Step 3: 重启服务（30秒）**
```bash
pm2 start index.js --name backend
pm2 save

# 等待启动
sleep 5

# 检查状态
pm2 status
# 预期: backend │ online │ ...

echo "[$(date '+%H:%M:%S')] ✓ Service restarted"
```

**Step 4: 快速验证（15秒）**
```bash
curl -sf http://127.0.0.1:3003/api/v1/health | head -c 200
# 预期: {"status":"ok",...}

echo ""
echo "[$(date '+%H:%M:%S')] ✓ Rollback complete - Level 1"
```

#### 验证回滚成功
- [ ] PM2显示 `backend` 状态为 `online`
- [ ] `/api/v1/health` 返回 `{"status":"ok"}`
- [ ] 无数据库连接错误日志
- [ ] 前端页面可访问

#### 总耗时: **约2分钟**

---

### 🔧 Level 2: 配置回滚（< 5分钟）

#### 适用场景
- `.env.production` 文件损坏或权限错误
- `config/domain.js` 加载逻辑导致环境变量丢失
- Nginx配置被意外修改

#### 步骤

**Step 1: 停止服务（同Level 1 Step 1）**

**Step 2: 恢复配置文件（2分钟）**
```bash
cd /www/wwwroot/qiguan

# 备份当前配置（以防万一）
cp .env.production .env.production.broken.$(date +%Y%m%d_%H%M%S)
cp config/domain.js config/domain.js.broken.$(date +%Y%m%d_%H%M%S)

# 从本地备份恢复（通过SCP）
# 在本地机器执行:
scp E:\1\绮管后台\backup\pre-fix\config\domain.js.orig \
    root@101.34.39.231:/www/wwwroot/qiguan/config/domain.js

scp E:\1\绮管后台\backup\pre-fix\.env.production \
    root@101.34.39.231:/www/wwwroot/qiguan/.env.production

# 设置正确权限
ssh root@101.34.39.231 "chmod 600 /www/wwwroot/qiguan/.env.production"

echo "✓ Config files restored"
```

**Step 3: 清理并重启（1分钟）**
```bash
# 清除可能的缓存
pm2 flush

# 重启服务
pm2 restart backend

# 等待初始化
sleep 8

# 验证配置加载
pm2 logs backend --lines 20 --nostream | grep -E "(Config|Environment)"
# 预期看到: [Config] ✓ Environment loaded from: .env.production
```

**Step 4: 完整验证（1分钟）**
```bash
# 健康检查
curl -sf http://127.0.0.1:3003/api/v1/health | python -m json.tool

# 测试数据库连接
curl -sf http://127.0.0.1:3003/api/v1/customers?page=1&limit=1 \
  -H "Authorization: Bearer TEST" | python -m json.tool

# 检查PM2日志是否有配置错误
pm2 logs backend --lines 50 --nostream | grep -i error
```

#### 验证回滚成功
- [ ] 配置文件MD5与备份一致
- [ ] 启动日志显示正确的环境文件被加载
- [ ] 数据库连接正常
- [ ] 所有API响应格式正确

#### 总耗时: **约5分钟**

---

### 🔄 Level 3: 完全回滚（< 10分钟）

#### 适用场景
- Level 1和Level 2都无法解决问题
- 怀疑数据库结构被修改
- 需要确保100%恢复到修复前状态

#### 步骤

**Step 1: 紧急停止所有服务（30秒）**
```bash
# 停止所有Node.js进程
pm2 stop all

# 强制杀残留进程（如果PM2无法停止）
pkill -f "node.*index.js" || true

# 确认无进程运行
ps aux | grep node | grep -v grep
# 预期: 无输出（或只有grep本身）

echo "[$(date '+%H:%M:%S')] ✓ All services stopped"
```

**Step 2: 数据库备份（如果需要）（2分钟）**
```bash
# ⚠️ 仅当怀疑数据库有问题时执行此步

# 备份当前数据库（以防回滚后还需要当前数据）
mysqldump -u QMZYXCX -p'LJN040821.' qmzyxcx \
  > /tmp/db_before_rollback_$(date +%Y%m%d_%H%M%S).sql

echo "✓ Database backed up (if needed)"
```

**Step 3: 完整代码恢复（3分钟）**
```bash
cd /www/wwwroot/qiguan

# 创建当前版本的紧急备份
tar czf /tmp/broken-version-backup.tar.gz .

# 使用Git完全回滚
git clean -fd  # 清除未跟踪的文件
git reset --hard HEAD  # 撤销未提交的更改
git checkout v1.0.0-pre-fix

# 或者从本地完整备份恢复
# rm -rf *
# scp -r local_backup/* .

echo "✓ Code fully restored to baseline"
```

**Step 4: 恢复配置和环境（2分钟）**
```bash
# 恢复.env文件
scp root@local_machine:E:/1/绮管后台/backup/pre-fix/.env.production \
    /www/wwwroot/qiguan/.env.production
chmod 600 /www/wwwroot/qiguan/.env.production

# 恢复Nginx配置（如果有改动）
scp /tmp/nginx_full_config.conf /www/server/nginx/conf/nginx.conf
nginx -t && nginx -s reload

echo "✓ Configuration restored"
```

**Step 5: 重启并验证（2分钟）**
```bash
# 安装依赖（如果node_modules有问题）
npm install --production

# 启动服务
pm2 start index.js --name backend
pm2 save

# 等待启动完成
sleep 10

# 全面验证
echo "=== Health Check ==="
curl -sf http://127.0.0.1:3003/api/v1/health

echo -e "\n=== Database Test ==="
mysql -u QMZYXCX -p'LJN040821.' qmzyxcx -e "SELECT COUNT(*) FROM customers;"

echo -e "\n=== PM2 Status ==="
pm2 status

echo -e "\n=== Recent Errors ==="
pm2 logs backend --lines 30 --nostream | grep -iE "(error|fail|exception)"

echo "[$(date '+%H:%M:%S')] ✓ Full rollback complete - Level 3"
```

#### 验证回滚成功
- [ ] Git状态干净（`git status` 无修改）
- [ ] 配置文件校验和与备份一致
- [ ] 数据库表结构和数据量正常
- [ ] 服务健康检查通过
- [ ] 核心API功能正常
- [ ] PM2无错误日志
- [ ] 前端页面完全可用

#### 总耗时: **约10分钟**

---

## 🔍 回滚验证方法

### 自动化验证脚本

创建验证脚本 `verify_rollback.sh`：

```bash
#!/bin/bash
# 回滚验证脚本
# 用法: bash verify_rollback.sh

set -e

PASS=0
FAIL=0
ERRORS=""

check() {
  local description="$1"
  local command="$2"
  local expected="$3"

  echo -n "  [$description] ... "

  if output=$(eval "$command" 2>&1); then
    if [[ -z "$expected" || "$output" == *"$expected"* ]]; then
      echo "✓ PASS"
      ((PASS++))
    else
      echo "✗ FAIL (unexpected output)"
      echo "    Expected: $expected"
      echo "    Got: $output"
      ((FAIL++))
      ERRORS="$ERRORS\n  - $description"
    fi
  else
    echo "✗ FAIL (command failed)"
    echo "    Error: $output"
    ((FAIL++))
    ERRORS="$ERRORS\n  - $description"
  fi
}

echo "========================================="
echo "  ROLLBACK VERIFICATION REPORT"
echo "  Time: $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================="
echo ""

echo "--- Service Status ---"
check "PM2 Backend Online" "pm2 show backend | grep 'status' | awk '{print \$4}'" "online"
check "Process Running" "pgrep -f 'node.*index.js' | wc -l" "1"

echo ""
echo "--- Health Check ---"
check "HTTP Health Endpoint" "curl -sf http://127.0.0.1:3003/api/v1/health" '"status":"ok"'
check "Database Connected" "curl -sf http://127.0.0.1:3003/api/v1/health" '"database":"connected"'

echo ""
echo "--- Database Integrity ---"
check "Customers Table Exists" "mysql -u QMZYXCX -p'LJN040821.' qmzyxcx -e 'SHOW TABLES LIKE \"customers\"'" "customers"
check "Can Query Data" "mysql -u QMZYXCX -p'LJN040821.' qmzyxcx -e 'SELECT COUNT(*) as cnt FROM customers'" "cnt"

echo ""
echo "--- File Integrity ---"
check "domain.js Exists" "test -f /www/wwwroot/qiguan/config/domain.js && echo 'exists'" "exists"
check ".env.production Exists" "test -f /www/wwwroot/qiguan/.env.production && echo 'exists'" "exists"
check ".env Permissions" "stat -c '%a' /www/wwwroot/qiguan/.env.production" "600"

echo ""
echo "--- No Critical Errors ---"
check "No DB Connection Errors" "pm2 logs backend --lines 100 --nostream 2>/dev/null | grep -c 'ECONNREFUSED'" "0"
check "No Process Crashes" "pm2 show backend | grep 'restarts' | awk '{print \$4}'" "0"

echo ""
echo "========================================="
echo "  RESULTS: $PASS passed, $FAIL failed"
echo "========================================="

if [ $FAIL -gt 0 ]; then
  echo -e "\n❌ FAILED CHECKS:$ERRORS"
  echo ""
  echo "⚠️  Rollback verification FAILED!"
  echo "    Please investigate the failed checks above."
  exit 1
else
  echo ""
  echo "✅ All checks PASSED! Rollback successful."
  exit 0
fi
```

**使用方法**:
```bash
# 在生产服务器执行
scp verify_rollback.sh root@101.34.39.231:/tmp/
ssh root@101.34.39.231 "bash /tmp/verify_rollback.sh"
```

### 手动验证Checklist

打印此清单并在回滚后逐项确认：

```
═══════════════════════════════════════════
     ROLLBACK VERIFICATION CHECKLIST
     Time: ___________
     Executor: _________
═══════════════════════════════════════════

□ 1. 服务状态
   □ PM2 backend 显示 online
   □ 进程PID稳定（不频繁变化）
   □ 内存使用正常 (< 512MB)

□ 2. 健康检查
   □ GET /api/v1/health 返回 200
   □ 响应体包含 {"status":"ok"}
   □ database字段显示 "connected"

□ 3. 数据库连接
   □ 可以执行 SELECT 查询
   □ 表结构完整（customers, products, orders等）
   □ 数据量合理（不为空且不是0行）

□ 4. 核心API测试
   □ POST /api/v1/auth/login - 登录正常
   □ GET /api/v1/customers - 列表加载正常
   □ GET /api/v1/products - 产品列表正常
   □ GET /api/v1/orders - 订单列表正常

□ 5. 前端功能
   □ 浏览器可以打开 https://admin.qimengzhiyue.cn/admin
   □ 登录页面显示正常
   □ 登录后可以看到Dashboard
   □ 各菜单页面可切换

□ 6. 日志检查
   □ PM2日志无 FATAL 错误
   □ 无数据库连接失败信息
   □ 无 unhandledException 或 unhandledRejection
   □ 最近5分钟的错误数 = 0

□ 7. 性能基准
   □ 首页加载时间 < 3秒
   □ API平均响应时间 < 500ms
   □ CPU使用率 < 80%
   □ 内存使用率 < 90%

═══════════════════════════════════════════
结果: □ 全部通过  □ 有失败项（附说明）
签字: _________  日期: _________
═══════════════════════════════════════════
```

---

## 🆘 应急联系人与升级流程

### 关键联系人名单

| 角色 | 姓名 | 电话 | 微信 | 职责 | 可用时间 |
|-----|------|------|------|------|---------|
| **On-call工程师** | [待填写] | [138xxxxxxxx] | [wxid_001] | 第一响应者 | 7×24小时 |
| **技术负责人** | [待填写] | [139xxxxxxxx] | [wxid_002] | 决策者 | 工作日9-21点 |
| **DBA** | [待填写] | [137xxxxxxxx] | [wxid_003] | 数据库操作 | 需提前预约 |
| **运维工程师** | [待填写] | [136xxxxxxxx] | [wxid_004] | 服务器/Nginx | 工作日9-18点 |
| **产品经理** | [待填写] | [135xxxxxxxx] | [wxid_005] | 业务决策 | 工作日10-19点 |
| **CTO/VP** | [待填写] | [134xxxxxxxx] | [wxid_006] | 最终审批 | 紧急时可达 |

### 升级触发条件与流程

```
Level 1: On-call自主处理
├─ 触发: 小问题，有明确解决方案
├─ 时限: 自主判断（通常< 15分钟）
└─ 例子: 单个API报错、偶发超时
         ↓ （若10分钟内未解决）
Level 2: 通知技术负责人
├─ 触发: 核心功能受影响或不确定原因
├─ 时限: 通知后15分钟内响应
├─ 行动: 电话+微信群同步
└─ 例子: 登录功能不可用、数据库慢查询
         ↓ （若30分钟内未解决或影响扩大）
Level 3: 紧急升级
├─ 触发: 服务完全不可用或数据风险
├─ 时限: 立即通知所有人
├─ 行动: 电话+短信+微信+邮件
└─ 例子: 503错误率>50%、怀疑数据丢失
         ↓
Level 4: CTO/高管介入
├─ 触发: 可能造成重大业务损失或声誉影响
├─ 时限: 不超过5分钟
└─ 行动: 启动业务连续性计划（BCP）
```

### 通信模板

#### 内部通知（微信群/钉钉）

```markdown
🚨 **[P0/P1/P2] 生产事故通报**

**时间**: YYYY-MM-DD HH:MM:SS
**影响**: [简要描述]
**当前状态**: [正在排查/已定位/正在修复/已回滚]
**负责人**: @姓名
**预计恢复**: [时间或"未知"]

**最新进展**:
- [HH:MM] 发现问题：...
- [HH:MM] 正在执行：...

**下一步行动**:
1. ...
2. ...

@所有人 请关注后续进展
```

#### 用户通知（如需）

```markdown
尊敬的用户：

我们检测到系统出现临时性问题，技术团队正在紧急处理。
预计恢复时间：[预估时间]

给您带来的不便，我们深表歉意。
如有紧急问题，请联系客服：400-xxx-xxxx

—— 绮管技术团队
```

---

## 📊 回滚后行动

### 立即行动（回滚完成后30分钟内）

1. **确认服务恢复**
   - 运行验证脚本
   - 人工快速检查核心功能
   - 确认用户反馈恢复正常

2. **记录事件**
   ```bash
   cat >> /var/log/qiguan/incident.log << EOF
   ====================================
   INCIDENT: P0 Fix Rollback
   TIME: $(date '+%Y-%m-%d %H:%M:%S')
   TRIGGER: [描述触发原因]
   ROLLBACK_LEVEL: [1/2/3]
   DURATION: [回滚耗时]
   EXECUTOR: [执行人姓名]
   VERIFICATION: [PASS/FAIL]
   NEXT_STEPS: [后续计划]
   ====================================
   EOF
   ```

3. **通知相关人员**
   - 发送内部通报（使用上述模板）
   - 如影响用户，准备用户公告

4. **保护现场**
   - 保留失败版本的日志（至少7天）
   - 不要立即删除 `broken-version-backup.tar.gz`
   - 记录当时的系统负载、并发等指标

### 短期行动（24小时内）

1. **初步复盘（1小时内）**
   - 召集相关人员简短会议（15-30分钟）
   - 明确问题根因（初步判断）
   - 决定是否需要深度分析

2. **制定新修复计划（4小时内）**
   - 基于本次经验调整FIX_PLAN_V2.md
   - 加强验证步骤
   - 考虑增加自动化测试

3. **更新文档（当天）**
   - 更新本回滚文档（记录实际执行情况）
   - 更新FIX_PLAN_V2.md（标注风险点）
   - 补充知识库（如有新的发现）

### 中期行动（1周内）

1. **深度复盘（3个工作日内）**
   - 完整的事故报告（5W1H分析）
   - 根因分析（5 Whys方法）
   - 改进措施（预防再次发生）

2. **流程改进**
   - 优化部署流程（如需要）
   - 增强监控告警
   - 完善应急预案

3. **知识分享**
   - 团队内部分享会
   - 更新最佳实践文档
   - 培训相关人员

---

## 🎯 特殊场景处理

### 场景1: 回滚过程中SSH断连

**症状**: 执行回滚命令时SSH连接中断

**应对**:
```bash
# 1. 重新连接SSH
ssh root@101.34.39.231

# 2. 检查服务状态
pm2 status
ps aux | grep node

# 3. 判断断连时执行到了哪一步
#    - 如果已经执行了 git checkout → 继续重启服务
#    - 如果还在停止服务阶段 → 重新开始回滚流程

# 4. 使用 screen/tmux 避免未来断连
screen -S rollback
# 然后在screen内执行回滚命令
# Ctrl+A D 可以断开screen但不终止命令
```

### 场景2: Git回滚失败

**症状**: `git checkout v1.0.0-pre-fix` 报错

**可能原因及解决**:

```bash
# 原因1: 未提交的更改冲突
git stash        # 暂存更改
git checkout v1.0.0-pre-fix

# 原因2: 标签不存在
git tag -l       # 列出所有标签
# 如果没有标签，使用commit hash回滚
git log --oneline -10  # 找到基线commit
git checkout <commit-hash>

# 原因3: 仓库损坏（极端情况）
rm -rf .git     # 删除损坏的仓库
# 重新从远程克隆或从本地备份恢复
```

### 场景3: 回滚后服务仍不正常

**症状**: 已完成回滚但健康检查仍失败

**排查步骤**:
```bash
# 1. 检查端口占用
netstat -tlnp | grep 3003
# 如果端口被占用: kill <PID>

# 2. 检查.env文件权限
ls -la /www/wwwroot/qiguan/.env.production
# 应该是: -rw------- (600)

# 3. 检查.env文件内容
cat /www/wwwroot/qiguan/.env.production | head -20
# 确认没有乱码或截断

# 4. 手动测试数据库连接
mysql -u QMZYXCX -p'LJN040821.' -h 10.0.0.16 qmzyxcx -e "SELECT 1"

# 5. 查看详细错误日志
pm2 logs backend --lines 100 --err

# 6. 尝试手动启动（查看实时错误）
cd /www/wwwroot/qiguan
node index.js
# 观察5-10秒的输出
# Ctrl+C 停止
```

### 场景4: 部分回滚需求

**场景**: 只想撤销某个特定文件的修改

**方法**:
```bash
# 例如只回退domain.js
cd /www/wwwroot/qiguan

# 从备份恢复单个文件
scp user@local:E:/1/绮管后台/backup/pre-fix/config/domain.js.orig config/domain.js

# 重启服务使更改生效
pm2 restart backend

# 验证
pm2 logs backend --lines 20 --nostream | grep -i config
```

### 场景5: 数据库也需要回滚

**⚠️ 警告**: 数据库回滚会导致数据丢失！

**仅在以下情况下执行**:
- 表结构被错误修改
- 重要数据被误删
- 数据完整性被破坏

**步骤**:
```bash
# 1. 停止所有应用服务（防止新写入）
pm2 stop all

# 2. 备份当前数据库（双重保险）
mysqldump -u QMZYXCX -p'LJN040821.' qmzyxcx > /tmp/emergency_backup_$(date +%s).sql

# 3. 从备份恢复（需要有之前的备份文件）
# 假设备份文件为 /backups/db_YYYYMMDD_HHMMSS.sql
mysql -u QMZYXCX -p'LJN040821.' qmzyxcx < /backups/db_YYYYMMDD_HHMMSS.sql

# 4. 验证数据完整性
mysql -u QMZYXCX -p'LJN040821.' qmzyxcx -e "
  CHECK TABLE customers, products, orders, order_items, users, categories;
  SELECT COUNT(*) as customers_count FROM customers;
  SELECT COUNT(*) as products_count FROM products;
"

# 5. 重启服务
pm2 start all
```

---

## 📈 回滚效果度量

### 成功标准

| 指标 | 目标值 | 测量方法 |
|-----|--------|---------|
| 回滚完成时间 | < 10分钟 | 从决定回滚到验证通过 |
| 数据丢失 | 0字节 | 对比前后数据量 |
| 服务中断时间 | < 5分钟 | 监控系统的downtime |
| 用户感知 | 无投诉 | 客服反馈、社交媒体 |

### 事后改进指标

- **MTTR (平均恢复时间)**: 目标 < 15分钟（本次回滚后统计）
- **回滚成功率**: 目标 > 95%（每次回滚都应成功）
- **重复发生率**: 同类问题6个月内不重复

---

## 📚 附录

### A. 常用命令速查

```bash
# 服务管理
pm2 start|stop|restart|delete|status
pm2 logs <app-name> [--lines N] [--err]
pm2 flush  # 清空日志
pm2 save   # 保存进程列表

# Git操作
git status
git log --oneline -10
git checkout <tag-or-commit>
git diff <file>
git stash / git stash pop

# 系统诊断
netstat -tlnp | grep <port>
ps aux | grep node
df -h
free -m
top -bn1 | head -20

# 数据库
mysql -u USER -pPASS DBNAME -e "SQL;"
mysqldump -u USER -pPASS DBNAME > backup.sql

# 文件操作
md5sum file
chmod 600 file
chown user:group file
tail -f /path/to/logfile
```

### B. 回滚决策记录模板

每次执行回滚后，填写此表格并存档：

```markdown
## 回滚事件记录

| 字段 | 内容 |
|-----|------|
| **事件ID** | INC-YYYYMMDD-NNN |
| **日期时间** | YYYY-MM-DD HH:MM:SS |
| **执行人** | 姓名 |
| **触发原因** | [选择/填写] |
| **回滚级别** | Level 1 / 2 / 3 |
| **回滚范围** | [具体文件或全部] |
| **开始时间** | HH:MM:SS |
| **结束时间** | HH:MM:SS |
| **总耗时** | X分X秒 |
| **是否成功** | ✓ / ✗ |
| **验证结果** | [PASS/FAIL详情] |
| **遇到的问题** | [描述] |
| **用户影响** | [受影响用户数/时长] |
| **后续行动** | [链接到任务跟踪] |
| **经验教训** | [简短总结] |
```

### C. 相关文档

- [FIX_PLAN_V2.md](./FIX_PLAN_V2.md) - 修复方案
- [A1_ROOT_CAUSE_ANALYSIS.md](./A1_ROOT_CAUSE_ANALYSIS.md) - 根因分析
- [A2_ISSUE_CONFIRMATION.md](./A2_ISSUE_CONFIRMATION.md) - 问题确认

---

## ✅ 文档维护

| 版本 | 日期 | 作者 | 变更内容 |
|-----|------|------|---------|
| V1.0 | 2026-04-15 | AI Assistant | 初始版本，基于FIX_PLAN_V2制定 |

**下次审查日期**: 2026-05-15（或任何回滚事件后立即审查）

---

## 📌 重要提醒

### ⚠️ 执行回滚前的最后检查

在按下回车键执行回滚命令之前，**请逐项确认**：

- [ ] 我已经通知了相关负责人（电话/微信）
- [ ] 我知道当前的Git commit hash或备份位置
- [ ] 我选择了合适的回滚级别（1/2/3）
- [ ] 我理解每个命令的作用和后果
- [ ] 我准备好了验证脚本或Checklist
- [ ] 我记录了当前时间（用于计算回滚耗时）
- [ ] 如果回滚也失败了，我知道下一步该怎么办（联系CTO/升级）

### 💡 最佳实践

1. **保持冷静**: 即使压力很大，也要按步骤执行
2. **沟通优先**: 先通知再操作，不要默默回滚
3. **保留证据**: 日志、截图、命令历史都很重要
4. **双人在场**: 如果可能，两个人一起操作（一人执行，一人监督）
5. **先测试再生产**: 如果时间允许，先在Staging试一遍
6. **记录一切**: 为事后复盘提供充分素材

---

**文档结束**

如有疑问或建议，请联系技术负责人或更新本文档。

**记住**: 回滚不是失败，而是负责任的表现。及时回滚比让故障持续蔓延更明智！
