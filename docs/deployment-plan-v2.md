# 绮管电商后台 - 生产环境部署计划 v2

## 📋 部署概览

**版本**: v2.0  
**日期**: 2026-04-15  
**环境**: 腾讯云TDSQL-C + 宝塔面板  
**目标**: 零停机时间部署

---

## 🔧 步骤1: 环境前置检查

### 1.1 本地环境验证
- [x] Node.js >= 18.0
- [x] npm >= 9.0
- [ ] 前端构建完成 (qiguanqianduan/dist)
- [ ] 后端依赖安装 (node_modules)
- [ ] 数据库初始化完成

### 1.2 远程服务器连通性测试
```bash
# 测试SSH连接
ssh -i qimengzhiyue.pem root@<server-ip> "echo 'Connection OK'"

# 测试数据库连接
mysql -h 10.0.0.16 -u QMZYXCX -p'***' qmzyxcx -e "SELECT 1"
```

### 1.3 磁盘空间检查
- [ ] 服务器可用空间 > 5GB
- [ ] 数据库存储空间充足

---

## 📦 步骤2: 依赖安装与构建

### 2.1 后端依赖安装
```bash
cd e:\1\绮管后台
npm install --production
```

**关键依赖列表**:
- express ^4.21.2
- mysql2 ^3.22.0
- sqlite3 ^6.0.1 (开发/备用)
- jsonwebtoken ^9.0.3
- bcryptjs ^3.0.3
- multer ^2.1.1
- helmet ^8.1.0
- cors ^2.8.5

### 2.2 前端构建
```bash
cd e:\1\绮管后台\qiguanqianduan
npm install
npm run build
```

**预期输出**:
- dist/ 目录生成
- 静态资源优化完成
- 构建日志无ERROR

---

## ⚙️ 步骤3: 配置文件更新

### 3.1 生产环境配置 (.env.production)
```
✅ 已验证配置项:
- DB_HOST=10.0.0.16
- DB_PORT=3306
- DB_USER=QMZYXCX
- DB_NAME=qmzyxcx
- JWT_SECRET=<已配置强密钥>
- PORT=3003
- NODE_ENV=production
```

### 3.2 安全配置检查
- [ ] JWT_SECRET 强度 >= 32字符 ✅
- [ ] 数据库密码非默认值 ✅
- [ ] CORS_ORIGIN 配置正确
- [ ] UPLOAD_DIR 权限设置

---

## 🚀 步骤4: 文件上传部署

### 4.1 使用 deploy.js 自动化部署
```bash
cd e:\1\绮管后台
node deploy.js
```

**部署内容**:
- 前端静态文件 → /var/www/admin/dist/
- 后端JS源码 → /www/wwwroot/qiguan/
- 配置文件 → /www/wwwroot/qiguan/.env.production (权限600)

### 4.2 文件上传验证
- [ ] 总文件数: ~150+ 文件
- [ ] 上传成功率: 100%
- [ ] 配置文件权限: 600

---

## 🔄 步骤5: 服务启停管理

### 5.1 备份当前版本
```bash
# 在远程服务器执行
cp -r /www/wwwroot/qiguan /www/wwwroot/qiguan_backup_$(date +%Y%m%d_%H%M%S)
cp -r /var/www/admin/dist /var/www/admin/dist_backup_$(date +%Y%m%d_%H%M%S)
```

### 5.2 重启后端服务
```bash
# 使用PM2管理进程
pm2 restart qiguan-backend

# 或使用宝塔面板重启Node.js服务
```

### 5.3 验证进程状态
```bash
pm2 status
pm2 logs qiguan-backend --lines 20
```

---

## ✅ 步骤6: 版本与健康检查

### 6.1 API健康检查端点
```bash
curl -X GET http://<server-ip>:3003/api/v1/health
```

**预期响应**:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": <seconds>,
  "database": {
    "status": "connected",
    "pool": { "active": 1, "idle": 9, "total": 10 }
  },
  "timestamp": "<ISO8601>"
}
```

### 6.2 核心功能验证
- [ ] GET /api/v1/categories - 分类列表
- [ ] GET /api/v1/products - 商品列表
- [ ] POST /api/v1/auth/login - 登录接口
- [ ] GET /api/v1/coupons - 优惠券列表
- [ ] 前端页面加载正常

---

## 📊 步骤7: 性能基线记录

### 7.1 关键指标采集
| 指标 | 目标值 | 实测值 | 状态 |
|------|--------|--------|------|
| API平均响应时间 | <200ms | - | 待测 |
| 首页加载时间 | <2s | - | 待测 |
| 数据库查询耗时 | <50ms | - | 待测 |
| 内存占用 | <512MB | - | 待测 |
| CPU使用率 | <70% | - | 待测 |

### 7.2 压力测试（可选）
```bash
# 使用autocannon进行简单压力测试
autocannon -c 10 -d 30 http://<server-ip>:3003/api/v1/categories
```

---

## 🛡️ 步骤8: 监控与回滚预案

### 8.1 部署后监控（前30分钟）
- [ ] 错误日志监控
- [ ] 数据库连接池状态
- [ ] 内存/CPU趋势
- [ ] API错误率 (<1%)

### 8.2 回滚触发条件
- 错误率持续 > 5% 超过5分钟
- 数据库连接失败
- 内存泄漏迹象
- 核心API不可用

### 8.3 一键回滚命令
```bash
# 恢复备份
pm2 stop qiguan-backend
rm -rf /www/wwwroot/qiguan
mv /www/wwwroot/qiguan_backup_<timestamp> /www/wwwroot/qiguan
pm2 start qiguan-backend
```

---

## 📝 部署检查清单

### 部署前
- [ ] 代码已提交到Git仓库
- [ ] 本地测试通过 (npm test)
- [ ] 数据库迁移脚本已准备
- [ ] 配置文件已更新
- [ ] SSH密钥权限正确

### 部署中
- [ ] 文件上传无报错
- [ ] 配置文件权限正确
- [ ] 服务启动成功
- [ ] 无明显错误日志

### 部署后
- [ ] 所有API端点可达
- [ ] 数据库读写正常
- [ ] 前端功能完整
- [ ] 性能指标达标
- [ ] 监控告警已启用

---

## 🆘 紧急联系信息

- **技术负责人**: [待填写]
- **运维支持**: [待填写]
- **数据库DBA**: [待填写]
- **紧急回滚**: 见步骤8.3

---

## 📌 版本历史

| 版本 | 日期 | 变更说明 | 操作人 |
|------|------|----------|--------|
| v2.0 | 2026-04-15 | 初始版本，完整8步部署流程 | System |

---

**备注**: 本文档由自动化部署工具生成，请根据实际情况调整参数。
