# 生产环境部署前检查清单

## 📋 使用说明
- **适用场景**: 生产环境部署前的最终检查
- **执行人**: DevOps工程师 / 部署负责人
- **预计时间**: 15-30分钟
- **通过标准**: 所有P0项必须全部勾选 ✅

---

## 1️⃣ 服务器基础环境

### 操作系统与核心组件
- [ ] **操作系统**: Ubuntu 20.04 LTS / CentOS 7+ / Debian 10+
  ```bash
  cat /etc/os-release | grep PRETTY_NAME
  ```
- [ ] **内核版本**: >= 4.15 (支持某些性能优化特性)
  ```bash
  uname -r
  ```
- [ ] **Node.js**: v14.x 或更高 (推荐 v16.x LTS 或 v18.x LTS)
  ```bash
  node --version
  # 期望输出: v16.x.x 或 v18.x.x
  ```
- [ ] **npm**: v6.x 或更高 (与Node.js版本匹配)
  ```bash
  npm --version
  ```
- [ ] **PM2**: v5.x 或更高 (进程管理器)
  ```bash
  pm2 version
  # 安装命令: npm install -g pm2
  ```

### Web服务器与反向代理
- [ ] **Nginx**: v1.18 或更高
  ```bash
  nginx -v
  # 配置检查: nginx -t
  ```
- [ ] **Nginx状态**: 运行中且开机自启
  ```bash
  systemctl status nginx
  systemctl is-enabled nginx
  ```

### 数据库客户端
- [ ] **MySQL Client**: v5.7+ 或 v8.0 (用于Schema升级)
  ```bash
  mysql --version
  # 如果未安装，Schema升级步骤将被跳过
  ```

### 版本控制
- [ ] **Git**: 最新版 (>= 2.20)
  ```bash
  git --version
  git config user.name    # 已配置用户名
  git config user.email   # 已配置邮箱
  ```

### 系统资源
- [ ] **磁盘空间**: > 2GB 可用空间
  ```bash
  df -h | grep -E "/$|/www"
  # 确保可用空间 > 2GB
  ```
- [ ] **内存**: > 1GB RAM (推荐 2GB+)
  ```bash
  free -h
  ```
- [ ] **CPU**: >= 2核 (推荐4核+)
  ```bash
  nproc
  ```

---

## 2️⃣ 网络与安全配置

### 端口开放情况
- [ ] **HTTP端口 (80)**: 对外开放或由Nginx监听
  ```bash
  ss -tlnp | grep :80
  # 或: netstat -tlnp | grep :80
  ```
- [ ] **HTTPS端口 (443)**: SSL证书已配置
  ```bash
  ss -tlnp | grep :443
  openssl s_client -connect qimengzhiyue.cn:443 </dev/null 2>/dev/null | openssl x509 -noout -dates
  ```
- [ ] **SSH端口 (22)**: 可远程访问（建议限制IP）
  ```bash
  ss -tlnp | grep :22
  ```
- [ ] **Node.js端口 (3000)**: 仅本地访问（Nginx反代）
  ```bash
  ss -tlnp | grep :3000
  # 应该只监听 127.0.0.1:3000，不对外暴露
  ```

### 防火墙配置
- [ ] **防火墙状态**: ufw/firewalld/iptables 已启用
  ```bash
  # Ubuntu/Debian:
  sudo ufw status verbose

  # CentOS:
  sudo firewall-cmd --list-all
  ```
- [ ] **必要端口已放行**:
  - [ ] 22 (SSH) - 建议限制来源IP
  - [ ] 80 (HTTP) - 重定向到HTTPS
  - [ ] 443 (HTTPS) - 对外服务
  - [ ] 3000 (可选) - 如需外部调试（不推荐生产环境）

### DNS解析
- [ ] **域名解析**: A记录指向服务器公网IP
  ```bash
  dig qimengzhiyue.cn A +short
  # 应返回服务器公网IP
  ```
- [ ] **DNS传播**: 全球DNS已更新（可能需要几分钟到24小时）
  ```bash
  nslookup qimengzhiyue.cn 8.8.8.8   # Google DNS
  nslookup qimengzhiyue.cn 114.114.114.114  # 国内DNS
  ```

### SSL证书
- [ ] **证书有效性**: 有效期 > 30天
  ```bash
  echo | openssl s_client -connect qimengzhiyue.cn:443 2>/dev/null | openssl x509 -noout -dates
  # 检查 notAfter 字段
  ```
- [ ] **证书路径**: 正确配置在Nginx中
  ```bash
  ls -lh /path/to/cert.pem
  ls -lh /path/to/key.pem
  # 权限应为: cert.pem (644), key.pem (600)
  ```
- [ ] **自动续期**: Let's Encrypt Certbot 或其他自动续期工具已配置（如使用）

---

## 3️⃣ 数据库准备

### 连接性测试
- [ ] **TDSQL-C连接性**: 可从服务器连通数据库
  ```bash
  ping -c 3 10.0.0.16
  # 或: nc -zv 10.0.0.16 3306
  ```
- [ ] **认证凭据**: .env.production中的DB凭证正确
  ```bash
  mysql -h 10.0.0.16 -u QMZYXCX -p'YOUR_PASSWORD' qmzyxcx -e "SELECT 1"
  # 应成功返回结果
  ```

### 数据库备份
- [ ] **全量备份**: 最近24小时内已完成
  ```bash
  # 检查最近备份时间戳
  ls -lht /backup/qmzyxcx_*.sql | head -1
  ```
- [ ] **备份完整性**: 备份文件可正常导入（测试过）
  ```bash
  # 在测试库验证备份文件
  mysql -u test_user -p test_db < backup_file.sql
  ```

### Schema升级脚本
- [ ] **升级脚本存在**: `database/schema_v2_upgrade_system_identification.sql`
  ```bash
  ls -lh database/schema_v2_upgrade_system_identification.sql
  ```
- [ ] **脚本幂等性**: 包含 IF NOT EXISTS / CREATE TABLE IF NOT EXISTS
  ```bash
  grep -E "IF NOT EXISTS|CREATE TABLE IF" database/schema_v2_upgrade_system_identification.sql | head -5
  ```
- [ ] **测试通过**: 已在测试/预发布环境验证
  - [ ] 新增标识字段验证通过（created_by, updated_by, source_ip）
  - [ ] 新建专用表创建成功（admin_logs, system_config, mp_*）
  - [ ] 触发器激活正常
  - [ ] 历史数据迁移标记完成

### 回滚方案
- [ ] **回滚SQL**: 已准备好回滚脚本
  ```bash
  ls -lh database/rollback_*.sql
  ```
- [ ] **数据快照**: 当前数据库完整快照已保存

---

## 4️⃣ 应用配置

### 环境变量配置
- [ ] **.env.production 文件存在**
  ```bash
  ls -lh .env.production
  ```
- [ ] **必需变量已配置** (无空值):
  ```ini
  NODE_ENV=production
  PORT=3000
  DB_HOST=10.0.0.16
  DB_PORT=3306
  DB_NAME=qmzyxcx
  DB_USER=QMZYXCX
  DB_PASSWORD=<your-password>        # ⚠️ 必须设置！
  JWT_SECRET=<your-jwt-secret>        # ⚠️ 强随机字符串！
  SESSION_SECRET=<your-session-secret> # ⚠️ 强随机字符串！
  ```
  **验证方法**:
  ```bash
  grep -E "^(DB_HOST|DB_USER|DB_PASSWORD|DB_NAME|JWT_SECRET|SESSION_SECRET)=" .env.production
  # 确保所有行都有值（不是空的）
  ```

### 安全配置检查
- [ ] **敏感信息不在代码中硬编码**:
  ```bash
  # 检查db_mysql.js是否还有硬编码密码
  grep -n "LJN040821\|QMZYXCX" db_mysql.js
  # 应该没有输出（除了注释）
  ```
- [ ] **.env文件权限正确**:
  ```bash
  chmod 600 .env.production
  ls -l .env.production
  # 权限应该是: -rw-------
  ```
- [ ] **.gitignore包含.env**:
  ```bash
  grep "\.env" .gitignore
  # 应包含: .env, .env.*, !.env.example
  ```

### 文件系统权限
- [ ] **项目目录权限**:
  ```bash
  # 项目根目录
  chown -R www-data:www-data /www/wwwroot/qiguan-backend
  find /www/wwwroot/qiguan-backend -type d -exec chmod 755 {} \;
  find /www/wwwroot/qiguan-backend -type f -exec chmod 644 {} \;

  # 特殊文件
  chmod +x deploy.sh
  chmod 600 .env.production
  ```
- [ ] **日志目录可写**:
  ```bash
  mkdir -p /var/log/qiguan
  chown www-data:www-data /var/log/qiguan
  chmod 755 /var/log/qiguan
  ```

---

## 5️⃣ 监控告警配置

### PM2监控
- [ ] **PM2进程管理**: ecosystem.config.js 已配置
  ```bash
  pm2 start ecosystem.config.js.production
  pm2 save
  pm2 startup  # 设置开机自启（首次运行）
  ```
- [ ] **日志输出**: 错误日志和标准日志分离
  ```bash
  pm2 logs qiguan-backend --lines 10
  # 检查是否有正常日志输出
  ```

### 日志轮转 (Logrotate)
- [ ] **logrotate配置**: 已安装并启用
  ```bash
  sudo cp logrotate_qiguan.conf /etc/logrotate.d/qiguan
  sudo logrotate -d /etc/logrotate.d/qiguan  # 测试配置（dry-run）
  ```
- [ ] **日志保留策略**: 保留14天，压缩旧日志
  ```bash
  cat /etc/logrotate.d/qiguan
  # 应包含: daily, rotate 14, compress
  ```

### 错误通知
- [ ] **通知渠道已配置** (至少一种):
  - [ ] **钉钉Webhook**: 测试发送成功
  - [ ] **企业微信Webhook**: 测试发送成功
  - [ ] **邮件通知**: SMTP配置正确
  - [ ] **短信告警**: API密钥有效（严重故障时）

---

## 6️⃣ P0问题修复验证

在部署前，确认以下P0问题已修复：

- [ ] **P0-001**: `/health` 接口不再返回HTML
  - [x] Nginx配置: `location = /health` 精确匹配已添加
  - [x] Express路由: routes/health.js 已增强
  - **验证**: `curl http://localhost:3000/health` 返回JSON

- [ ] **P0-002**: `/dashboard/stats` 路由已添加
  - [x] routes/dashboard.js 包含 `/stats` 路由
  - **验证**: `curl http://localhost:3000/api/v1/dashboard/stats` 返回统计数据

- [ ] **P0-003**: products.js 路由顺序已修正
  - [x] `/:id` 路由移到最后
  - [x] 固定路径路由 (`/recommended`, `/hot`, `/search`) 在前
  - **验证**: `curl http://localhost:3000/api/v1/products/recommended` 返回商品列表

- [ ] **P0-004**: 订单取消接口已实现
  - [x] routes/orders.js 包含 `PUT /:id/cancel`
  - **验证**: 参考 SMOKE_TEST_MANUAL.md

- [ ] **P0-005**: 硬编码数据库凭证已移除
  - [x] db_mysql.js 默认值为空或安全默认值
  - [x] 生产环境强制检查已添加
  - **验证**: 启动时无警告信息

---

## 7️⃣ 最终确认

### 预部署检查清单
- [ ] 所有上述项目已完成 ✅
- [ ] 回滚方案已准备就绪
- [ ] 相关人员已通知（运维、开发、测试）
- [ ] 维护窗口已确认（低峰期部署）
- [ ] 数据库备份已完成
- [ ] 部署脚本已review (`deploy.sh`)
- [ ] 冒烟测试用例已准备 (`SMOKE_TEST_MANUAL.md`)

### 签字确认
```
部署工程师: _______________ 日期: _______ 时间: _______
技术负责人: _______________ 日期: _______ 时间: _______
DBA确认:    _______________ 日期: _______ 时间: _______
```

---

## 📞 紧急联系人

| 角色       | 姓名   | 电话         | 邮箱                    |
|----------|--------|--------------|------------------------|
| 部署负责人 |        |              |                        |
| 后端开发   |        |              |                        |
| 运维工程师 |        |              |                        |
| DBA       |        |              |                        |

---

## 🚀 下一步行动

✅ **如果所有项都已勾选**, 可以开始部署：
```bash
# 执行自动化部署
chmod +x deploy.sh
./deploy.sh

# 或者手动分步执行（参考deploy.sh中的Step 1-9）
```

❌ **如果有任何未完成项**:
1. 先解决阻塞性问题（标记为P0的项）
2. 记录已知风险和缓解措施
3. 与团队讨论是否可以带风险部署

---

**文档版本**: v2.0
**最后更新**: 2026-04-10
**维护者**: AI Assistant
