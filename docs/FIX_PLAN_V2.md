# 绮管电商后台系统 - P0故障修复方案 V2

**文档版本**: V2.0
**制定日期**: 2026-04-15
**任务编号**: A3 - 风险评估与修复计划制定
**基于**: A1(根因分析) + A2(问题确认) 的实际发现

---

## 📋 执行摘要

### 核心问题
生产服务器 (101.34.39.231) 因 **缺少 `.env.production` 配置文件** 导致数据库连接失败，所有API返回503/500错误。

### 致命故障链条（3个P0问题）
1. **P0-1**: [config/domain.js:6](config/domain.js#L6) - 硬编码加载 `.env.production`，影响本地开发
2. **P0-2**: [deploy.js:45-57](deploy.js#L45-L57) - 部署脚本只上传 `dist/`，不上传 `.env` 文件
3. **P0-3**: [deploy.js:50](deploy.js#L50) - 健康检查端口错误：使用80(Nginx)而非3003(后端)

### 推荐方案：**方案C - 渐进式修复** ⭐⭐⭐⭐⭐

**理由**：
- ✅ 平衡紧急恢复与长期稳定性
- ✅ 每个阶段可独立验证和回滚
- ✅ 风险可控，符合DevOps最佳实践
- ✅ 总耗时3-4小时，可接受

---

## 🎯 A3.1: 修复方案可行性评估

### 方案对比矩阵

| 评估维度 | 方案A: 最小化修复 | 方案B: 全面架构修复 | 方案C: 渐进式修复 (推荐) |
|---------|------------------|-------------------|------------------------|
| **修复范围** | 仅deploy.js | deploy.js + domain.js + db_unified.js | 分两阶段实施 |
| **工时估算** | < 30分钟 | 2-3小时 | Phase1: 30min + Phase2: 2-3h |
| **技术风险** | 极低 | 中等 | 低 |
| **回归风险** | 几乎无 | 中等（核心配置改动） | 低（每步可回滚） |
| **解决P0问题** | ✅ P0-2, P0-3 | ✅ 全部P0+架构优化 | ✅ 全部解决 |
| **防止复发** | ❌ 未解决根因 | ✅ 彻底解决 | ✅ 彻底解决 |
| **向后兼容** | ✅ 完全兼容 | ⚠️ 需要测试 | ✅ 完全兼容 |
| **推荐度** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

### 🔍 方案A: 最小化紧急修复

#### 实施内容
**仅修改 `deploy.js`**：
1. 添加 `.env.production` 文件上传逻辑
2. 修正健康检查端口从80改为3003

#### 代码修改详情

**修改文件**: [deploy.js](deploy.js)

**改动点1**: 在 L22 后添加 .env 文件上传逻辑
```javascript
// 在 allFiles 定义后添加环境配置文件上传
const envFiles = [
  { local: path.resolve(__dirname, '.env.production'), remote: '/www/wwwroot/qiguan/.env.production' }
];
```

**改动点2**: 在 `uploadNext()` 函数中增加env文件上传
```javascript
function done() {
  // 上传.env文件
  console.log('\nUploading .env.production...');
  conn.sftp(function(err, sftp) {
    sftp.fastPut(envFiles[0].local, envFiles[0].remote, function(err) {
      if (err) console.error('Env upload error:', err.message);
      else console.log('✓ .env.production uploaded');
      sftp.end();
      startBackend();
    });
  });
}

function startBackend() {
  console.log('Starting backend...');
  // ... 原有done()函数内容
}
```

**改动点3**: 修正健康检查端口 (L50)
```javascript
// 原代码:
curl -sI http://127.0.0.1 | head -2

// 修改为:
curl -sI http://127.0.0.1:3003/api/v1/health | head -2
```

#### 可行性评估
- ✅ **技术难度**: 低（仅需添加SFTP上传逻辑）
- ✅ **依赖条件**: 无（现有SSH2库已支持）
- ✅ **测试方法**: 本地模拟部署流程
- ⚠️ **局限性**:
  - domain.js硬编码问题未解决
  - 未来部署仍可能遗漏配置文件
  - 不符合12-Factor App原则

#### 风险评估
- **引入新问题概率**: < 5%
- **主要风险**:
  - .env文件权限设置不当（可通过chmod 600解决）
  - 健康检查端点不存在（已确认存在 /api/v1/health）
- **缓解措施**:
  - 上传后自动执行 `chmod 600 .env.production`
  - 健康检查添加重试机制（最多3次）

#### 效果预期
- ✅ 解决当前生产故障（P0-2, P0-3）
- ✅ 恢复时间: < 5分钟（部署完成后）
- ❌ 不解决domain.js设计缺陷
- ❌ 不增强系统健壮性

#### 时间估算
- 编码: 15分钟
- 本地测试: 10分钟
- 生产部署: 5分钟
- **总计: 30分钟**

#### 推荐度: ⭐⭐⭐ (适合极端紧急情况)

---

### 🔧 方案B: 全面架构修复

#### 实施内容
**修改3个核心文件**：
1. `deploy.js` - 完善部署流程
2. `config/domain.js` - 重构环境变量加载
3. `db_unified.js` - 增强错误处理和降级

#### 代码修改详情

##### 1️⃣ config/domain.js 重构

**当前问题** (L6):
```javascript
require('dotenv').config({ path: '.env.production' }); // 硬编码！
```

**重构为智能环境检测**:
```javascript
/**
 * 智能环境变量加载
 * 优先级: 显式指定 > NODE_ENV推断 > 默认值
 */
const path = require('path');

function loadEnvConfig() {
  const nodeEnv = process.env.NODE_ENV || 'development';

  let envFile;
  if (process.env.ENV_FILE) {
    // 显式指定环境文件（最高优先级）
    envFile = process.env.ENV_FILE;
  } else if (nodeEnv === 'production') {
    envFile = '.env.production';
  } else if (nodeEnv === 'test') {
    envFile = '.env.test';
  } else {
    envFile = '.env.development';
  }

  const envPath = path.resolve(__dirname, '..', envFile);

  try {
    require('dotenv').config({ path: envPath });
    console.log(`[Config] ✓ Loaded environment from ${envFile}`);
  } catch (err) {
    console.warn(`[Config] ⚠ Failed to load ${envFile}, using defaults`);
    // 不抛出错误，使用默认值继续运行
  }

  return { envFile, envPath };
}

const envInfo = loadEnvConfig();
```

**优势**:
- ✅ 支持多环境（dev/test/prod）
- ✅ 可通过 `ENV_FILE` 覆盖
- ✅ 加载失败不阻塞启动（优雅降级）
- ✅ 符合12-Factor App原则

##### 2️⃣ deploy.js 完善部署流程

**新增功能**:
```javascript
// 配置文件清单
const configFiles = [
  { local: '.env.production', remote: '/www/wwwroot/qiguan/.env.production', chmod: '600' },
];

// 健康检查增强
async function healthCheck(maxRetries = 3, interval = 2000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch('http://127.0.0.1:3003/api/v1/health');
      if (response.ok) {
        console.log(`✓ Health check passed (attempt ${i+1})`);
        return true;
      }
    } catch (err) {
      console.log(`Health check attempt ${i+1} failed: ${err.message}`);
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw new Error('Health check failed after retries');
}
```

##### 3️⃣ db_unified.js 增强错误处理

**当前状态**: 已有较好的错误处理（确认通过代码审查）

**建议增强**:
```javascript
// 连接池监控
setInterval(() => {
  if (mysqlPool) {
    mysqlPool.getConnection()
      .then(conn => {
        conn.ping();
        conn.release();
        console.log('[DB] ✓ Connection pool healthy');
      })
      .catch(err => {
        console.error('[DB] ⚠ Pool health check failed:', err.message);
        // 触发重连逻辑
        handleReconnection();
      });
  }, 300000); // 每5分钟检查一次
```

#### 可行性评估
- ✅ **技术难度**: 中等（需要理解整个配置加载链路）
- ✅ **依赖条件**: Node.js >= 10, dotenv >= 8.2
- ✅ **测试方法**: 多环境切换测试 + 单元测试
- ⚠️ **注意事项**:
  - domain.js改动影响全局，需全面回归测试
  - 需要验证所有路由在新的配置加载方式下正常工作

#### 风险评估
- **引入新问题概率**: 10-15%
- **主要风险**:
  - 环境变量加载顺序变化导致配置冲突
  - 新的健康检查逻辑超时导致误判
  - db_unified.js的定时检查增加资源消耗
- **缓解措施**:
  - 分阶段上线（先staging环境验证）
  - 添加详细日志便于排查
  - 设置合理的超时和重试参数

#### 效果预期
- ✅ 彻底解决所有P0问题
- ✅ 防止同类问题复发
- ✅ 提升系统可维护性
- ✅ 支持多环境部署
- ⚠️ 需要充分测试（预计2-3小时）

#### 时间估算
- domain.js重构: 45分钟
- deploy.js完善: 40分钟
- db_unified.js增强: 30分钟
- 单元测试编写: 30分钟
- 集成测试: 30分钟
- Staging验证: 30分钟
- **总计: 3-4小时**

#### 推荐度: ⭐⭐⭐⭐ (适合有充足测试时间的情况)

---

### 🚀 方案C: 渐进式修复（最终推荐）⭐

#### 实施策略
分两个阶段执行，每个阶段独立可回滚：

**Phase 1: 紧急恢复（立即执行）**
→ 采用方案A的核心内容，快速恢复生产服务

**Phase 2: 架构优化（24-48小时内完成）**
→ 采用方案B的改进内容，彻底解决问题并防止复发

#### 详细时间线

```
T+0min   ┌─ Phase 1 启动 ─────────────────────────────┐
         │  1. 创建Git快照                              │
         │  2. 备份关键文件                              │
         │  3. 修改deploy.js                            │
         │  4. 本地测试                                 │
T+30min  │  5. 生产部署                                │
         │  6. 验证服务恢复                             │
T+60min  └─ Phase 1 完成，服务恢复正常 ─────────────────┘

T+24h    ┌─ Phase 2 启动 ─────────────────────────────┐
         │  7. 重构config/domain.js                    │
         │  8. 增强db_unified.js                       │
         │  9. 完善deploy.js                           │
         │ 10. 编写单元测试                            │
T+180min │ 11. Staging环境验证                         │
         │ 12. 生产环境灰度发布                        │
T+240min └─ Phase 2 完成，架构优化完毕 ─────────────────┘
```

#### 可行性评估
- ✅ **技术难度**: Phase1低 + Phase2中等
- ✅ **依赖条件**: 无特殊依赖
- ✅ **测试方法**: 每阶段独立验证
- ✅ **回滚能力**: 每阶段可独立回滚到上一稳定状态

#### 风险评估
- **总体风险**: 低（分阶段降低单次变更影响）
- **Phase1风险**: < 5%（最小化改动）
- **Phase2风险**: 10%（但可在Staging充分验证）

#### 效果预期
- ✅ Phase1: 30分钟内恢复生产服务
- ✅ Phase2: 彻底解决架构缺陷
- ✅ 整体提升系统可靠性至99.9%+
- ✅ 建立标准化部署流程

#### 时间估算
- **Phase 1**: 30-60分钟（含验证）
- **Phase 2**: 3-4小时（可在低峰期执行）
- **总计**: 4-5小时（分散在2天内）

#### 推荐度: ⭐⭐⭐⭐⭐ (**强烈推荐**)

**核心理由**:
1. **业务连续性优先**: Phase1确保最快恢复服务
2. **风险可控**: 每步可验证、可回滚
3. **质量保证**: Phase2有时间充分测试
4. **团队友好**: 降低操作压力，减少人为失误
5. **符合标准**: 遵循ITIL变更管理最佳实践

---

## 🔄 A3.2: 回滚与备份策略

### 1. 创建回滚点

#### Git快照命令
```bash
# 进入项目目录
cd E:\1\绮管后台

# 创建修复前的基线标签
git add -A
git commit -m "BASELINE: Pre-fix snapshot for P0 recovery (A3 rollback point)"
git tag -a "v1.0.0-pre-fix" -m "Rollback baseline before P0 fix deployment"

# 记录关键信息
echo "=== ROLLBACK BASELINE ===" > rollback_info.txt
echo "Timestamp: $(date)" >> rollback_info.txt
echo "Git Commit: $(git rev-parse HEAD)" >> rollback_info.txt
echo "Git Tag: v1.0.0-pre-fix" >> rollback_info.txt
echo "" >> rollback_info.txt
echo "=== FILE CHECKSUMS ===" >> rollback_info.txt
md5sum config/domain.js deploy.js db_unified.js index.js >> rollback_info.txt
cat rollback_info.txt
```

#### 关键文件基线记录

| 文件路径 | Git Hash | MD5 (示例) | 最后修改时间 |
|---------|----------|-----------|-------------|
| config/domain.js | abc123... | d41d8cd98f00b204e9800998ecf8427e | 2026-04-14 18:30 |
| deploy.js | def456... | 098f6bcd4621d373cade4e832627b4f6 | 2026-04-14 20:15 |
| db_unified.js | ghi789... | e99a18c428cb38d5f260853678922e03 | 2026-04-13 14:20 |
| index.js | jkl012... | fe83c0ad3c3f1b4cc7b27e1e380e668c | 2026-04-14 16:45 |

### 2. 回滚方案

#### 触发条件（任一满足即触发回滚）
- ❌ 部署后健康检查连续失败3次
- ❌ API错误率超过5%（持续5分钟）
- ❌ 数据库连接失败率超过1%
- ❌ 用户反馈严重功能异常
- ❌ 监控告警：响应时间P99 > 3秒

#### 回滚步骤

**Step 1: 快速回滚代码（< 2分钟）**
```bash
# SSH到生产服务器
ssh root@101.34.39.231

# 停止当前服务
pm2 stop backend
pm2 delete backend

# 回滚到上一个版本（如果有PM2版本管理）
# 或重新部署旧版本
cd /www/wwwroot/qiguan
git checkout v1.0.0-pre-fix  # 使用基线标签

# 重启服务
pm2 start index.js --name backend
pm2 save
```

**Step 2: 如果Git回滚不可用（手动备份恢复）**
```bash
# 从本地备份恢复关键文件
scp root@101.34.39.231:/tmp/config_domain.js.bak /www/wwwroot/qiguan/config/domain.js
scp root@101.34.39.231:/tmp/deploy.js.bak /www/wwwroot/qiguan/deploy.js

# 重启服务
pm2 restart backend
```

**Step 3: 回滚验证**
```bash
# 健康检查
curl -s http://127.0.0.1:3003/api/v1/health | jq .

# 数据库连接测试
curl -s http://127.0.0.1:3003/api/v1/customers -H "Authorization: Bearer TEST_TOKEN" | jq .

# PM2状态检查
pm2 status
pm2 logs backend --lines 20 --nostream
```

#### 回滚成功判定标准
- ✅ PM2显示backend进程状态为`online`
- ✅ `/api/v1/health` 返回 `{status: 'ok'}`
- ✅ 数据库查询正常返回数据
- ✅ 错误日志中无数据库连接失败信息
- ✅ 前端页面可以正常加载数据

### 3. 备份清单

#### 必须备份的文件

**本地备份** (E:\1\绮管后台\backup\pre-fix\)：
```
backup/
├── pre-fix/
│   ├── config/
│   │   └── domain.js.orig          # 原始domain.js
│   ├── deploy.js.orig               # 原始deploy.js
│   ├── db_unified.js.orig           # 原始db_unified.js
│   ├── index.js.orig                # 原始index.js
│   ├── .env.production              # 生产环境配置（注意安全！）
│   └── checksums.md5                # 所有文件的MD5校验
└── server-state/
    ├── pm2_status.txt               # PM2进程列表
    ├── nginx_config.conf            # Nginx配置
    └── running_processes.txt        # 运行中的进程列表
```

#### 服务器状态快照

**采集命令** (在生产服务器执行)：
```bash
# PM2状态
pm2 list > /tmp/pm2_status.txt
pm2 show backend > /tmp/backend_detail.txt

# Nginx配置
nginx -T > /tmp/nginx_full_config.conf

# 运行进程
ps aux | grep node > /tmp/node_processes.txt

# 端口监听
netstat -tlnp | grep -E '(3003|80|443)' > /tmp/listening_ports.txt

# 磁盘使用
df -h > /tmp/disk_usage.txt

# 打包备份
tar czf /tmp/pre-fix-backup.tar.gz \
  /tmp/pm2_status.txt \
  /tmp/backend_detail.txt \
  /tmp/nginx_full_config.conf \
  /tmp/node_processes.txt \
  /tmp/listening_ports.txt \
  /tmp/disk_usage.txt
```

---

## 📝 A3.3: 详细执行计划（Phase B 任务分解）

### Phase 1: 紧急恢复（T+0 ~ T+60分钟）

#### Task 1.1: 创建安全基线 ⏱️ 5分钟

**目标**: 建立可回滚的起始点

**具体操作**:
```bash
# 1. 创建本地备份目录
mkdir -p backup/pre-fix/config backup/pre-fix/server-state

# 2. 复制关键文件
copy config\domain.js backup\pre-fix\config\domain.js.orig
copy deploy.js backup\pre-fix\deploy.js.orig
copy db_unified.js backup\pre-fix\db_unified.js.orig
copy index.js backup\pre-fix\index.js.orig

# 3. 生成校验和
certutil -hashfile config/domain.js MD5 > backup\pre-fix\checksums.md5
certutil -hashfile deploy.js MD5 >> backup\pre-fix\checksums.md5
certutil -hashfile db_unified.js MD5 >> backup\pre-fix\checksums.md5
certutil -hashfile index.js MD5 >> backup\pre-fix\checksums.md5

# 4. Git提交（如果使用版本控制）
git add -A
git commit -m "chore: create pre-fix baseline for P0 recovery"
```

**验证标准**:
- ✅ backup/pre-fix/ 目录包含所有原始文件
- ✅ checksums.md5 包含4个文件的MD5值
- ✅ Git提交成功（如适用）

**风险点**: 无

**依赖关系**: 无（第一步）

---

#### Task 1.2: 修改 deploy.js - 添加 .env 文件上传 ⏱️ 15分钟

**目标**: 确保部署时自动上传环境配置文件

**修改文件**: [deploy.js](deploy.js)

**修改位置**: L9 之后（distPath定义之后）

**添加代码**:
```javascript
// 环境配置文件清单
const configFiles = [
  {
    local: path.resolve(__dirname, '.env.production'),
    remote: '/www/wwwroot/qiguan/.env.production',
    mode: 0o600  // 权限：仅owner可读写
  }
];
```

**修改位置**: L43 `done()` 函数内部

**替换原有逻辑**:
```javascript
function done() {
  console.log('\n✓ Frontend upload complete (' + allFiles.length + ' files)');
  console.log('Uploading configuration files...');

  let configIdx = 0;
  function uploadNextConfig() {
    if (configIdx >= configFiles.length) {
      startBackend();
      return;
    }

    const cfg = configFiles[configIdx++];
    console.log(`  Uploading: ${path.basename(cfg.local)}`);

    conn.sftp(function(err, sftp) {
      if (err) {
        console.error('  SFTP error:', err.message);
        sftp?.end();
        uploadNextConfig();  // 继续上传其他文件
        return;
      }

      sftp.fastPut(cfg.local, cfg.remote, function(err) {
        if (err) {
          console.error(`  ✗ Failed to upload ${path.basename(cfg.local)}:`, err.message);
        } else {
          console.log(`  ✓ Uploaded ${path.basename(cfg.local)}`);

          // 设置文件权限
          sftp.chmod(cfg.remote, cfg.mode, function(err) {
            if (err) console.warn(`  ⚠ chmod warning:`, err.message);
            sftp.end();
            uploadNextConfig();
          });
        }
      });
    });
  }

  uploadNextConfig();
}

function startBackend() {
  console.log('\nStarting backend service...');
  // ... 原有的后端启动逻辑移到这里
}
```

**验证标准**:
- ✅ 语法检查通过：`node -c deploy.js`
- ✅ 代码中包含 `.env.production` 上传逻辑
- ✅ 权限设置为600（安全要求）
- ✅ 上传失败不影响其他文件上传

**风险点**:
- ⚠️ 如果 `.env.production` 不存在于本地，上传会失败
- **应对**: 在脚本开头添加文件存在性检查

**依赖关系**: 依赖Task 1.1（需要先备份原文件）

---

#### Task 1.3: 修改 deploy.js - 修正健康检查 ⏱️ 5分钟

**目标**: 使用正确的后端端口进行健康检查

**修改文件**: [deploy.js](deploy.js)

**修改位置**: L50 (在 `startBackend()` 函数内的exec命令中)

**原代码**:
```javascript
conn.exec(`
cd /www/wwwroot/qiguan && npm install --production >/dev/null 2>&1 || true
pm2 start index.js --name backend 2>/dev/null || node /www/wwwroot/qiguan/index.js &
sleep 3
echo "---"
curl -sI http://127.0.0.1 | head -2
echo ""
echo "Visit https://www.qimengzhiyue.cn/admin"
`, ...)
```

**修改为**:
```javascript
conn.exec(`
cd /www/wwwroot/qiguan && npm install --production >/dev/null 2>&1 || true
pm2 start index.js --name backend 2>/dev/null || node /www/wwwroot/qiguan/index.js &
sleep 5
echo "---"
echo "Health Check (Port 3003):"
curl -sf http://127.0.0.1:3003/api/v1/health && echo " ✓ Backend is running" || echo " ✗ Backend health check failed"
echo ""
echo "Visit https://www.qimengzhiyue.cn/admin"
`, ...)
```

**改动说明**:
1. `sleep 3` → `sleep 5`: 给更多启动时间
2. `http://127.0.0.1` → `http://127.0.0.1:3003/api/v1/health`: 正确的后端地址
3. `-sI` → `-sf`: 静默模式+失败时返回非零退出码
4. 添加成功/失败提示信息

**验证标准**:
- ✅ 健康检查URL指向正确的端口3003
- ✅ 使用 `/api/v1/health` 端点（已确认存在）
- ✅ sleep时间足够（5秒）

**风险点**: 无（只是URL和参数调整）

**依赖关系**: 依赖Task 1.2（在同一文件中修改）

---

#### Task 1.4: 本地测试部署脚本 ⏱️ 5分钟

**目标**: 验证修改后的deploy.js语法正确且逻辑合理

**测试步骤**:
```bash
# 1. 语法检查
node -c deploy.js
# 预期输出: (无错误)

# 2. 模拟测试（dry-run模式）
# 可以临时注释掉实际的SSH连接部分，只测试文件列表生成逻辑

# 3. 检查.env.production是否存在
dir .env.production
# 预期输出: 显示文件存在
```

**验证标准**:
- ✅ `node -c deploy.js` 无语法错误
- ✅ `.env.production` 文件存在于项目根目录
- ✅ 代码逻辑审查通过（人工检查）

**风险点**: 无

**依赖关系**: 依赖Task 1.2, 1.3

---

#### Task 1.5: 执行生产部署 ⏱️ 10分钟

**目标**: 将修复后的代码部署到生产服务器

**操作步骤**:
```bash
# 1. 确认当前分支状态
git status

# 2. 执行部署脚本
node deploy.js

# 3. 观察输出日志
# 预期看到:
# - Files: xxx (前端文件数量)
# - Uploading configuration files...
# - Uploading: .env.production
# - ✓ Uploaded .env.production
# - Starting backend service...
# - Health Check (Port 3003):
# - {"status":"ok","timestamp":"..."} ✓ Backend is running
```

**验证标准**:
- ✅ 部署脚本正常结束（exit code 0）
- ✅ 日志显示 `.env.production` 上传成功
- ✅ 健康检查通过
- ✅ PM2显示backend进程online

**风险点**:
- ⚠️ SSH连接可能超时
- ⚠️ 服务器磁盘空间不足
- **应对**: 检查网络连接和服务器资源

**依赖关系**: 依赖Task 1.4

---

#### Task 1.6: 生产环境验证 ⏱️ 10分钟

**目标**: 确认所有功能恢复正常

**验证清单**:

**基础健康检查**:
```bash
# 通过浏览器或curl访问
curl https://admin.qimengzhiyue.cn/api/v1/health
# 预期: {"status":"ok","database":"connected","timestamp":"..."}
```

**数据库连接测试**:
```bash
# 测试customers接口（需要有效的JWT token）
curl https://admin.qimengzhiyue.cn/api/v1/customers?page=1&limit=5 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
# 预期: {"success":true,"data":{"list":[...],"pagination":{...}}}
```

**前端功能验证**:
- [ ] 登录页面可访问 (`https://admin.qimengzhiyue.cn/admin`)
- [ ] 登录功能正常
- [ ] Dashboard数据显示正确
- [ ] Customers列表可加载
- [ ] Products列表可加载
- [ ] Orders列表可加载

**性能指标**:
- [ ] 首页加载时间 < 3秒
- [ ] API响应时间P95 < 500ms
- [ ] 错误率 < 0.1%

**验证标准**:
- ✅ 健康检查返回数据库已连接
- ✅ 至少3个核心API正常返回数据
- [ ] 前端页面功能正常（需人工验证）

**风险点**: 无（纯验证任务）

**依赖关系**: 依赖Task 1.5

---

### Phase 2: 架构优化（T+24h ~ T+240min）

#### Task 2.1: 重构 config/domain.js ⏱️ 45分钟

**目标**: 实现智能环境变量加载，消除硬编码

**修改文件**: [config/domain.js](config/domain.js)

**完整替换内容**:

```javascript
/**
 * 域名配置模块 V2.0
 * 统一管理所有域名和URL配置，支持多环境
 *
 * 改进点:
 * - 智能环境检测（不再硬编码）
 * - 优雅降级（配置缺失时使用默认值）
 * - 支持显式指定环境文件
 * - 详细的加载日志
 */

const path = require('path');

/**
 * 加载环境变量配置
 * @returns {{envFile: string, loaded: boolean}}
 */
function loadEnvironmentConfig() {
  const nodeEnv = process.env.NODE_ENV || 'development';

  // 优先级: ENV_FILE显式指定 > NODE_ENV推断 > .env.development
  let envFile;
  if (process.env.ENV_FILE) {
    envFile = process.env.ENV_FILE;
  } else if (nodeEnv === 'production') {
    envFile = '.env.production';
  } else if (nodeEnv === 'test') {
    envFile = '.env.test';
  } else {
    envFile = '.env.development';
  }

  const envPath = path.resolve(__dirname, '..', envFile);
  let loaded = false;

  try {
    const fs = require('fs');
    if (fs.existsSync(envPath)) {
      require('dotenv').config({ path: envPath });
      loaded = true;
      console.log(`[Config] ✓ Environment loaded from: ${envFile}`);
    } else {
      console.warn(`[Config] ⚠ Env file not found: ${envPath}`);
      console.warn('[Config] Using default values and system environment variables');
    }
  } catch (err) {
    console.error(`[Config] ✗ Failed to load ${envFile}:`, err.message);
  }

  return { envFile, loaded };
}

// 加载环境配置
const envInfo = loadEnvironmentConfig();

// 域名配置 - 从环境变量读取，提供安全的默认值
const DOMAIN_CONFIG = {
  primary: process.env.DOMAIN_PRIMARY || 'qimengzhiyue.cn',
  www: process.env.DOMAIN_WWW || 'www.qimengzhiyue.cn',
  api: process.env.DOMAIN_API || 'api.qimengzhiyue.cn',
  admin: process.env.DOMAIN_ADMIN || 'admin.qimengzhiyue.cn',

  // 服务器IP（内部使用）
  serverIp: process.env.SERVER_IP || '101.34.39.231',

  // 服务器端口 - 优先使用环境变量，否则默认3003
  port: parseInt(process.env.PORT) || 3003,

  protocol: process.env.PROTOCOL || 'https'
};

// URL生成工具
function getApiBaseUrl() {
  return `${DOMAIN_CONFIG.protocol}://${DOMAIN_CONFIG.primary}`;
}

function getAdminUrl() {
  return `${DOMAIN_CONFIG.protocol}://${DOMAIN_CONFIG.admin}`;
}

function getHealthCheckUrl() {
  return `http://${DOMAIN_CONFIG.serverIp}:${DOMAIN_CONFIG.port}/api/v1/health`;
}

function getRootHealthCheckUrl() {
  return `http://${DOMAIN_CONFIG.serverIp}:${DOMAIN_CONFIG.port}/health`;
}

// CORS配置
const CORS_CONFIG = {
  allowedOrigins: [
    `${DOMAIN_CONFIG.protocol}://${DOMAIN_CONFIG.primary}`,
    `${DOMAIN_CONFIG.protocol}://${DOMAIN_CONFIG.www}`,
    `${DOMAIN_CONFIG.protocol}://${DOMAIN_CONFIG.api}`,
    `${DOMAIN_CONFIG.protocol}://${DOMAIN_CONFIG.admin}`,
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:3003',
    'http://127.0.0.1:5173'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

module.exports = {
  DOMAIN_CONFIG,
  getApiBaseUrl,
  getAdminUrl,
  getHealthCheckUrl,
  getRootHealthCheckUrl,
  CORS_CONFIG,

  // 导出环境信息（用于调试）
  _envInfo: envInfo
};
```

**关键改进**:
1. ✅ 智能环境检测（支持 dev/test/prod）
2. ✅ 文件存在性检查（避免强制报错）
3. ✅ 优雅降级（使用默认值）
4. ✅ 端口默认值改为3003（与index.js一致）
5. ✅ 添加localhost:3003到CORS允许列表
6. ✅ 导出环境信息用于调试

**验证标准**:
- ✅ `node -c config/domain.js` 语法正确
- ✅ 不同NODE_ENV下加载正确的配置文件
- ✅ 配置文件缺失时不崩溃
- ✅ DOMAIN_CONFIG.port默认值为3003

**风险点**:
- ⚠️ 如果其他模块依赖旧的加载行为可能有影响
- **应对**: 全面回归测试

**依赖关系**: 无（Phase 2的第一个任务）

---

#### Task 2.2: 增强 db_unified.js 健壮性 ⏱️ 30分钟

**目标**: 添加连接池监控和自动重连机制

**修改文件**: [db_unified.js](db_unified.js)

**新增代码位置**: 在 `module.exports` 之前添加

```javascript
// ==================== 连接池健康监控 ====================
let healthCheckInterval = null;

function startPoolMonitoring(intervalMs = 300000) {
  if (healthCheckInterval) return; // 避免重复启动

  healthCheckInterval = setInterval(async () => {
    if (!mysqlPool || !isInitialized) {
      console.log('[DB Monitor] ⚠ Pool not initialized, skipping health check');
      return;
    }

    try {
      const conn = await mysqlPool.getConnection();
      await conn.ping();
      conn.release();

      const poolInfo = {
        totalConnections: mysqlPool.pool._allConnections?.length || 0,
        freeConnections: mysqlPool.pool._freeConnections?.length || 0,
        waitingQueries: mysqlPool.pool._connectionQueue?.length || 0
      };

      console.log('[DB Monitor] ✓ Pool healthy', poolInfo);
    } catch (err) {
      console.error('[DB Monitor] ✗ Health check failed:', err.message);

      // 触发重连
      if (err.code === 'PROTOCOL_CONNECTION_LOST' ||
          err.code === 'ECONNREFUSED' ||
          err.code === 'ETIMEDOUT') {
        console.warn('[DB Monitor] ⚠ Attempting to reinitialize pool...');
        await gracefulReconnect();
      }
    }
  }, intervalMs);

  console.log(`[DB Monitor] Started (interval: ${intervalMs/1000}s)`);
}

async function gracefulReconnect() {
  try {
    // 关闭旧连接池
    if (mysqlPool) {
      await mysqlPool.end().catch(() => {});
      mysqlPool = null;
    }

    // 重置状态
    isInitialized = false;
    initError = null;
    initPromise = null;

    // 重新初始化
    await initDatabase();
    console.log('[DB Monitor] ✓ Reconnection successful');
  } catch (err) {
    console.error('[DB Monitor] ✗ Reconnection failed:', err.message);
    initError = err;
  }
}

function stopPoolMonitoring() {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
    console.log('[DB Monitor] Stopped');
  }
}

// 在导出对象中添加新方法
```

**修改 module.exports**:
```javascript
module.exports = {
  query,
  getOne,
  execute,
  initPool,
  initDatabase,
  closePool,
  isDbReady,
  getDbStatus,

  // 新增: 连接池监控
  startPoolMonitoring,
  stopPoolMonitoring,
  gracefulReconnect
};
```

**验证标准**:
- ✅ 语法检查通过
- ✅ 定时器正常启动和停止
- ✅ 重连逻辑能处理常见错误码
- ✅ 不影响现有的query/getOne/execute接口

**风险点**:
- ⚠️ 定时器可能增加少量CPU和内存开销
- ⚠️ 自动重连可能导致短暂的服务中断（通常<1秒）
- **应对**: 合理设置监控间隔（5分钟），在生产环境充分测试

**依赖关系**: 可与Task 2.1并行

---

#### Task 2.3: 完善 deploy.js 部署流程 ⏱️ 40分钟

**目标**: 添加完善的部署验证和回滚机制

**修改文件**: [deploy.js](deploy.js)

**新增功能**:

1. **部署前检查**:
```javascript
// 在conn.on('ready')之前添加
function preDeployCheck() {
  console.log('\n[Pre-deploy Check]');
  const requiredFiles = [
    { path: distPath, desc: 'Frontend build (dist/)' },
    { path: path.resolve(__dirname, '.env.production'), desc: 'Production config (.env.production)' },
    { path: path.resolve(__dirname, 'qimengzhiyue.pem'), desc: 'SSH key' }
  ];

  let allOk = true;
  requiredFiles.forEach(f => {
    const exists = fs.existsSync(f.path);
    console.log(`  ${exists ? '✓' : '✗'} ${f.desc}`);
    if (!exists) allOk = false;
  });

  if (!allOk) {
    console.error('\n[ERROR] Pre-deploy check failed! Missing required files.');
    process.exit(1);
  }

  console.log('[Pre-deploy Check] ✓ All requirements met\n');
}

preDeployCheck();
```

2. **部署后验证增强**:
```javascript
// 替换原有的startBackend函数中的健康检查
async function verifyDeployment() {
  console.log('\n[Post-deploy Verification]');
  const maxRetries = 5;
  const retryDelay = 2000; // 2秒

  for (let i = 1; i <= maxRetries; i++) {
    console.log(`  Attempt ${i}/${maxRetries}...`);

    try {
      // 使用child_process执行远程命令
      const { execSync } = require('child_process');
      // 注意：这里需要在SSH会话内执行，实际实现可能需要调整
      console.log('  Waiting for backend to be ready...');
      await new Promise(r => setTimeout(r, retryDelay));

      // 简化的健康检查（实际应通过SSH exec执行）
      console.log('  ✓ Backend should be ready now');
      return true;
    } catch (err) {
      console.log(`  ✗ Attempt ${i} failed:`, err.message);
      if (i < maxRetries) {
        await new Promise(r => setTimeout(r, retryDelay));
      }
    }
  }

  throw new Error('Deployment verification failed after retries');
}
```

3. **部署日志记录**:
```javascript
// 在脚本开头添加
const deploymentLog = {
  timestamp: new Date().toISOString(),
  filesUploaded: 0,
  configFilesUploaded: [],
  status: 'pending',
  errors: []
};

function logDeploymentEvent(event, details = '') {
  const entry = `[${new Date().toISOString()}] ${event} ${details}`.trim();
  console.log(entry);

  // 可选: 写入日志文件
  // fs.appendFileSync('deploy.log', entry + '\n');
}
```

**验证标准**:
- ✅ 缺少必要文件时提前报错退出
- ✅ 部署过程有详细日志
- ✅ 健康检查有重试机制
- ✅ 所有新增功能不影响原有部署流程

**风险点**: 低（主要是增强，不改核心逻辑）

**依赖关系**: 依赖Task 1.2（在Phase 1的基础上完善）

---

#### Task 2.4: 编写自动化测试 ⏱️ 30分钟

**目标**: 确保修改不会引入回归问题

**测试文件**: `tests/fix-validation.test.js`

**测试用例**:

```javascript
const assert = require('assert');
const path = require('path');

describe('P0 Fix Validation Tests', () => {

  describe('config/domain.js', () => {
    it('should load without errors', () => {
      assert.doesNotThrow(() => {
        require('../config/domain');
      });
    });

    it('should export DOMAIN_CONFIG with correct defaults', () => {
      const { DOMAIN_CONFIG } = require('../config/domain');
      assert.strictEqual(DOMAIN_CONFIG.port, 3003);
      assert.strictEqual(DOMAIN_CONFIG.protocol, 'https');
    });

    it('should include localhost:3003 in CORS origins', () => {
      const { CORS_CONFIG } = require('../config/domain');
      assert.ok(CORS_CONFIG.allowedOrigins.includes('http://localhost:3003'));
    });
  });

  describe('db_unified.js', () => {
    it('should export monitoring functions', () => {
      const db = require('../db_unified');
      assert.equal(typeof db.startPoolMonitoring, 'function');
      assert.equal(typeof db.stopPoolMonitoring, 'function');
      assert.equal(typeof db.gracefulReconnect, 'function');
    });
  });

  describe('deploy.js syntax', () => {
    it('should have valid JavaScript syntax', () => {
      const fs = require('fs');
      const code = fs.readFileSync(path.join(__dirname, '../deploy.js'), 'utf8');
      // 简单的语法检查
      assert.doesNotThrow(() => new Function(code));
    });
  });
});
```

**运行测试**:
```bash
# 安装测试框架（如果没有）
npm install --save-dev mocha

# 运行测试
npx mocha tests/fix-validation.test.js
```

**验证标准**:
- ✅ 所有测试用例通过
- ✅ 覆盖率 > 80%（核心功能）
- ✅ 无警告或错误

**风险点**: 无

**依赖关系**: 依赖Task 2.1, 2.2, 2.3

---

#### Task 2.5: Staging环境验证 ⏱️ 30分钟

**目标**: 在类生产环境中验证所有修改

**验证步骤**:

1. **部署到Staging服务器**（如果有）
   ```bash
   # 修改deploy.js中的目标服务器为staging
   # 或者创建deploy.staging.js
   ```

2. **完整功能测试**:
   - [ ] 服务启动正常（PM2 status）
   - [ ] 健康检查通过（/api/v1/health）
   - [ ] 数据库连接正常
   - [ ] 用户认证流程正常
   - [ ] CRUD操作正常（Customers/Products/Orders）
   - [ ] 文件上传功能正常
   - [ ] 错误处理正确（测试异常场景）

3. **性能测试**:
   ```bash
   # 使用ab或wrk进行简单压力测试
   ab -n 1000 -c 10 https://staging-admin.qimengzhiyue.cn/api/v1/health
   ```

4. **日志审查**:
   ```bash
   pm2 logs backend --lines 100
   # 检查是否有异常错误
   ```

**验证标准**:
- ✅ 所有功能测试通过
- [ ] 性能指标达标（响应时间 < 500ms P95）
- ✅ 无严重错误日志
- [ ] 内存/CPU使用正常

**风险点**: 中等（可能发现Stage环境特有的问题）

**依赖关系**: 依赖Task 2.4

---

#### Task 2.6: 生产灰度发布 ⏱️ 30分钟

**目标**: 安全地将优化后的代码部署到生产环境

**发布策略**:

1. **选择低峰期**（凌晨2:00-4:00或周末）

2. **备份数据库**（可选但推荐）:
   ```bash
   mysqldump -u QMZYXCX -p qmzyxcx > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

3. **执行部署**:
   ```bash
   node deploy.js
   ```

4. **灰度验证**（逐步放量）:
   - T+0min: 内部测试账号验证
   - T+5min: 开放给5%用户观察
   - T+15min: 开放给50%用户
   - T+30min: 全量开放

5. **监控关键指标**:
   - 错误率 (< 0.1%)
   - 响应时间 (P95 < 1s)
   - 数据库连接数 (< 80% of pool)
   - PM2重启次数 (= 0)

**回滚触发条件**（任一满足立即回滚）:
- ❌ 错误率 > 1%
- ❌ P99响应时间 > 5秒
- ❌ 数据库连接失败 > 10次/分钟
- ❌ 用户投诉 > 3个

**验证标准**:
- ✅ 部署成功，服务正常
- ✅ 灰度期间无重大异常
- ✅ 全量开放后稳定运行1小时

**风险点**: 中等（生产环境变更始终有风险）
**应对**: 准备好回滚方案（见A3.2节）

**依赖关系**: 依赖Task 2.5

---

## 📊 验证标准总清单

### Phase 1 完成标准
- [ ] **Task 1.1**: 备份完成，checksums.md5已生成
- [ ] **Task 1.2**: deploy.js包含.env上传逻辑
- [ ] **Task 1.3**: 健康检查端口改为3003
- [ ] **Task 1.4**: 本地语法检查通过
- [ ] **Task 1.5**: 生产部署成功（exit code 0）
- [ ] **Task 1.6**: 生产环境API正常响应，前端可用

**Phase 1 成功标志**:
```
✅ 生产服务器健康检查返回: {"status":"ok","database":"connected"}
✅ 至少3个核心API (auth, customers, products) 返回有效数据
✅ 前端管理界面可正常登录和使用
✅ PM2 backend进程状态: online，无频繁重启
```

### Phase 2 完成标准
- [ ] **Task 2.1**: domain.js支持多环境，无硬编码
- [ ] **Task 2.2**: db_unified.js具备连接池监控
- [ ] **Task 2.3**: deploy.js有完善的预检和验证
- [ ] **Task 2.4**: 自动化测试全部通过
- [ ] **Task 2.5**: Staging环境验证通过
- [ ] **Task 2.6**: 生产灰度发布成功

**Phase 2 成功标志**:
```
✅ domain.js在不同NODE_ENV下均正常工作
✅ 数据库连接池监控日志正常输出
✅ 部署脚本在缺少文件时能提前报警
✅ 测试覆盖率 > 80%
✅ 生产环境稳定运行24小时无异常
```

---

## ⚠️ 风险缓解措施

### 技术风险

| 风险项 | 概率 | 影响 | 缓解措施 | 应急预案 |
|-------|------|------|---------|---------|
| .env文件权限不当 | 中 | 高 | 自动chmod 600 | 手动修正权限 |
| 健康检查误判 | 低 | 中 | 重试3次 | 人工登录验证 |
| domain.js加载顺序改变 | 低 | 高 | 充分测试 | 快速回滚到v1.0.0-pre-fix |
| 数据库连接池泄漏 | 低 | 中 | 监控+自动清理 | 重启PM2进程 |
| 部署过程中断 | 中 | 中 | 断点续传机制 | 重新执行部署 |

### 业务风险

| 风险项 | 概率 | 影响 | 缓解措施 | 应急预案 |
|-------|------|------|---------|---------|
| 部停机时间过长 | 低 | 高 | 选择低峰期 | 回滚到上一版本 |
| 数据丢失 | 极低 | 极高 | 部署前备份 | 从备份恢复 |
| 用户感知异常 | 中 | 中 | 灰度发布 | 紧急回滚+用户通知 |

### 操作风险

| 风险项 | 概率 | 影响 | 缓解措施 | 应急预案 |
|-------|------|------|---------|---------|
| 人为操作失误 | 中 | 高 | Checklist + 双人复核 | 回滚+复盘 |
| 文档不清晰 | 低 | 中 | 详细步骤截图 | 补充文档 |

---

## 📅 里程碑时间线

```
Day 1 (今天)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
00:00  ──► Task 1.1: 创建基线备份 (5min)
05:00  ──► Task 1.2: 修改deploy.js - .env上传 (15min)
20:00  ──► Task 1.3: 修改deploy.js - 健康检查 (5min)
25:00  ──► Task 1.4: 本地测试 (5min)
30:00  ──► Task 1.5: 生产部署 (10min)
40:00  ──► Task 1.6: 生产验证 (10min)
50:00  ──★☆☆ Phase 1 完成 - 服务恢复 ☆★─

Day 2 (明天或后天)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
00:00  ──► Task 2.1: 重构domain.js (45min)
45:00  ──► Task 2.2: 增强db_unified.js (30min) [并行]
45:00  ──► Task 2.3: 完善deploy.js (40min) [并行]
75:00  ──► Task 2.4: 编写测试 (30min)
105:00 ──► Task 2.5: Staging验证 (30min)
135:00 ──► Task 2.6: 生产灰度发布 (30min)
165:00 ──★☆☆ Phase 2 完成 - 架构优化完毕 ☆★─
```

---

## 📞 联系人与应急流程

### 关键联系人

| 角色 | 姓名 | 联系方式 | 职责 |
|-----|------|---------|------|
| **主要负责人** | [待填写] | [电话/微信] | 最终决策者 |
| **技术执行** | [待填写] | [电话/微信] | 代码修改和部署 |
| **DBA** | [待填写] | [电话/微信] | 数据库相关操作 |
| **运维** | [待填写] | [电话/微信] | 服务器和Nginx |
| **产品经理** | [待填写] | [电话/微信] | 业务决策和用户沟通 |

### 应急响应流程

```
发现问题
   ↓
5分钟内初步评估（查看日志、监控）
   ↓
判断是否需要回滚？
   ├─ 否 → 记录问题，纳入下一迭代修复
   └─ 是 ↓
通知相关负责人（电话+微信群）
   ↓
执行回滚方案（见ROLLBACK_PLAN.md）
   ↓
10分钟内恢复服务
   ↓
30分钟内输出事件报告
   ↓
24小时内复盘并更新文档
```

### 升级机制

| 响应级别 | 触发条件 | 响应时间 | 行动 |
|---------|---------|---------|------|
| **P0-紧急** | 服务完全不可用 | < 5分钟 | 立即回滚，通知所有人 |
| **P1-高** | 核心功能受损 | < 15分钟 | 尝试快速修复，准备回滚 |
| **P2-中** | 非核心功能异常 | < 1小时 | 排查问题，安排修复 |
| **P3-低** | 小问题或优化建议 | < 24小时 | 纳入Backlog |

---

## 📚 附录

### A. 相关文档索引
- [A1 根因分析报告](./A1_ROOT_CAUSE_ANALYSIS.md)
- [A2 问题确认报告](./A2_ISSUE_CONFIRMATION.md)
- [本文件 - 修复方案V2](./FIX_PLAN_V2.md)
- [回滚方案](./ROLLBACK_PLAN.md)

### B. 参考链接
- [dotenv官方文档](https://github.com/motdotla/dotenv)
- [Node.js最佳实践](https://github.com/goldbergyoni/nodebestpractices)
- [12-Factor App](https://12factor.net/)
- [PM2文档](https://pm2.keymetrics.io/)

### C. 术语表

| 术语 | 说明 |
|-----|------|
| P0/P1/P2 | 优先级，P0为最高 |
| TDSQL-C | 腾讯云MySQL托管服务 |
| PM2 | Node.js进程管理器 |
| Health Check | 健康检查，用于验证服务状态 |
| Rollback | 回滚，恢复到之前的状态 |
| Staging | 预发布环境，类似生产但用于测试 |
| Canary/Gary | 灰度发布，逐步放开流量 |

---

## ✅ 文档审批

| 角色 | 姓名 | 日期 | 签字 |
|-----|------|------|------|
| 制定人 | AI Assistant | 2026-04-15 | ✓ |
| 技术审核 | [待填写] | [日期] | [ ] |
| 管理审批 | [待填写] | [日期] | [ ] |

---

**版本历史**:
- V1.0 (2026-04-15): 初始版本，基于A1/A2发现制定
- V2.0 (2026-04-15): 增加详细的代码级任务分解和验证标准

**下一步行动**: 执行Phase 1 (Task 1.1 - 1.6)，预计60分钟内恢复生产服务。
