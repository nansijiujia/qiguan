/**
 * 域名配置模块
 * 统一管理所有域名和URL配置，避免硬编码
 */

require('dotenv').config({ path: '.env.production' });

// 域名配置 - 从环境变量读取，提供默认值
const DOMAIN_CONFIG = {
  // 主域名（小程序API）
  primary: process.env.DOMAIN_PRIMARY || 'qimengzhiyue.cn',
  
  // 子域名（后台管理系统）
  admin: process.env.DOMAIN_ADMIN || 'admin.qimengzhiyue.cn',
  
  // API子域名（可选）
  api: process.env.DOMAIN_API || 'api.qimengzhiyue.cn',
  
  // 服务器IP（仅用于内部引用，不应暴露给用户）
  serverIp: process.env.SERVER_IP || '101.34.39.231',
  
  // 服务器端口
  port: parseInt(process.env.PORT) || 3000,
  
  // 协议
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
  // 健康检查可以使用HTTP（内部调用）
  return `http://${DOMAIN_CONFIG.serverIp}:${DOMAIN_CONFIG.port}/api/v1/health`;
}

function getRootHealthCheckUrl() {
  // 根路径健康检查
  return `http://${DOMAIN_CONFIG.serverIp}:${DOMAIN_CONFIG.port}/health`;
}

// CORS配置
const CORS_CONFIG = {
  allowedOrigins: [
    `${DOMAIN_CONFIG.protocol}://${DOMAIN_CONFIG.primary}`,
    `${DOMAIN_CONFIG.protocol}://${DOMAIN_CONFIG.admin}`,
    `${DOMAIN_CONFIG.protocol}://www.${DOMAIN_CONFIG.primary}`,
    'http://localhost:5173',
    'http://localhost:3000',
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
  CORS_CONFIG
};
