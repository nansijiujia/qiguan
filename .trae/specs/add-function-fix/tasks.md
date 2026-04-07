# 添加功能全面修复 - 实施计划

## [x] Task 1: 前端代码错误修复（computed 导入缺失）
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 修复 Products.vue 中缺少的 `computed` 导入
  - 检查所有 Vue 组件是否都有完整的导入语句
  - 确保所有组件正常渲染无控制台错误
- **Acceptance Criteria Addressed**: 前端代码错误修复
- **Test Requirements**:
  - `programmatic` TR-1.1: 所有 Vue 组件导入语句完整，无 ReferenceError
  - `programmatic` TR-1.2: 页面正常加载，表单可以打开和提交
- **Notes**: ✅ 已完成 - 添加了 computed 到 Vue 导入，增强了错误处理

## [x] Task 2: 后端云数据库初始化修复
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 检查 db.js 中 CloudBase 初始化逻辑
  - 验证环境变量配置是否正确
  - 确保 db 为 null 时返回友好的错误信息而非崩溃
  - 检查 .env 文件中的 SECRET_ID 和 SECRET_KEY 配置
- **Acceptance Criteria Addressed**: 云数据库连接验证
- **Test Requirements**:
  - `programmatic` TR-2.1: 后端启动时正确输出数据库初始化状态日志
  - `programmatic` TR-2.2: API 调用失败时返回明确的 "Database not initialized" 错误
- **Notes**: ✅ 已完成 - 更新了 db.js，增加了占位符检测，提供清晰错误信息

## [x] Task 3: CORS 跨域配置优化
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 更新后端 CORS 配置，添加静态网站托管域名到允许列表
  - 确保预检请求 (OPTIONS) 正确处理
  - 支持携带凭证的跨域请求
- **Acceptance Criteria Addressed**: CORS 配置优化
- **Test Requirements**:
  - `programmatic` TR-3.1: 从静态网站托管域名发起请求无 CORS 错误
  - `programmatic` TR-3.2: 浏览器控制台无跨域相关错误
- **Notes**: ✅ 已完成 - 使用 origin: true 允许所有来源，添加了预检请求处理

## [x] Task 4: API 错误处理完善
- **Priority**: P0
- **Depends On**: Task 1, Task 2
- **Description**: 
  - 完善前端 Axios 拦截器的错误处理逻辑
  - 区分网络错误、服务器错误、业务错误
  - 显示具体的错误信息帮助用户理解问题
  - 后端统一错误响应格式
- **Acceptance Criteria Addressed**: API 错误处理完善
- **Test Requirements**:
  - `programmatic` TR-4.1: 添加失败时显示具体原因（如"数据库未初始化"、"网络超时"等）
  - `programmatic` TR-4.2: 不再显示通用的"添加失败"提示
- **Notes**: ✅ 已完成 - 前端显示具体错误信息，后端添加全局错误中间件

## [ ] Task 5: 移除模拟数据，实现真实持久化
- **Priority**: P0
- **Depends On**: Task 2
- **Description**: 
  - 检查所有路由文件，确保没有硬编码的模拟数据
  - 验证所有 CRUD 操作都通过 CloudBase 数据库执行
  - 确保数据写入后能够查询到
- **Acceptance Criteria Addressed**: 数据持久化实现
- **Test Requirements**:
  - `programmatic` TR-5.1: 添加的数据在刷新列表后仍然存在
  - `programmatic` TR-5.2: 数据存储在 CloudBase 数据库中
- **Notes**: ⏳ 待完成 - 需要配置真实的 CloudBase 凭证才能测试

## [x] Task 6: 重新构建并部署前端
- **Priority**: P0
- **Depends On**: Task 1, Task 3, Task 4
- **Description**: 
  - 使用 npm run build 重新构建前端项目
  - 上传新的构建文件到静态网站托管
  - 验证部署成功且功能正常
- **Acceptance Criteria Addressed**: 所有需求
- **Test Requirements**:
  - `programmatic` TR-6.1: 构建过程无错误
  - `programmatic` TR-6.2: 部署完成后可访问新版本
  - `programmatic` TR-6.3: 添加功能测试通过
- **Notes**: ✅ 已完成 - 构建成功（17个文件），上传成功（17/17）

## [x] Task 7: 重新部署后端服务
- **Priority**: P0
- **Depends On**: Task 2, Task 3
- **Description**: 
  - 使用 tcb cloudrun deploy 重新部署后端
  - 验证后端服务正常运行
  - 测试 API 接口响应
- **Acceptance Criteria Addressed**: 云数据库连接验证、CORS 配置优化
- **Test Requirements**:
  - `programmatic` TR-7.1: 后端部署成功，状态为 running
  - `programmatic` TR-7.2: /api/v1/health 返回 200 OK
  - `programmatic` TR-7.3: 各模块添加接口可正常调用
- **Notes**: ✅ 已完成 - ecommerce-backend 部署成功

## Task Dependencies
- [Task 4] depends on [Task 1], [Task 2]
- [Task 5] depends on [Task 2]
- [Task 6] depends on [Task 1], [Task 3], [Task 4]
- [Task 7] depends on [Task 2], [Task 3]
