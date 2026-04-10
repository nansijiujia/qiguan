# Products.js 路由顺序修复说明

## 问题描述
**P0-003**: `routes/products.js` 中参数路由 `/:id`(第113行) 位于固定路径路由 `/recommended`(164行)、`/hot`(228行)、`/search`(266行) 之前。

这导致当访问 `/api/v1/products/recommended` 时，Express会将 "recommended" 作为 `:id` 参数捕获，返回404或错误数据。

## Express路由匹配规则
Express按照路由定义的顺序进行匹配。参数路由（如 `/:id`）会匹配所有路径，因此必须放在固定路径之后。

## 修复方案

### 修复前（错误）:
```
router.get('/', ...)           // ✅ 列表 - OK
router.get('/:id', ...)        // ❌ 参数路由 - 拦截了下面的路由！
router.get('/recommended', ...) // ❌ 被 /:id 拦截
router.get('/hot', ...)         // ❌ 被 /:id 拦截
router.get('/search', ...)      // ❌ 被 /:id 拦截
router.get('/suggestions', ...) // ❌ 被 /:id 拦截
router.post('/', ...)           // ✅ POST不受影响
router.put('/:id', ...)         // ✅ PUT /:id 正确
router.delete('/:id', ...)      // ✅ DELETE /:id 正确
router.get('/category/:id', ...) // ⚠️ 另一个参数路由
```

### 修复后（正确）:
```
router.get('/', ...)              // ✅ 列表
router.get('/recommended', ...)   // ✅ 推荐商品
router.get('/hot', ...)           // ✅ 热门商品
router.get('/search', ...)        // ✅ 搜索
router.get('/suggestions', ...)   // ✅ 搜索建议
router.post('/', ...)             // ✅ 创建商品
router.get('/:id', ...)           // ✅ 商品详情（放在最后）
router.put('/:id', ...)           // ✅ 更新商品
router.delete('/:id', ...)        // ✅ 删除商品
router.get('/category/:id', ...)  // ✅ 分类商品（参数路由）
```

## 验证方法
修复后，以下API应该正常工作：
```bash
# 应该返回推荐商品列表，而不是404
curl https://qimengzhiyue.cn/api/v1/products/recommended

# 应该返回热门商品列表
curl https://qimengzhiyue.cn/api/v1/products/hot

# 应该执行搜索
curl "https://qimengzhiyue.cn/api/v1/products/search?q=手机"

# 应该返回ID为1的商品详情
curl https://qimengzhiyue.cn/api/v1/products/1
```

## 影响范围
此修复影响以下前端功能：
- [x] 首页推荐商品展示
- [x] 热门商品模块
- [x] 商品搜索功能
- [x] 搜索建议自动补全
- [x] 商品详情页（保持不变）

## 实施步骤
1. 备份原文件: `cp routes/products.js routes/products.js.bak`
2. 应用修复后的代码
3. 重启PM2服务: `pm2 restart all`
4. 执行冒烟测试验证

## 回滚方案
如果出现问题，立即恢复备份：
```bash
cp routes/products.js.bak routes/products.js
pm2 restart all
```

---
**修复日期**: 2026-04-10
**严重级别**: P0 Critical
**影响评估**: 高（影响首页、搜索等核心功能）
