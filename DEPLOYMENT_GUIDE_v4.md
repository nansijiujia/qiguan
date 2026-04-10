# 🚀 生产环境部署执行指南 v4.0.0

> **重要提示**: 本文档用于指导在云服务器上执行生产部署
> **预计耗时**: 15-30分钟 | **风险等级**: 中 (有完整回滚方案)

---

## 📋 部署前检查清单

### ✅ 必须确认项 (逐项检查后再执行!)

- [ ] **Git代码已推送**: `v4.0.0-production` 标签已存在
  ```bash
  git tag -l | grep v4.0.0-production
  # 应输出: v4.0.0-production
  ```

- [ ] **服务器SSH连接正常**:
  ```bash
  ssh root@your-server-ip "echo 'SSH连接成功'"
  ```

- [ ] **数据库备份已完成**:
  ```bash
  # 在服务器上或本地执行
  mysqldump -h 10.0.0.16 -u QMZYXCX -p'LJN040821.' qmzyxcx > backup_$(date +%Y%m%d).sql
  ```

- [ ] **低峰期时间窗口**: 建议凌晨2:00-6:00 (用户活跃度最低)

- [ ] **回滚脚本就绪**: `rollback.sh` 已上传至服务器

- [ ] **紧急联系人已通知**: 团队成员知晓即将部署

---

## 🔧 方式一：使用自动化部署脚本 (推荐)

### Step 1: SSH连接服务器

```bash
ssh root@your-server-ip
# 替换 your-server-ip 为您的实际服务器IP地址
```

### Step 2: 进入项目目录

```bash
cd /www/wwwroot/qiguan-backend
# 或您的实际项目路径
```

### Step 3: 拉取最新代码 (含新标签)

```bash
git fetch origin
git checkout tags/v4.0.0-production -b release-v4.0.0
```

或者如果您想继续在当前分支:

```bash
git pull origin feature/option-b-security-hardening
```

### Step 4: 设置脚本可执行权限

```bash
chmod +x deploy.sh rollback.sh db_tools.sh
```

### Step 5: 执行自动化部署

#### 标准部署 (推荐首次使用):

```bash
./deploy.sh
```

#### 快速部署 (跳过备份和测试，适用于后续小更新):

```bash
./deploy.sh --skip-backup --skip-tests
```

#### 部署指定分支:

```bash
./deploy.sh --branch feature/option-b-security-hardening
```

### Step 6: 观察部署输出

部署脚本会自动执行以下9个步骤并输出详细日志:

```
==========================================
  绮管电商后台 - 生产部署 v4.0.0
  部署时间: 2026-04-09 02:30:00
==========================================

[INFO] Step 1/9: 检查部署环境...
[INFO]   ✓ Node.js 版本: v16.x (要求 >= 14)
[INFO]   ✓ npm 版本: 8.x
[INFO]   ✓ PM2 已安装
[INFO]   ✓ MySQL 客户端可用
[INFO] 环境检查通过!

[INFO] Step 2/9: 备份当前版本...
[INFO]   ✅ 备份完成: backups/pre-deploy-20260409-023000.tar.gz

[INFO] Step 3/9: 拉取最新代码...
[INFO]   ✅ 代码已更新至最新版本

... (中间步骤省略) ...

[INFO] Step 9/9: 执行冒烟测试...
[INFO]   ✅ 健康检查通过 (HTTP 200)
[INFO]   ✅ 登录API测试通过
[INFO]   ✅ 静态资源加载正常

==========================================
  🎉 部署完成!
  备份文件: backups/pre-deploy-20260409-023000.tar.gz
  部署时间: 2026-04-09 02:35:00
  回滚命令: bash rollback.sh backups/pre-deploy-20260409-023000.tar.gz
==========================================
```

---

## 🔧 方式二：手动逐步部署 (适用于需要自定义的场景)

如果自动化脚本不适用，请按以下步骤手动执行：

### Step 1: 备份当前版本

```bash
cd /www/wwwroot/qiguan-backend

mkdir -p backups
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

tar -czf backups/pre-deploy-${TIMESTAMP}.tar.gz \
  --exclude='node_modules' \
  --exclude='data/*.db' \
  --exclude='.env' \
  --exclude='logs' \
  --exclude='backups' \
  .

echo "✅ 备份完成: backups/pre-deploy-${TIMESTAMP}.tar.gz"
ls -lh backups/pre-deploy-${TIMESTAMP}.tar.gz
```

### Step 2: 拉取最新代码

```bash
git fetch origin
git reset --hard origin/feature/option-b-security-hardening

# 或者使用标签
# git checkout tags/v4.0.0-production -b release-v4.0.0

echo "✅ 代码更新完成"
git log -1 --oneline
```

### Step 3: 安装生产依赖

```bash
npm install --production

echo "✅ 依赖安装完成"
npm list --depth=0 | head -15
```

### Step 4: 构建前端资源

```bash
cd qiguanqianduan
npm install
npm run build
cd ..

echo "✅ 前端构建完成"
ls -lh qiguanqianduan/dist/index.html
```

### Step 5: 更新数据库Schema (幂等操作)

```bash
mysql -h 10.0.0.16 -u QMZYXCX -p'LJN040821.' qmzyxcx < database/production_schema.sql

echo "✅ 数据库Schema更新完成"
mysql -h 10.0.0.16 -u QMZYXCX -p'LJN040821.' qmzyxcx -e "SHOW TABLES;"
```

### Step 6: 重启PM2服务

```bash
pm2 restart all
sleep 5

echo "✅ 服务重启完成"
pm2 status
pm2 logs --lines 20 --nostream
```

### Step 7: 清理Nginx缓存

```bash
rm -rf /var/cache/nginx/*
nginx -t && systemctl reload nginx

echo "✅ Nginx缓存清理完成"
```

---

## ✅ Step 8: 冒烟测试验证 (必须全部通过!)

部署完成后，**立即执行以下测试**确认系统正常运行：

### 测试1: 健康检查接口

```bash
curl -I https://qimengzhiyue.cn/health
# 期望输出: HTTP/1.1 200 OK
```

### 测试2: 后台登录API

```bash
curl -X POST https://qimengzhiyue.cn/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
# 期望输出: {"success":true,"data":{"token":"eyJhbGciOi...","user":{...}}}
```

### 测试3: 前端页面加载

```bash
curl -I https://qimengzhiyue.cn/
# 期望输出: HTTP/1.1 200 OK, Content-Type: text/html
```

### 测试4: 商品列表API

```bash
curl -X GET "https://qimengzhiyue.cn/api/v1/products?page=1&pageSize=10"
# 期望输出: {"success":true,"data":{"list":[...],"pagination":{...}}}
```

### 测试5: 分类列表API (含别名路由)

```bash
curl -X GET https://qimengzhiyue.cn/api/v1/categories
curl -X GET https://qimengzhiyue.cn/api/v1/products/category
# 两者都应返回分类数据
```

### 测试6: PM2进程状态

```bash
pm2 status
pm2 info qiguan-backend  # 或您的应用名
# 期望: 所有进程状态为 online, restart次数为0
```

### 测试结果记录表

| 测试项 | 预期结果 | 实际结果 | 状态 |
|--------|----------|----------|------|
| 健康检查 | HTTP 200 | ______ | ⬜ |
| 登录API | 返回token | ______ | ⬜ |
| 首页加载 | HTTP 200 | ______ | ⬜ |
| 商品API | 返回列表 | ______ | ⬜ |
| 分类API | 返回数据 | ______ | ⬜ |
| PM2状态 | online/0重启 | ______ | ⬜ |

**如果所有测试通过** → ✅ 部署成功！进入监控阶段  
**如果有任何测试失败** → ⚠️ 立即执行回滚 (见下方)

---

## 🔄 紧急回滚程序 (如果部署失败)

### 自动回滚 (deploy.sh内置)

如果冒烟测试失败，deploy.sh会自动触发回滚。或者手动执行：

### 手动回滚步骤

```bash
cd /www/wwwroot/qiguan-backend

# 1. 查看可用备份
ls -lt backups/*.tar.gz | head -5

# 2. 执行回滚 (选择最新的备份文件)
bash rollback.sh backups/pre-deploy-YYYYMMDD-HHMMSS.tar.gz

# 回滚脚本会提示双重确认:
# 第一次输入: yes
# 第二次输入: CONFIRM-ROLLBACK

# 3. 验证回滚成功
pm2 status
curl -I https://qimengzhiyue.cn/health
```

### 回滚后必做事项

1. **通知团队**: "v4.0.0部署失败，已回滚到上一版本"
2. **保留日志**: 
   ```bash
   pm2 logs --lines 100 > deploy-failure-$(date +%Y%m%d).log
   ```
3. **分析原因**: 检查日志确定失败原因
4. **修复问题**: 解决后重新尝试部署

---

## 📊 部署后监控 (24小时关键期)

### 首小时监控 (每10分钟检查一次)

```bash
# 1. PM2进程稳定性
watch -n 600 'pm2 status'

# 2. 错误日志监控
pm2 logs --lines 50 --err

# 3. API响应时间
curl -w "@curl-format.txt" -o /dev/null -s https://qimengzhiyue.cn/api/v1/products
```

### 关键指标阈值

| 指标 | 正常范围 | 警告阈值 | 严重阈值 |
|------|----------|----------|----------|
| PM2 restart次数 | 0/hour | < 3/hour | ≥ 5/hour |
| 错误率 (5xx) | < 0.1% | < 1% | ≥ 5% |
| P95响应时间 | < 500ms | < 1000ms | ≥ 2000s |
| CPU使用率 | < 70% | < 85% | ≥ 95% |
| 内存使用 | < 75% | < 90% | ≥ 95% |

### 监控命令速查

```bash
# 实时日志
pm2 logs qiguan-backend --lines 100

# 进程详情
pm2 describe qiguan-backend

# 性能监控
pm2 monit

# 数据库连接数
mysql -h 10.0.0.16 -u QMZYXCX -p'LJN040821.' qmzyxcx -e "SHOW STATUS LIKE 'Threads_connected';"

# Nginx访问日志 (实时)
tail -f /var/log/nginx/access.log | grep "HTTP/1.1\" [45]"
```

---

## 🆘 故障排查指南

### 问题1: PM2启动失败

**症状**: `pm2 start` 报错或进程立即退出

**诊断**:
```bash
pm2 logs --lines 50 --err
node index.js  # 手动运行查看错误
```

**常见原因及解决方案**:
- 缺少依赖 → `npm install`
- .env配置错误 → 检查DB_HOST/DB_PASSWORD
- 端口被占用 → `lsof -i :3000` 查找占用进程

### 问题2: 数据库连接失败

**症状**: 日志显示 `ECONNREFUSED` 或 `access denied`

**诊断**:
```bash
# 测试数据库连通性
mysql -h 10.0.0.16 -u QMZYXCX -p'LJN040821.' qmzyxcx -e "SELECT 1;"

# 检查防火墙
telnet 10.0.0.16 3306
```

**解决方案**:
- 检查TDSQL-C控制台是否允许该IP访问
- 验证账号密码是否正确 (区分大小写!)
- 确认数据库实例状态为"运行中"

### 问题3: Nginx 502 Bad Gateway

**症状**: 访问网站显示502错误

**诊断**:
```bash
systemctl status nginx
nginx -t  # 检查配置语法
tail -20 /var/log/nginx/error.log
```

**解决方案**:
- PM2未启动 → `pm2 start all`
- 端口配置错误 → 检查nginx.conf的proxy_pass
- 上游超时 → 增加 proxy_read_timeout

### 问题4: 前端资源404

**症状**: 页面显示但JS/CSS/图片加载失败

**诊断**:
```bash
ls -la qiguanqianduan/dist/
curl -I https://qimengzhiyue.cn/static/js/app.js
```

**解决方案**:
- 前端未构建 → `cd qiguanqianduan && npm run build`
- Nginx静态路径错误 → 检查root/alias配置
- 缓存问题 → 清除CDN/Nginx缓存

---

## 📝 部署完成确认清单

部署成功后，请逐项确认并勾选：

### 功能验证
- [ ] 后台登录页可访问 (https://qimengzhiyue.cn)
- [ ] admin/admin123 登录成功
- [ ] Dashboard数据显示正常 (8卡片+4图表)
- [ ] 商品管理CRUD正常
- [ ] 分类管理正常
- [ ] 订单管理正常
- [ ] 用户管理正常
- [ ] **新增功能**:
  - [ ] 购物车管理菜单可见且可用
  - [ ] 优惠券管理CRUD正常
  - [ ] 内容管理(CMS)Banner/公告正常

### 小程序集成验证
- [ ] 小程序首页加载正常 (Banner+推荐+分类)
- [ ] 商品详情页可打开
- [ ] 分类筛选功能正常
- [ ] 个人中心可访问
- [ ] 购物车功能可用

### 性能验证
- [ ] 首页加载时间 < 3秒
- [ ] API平均响应时间 < 500ms
- [ ] PM2进程稳定 (0次restart/hour)
- [ ] 无JavaScript控制台错误

### 安全验证
- [ ] HTTPS强制启用
- [ ] 未授权访问返回401 (非200/500)
- [ ] 无敏感信息泄露 (无密码/Token在日志中)

---

## 📞 紧急联系人

| 角色 | 姓名 | 电话/微信 | 备注 |
|------|------|-----------|------|
| 开发负责人 | AI Assistant | Trae IDE | 可提供技术支持 |
| 运维负责人 | _____________ | _____________ | 服务器管理 |
| 产品负责人 | User | Trae IDE | 业务决策 |
| DBA | _____________ | _____________ | 数据库问题 |

---

## 📚 相关文档索引

所有相关文档位于项目目录 `.trae/specs/cloud-migration-production-deploy/`:

- [FINAL_IMPLEMENTATION_REPORT.md](.trae/specs/cloud-migration-production-deploy/FINAL_IMPLEMENTATION_REPORT.md) - 最终实施总结
- [DEPLOYMENT_CHECKLIST.md](.trae/specs/cloud-migration-production-deploy/DEPLOYMENT_CHECKLIST.md) - 详细检查清单
- [P0_FIX_REPORT.md](.trae/specs/cloud-migration-production-deploy/P0_FIX_REPORT.md) - API问题修复报告
- [P0_CODE_FIX_REPORT.md](.trae/specs/cloud-migration-production-deploy/P0_CODE_FIX_REPORT.md) - 代码问题修复报告
- [API_COMPARISON_MATRIX.md](.trae/specs/cloud-migration-production-deploy/API_COMPARISON_MATRIX.md) - API对比矩阵

---

## 🎯 部署时间线建议

```
02:00 - 02:05  准备工作 (检查清单、备份数据库、通知团队)
02:05 - 02:10  Git拉取代码 + 设置权限
02:10 - 02:25  执行 ./deploy.sh (自动化部署)
02:25 - 02:30  冒烟测试验证
02:30 - 02:35  功能抽检 (登录/Dashboard/商品)
02:35        部署完成! 进入24小时监控期
```

**总预计时长**: ~35分钟 (含测试和验证)

---

## ✍️ 部署签名

- **执行人**: _________________ 日期: _______ 时间: _______
- **审核人**: _________________ 日期: _______ 时间: _______
- **批准人**: _________________ 日期: _______ 时间: _______

**部署结果**: □ **成功** □ **部分成功(附说明)** □ **失败(已回滚)**

**备注**:
_________________________________________________________

---

**文档版本**: v4.0.0  
**最后更新**: 2026-04-09  
**维护者**: AI Assistant  
**下次审查**: 2026-05-09

---

## 🎉 祝您部署顺利！

如有任何问题，请参考上方故障排查指南或联系紧急联系人。

**记住**: 我们有完整的回滚机制，即使出现问题也能快速恢复！💪
