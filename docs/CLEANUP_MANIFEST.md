# 系统深度清理清单 (CLEANUP_MANIFEST)

**生成时间**: 2026-04-15
**清理目录**: E:\1\绮管后台

---

## 📋 待删除文件总览

| 类别 | 文件数 | 总大小 |
|------|--------|--------|
| 修复脚本 (_fix*.js) | 7 | 18,863 bytes |
| 诊断脚本 (_diagnose*.js) | 3 | 20,519 bytes |
| Windows脚本 (_win.js) | 1 | 2,881 bytes |
| 启动脚本/参考卡 | 2 | 8,758 bytes |
| 测试文件 (test_*.js等) | 9 | 8,359 bytes |
| 压缩包 (*.tar.gz) | 3 | 1,902,008 bytes |
| 报告文档 (*.md) | 5 | 79,272 bytes |
| 覆盖率目录 (coverage/) | 13 files | 228,035 bytes |
| **合计** | **43 items** | ****2,268,695 bytes (2.16 MB)** |

---

## 🗑️ 详细删除清单

### 1. 修复脚本 (_fix*.js) - 7个文件
原因：临时修复脚本，问题已解决或已合并到主代码

| 文件路径 | 大小 (bytes) |
|----------|-------------|
| E:\1\绮管后台\_fix2.js | 2,098 |
| E:\1\绮管后台\_fix_all.js | 2,529 |
| E:\1\绮管后台\_fix_db.js | 3,102 |
| E:\1\绮管后台\_fix_deploy.js | 1,837 |
| E:\1\绮管后台\_fix_final.js | 2,598 |
| E:\1\绮管后台\_fix_routes.js | 2,784 |
| E:\1\绮管后台\_fix_routes_final.js | 3,915 |

### 2. 诊断脚本 (_diagnose*.js) - 3个文件
原因：临时诊断工具，问题已定位并修复

| 文件路径 | 大小 (bytes) |
|----------|-------------|
| E:\1\绮管后台\_diagnose.js | 1,777 |
| E:\1\绮管后台\_diagnose_db.js | 4,420 |
| E:\1\绮管后台\_diagnose_mysql_v2.js | 14,322 |

### 3. Windows适配脚本 - 1个文件
原因：Windows平台临时适配脚本，已不需要

| 文件路径 | 大小 (bytes) |
|----------|-------------|
| E:\1\绮管后台\_win.js | 2,881 |

### 4. 启动脚本和参考卡 - 2个文件
原因：临时启动脚本和快速参考文档，已过时

| 文件路径 | 大小 (bytes) |
|----------|-------------|
| E:\1\绮管后台\_启动系统.bat | 4,160 |
| E:\1\绮管后台\_快速参考卡.txt | 4,598 |

### 5. 测试和临时服务器文件 - 9个文件
原因：测试文件、临时服务器、测试结果，不属于核心代码

| 文件路径 | 大小 (bytes) |
|----------|-------------|
| E:\1\绮管后台\test_app.js | 343 |
| E:\1\绮管后台\test_functionality.js | 1,799 |
| E:\1\绮管后台\test_performance.js | 1,280 |
| E:\1\绮管后台\test_performance_supertest.js | 1,545 |
| E:\1\绮管后台\test_security.js | 2,534 |
| E:\1\绮管后台\test_server.js | 531 |
| E:\1\绮管后台\test-results.txt | 6 |
| E:\1\绮管后台\simple_server.js | 343 |
| E:\1\绮管后台\start_production.js | 278 |

### 6. 压缩包文件 - 3个文件
原因：旧的构建产物/备份压缩包，可重新生成

| 文件路径 | 大小 (bytes) |
|----------|-------------|
| E:\1\绮管后台\_dist.tar.gz | 950,560 |
| E:\1\绮管后台\admin-dist.tar.gz | 29 |
| E:\1\绮管后台\dist.tar.gz | 951,419 |

### 7. 报告文档 - 5个文件
原因：临时生成的诊断报告和总结文档，已完成历史使命

| 文件路径 | 大小 (bytes) |
|----------|-------------|
| E:\1\绮管后台\_FINAL_REPORT.md | 11,767 |
| E:\1\绮管后台\_FIX_GUIDE.md | 7,784 |
| E:\1\绮管后台\_DOMAIN_DB_FIX_GUIDE.md | 19,265 |
| E:\1\绮管后台\DEPLOYMENT_SUMMARY.md | 1,731 |
| E:\1\绮管后台\BACKEND_REFACTORING_INSIGHT_REPORT.md | 36,725 |

### 8. 测试覆盖率目录 - 13个文件
原因：Jest测试覆盖率报告，可重新生成

| 目录路径 | 文件数 | 大小 |
|----------|--------|------|
| E:\1\绮管后台\coverage\ | 13 | 228,035 bytes |

包含文件：
- coverage-final.json
- lcov.info
- clover.xml
- lcov-report/ (含HTML/CSS/JS资源文件)

---

## ✅ 核心保留文件清单

以下文件将被保留，不受本次清理影响：

### 后端核心
- `index.js` - 主入口文件
- `package.json` / `package-lock.json` - 项目配置
- `.env.production` - 生产环境配置
- `.gitignore` - Git忽略规则
- `deploy.js` - 部署脚本
- `db_unified.js` - 统一数据库模块
- `db_mysql.js` - MySQL数据库模块
- `db_sqlite.js` - SQLite数据库模块（如存在）

### 源代码目录
- `src/` - 源代码目录
- `routes/` - API路由目录
- `utils/` - 工具函数目录
- `middleware/` - 中间件目录
- `config/` - 配置文件目录
- `database/` - 数据库脚本目录
- `nginx/` - Nginx配置目录

### 前端项目
- `qiguanqianduan/src/` - 前端源代码

### 其他必要文件
- `Dockerfile` - Docker配置
- `.env.example` - 环境变量示例
- `.dockerignore` - Docker忽略规则
- `.cloudbaseignore` - 云开发忽略规则
- `.prettierrc` / `.prettierignore` - 代码格式化配置
- `jest.config.js` - Jest测试配置（保留以便未来测试）
- `build_frontend.bat` - 前端构建脚本
- `scripts/` - 运维脚本目录
- `hooks/` - Git钩子目录
- `functions/` - 云函数目录
- `data/` - 数据文件目录

---

## ⚠️ 清理注意事项

1. **所有待删除文件均为临时性/辅助性文件**
2. **不影响系统正常运行**
3. **压缩包可随时通过构建重新生成**
4. **覆盖率报告可通过运行测试重新生成**
5. **报告文档仅作历史记录参考**

---

*此清单由系统自动生成，用于记录清理操作*
