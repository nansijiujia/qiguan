# 绮管电商后台系统 - API 参考文档

> **版本**: v1.0.0  
> **基础URL**: `https://api.qimengzhiyue.cn/api/v1`  
> **认证方式**: Bearer Token (JWT)  
> **数据格式**: JSON  
> **字符编码**: UTF-8  
> **最后更新**: 2026-04-08  

---

## 目录

- [1. 接口概览](#1-接口概览)
- [2. 认证模块 (Auth)](#2-认证模块-auth)
  - [2.1 用户登录](#21-post-apiv1authlogin)
  - [2.2 用户注册](#22-post-apiv1authregister)
- [3. 分类模块 (Categories)](#3-分类模块-categories)
  - [3.1 获取分类列表](#31-get-apiv1categories)
  - [3.2 创建分类](#32-post-apiv1categories)
  - [3.3 更新分类](#33-put-apiv1categoriesid)
  - [3.4 删除分类](#34-delete-apiv1categoriesid)
  - [3.5 获取分类详情](#35-get-apiv1categoriesid)
  - [3.6 获取分类树](#36-get-apiv1categoriestree)
- [4. 商品模块 (Products)](#4-商品模块-products)
  - [4.1 获取商品列表](#41-get-apiv1products)
  - [4.2 创建商品](#42-post-apiv1products)
  - [4.3 更新商品](#43-put-apiv1productsid)
  - [4.4 删除商品](#44-delete-apiv1productsid)
  - [4.5 获取商品详情](#45-get-apiv1productsid)
- [5. 用户模块 (Users)](#5-用户模块-users)
  - [5.1 获取用户列表](#51-get-apiv1users)
  - [5.2 创建用户](#52-post-apiv1users)
  - [5.3 更新用户](#53-put-apiv1usersid)
  - [5.4 删除用户](#54-delete-apiv1usersid)
  - [5.5 切换用户状态](#55-put-apiv1usersidstatus)
- [6. 订单模块 (Orders)](#6-订单模块-orders)
  - [6.1 获取订单列表](#61-get-apiv1orders)
  - [6.2 获取订单详情](#62-get-apiv1ordersid)
  - [6.3 创建订单](#63-post-apiv1orders)
  - [6.4 更新订单状态](#64-put-apiv1ordersidstatus)
- [7. 仪表盘模块 (Dashboard)](#7-仪表盘模块-dashboard)
  - [7.1 获取统计数据](#71-get-apiv1dashboardoverview)
  - [7.2 获取销售趋势](#72-get-apiv1dashboardsales)
- [8. 内容模块 (Content)](#8-内容模块-content)
  - [8.1 获取首页数据](#81-get-apiv1contenthomepage)
  - [8.2 获取推荐商品](#82-get-apiv1contentrecommendations)
- [9. 错误码说明](#9-错误码说明)
- [10. 示例代码](#10-示例代码)

---

## 1. 接口概览

| 模块 | 接口数量 | 基础路径 | 说明 | 认证要求 |
|------|---------|---------|------|---------|
| **认证** | 2+2 | `/api/v1/auth` | 登录/注册/资料修改 | 公开 |
| **分类** | 6 | `/api/v1/categories` | CRUD + 树形结构 | 部分需认证 |
| **商品** | 9 | `/api/v1/products` | CRUD + 搜索 + 推荐 + 热门 | 部分需认证 |
| **用户** | 5 | `/api/v1/users` | CRUD + 状态管理 | ✅ Token + Admin角色 |
| **订单** | 4 | `/api/v1/orders` | 查询/创建/状态流转 | ✅ Token |
| **仪表盘** | 5 | `/api/v1/dashboard` | 统计/趋势/排行 | 部分需认证 |
| **内容** | 5 | `/api/v1/content` | 首页轮播/推荐/促销 | 公开 |
| **健康检查** | 1 | `/api/v1/health` | 服务健康状态 | 公开 |
| **合计** | **37** | - | - | - |

### 认证要求图例

| 图标 | 含义 |
|------|------|
| 🔓 | 公开接口，无需Token |
| 🔑 | 需要Bearer Token（任何已登录用户） |
| 👑 | 需要Admin角色权限 |

### 统一响应格式

所有接口均遵循以下响应格式：

```typescript
// 成功响应
interface SuccessResponse<T = any> {
  success: true;
  data: T;                    // 业务数据
  pagination?: {               // 分页信息（仅列表接口）
    total: number;
    totalPages: number;
    page: number;
    limit: number;
  };
  message?: string;            // 提示消息
}

// 错误响应
interface ErrorResponse {
  success: false;
  error: {
    code: string;              // 机器可读错误码
    message: string;           // 人类可读错误描述
  };
}
```

---

## 2. 认证模块 (Auth)

🔓 **公开接口**

### 2.1 POST /api/v1/auth/login

**描述**: 用户登录，验证凭据后签发 JWT Token。

**请求头**:
```
Content-Type: application/json
```

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 | 示例值 |
|--------|------|------|------|--------|
| username | string | 条件必填* | 用户名（与email二选一） | `admin` |
| email | string | 条件必填* | 邮箱地址（与username二选一） | `admin@qiguan.com` |
| password | string | ✅ 是 | 登录密码 | `123456` |

> *username 和 email 至少提供一个

**请求示例**:
```json
{
  "username": "admin",
  "password": "123456"
}
```

**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "username": "admin",
      "email": "admin@qiguan.com",
      "role": "admin",
      "avatar": null
    }
  }
}
```

**错误响应**:

| HTTP状态码 | 错误码 | 说明 | 解决方案 |
|-----------|--------|------|---------|
| 400 | `INVALID_INPUT` | 密码未提供 | 补充 password 字段 |
| 400 | `INVALID_INPUT` | 未提供用户名或邮箱 | 填写 username 或 email |
| 401 | `INVALID_CREDENTIALS` | 用户名或密码错误 | 检查账号密码是否正确 |
| 403 | `ACCOUNT_BANNED` | 账号已被封禁 | 联系管理员解封 |
| 403 | `ACCOUNT_INACTIVE` | 账号未激活 | 等待管理员激活或查收激活邮件 |
| 500 | `SERVER_ERROR` | 服务器内部错误 | 联系技术支持 |

💡 **使用提示**: 
- 登录成功后，后续请求需要在 Header 中携带 `Authorization: Bearer <token>`
- Token 默认有效期 24小时（可通过 `JWT_EXPIRES_IN` 配置）

---

### 2.2 POST /api/v1/auth/register

**描述**: 注册新用户账户。

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 | 示例值 |
|--------|------|------|------|--------|
| username | string | ✅ 是 | 用户名（唯一） | `newuser2026` |
| email | string | ✅ 是 | 邮箱地址（唯一） | `user@example.com` |
| password | string | ✅ 是 | 密码（≥6位） | `mypassword123` |
| role | string | 否 | 角色，默认 `user` | `user` |

**请求示例**:
```json
{
  "username": "newuser2026",
  "email": "user@example.com",
  "password": "SecurePass123!",
  "role": "user"
}
```

**成功响应 (201)**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": 2,
      "username": "newuser2026",
      "email": "user@example.com",
      "role": "user",
      "avatar": null,
      "status": "active"
    }
  }
}
```

**错误响应**:

| HTTP状态码 | 错误码 | 说明 |
|-----------|--------|------|
| 400 | `INVALID_INPUT` | 缺少必填字段 |
| 400 | `INVALID_PASSWORD` | 密码长度不足6位 |
| 409 | `CONFLICT` | 用户名或邮箱已被注册 |

---

## 3. 分类模块 (Categories)

### 3.1 GET /api/v1/categories

🔓 **公开接口**

**描述**: 获取全部分类列表（扁平结构）。

**查询参数**: 无

**成功响应 (200)**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "电子产品",
      "parent_id": null,
      "sort_order": 1,
      "status": "active",
      "created_at": "2026-04-08T00:00:00.000Z"
    },
    {
      "id": 2,
      "name": "手机数码",
      "parent_id": 1,
      "sort_order": 1,
      "status": "active",
      "created_at": "2026-04-08T00:00:00.000Z"
    }
  ]
}
```

---

### 3.2 GET /api/v1/categories/tree

🔓 **公开接口**

**描述**: 获取分类树形结构（嵌套 children 数组）。

**查询参数**:

| 参数名 | 类型 | 必填 | 说明 | 示例值 |
|--------|------|------|------|--------|
| flat | string | 否 | 设为 `true` 返回扁平化带层级的数据 | `true` |

**成功响应 (200)** - 树形结构:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "电子产品",
      "parent_id": null,
      "sort_order": 1,
      "status": "active",
      "product_count": 2,
      "children": [
        {
          "id": 2,
          "name": "手机数码",
          "parent_id": 1,
          "sort_order": 1,
          "status": "active",
          "product_count": 1,
          "children": []
        }
      ]
    }
  ]
}
```

---

### 3.3 GET /api/v1/categories/:id

🔓 **公开接口**

**描述**: 获取单个分类的详细信息（包含子分类、父分类、关联商品数）。

**路径参数**:

| 参数名 | 类型 | 说明 | 示例值 |
|--------|------|------|--------|
| id | integer | 分类ID | `1` |

**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "电子产品",
    "parent_id": null,
    "sort_order": 1,
    "status": "active",
    "product_count": 2,
    "created_at": "2026-04-08T00:00:00.000Z",
    "children": [...],
    "parent": null
  }
}
```

**错误响应**: 404 `NOT_FOUND` - 分类不存在

---

### 3.4 POST /api/v1/categories

🔑 **需要认证**

**描述**: 创建新的商品分类。

**请求头**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 | 示例值 |
|--------|------|------|------|--------|
| name | string | ✅ 是 | 分类名称（唯一） | `"智能家居"` |
| parent_id | integer | 否 | 父分类ID（null=顶级） | `1` 或 `null` |
| sort_order | integer | 否 | 排序权重（越小越靠前） | `10` |
| status | string | 否 | 状态：`active`/`inactive` | `"active"` |

**请求示例**:
```json
{
  "name": "智能家居",
  "parent_id": 1,
  "sort_order": 10,
  "status": "active"
}
```

**成功响应 (201)**:
```json
{
  "success": true,
  "data": {
    "id": 10,
    "name": "智能家居",
    "parent_id": 1,
    "sort_order": 10,
    "status": "active"
  }
}
```

**错误响应**:

| HTTP状态码 | 错误码 | 说明 |
|-----------|--------|------|
| 400 | `VALIDATION_ERROR` | 分类名称为空 |
| 400 | `VALIDATION_ERROR` | 父分类不存在 |
| 409 | `DUPLICATE_ERROR` | 分类名称已存在 |

---

### 3.5 PUT /api/v1/categories/:id

🔑 **需要认证**

**描述**: 更新分类信息。

**路径参数**: `id` - 分类ID (integer)

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| name | string | ✅ 更新时必填 | 新的分类名称 |
| parent_id | integer | 否 | 新的父分类ID |
| sort_order | integer | 否 | 新的排序权重 |
| status | string | 否 | 新的状态 |

**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "id": 10,
    "name": "智能硬件",       // ← 已更新
    "parent_id": null,         // ← 已更新
    "sort_order": 5,           // ← 已更新
    "status": "active"
  }
}
```

**特殊校验**:
- 不能将自己设为父分类（`parent_id === id` 返回 400）
- 名称重复返回 409

---

### 3.6 DELETE /api/v1/categories/:id

🔑 **需要认证**

**描述**: 删除分类。

**前置条件**:
- 该分类下不能有子分类 → 返回 400 `HAS_CHILDREN`
- 该分类下不能有关联商品 → 返回 400 `HAS_PRODUCTS`

**成功响应 (200)**:
```json
{
  "success": true,
  "message": "分类删除成功"
}
```

**错误响应**: 404 `NOT_FOUND` - 分类不存在

---

## 4. 商品模块 (Products)

### 4.1 GET /api/v1/products

🔓 **公开接口**

**描述**: 获取商品列表，支持分页、搜索、筛选和排序。

**查询参数**:

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| page | integer | 否 | `1` | 页码（从1开始） |
| limit | integer | 否 | `20` | 每页数量（最大100） |
| category_id | integer | 否 | - | 按分类ID筛选 |
| keyword | string | 否 | - | 搜索关键词（匹配名称和描述） |
| status | string | 否 | - | 状态筛选：`active`/`inactive` |
| sort_by | string | 否 | `created_at` | 排序字段：`price`/`created_at`/`sales`/`stock` |
| sort_order | string | 否 | `desc` | 排序方向：`asc`/`desc` |

**请求示例**:
```
GET /api/v1/products?page=1&limit=10&category_id=2&keyword=iPhone&status=active&sort_by=price&sort_order=asc
```

**成功响应 (200)**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "iPhone 15 Pro Max",
      "description": "苹果最新旗舰手机...",
      "price": 9999.00,
      "original_price": 10999.00,
      "stock": 100,
      "category_id": 2,
      "image": "https://example.com/iphone.jpg",
      "status": "active",
      "stock_status": "充足",
      "category": { "id": 2, "name": "手机数码" },
      "created_at": "2026-04-08T00:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 25,
    "totalPages": 3,
    "page": 1,
    "limit": 10
  },
  "responseTime": 45
}
```

**stock_status 字段说明**:

| 值 | 条件 |
|----|------|
| `充足` | stock > 10 |
| `不足` | 0 < stock ≤ 10 |
| `缺货` | stock = 0 |

---

### 4.2 GET /api/v1/products/:id

🔓 **公开接口**

**描述**: 获取商品详情（含相似商品推荐）。

**路径参数**: `id` - 商品ID

**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "iPhone 15 Pro Max",
    "description": "...",
    "price": 9999.00,
    "stock": 100,
    "category": { "id": 2, "name": "手机数码" },
    "similar_products": [
      // 同分类下最多5个相似商品
    ]
  }
}
```

---

### 4.3 POST /api/v1/products

🔑 **需要认证**

**描述**: 创建新商品。

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 | 示例值 |
|--------|------|------|------|--------|
| name | string | ✅ 是 | 商品名称 | `"新款蓝牙耳机"` |
| description | string | 否 | 商品详细描述 | `"高品质无线耳机..."` |
| price | number | 否 | 现价（≥0） | `299.99` |
| stock | integer | 否 | 库存数量（≥0） | `500` |
| category_id | integer | 否 | 所属分类ID | `2` |
| image | string | 否 | 主图URL | `"https://..."` |
| status | string | 否 | 状态：`active`/`inactive` | `"active"` |

**校验规则**:
- name 不能为空
- price 不能为负数
- stock 不能为负数

**成功响应 (201)**:
```json
{
  "success": true,
  "data": {
    "id": 10,
    "name": "新款蓝牙耳机",
    "description": "高品质无线耳机...",
    "price": 299.99,
    "stock": 500,
    "category_id": 2,
    "image": null,
    "status": "active"
  }
}
```

---

### 4.4 PUT /api/v1/products/:id

🔑 **需要认证**

**描述**: 更新商品信息（支持部分更新，只需传递要修改的字段）。

**路径参数**: `id` - 商品ID

**请求参数**（均为可选，传什么改什么）:

| 参数名 | 类型 | 说明 |
|--------|------|------|
| name | string | 商品名称 |
| description | string | 描述 |
| price | number | 价格 |
| stock | integer | 库存 |
| category_id | integer | 分类ID |
| image | string | 图片URL |
| status | string | 状态 |

**成功响应 (200)**:
```json
{
  "success": true,
  "data": { "id": 10, "name": "升级版蓝牙耳机Pro", ... }
}
```

**特殊错误**: 如果没有提供任何有效字段，返回 400 `VALIDATION_ERROR`

---

### 4.5 DELETE /api/v1/products/:id

🔑 **需要认证**

**描述**: 删除商品。

**路径参数**: `id` - 商品ID

**成功响应 (200)**:
```json
{ "success": true, "message": "商品删除成功" }
```

**错误响应**: 404 `NOT_FOUND` - 商品不存在

---

## 5. 用户模块 (Users)

👑 **所有接口需要 Admin 角色权限**

### 5.1 GET /api/v1/users

**描述**: 获取用户列表（分页），支持按角色/状态/关键词筛选。

**请求头**: `Authorization: Bearer <admin_token>`

**查询参数**:

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| page | integer | 否 | `1` | 页码 |
| limit | integer | 否 | `10` | 每页数量 |
| role | string | 否 | - | 按角色筛选：`user`/`admin`/`manager` |
| status | string | 否 | - | 按状态筛选：`active`/`inactive`/`banned` |
| keyword | string | 否 | - | 搜索用户名或邮箱 |

**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "list": [
      {
        "id": 1,
        "username": "admin",
        "email": "admin@qiguan.com",
        "avatar": null,
        "role": "admin",
        "status": "active",
        "last_login": "2026-04-08T10:30:00.000Z",
        "created_at": "2026-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 15
    }
  }
}
```

⚠️ **安全注意**: 返回的用户列表不包含 `password_hash` 字段。

---

### 5.2 POST /api/v1/users

**描述**: 创建新用户（管理员操作）。

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| username | string | ✅ | 用户名（唯一） |
| email | string | ✅ | 邮箱（唯一） |
| password | string | ✅ | 初始密码（≥6位） |
| avatar | string | 否 | 头像URL |
| role | string | 否 | 角色，默认 `user` |
| status | string | 否 | 状态，默认 `active` |

**成功响应 (201)**: 返回创建的用户信息（不含密码）

**错误响应**: 409 `Username or email already exists`

---

### 5.3 PUT /api/v1/users/:id

**描述**: 更新用户信息。

**路径参数**: `id` - 用户ID

**请求参数**（可选，传什么改什么）:

| 参数名 | 类型 | 说明 |
|--------|------|------|
| username | string | 用户名 |
| email | string | 邮箱 |
| password | string | 新密码（会自动bcrypt哈希） |
| avatar | string | 头像 |
| role | string | 角色 |
| status | string | 状态 |

**成功响应 (200)**: 返回更新后的完整用户信息

---

### 5.4 DELETE /api/v1/users/:id

**描述**: 删除用户。

**路径参数**: `id` - 用户ID

**成功响应 (200)**:
```json
{ "success": true, "message": "User deleted successfully" }
```

---

### 5.5 PUT /api/v1/users/:id/status

**描述**: 快速切换用户状态（启用/禁用/封禁）。

**路径参数**: `id` - 用户ID

**请求体**:
```json
{ "status": "banned" }
```

**status 可选值**: `active` | `inactive` | `banned`

**成功响应 (200)**:
```json
{ "success": true, "message": "User status updated successfully" }
```

---

## 6. 订单模块 (Orders)

🔑 **所有接口需要认证**

### 6.1 GET /api/v1/orders

**描述**: 获取当前用户的订单列表（普通用户）/ 所有订单（管理员）。

**查询参数**:

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| page | integer | 否 | `1` | 页码 |
| limit | integer | 否 | `10` | 每页数量 |
| status | string | 否 | - | 按状态筛选 |

**status 有效值**: `pending` | `paid` | `shipped` | `completed` | `cancelled`

**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "list": [
      {
        "id": 1,
        "order_no": "ORD174412345678901234",
        "user_id": 2,
        "customer_name": "张三",
        "total_amount": 1999.98,
        "status": "paid",
        "item_count": 2,
        "shipping_address": { "address": "北京市xxx" },
        "created_at": "2026-04-08T12:00:00.000Z"
      }
    ],
    "pagination": { "page": 1, "limit": 10, "total": 5 }
  }
}
```

---

### 6.2 GET /api/v1/orders/:id

**描述**: 获取订单详细信息（含订单项明细）。

**路径参数**: `id` - 订单ID

**权限规则**:
- Admin: 可以查看任意订单
- 普通用户: 只能查看自己的订单（否则返回 403）

**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "order_no": "ORD174412345678901234",
    "user_id": 2,
    "customer_name": "张三",
    "customer_phone": "13800138000",
    "total_amount": 1999.98,
    "status": "shipped",
    "remark": "",
    "shipping_address": { "address": "北京市朝阳区..." },
    "items": [
      {
        "id": 1,
        "order_id": 1,
        "product_id": 1,
        "product_name": "iPhone 15 Pro Max",
        "quantity": 1,
        "price": 9999.00,
        "product_image": "https://...",
        "product_description": "..."
      }
    ],
    "timeline": {
      "created_at": "2026-04-08T12:00:00.000Z",
      "updated_at": "2026-04-08T14:30:00.000Z"
    }
  }
}
```

---

### 6.3 POST /api/v1/orders

**描述**: 创建订单（事务操作，自动扣减库存）。

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| items | array | ✅ | 订单项数组（至少1个） |
| items[].product_id | integer | ✅ | 商品ID |
| items[].quantity | integer | ✅ | 数量（>0） |
| items[].price | number | ✅ | 单价（>0） |
| shipping_address | object | 否 | 收货地址JSON |
| remark | string | 否 | 订单备注 |

**请求示例**:
```json
{
  "items": [
    { "product_id": 1, "quantity": 1, "price": 9999.00 },
    { "product_id": 3, "quantity": 2, "price": 299.00 }
  ],
  "shipping_address": {
    "province": "北京",
    "city": "北京市",
    "detail": "朝阳区xxx路100号",
    "receiver": "张三",
    "phone": "13800138000"
  },
  "remark": "尽快发货"
}
```

**业务逻辑**:
1. 校验每个商品的库存是否充足
2. 在事务中扣减库存 + 创建订单 + 创建订单项
3. 总金额自动计算 = Σ(quantity × price)

**成功响应 (201)**:
```json
{
  "success": true,
  "data": {
    "id": 10,
    "order_number": "ORD1744123456789...",
    "total_amount": 10597.00,
    "status": "pending",
    "items": [...],
    "message": "Order created successfully"
  }
}
```

**错误响应**:

| HTTP状态码 | 错误码 | 说明 |
|-----------|--------|------|
| 400 | `INVALID_ORDER` | 订单项为空或参数无效 |
| 404 | `PRODUCT_NOT_FOUND` | 商品不存在 |
| 400 | `INSUFFICIENT_STOCK` | 库存不足 |

---

### 6.4 PUT /api/v1/orders/:id/status

**描述**: 更新订单状态（遵循状态机流转规则）。

**路径参数**: `id` - 订单ID

**请求体**:
```json
{ "status": "shipped" }
```

**状态流转规则**:

```
pending ──→ paid ──→ shipped ──→ completed
   │                              │
   └──────→ cancelled ◄──────────┘
              (取消时自动恢复库存)
```

**非法流转示例**: `completed` → `pending` ❌ (不允许)

**成功响应 (200)**: 返回更新后的完整订单信息及订单项

---

## 7. 仪表盘模块 (Dashboard)

### 7.1 GET /api/v1/dashboard/overview

🔓 **公开接口**

**描述**: 获取仪表盘核心统计数据。

**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "totalProducts": 5,
    "totalOrders": 128,
    "totalRevenue": "256800.50",
    "totalUsers": 1050,
    "productGrowth": "+12.3%",
    "orderGrowth": "+8.1%",
    "revenueGrowth": "-2.4%",
    "userGrowth": "+15.7%"
  }
}
```

> 💡 增长率数据目前为模拟值，后续可接入真实时间对比计算。

---

### 7.2 GET /api/v1/dashboard/sales

🔓 **公开接口**

**描述**: 获取销售趋势数据（按日统计）。

**查询参数**:

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| period | integer | 否 | `30` | 统计最近N天的数据 |

**成功响应 (200)**:
```json
{
  "success": true,
  "data": [
    { "date": "2026-03-09", "orders": 5, "revenue": 12500.00 },
    { "date": "2026-03-10", "orders": 8, "revenue": 21300.50 },
    ...
  ]
}
```

---

## 8. 内容模块 (Content)

### 8.1 GET /api/v1/content/homepage

🔓 **公开接口**

**描述**: 获取首页展示数据（轮播图 + 推荐商品 + 热门商品 + 促销活动）。

**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "banners": [
      { "id": 1, "image": "https://...", "link": "/products/category/1" }
    ],
    "recommendations": [...],     // 随机推荐6个活跃商品
    "hotProducts": [...],         // 按销量排序的商品
    "promotions": [
      { "id": 1, "title": "限时特惠", "description": "全场满100减20", "link": "/products" }
    ]
  }
}
```

> 💡 当前 banners 和 promotions 为模拟数据，后续可接入CMS管理后台。

---

### 8.2 GET /api/v1/content/homepage/recommendations

🔓 **公开接口**

**描述**: 获取首页推荐商品列表。

**查询参数**:

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| limit | integer | 否 | `10` | 返回数量（最大50） |

**成功响应 (200)**:
```json
{
  "success": true,
  "data": [...]   // 随机 N 个 active 状态的商品
}
```

---

## 9. 错误码说明

### 完整错误码表

| 错误码 | HTTP状态码 | 所属模块 | 说明 | 解决方案 |
|--------|-----------|---------|------|---------|
| **通用错误** |||||
| `0` | 200 | 全局 | 成功 | - |
| `INTERNAL_ERROR` | 500 | 全局 | 服务器内部错误 | 检查日志，联系运维 |
| `SERVER_ERROR` | 500 | 全局 | 服务端异常 | 同上 |
| `NOT_FOUND` | 404 | 全局 | 资源不存在 | 检查资源ID是否正确 |
| **认证错误** |||||
| `UNAUTHORIZED` | 401 | Auth | 未提供/无效Token | 重新登录获取新Token |
| `TOKEN_EXPIRED` | 401 | Auth | Token已过期 | 重新登录 |
| `INVALID_TOKEN` | 401 | Auth | Token格式无效 | 清除本地存储的Token |
| `FORBIDDEN` | 403 | Auth | 权限不足 | 使用更高权限的账号 |
| `INVALID_CREDENTIALS` | 401 | Auth | 用户名或密码错误 | 检查账号密码 |
| `ACCOUNT_BANNED` | 403 | Auth | 账号被封禁 | 联系管理员 |
| `ACCOUNT_INACTIVE` | 403 | Auth | 账号未激活 | 等待激活或联系管理员 |
| **输入校验错误** |||||
| `INVALID_INPUT` | 400 | 全局 | 参数缺失或格式错误 | 对照API文档补充必填参数 |
| `INVALID_PASSWORD` | 400 | Auth | 密码不符合规则 | 密码至少6位 |
| `CONFLICT` | 409 | Auth/Users | 资源冲突（重复注册等） | 更换用户名/邮箱 |
| `DUPLICATE_ERROR` | 409 | Categories | 名称重复 | 使用不同的名称 |
| `VALIDATION_ERROR` | 400 | Categories/Products | 数据验证失败 | 查看具体message |
| **业务逻辑错误** |||||
| `HAS_CHILDREN` | 400 | Categories | 存在子分类无法删除 | 先删除或移动子分类 |
| `HAS_PRODUCTS` | 400 | Categories | 存在关联商品无法删除 | 先移除或删除商品 |
| `PRODUCT_NOT_FOUND` | 404 | Orders | 商品不存在 | 检查商品ID |
| `INSUFFICIENT_STOCK` | 400 | Orders | 库存不足 | 减少购买数量 |
| `ORDER_NOT_FOUND` | 404 | Orders | 订单不存在 | 检查订单ID |
| `INVALID_STATUS` | 400 | Orders | 无效的状态值 | 使用合法状态值 |
| `INVALID_STATUS_TRANSITION` | 400 | Orders | 不允许的状态流转 | 查看状态机规则 |

### 错误处理最佳实践

```javascript
// 前端 Axios 拦截器中的统一错误处理示例
axios.interceptors.response.use(
  response => response.data,
  error => {
    const { response } = error;
    
    if (!response) {
      // 网络错误
      return Promise.reject({ code: 'NETWORK_ERROR', message: '网络连接失败' });
    }
    
    const { status, data } = response;
    
    switch (status) {
      case 401:
        // Token过期或无效 -> 跳转登录页
        localStorage.removeItem('token');
        window.location.href = '/login';
        break;
        
      case 403:
        // 无权限 -> 显示提示
        console.warn('权限不足:', data.error?.message);
        break;
        
      case 404:
        console.warn('资源不存在:', data.error?.message);
        break;
        
      case 500:
        console.error('服务器错误:', data.error?.message);
        break;
        
      default:
        console.warn(`请求失败 [${status}]:`, data.error?.message);
    }
    
    return Promise.reject(data.error);
  }
);
```

---

## 10. 示例代码

### JavaScript / Fetch API

```javascript
// ===== 基础配置 =====
const BASE_URL = 'https://api.qimengzhiyue.cn/api/v1';

let authToken = null;

// 设置Token
function setToken(token) {
  authToken = token;
}

// 通用请求方法
async function apiRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
    ...options.headers
  };
  
  const response = await fetch(url, { ...options, headers });
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error?.message || `HTTP ${response.status}`);
  }
  
  return data;
}

// ===== 1. 登录示例 =====
async function login(username, password) {
  const result = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
  
  setToken(result.data.token);
  console.log('登录成功:', result.data.user);
  return result.data;
}

// ===== 2. 获取商品列表（分页+搜索）=====
async function getProducts(page = 1, keyword = '') {
  const params = new URLSearchParams({ page, limit: 20 });
  if (keyword) params.set('keyword', keyword);
  
  const result = await apiRequest(`/products?${params}`);
  console.log(`共 ${result.pagination.total} 个商品`);
  return result.data;
}

// ===== 3. 创建订单 =====
async function createOrder(items) {
  const result = await apiRequest('/orders', {
    method: 'POST',
    body: JSON.stringify({
      items,
      shipping_address: { /* 地址对象 */ }
    })
  });
  console.log('订单创建成功:', result.data.order_number);
  return result.data;
}

// ===== 4. 完整流程示例 =====
async function main() {
  try {
    // 1. 登录
    await login('admin', '123456');
    
    // 2. 获取商品列表
    const products = await getProducts(1, '');
    console.log('商品列表:', products);
    
    // 3. 获取仪表盘数据
    const dashboard = await apiRequest('/dashboard/overview');
    console.log('总营收:', dashboard.data.totalRevenue);
    
  } catch (error) {
    console.error('操作失败:', error.message);
  }
}

main();
```

### cURL 命令行示例

```bash
# ===== 认证 =====

# 登录并保存Token
curl -X POST https://api.qimengzhiyue.cn/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"123456"}' \
  | python3 -m json.tool

# 假设Token为: eyJhbGciOiJIUzI1NiIs...
TOKEN="eyJhbGciOiJIUzI1NiIs..."

# ===== 商品模块 =====

# 获取商品列表
curl "https://api.qimengzhiyue.cn/api/v1/products?page=1&limit=5&status=active" | python3 -m json.tool

# 创建商品（需要Token）
curl -X POST https://api.qimengzhiyue.cn/api/v1/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"测试商品","price":99.99,"stock":100,"status":"active"}' | python3 -m json.tool

# 更新商品
curl -X PUT https://api.qimengzhiyue.cn/api/v1/products/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"price":899.99}' | python3 -m json.tool

# 删除商品
curl -X DELETE https://api.qimengzhiyue.cn/api/v1/products/10 \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# ===== 分类模块 =====

# 获取分类树
curl https://api.qimengzhiyue.cn/api/v1/categories/tree | python3 -m json.tool

# 创建分类
curl -X POST https://api.qimengzhiyue.cn/api/v1/categories \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"测试分类","sort_order":99}' | python3 -m json.tool

# ===== 用户模块（需要Admin Token）=====

# 获取用户列表
curl "https://api.qimengzhiyue.cn/api/v1/users?limit=5" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# 切换用户状态
curl -X PUT "https://api.qimengzhiyue.cn/api/v1/users/2/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"banned"}' | python3 -m json.tool

# ===== 订单模块 =====

# 获取我的订单
curl "https://api.qimengzhiyue.cn/api/v1/orders?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# 创建订单
curl -X POST https://api.qimengzhiyue.cn/api/v1/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"product_id":1,"quantity":1,"price":9999}],
    "shipping_address":{"receiver":"测试","phone":"13800138000","address":"测试地址"}
  }' | python3 -m json.tool

# ===== 仪表盘 =====

# 获取统计数据
curl https://api.qimengzhiyue.cn/api/v1/dashboard/overview | python3 -m json.tool

# 获取销售趋势（最近7天）
curl "https://api.qimengzhiyue.cn/api/v1/dashboard/sales?period=7" | python3 -m json.tool

# ===== 健康检查 =====

curl https://api.qimengzhiyue.cn/api/v1/health | python3 -m json.tool
```

### Swagger UI 在线文档

部署后可通过以下地址访问交互式API文档：

```
https://api.qimengzhiyue.cn/api-docs
```

[截图：Swagger UI 界面]

---

## 附录

### A. 接口变更日志

| 版本 | 日期 | 变更内容 |
|------|------|---------|
| v1.0.0 | 2026-04-08 | 初始版本，37个接口全部就绪 |

### B. Postman 导入配置

可在 Postman 中导入以下配置快速开始：

```json
{
  "info": {"name": "绮管电商后台 API", "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"},
  "variable": [
    {"key":"base_url","value":"https://api.qimengzhiyue.cn/api/v1"},
    {"key":"token","value":""}
  ],
  "item": [
    {"name":"认证","item":[
      {"name":"登录","request":{"method":"POST","header":[{"key":"Content-Type","value":"application/json"}],"body":{"mode":"raw","raw":"{\n\t\"username\":\"admin\",\n\t\"password\":\"123456\"\n}"},"url":{"raw":"{{base_url}}/auth/login"}}
    ]},
    {"name":"商品","item":[...]}
  ]
}
```

### C. 相关资源链接

| 资源 | 链接 |
|------|------|
| Swagger UI | `/api-docs` |
| 健康检查 | `/api/v1/health` |
| 实施文档 | [IMPLEMENTATION.md](IMPLEMENTATION.md) |
| 测试报告 | [TEST_REPORT.md](TEST_REPORT.md) |
| 部署手册 | [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) |

---

> **文档维护说明**: 本API文档应随每次接口变更同步更新。建议在 Code Review 中强制要求同步更新此文档。
