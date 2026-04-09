# 绮梦之约小程序 - 代码风格规范

## 基本规范

### 缩进
- 使用 **2 空格缩进**
- 不使用 Tab 字符

### 引号
- JavaScript字符串: 单引号 (`'string'`)
- WXML属性: 双引号 (`attr="value"`)
- JSON: 双引号 (`"key": "value"`)

### 分号
- 每行语句末尾必须有分号

### 行宽
- 最大 80-100 字符
- 超长行应在运算符后换行

## 命名规范

### 变量和函数 (camelCase)
```javascript
// ✅ 正确
let userName = '张三';
function getUserInfo() {}

// ❌ 错误
let username = '张三';
function getUserinfo() {}
```

### 常量 (UPPER_SNAKE_CASE)
```javascript
// ✅ 正确
const API_BASE_URL = 'https://...';
const MAX_RETRY_COUNT = 3;

// ❌ 错误
const apiBaseUrl = 'https://...';
```

### 类 (PascalCase)
```javascript
// ✅ 正确
class ProductService {}

// ❌ 错误
class productService {}
```

## 文件组织

### 页面结构
```
pages/
  index/
    index.js      // 页面逻辑
    index.json    // 页面配置
    index.wxml    // 页面结构
    index.wxss    // 页面样式
```

### 组件结构
```
components/
  product-card/
    product-card.js
    product-card.json
    product-card.wxml
    product-card.wxss
```

## 注释规范

### JSDoc (函数注释)
```javascript
/**
 * 获取商品列表
 * @param {Object} options - 查询选项
 * @param {number} options.page - 页码 (从1开始)
 * @param {number} options.pageSize - 每页数量
 * @returns {Promise<Object>} 商品列表数据
 */
async function getProductList(options) {}
```

### 单行注释
```javascript
// 这是一个简单的单行注释
```

### TODO 注释
```javascript
// TODO: 待优化 - 这个查询可以添加缓存
// FIXME: 已知问题 - 并发时可能出现竞态条件
// HACK: 临时方案 - 下个版本重构
```

## 性能最佳实践

### setData 优化
```javascript
// ❌ 差: 循环中多次调用 setData
for (let i = 0; i < list.length; i++) {
  this.setData({ [`list[${i}]`]: list[i] });
}

// ✅ 好: 批量更新
const data = {};
list.forEach((item, idx) => {
  data[`list[${idx}]`] = item;
});
this.setData(data);
```

### 图片懒加载
```html
<!-- ✅ 使用 lazy-load -->
<image src="{{url}}" lazy-load />
```

### 事件解绑
```javascript
onLoad() {
  this.timer = setInterval(() => {
    // do something
  }, 1000);
},

onUnload() {
  // ⚠️ 重要: 清理定时器防止内存泄漏!
  if (this.timer) {
    clearInterval(this.timer);
  }
}
```

## 安全规范

### Token 存储
```javascript
// ✅ 正确: 使用微信安全存储
wx.setStorageSync('token', token);

// ❌ 错误: 不要存储敏感信息到 globalData
app.globalData.token = token; // 不安全
```

### 数据校验
```javascript
// ✅ 始终校验用户输入
if (!username || username.trim().length === 0) {
  wx.showToast({ title: '请输入用户名', icon: 'none' });
  return;
}
```

## Git 规范

### Commit Message 格式
```
<type>(<scope>): <subject>

<body>

<footer>
```

**type**: feat, fix, docs, style, refactor, test, chore

**示例**:
```
feat(cart): 添加购物车数量修改功能

- 支持增加/减少数量
- 库存不足时给出提示
- 数量变化时自动计算总价

Closes #123
```

---

## 调试日志规范 (重要!)

### ❌ 禁止在生产代码中使用
```javascript
// 这些绝对不能提交到生产环境:
console.log('调试信息');        // 禁止!
console.debug('调试信息');      // 禁止!
debugger;                        // 禁止! (会中断执行)
```

### ✅ 允许使用的日志
```javascript
// 错误日志 - 用于异常处理
console.error('API请求失败:', error);

// 警告日志 - 用于潜在问题
console.warn('数据格式异常:', data);

// 条件性日志 - 仅开发环境
if (__wxConfig.envVersion === 'develop') {
  console.log('开发环境调试信息');
}
```

### 推荐做法: 封装日志工具
```javascript
// utils/logger.js
const logger = {
  info: (tag, ...args) => {
    if (__wxConfig.envVersion === 'develop') {
      console.log(`[${tag}]`, ...args);
    }
  },
  
  error: (tag, ...args) => {
    // 生产环境也记录错误
    console.error(`[${tag}]`, ...args);
    
    // 可选: 上报到错误监控服务
    // reportError(tag, args);
  }
};

// 使用示例
logger.info('Cart', '添加商品:', goodsId);     // 仅开发环境
logger.error('API', '请求失败:', error);         // 所有环境
```

---

## 配置管理规范

### ✅ 正确: 集中配置管理
```javascript
// config/production.js
module.exports = {
  API_BASE_URL: 'https://api.example.com',
  CDN_URL: 'https://cdn.example.com',
  UPLOAD_URL: 'https://upload.example.com'
};

// 在业务代码中使用
const config = require('../../config/production.js');
wx.request({
  url: `${config.API_BASE_URL}/products`,
  // ...
});
```

### ❌ 错误: 硬编码 URL
```javascript
// 禁止这样做!
wx.request({
  url: 'https://ecommerce-backend-nansijiujia-xxx.tcloudbaseapp.com/products',
  // ...
});
```

### 环境区分
```javascript
// config/index.js
const envVersion = __wxConfig.envVersion;

let config;
if (envVersion === 'develop') {
  config = require('./development');
} else if (envVersion === 'trial') {
  config = require('./trial');
} else {
  config = require('./production');
}

module.exports = config;
```

---

## 内存管理规范

### 定时器使用原则

#### 1. setInterval 必须清理
```javascript
Page({
  data: {
    timer: null
  },
  
  onLoad() {
    // 创建定时器
    this.data.timer = setInterval(() => {
      this.pollData();
    }, 5000);
  },
  
  onUnload() {
    // ✅ 必须在页面卸载时清理
    if (this.data.timer) {
      clearInterval(this.data.timer);
      this.data.timer = null;
    }
  }
});
```

#### 2. setTimeout 的最佳实践
```javascript
// ✅ 对于可能被取消的延迟操作，保存引用
Page({
  data: {
    debounceTimer: null
  },
  
  handleInput(e) {
    // 清除上一个定时器
    if (this.data.debounceTimer) {
      clearTimeout(this.data.debounceTimer);
    }
    
    // 创建新的定时器
    this.data.debounceTimer = setTimeout(() => {
      this.search(e.detail.value);
    }, 300);
  },
  
  onUnload() {
    // 清理防抖定时器
    if (this.data.debounceTimer) {
      clearTimeout(this.data.debounceTimer);
    }
  }
});
```

#### 3. 组件中的定时器
```javascript
Component({
  data: {
    countdownTimer: null
  },
  
  lifetimes: {
    attached() {
      this.startCountdown();
    },
    
    detached() {
      // ✅ 组件销毁时必须清理
      if (this.data.countdownTimer) {
        clearInterval(this.data.countdownTimer);
      }
    }
  }
});
```

---

## 代码质量检查清单

### 提交前自查
- [ ] 无 `console.log` / `console.debug` / `debugger` 语句
- [ ] 无硬编码的 URL 或 IP 地址
- [ ] 所有 `setInterval` 都有对应的清理逻辑
- [ ] 长时间运行的 `setTimeout` 有取消机制
- [ ] 敏感数据不输出到日志中
- [ ] 错误处理使用了 `console.error` 而非 `console.log`
- [ ] 配置项都从统一配置文件导入

### Code Review 检查点
- [ ] 命名符合规范 (camelCase/PascalCase/UPPER_SNAKE_CASE)
- [ ] 函数有 JSDoc 注释
- [ ] 复杂逻辑有行内注释
- [ ] 无超过 100 字符的长行
- [ ] 无嵌套超过 3 层的代码
- [ ] 异步操作有错误处理
- [ ] 用户输入已做校验和过滤

---

## ESLint 配置建议 (可选)

如果项目引入 ESLint，推荐配置:

```javascript
// .eslintrc.js
module.exports = {
  extends: [
    'eslint:recommended'
  ],
  env: {
    browser: true,
    es6: true,
    node: true
  },
  rules: {
    // 禁止 debugger
    'no-debugger': 'error',
    
    // 禁止 console.log (允许 console.error/warn)
    'no-console': ['warn', { allow: ['error', 'warn', 'info'] }],
    
    // 强制分号
    'semi': ['error', 'always'],
    
    // 引号类型
    'quotes': ['error', 'single'],
    
    // 缩进
    'indent': ['error', 2],
    
    // 最大行宽
    'max-len': ['warn', { code: 100 }]
  },
  
  globals: {
    wx: 'readonly',
    getApp: 'readonly',
    getCurrentPages: 'readonly',
    App: 'readonly',
    Page: 'readonly',
    Component: 'readonly',
    __wxConfig: 'readonly',
    require: 'readonly',
    module: 'readonly',
    console: 'readonly',
    setTimeout: 'readonly',
    setInterval: 'readonly',
    clearTimeout: 'readonly',
    clearInterval: 'readonly'
  }
};
```

---

## 项目特定约定

### API 请求封装
所有网络请求应通过 `utils/request.js` 统一封装:

```javascript
// ✅ 正确
const request = require('../../utils/request');
request.get('/products', { page: 1 })
  .then(data => { /* ... */ });

// ❌ 错误: 直接使用 wx.request
wx.request({
  url: 'https://...',
  method: 'GET',
  success(res) { /* ... */ }
});
```

### 页面跳转统一使用 navigation 工具
```javascript
// ✅ 正确
const nav = require('../../utils/navigation');
nav.navigateTo('/pages/detail/detail?id=123');

// ❌ 错误: 直接调用 wx.navigateTo
wx.navigateTo({ url: '/pages/detail/detail?id=123' });
```

### 数据存储规范
```javascript
// 用户相关数据 → wx.setStorageSync
wx.setStorageSync('token', token);
wx.setStorageSync('userInfo', userInfo);

// 临时数据 → this.data 或 globalData (谨慎使用)
this.setData({ tempList: data });

// ❌ 避免: 混合使用
globalData.cartItems = items; // 不推荐
```

---

## 常见反模式 (Anti-Patterns)

### 1. 回调地狱
```javascript
// ❌ 差
wx.request({
  url: '/api/user',
  success(res1) {
    wx.request({
      url: '/api/orders',
      success(res2) {
        wx.request({
          url: '/api/products',
          success(res3) {
            // 嵌套过深
          }
        });
      }
    });
  }
});

// ✅ 好: 使用 async/await
async function loadData() {
  const user = await request.get('/api/user');
  const orders = await request.get('/api/orders');
  const products = await request.get('/api/products');
}
```

### 2. setData 滥用
```javascript
// ❌ 差: 频繁调用 setData
for (let i = 0; i < 100; i++) {
  this.setData({ [`items[${i}].visible]: true });
}

// ✅ 好: 合并更新
const updates = {};
items.forEach((item, idx) => {
  updates[`items[${idx}].visible`] = true;
});
this.setData(updates);
```

### 3. 事件监听未移除
```javascript
// ❌ 差
onLoad() {
  wx.onSocketMessage(this.handleMessage);
}

// ✅ 好
onLoad() {
  wx.onSocketMessage(this.handleMessage.bind(this));
},

onUnload() {
  wx.offSocketMessage(this.handleMessage.bind(this));
}
```

---

## 性能优化清单

### 渲染性能
- [ ] 使用 `wx:key` 优化列表渲染
- [ ] 长列表使用虚拟列表 (recycle-view)
- [ ] 图片使用 `lazy-load` 和合适的 `mode`
- [ ] 避免 setData 传输大量数据
- [ ] 减少 WXML 节点数量 (< 1000 个)

### 网络性能
- [ ] 接口返回数据精简，避免冗余字段
- [ ] 使用缓存策略 (本地缓存 + 缓存控制)
- [ ] 并发请求控制 (最多 5 个并发)
- [ ] 大图压缩或使用 CDN 缩略图

### 启动性能
- [ ] 减少首屏请求数量
- [ ] 关键路径资源预加载
- [ ] 分包加载 (subpackages)
- [ ] 避免同步操作阻塞主线程

---

**最后更新**: 2026-04-09  
**适用项目**: 绮梦之约小程序电商平台  
**版本**: v1.0  
**维护者**: 开发团队
