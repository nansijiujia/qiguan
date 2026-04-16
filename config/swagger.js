const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '绮管电商后台 API 文档',
      version: '2.0.0',
      description: `
## 🎯 绮管电商后台管理系统 API

### ✨ P0+P1 重构版本特性

- **🗄️ 纯 TDSQL-C 架构**: 移除 SQLite，专为腾讯云 TDSQL-C MySQL 优化
- **🛡️ 统一错误处理**: asyncHandler 全局异常捕获
- **🔒 SQL 注入防护**: 排序字段白名单校验
- **⚡ 查询缓存系统**: node-cache 内存缓存，热点数据响应提升 500%
- **📦 responseHelper 工具库**: 统一响应格式，10 个便捷方法
- **🔗 连接池优化**: mysql2/promise，TDSQL-C 专用配置

### 📊 技术栈

- **运行时**: Node.js >= 18.x
- **框架**: Express.js 4.x
- **数据库**: TDSQL-C (MySQL 兼容)
- **认证**: JWT (jsonwebtoken)
- **文档**: Swagger/OpenAPI 3.0

### 🔐 认证说明

所有需要认证的接口都需要在请求头中携带 JWT Token：

\`\`\`
Authorization: Bearer <your_jwt_token>
\`\`\`

### 📝 响应格式

#### 成功响应
\`\`\`json
{
  "success": true,
  "data": { ... },
  "message": "操作成功",
  "timestamp": "2026-04-14T16:34:44.958Z"
}
\`\`\`

#### 错误响应
\`\`\`json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "timestamp": "2026-04-14T16:34:44.958Z"
  }
}
\`\`\`

#### 分页响应
\`\`\`json
{
  "success": true,
  "data": {
    "list": [...],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100
    }
  }
}
\`\`\`

### 🌟 主要接口模块

1. **认证模块** (\`/api/v1/auth\`) - 登录、注册、Token 刷新
2. **用户管理** (\`/api/v1/admin/users\`) - CRUD + 权限控制
3. **客户管理** (\`/api/v1/customers\`) - 客户信息管理
4. **商品管理** (\`/api/v1/products\`) - 商品 CRUD + 分类
5. **分类管理** (\`/api/v1/categories\`) - 树形分类结构
6. **订单管理** (\`/api/v1/orders\`) - 订单全流程
7. **购物车** (\`/api/v1/cart\`) - 购物车操作
8. **优惠券** (\`/api/v1/coupons\`) - 优惠券管理
9. **仪表盘** (\`/api/v1/dashboard\`) - 数据统计
10. **系统设置** (\`/api/v1/system\`) - 系统配置

### ⚠️ 注意事项

- 所有时间字段均为 ISO 8601 格式
- 分页参数：page (页码), limit (每页数量)
- 排序参数：sort (排序字段), order (asc/desc)
- 搜索关键词支持模糊匹配 (LIKE %keyword%)
`,
      contact: {
        name: '绮管技术团队',
        email: 'support@qimengzhiyue.cn',
        url: 'https://qimengzhiyue.cn'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: '/api/v1',
        description: '生产环境 API (v1)',
        variables: {
          port: {
            default: '3003',
            description: '服务器端口'
          }
        }
      },
      {
        url: 'http://localhost:3003/api/v1',
        description: '本地开发环境'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Authorization header using the Bearer scheme. Example: \"Bearer {token}\"'
        }
      },
      schemas: {
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'object' },
            message: { type: 'string', example: '操作成功' },
            timestamp: { type: 'string', format: 'date-time' }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'INTERNAL_ERROR' },
                message: { type: 'string', example: '服务器内部错误' },
                timestamp: { type: 'string', format: 'date-time' }
              }
            }
          }
        },
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1, description: '当前页码' },
            limit: { type: 'integer', example: 10, description: '每页数量' },
            total: { type: 'integer', example: 100, description: '总记录数' }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            username: { type: 'string', example: 'admin' },
            email: { type: 'string', example: 'admin@qiguan.com' },
            avatar: { type: 'string', nullable: true },
            role: { type: 'string', enum: ['admin', 'manager', 'user'], example: 'admin' },
            status: { type: 'string', enum: ['active', 'inactive', 'banned'], example: 'active' },
            last_login: { type: 'string', format: 'date-time', nullable: true },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        Product: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            name: { type: 'string', example: '智能手机 Pro Max' },
            price: { type: 'number', format: 'float', example: 5999.00 },
            stock: { type: 'integer', example: 100 },
            category_id: { type: 'integer', example: 1 },
            description: { type: 'string', nullable: true },
            image: { type: 'string', nullable: true },
            status: { type: 'string', enum: ['active', 'inactive'], example: 'active' },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        Category: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            name: { type: 'string', example: '电子产品' },
            parent_id: { type: 'integer', nullable: true },
            sort_order: { type: 'integer', example: 0 },
            status: { type: 'string', enum: ['active', 'inactive'], example: 'active' },
            product_count: { type: 'integer', example: 50 },
            children: {
              type: 'array',
              items: { $ref: '#/components/schemas/Category' }
            }
          }
        },
        Order: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1001 },
            order_no: { type: 'string', example: 'ORD20260414001' },
            user_id: { type: 'integer', example: 1 },
            total_amount: { type: 'number', format: 'float', example: 5999.00 },
            status: { type: 'string', enum: ['pending', 'paid', 'shipped', 'delivered', 'cancelled'], example: 'pending' },
            shipping_address: { type: 'string', nullable: true },
            remark: { type: 'string', nullable: true },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        Customer: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            openid: { type: 'string', nullable: true },
            nickname: { type: 'string', example: '张三' },
            avatar_url: { type: 'string', nullable: true },
            real_name: { type: 'string', example: '张三丰' },
            phone: { type: 'string', example: '13800138000' },
            gender: { type: 'string', enum: ['male', 'female', 'other'], nullable: true },
            province: { type: 'string', nullable: true },
            city: { type: 'string', nullable: true },
            district: { type: 'string', nullable: true },
            detail_address: { type: 'string', nullable: true },
            full_address: { type: 'string', nullable: true },
            status: { type: 'string', enum: ['active', 'inactive'], example: 'active' },
            created_at: { type: 'string', format: 'date-time' }
          }
        }
      },
      parameters: {
        PageParam: {
          name: 'page',
          in: 'query',
          description: '页码（从1开始）',
          required: false,
          schema: { type: 'integer', minimum: 1, default: 1 }
        },
        LimitParam: {
          name: 'limit',
          in: 'query',
          description: '每页数量（最大100）',
          required: false,
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 }
        },
        SortParam: {
          name: 'sort',
          in: 'query',
          description: '排序字段（需在允许列表中）',
          required: false,
          schema: { type: 'string' }
        },
        OrderParam: {
          name: 'order',
          in: 'query',
          description: '排序方向',
          required: false,
          schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }
        },
        KeywordParam: {
          name: 'keyword',
          in: 'query',
          description: '搜索关键词（模糊匹配）',
          required: false,
          schema: { type: 'string' }
        },
        StatusParam: {
          name: 'status',
          in: 'query',
          description: '状态筛选',
          required: false,
          schema: { type: 'string' }
        },
        IdParam: {
          name: 'id',
          in: 'path',
          description: '资源ID',
          required: true,
          schema: { type: 'integer' }
        }
      },
      responses: {
        UnauthorizedError: {
          description: '未授权 - 缺少或无效的 JWT Token',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                error: {
                  code: 'UNAUTHORIZED',
                  message: '未授权访问',
                  timestamp: '2026-04-14T16:34:44.958Z'
                }
              }
            }
          }
        },
        ForbiddenError: {
          description: '权限不足 - 需要管理员权限',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                error: {
                  code: 'FORBIDDEN',
                  message: '权限不足',
                  timestamp: '2026-04-14T16:34:44.958Z'
                }
              }
            }
          }
        },
        NotFoundError: {
          description: '资源不存在',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                error: {
                  code: 'NOT_FOUND',
                  message: '资源不存在',
                  timestamp: '2026-04-14T16:34:44.958Z'
                }
              }
            }
          }
        },
        ValidationError: {
          description: '请求参数验证失败',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                error: {
                  code: 'VALIDATION_ERROR',
                  message: '字段不能为空',
                  timestamp: '2026-04-14T16:34:44.958Z'
                }
              }
            }
          }
        },
        ServerError: {
          description: '服务器内部错误',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                error: {
                  code: 'INTERNAL_ERROR',
                  message: '服务器内部错误',
                  timestamp: '2026-04-14T16:34:44.958Z'
                }
              }
            }
          }
        }
      }
    },
    tags: [
      { name: 'Auth', description: '用户认证与授权' },
      { name: 'Users', description: '用户管理（管理员）' },
      { name: 'Customers', description: '客户信息管理' },
      { name: 'Products', description: '商品管理' },
      { name: 'Categories', description: '商品分类管理' },
      { name: 'Orders', description: '订单管理' },
      { name: 'Cart', description: '购物车操作' },
      { name: 'Coupons', description: '优惠券管理' },
      { name: 'Dashboard', description: '数据统计仪表盘' },
      { name: 'System', description: '系统设置与管理' },
      { name: 'Health', description: '健康检查与服务状态' }
    ]
  },
  apis: ['./routes/*.js']
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = { swaggerSpec, options };