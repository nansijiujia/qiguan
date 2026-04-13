#!/usr/bin/env node

/**
 * API 路径配置检查脚本
 * 
 * 用途: 在部署前自动检测前端配置文件的一致性
 *       防止因路径配置错误导致的 405/404 问题
 * 
 * 使用方法: node scripts/check-api-config.js
 * 
 * 检查项:
 * 1. .env.production 中 VITE_API_BASE_URL 配置
 * 2. vite.config.js 中 base 配置
 * 3. request.js 中 baseURL 配置
 * 4. API 接口定义中的路径格式
 * 5. 配置之间的一致性验证
 */

const fs = require('fs')
const path = require('path')

// 颜色输出工具
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

// 项目根目录（脚本所在位置的上两级）
const PROJECT_ROOT = path.resolve(__dirname, '..')
const FRONTEND_DIR = path.join(PROJECT_ROOT, 'qiguanqianduan')

// 正确的配置值
const EXPECTED_CONFIG = {
  VITE_API_BASE_URL: '/api',
  VITE_BASE: '/admin',
  BACKEND_PREFIX: '/api/v1'
}

// 存储检查结果
const results = {
  passed: [],
  warnings: [],
  errors: [],
  info: []
}

/**
 * 读取文件内容
 */
function readFile(filePath) {
  try {
    const fullPath = path.resolve(FRONTEND_DIR, filePath)
    if (!fs.existsSync(fullPath)) {
      return { exists: false, content: null }
    }
    const content = fs.readFileSync(fullPath, 'utf-8')
    return { exists: true, content }
  } catch (error) {
    return { exists: false, content: null, error: error.message }
  }
}

/**
 * 从 .env 文件中提取变量值
 */
function parseEnvFile(content, variableName) {
  const regex = new RegExp(`^${variableName}=(.+)$`, 'm')
  const match = content.match(regex)
  return match ? match[1].trim().replace(/^["']|["']$/g, '') : null
}

/**
 * 从 JS 文件中提取配置值
 */
function extractJsConfig(content, pattern) {
  const regex = new RegExp(pattern)
  const match = content.match(regex)
  return match ? match[1].replace(/^["']|["']$/g, '') : null
}

/**
 * 检查 .env.production 配置
 */
function checkEnvProduction() {
  log('cyan', '\n📋 检查 1: .env.production 配置')
  
  const { exists, content } = readFile('.env.production')
  
  if (!exists) {
    results.errors.push('❌ .env.production 文件不存在')
    return
  }
  
  log('info', `   文件位置: ${path.join(FRONTEND_DIR, '.env.production')}`)
  
  // 检查 VITE_API_BASE_URL
  const apiBaseUrl = parseEnvFile(content, 'VITE_API_BASE_URL')
  
  if (!apiBaseUrl) {
    results.errors.push('❌ VITE_API_BASE_URL 未定义')
    return
  }
  
  log('info', `   VITE_API_BASE_URL = ${apiBaseUrl}`)
  
  // 验证值是否正确
  if (apiBaseUrl === EXPECTED_CONFIG.VITE_API_BASE_URL) {
    results.passed.push('✅ VITE_API_BASE_URL 配置正确 (/api)')
  } else {
    // 检查常见错误模式
    if (apiBaseUrl.includes('/admin')) {
      results.errors.push(
        `❌ VITE_API_BASE_URL 包含非法 /admin 前缀: ${apiBaseUrl}\n` +
        `   当前值: ${apiBaseUrl}\n` +
        `   应修改为: ${EXPECTED_CONFIG.VITE_API_BASE_URL}\n` +
        `   ⚠️  这会导致所有 API 请求路径错误，引发 405/404 错误`
      )
    } else {
      results.warnings.push(
        `⚠️  VITE_API_BASE_URL 值异常: ${apiBaseUrl}\n` +
        `   建议值: ${EXPECTED_CONFIG.VITE_API_BASE_URL}`
      )
    }
  }
  
  // 检查其他环境变量
  const appTitle = parseEnvFile(content, 'VITE_APP_TITLE')
  const appVersion = parseEnvFile(content, 'VITE_APP_VERSION')
  
  if (appTitle) log('info', `   VITE_APP_TITLE = ${appTitle}`)
  if (appVersion) log('info', `   VITE_APP_VERSION = ${appVersion}`)
}

/**
 * 检查 vite.config.js 配置
 */
function checkViteConfig() {
  log('cyan', '\n📋 检查 2: vite.config.js 配置')
  
  const { exists, content } = readFile('vite.config.js')
  
  if (!exists) {
    results.errors.push('❌ vite.config.js 文件不存在')
    return
  }
  
  log('info', `   文件位置: ${path.join(FRONTEND_DIR, 'vite.config.js')}`)
  
  // 提取 base 配置
  const baseValue = extractJsConfig(content, /base:\s*['"]([^'"]+)['"]/)
  
  if (!baseValue) {
    results.warnings.push('⚠️  未找到 vite.config.js 中的 base 配置')
    return
  }
  
  log('info', `   base = ${baseValue}`)
  
  // 验证 base 值
  if (baseValue === EXPECTED_CONFIG.VITE_BASE) {
    results.passed.push(`✅ vite.config.js base 配置正确 (${baseValue})`)
  } else {
    results.warnings.push(
      `⚠️  vite.config.js base 值为 ${baseValue}，预期 ${EXPECTED_CONFIG.VITE_BASE}`
    )
  }
  
  // 检查 proxy 配置
  const hasProxyConfig = content.includes("proxy:")
  if (hasProxyConfig) {
    const proxyTarget = extractJsConfig(content, /target:\s*(?:env\.VITE_API_BASE_URL\|\|)?['"]([^'"]+)['"]/)
    if (proxyTarget) {
      log('info', `   dev server proxy target = ${proxyTarget}`)
      results.info.push(`ℹ️  开发环境代理目标: ${proxyTarget}`)
    }
    results.passed.push('✅ 开发服务器代理配置已设置')
  }
}

/**
 * 检查 request.js 配置
 */
function checkRequestJs() {
  log('cyan', '\n📋 检查 3: src/utils/request.js 配置')
  
  const { exists, content } = readFile('src/utils/request.js')
  
  if (!exists) {
    results.errors.push('❌ src/utils/request.js 文件不存在')
    return
  }
  
  log('info', `   文件位置: ${path.join(FRONTEND_DIR, 'src/utils/request.js')}`)
  
  // 检查 baseURL 配置
  const hasEnvVarUsage = content.includes('import.meta.env.VITE_API_BASE_URL')
  const hasHardcodedBaseURL = content.match(/baseURL:\s*['"]([^'"]+)['"]/)
  
  if (hasEnvVarUsage) {
    results.passed.push('✅ request.js 使用环境变量 VITE_API_BASE_URL')
    
    // 检查是否有默认值
    const defaultBaseURL = extractJsConfig(content, /VITE_API_BASE_URL\|\|['"]?([^'"]*)['"]?/)
    if (defaultBaseURL && defaultBaseURL !== '') {
      results.info.push(`ℹ️  baseURL 默认值: ${defaultBaseURL || '(空字符串)'}`)
    }
  } else if (hasHardcodedBaseURL) {
    const hardcodedValue = hasHardcodedBaseURL[1]
    results.warnings.push(
      `⚠️  request.js 使用硬编码 baseURL: ${hardcodedValue}\n` +
      `   建议: 改为使用 import.meta.env.VITE_API_BASE_URL`
    )
  } else {
    results.warnings.push('⚠️  未在 request.js 中找到 baseURL 配置')
  }
  
  // 检查请求拦截器是否会修改 URL
  const interceptorModifiesUrl = content.match(/config\.url\s*=.*config\.url/)
  if (interceptorModifiesUrl) {
    results.errors.push(
      '❌ 请求拦截器中检测到 URL 修改操作\n' +
      '   这可能导致路径拼接错误，请检查拦截器逻辑'
    )
  } else {
    results.passed.push('✅ 请求拦截器未修改 URL（正确行为）')
  }
}

/**
 * 检查 API 接口定义
 */
function checkApiDefinitions() {
  log('cyan', '\n📋 检查 4: src/api/index.js 接口定义')
  
  const { exists, content } = readFile('src/api/index.js')
  
  if (!exists) {
    results.errors.push('❌ src/api/index.js 文件不存在')
    return
  }
  
  log('info', `   文件位置: ${path.join(FRONTEND_DIR, 'src/api/index.js')}`)
  
  // 检查是否有错误的完整路径（包含 /api 或 /admin）
  const wrongPatterns = [
    { pattern: /['"]\/api\/v1\//, desc: '包含 /api/v1/ 的完整路径' },
    { pattern: /['"]\/admin\/api\//, desc: '包含 /admin/api/ 的错误路径' },
    { pattern: /['"]\/admin\/v1\//, desc: '包含 /admin/v1/ 的错误路径' }
  ]
  
  let hasWrongPath = false
  
  wrongPatterns.forEach(({ pattern, desc }) => {
    if (pattern.test(content)) {
      results.errors.push(`❌ 发现错误的 API 路径格式: ${desc}\n   这会导致双重前缀问题`)
      hasWrongPath = true
      
      // 提取具体的错误行
      const lines = content.split('\n')
      lines.forEach((line, index) => {
        if (pattern.test(line)) {
          results.info.push(`   第 ${index + 1} 行: ${line.trim()}`)
        }
      })
    }
  })
  
  if (!hasWrongPath) {
    results.passed.push('✅ API 接口定义路径格式正确（从 /v1/ 开始）')
  }
  
  // 统计接口数量
  const apiCount = (content.match(/request\.(get|post|put|delete)\(/g) || []).length
  log('info', `   共发现 ${apiCount} 个 API 调用`)
}

/**
 * 检查路由配置
 */
function checkRouterConfig() {
  log('cyan', '\n📋 检查 5: Vue Router 配置')
  
  const { exists, content } = readFile('src/router/index.js')
  
  if (!exists) {
    results.warnings.push('⚠️  src/router/index.js 不存在，跳过检查')
    return
  }
  
  log('info', `   文件位置: ${path.join(FRONTEND_DIR, 'src/router/index.js')}`)
  
  // 检查 createWebHistory 参数
  const historyBase = extractJsConfig(content, /createWebHistory\(['"]([^'"]+)['"]\)/)
  
  if (historyBase) {
    log('info', `   Router base = ${historyBase}`)
    
    if (historyBase === EXPECTED_CONFIG.VITE_BASE) {
      results.passed.push(`✅ Vue Router base 与 vite.config.js 一致 (${historyBase})`)
    } else {
      results.warnings.push(
        `⚠️  Router base (${historyBase}) 与 vite.base (${EXPECTED_CONFIG.VITE_BASE}) 不一致`
      )
    }
  } else {
    results.warnings.push('⚠️  未找到 createWebHistory 配置')
  }
}

/**
 * 执行一致性验证
 */
function checkConsistency() {
  log('cyan', '\n📋 检查 6: 配置一致性验证')
  
  // 读取所有配置
  const envProd = readFile('.env.production')
  const viteConf = readFile('vite.config.js')
  const requestConf = readFile('src/utils/request.js')
  
  const apiBaseUrlFromEnv = envProd.exists ? 
    parseEnvFile(envProd.content, 'VITE_API_BASE_URL') : null
  
  const viteBase = viteConf.exists ?
    extractJsConfig(viteConf.content, /base:\s*['"]([^'"]+)['"]/): null
  
  // 验证关键规则
  if (apiBaseUrlFromEnv && viteBase) {
    // 规则 1: API_BASE_URL 不应包含 vite base
    if (apiBaseUrlFromEnv.includes(viteBase)) {
      results.errors.push(
        `❌ 一致性错误: VITE_API_BASE_URL (${apiBaseUrlFromEnv}) 包含 vite base (${viteBase})\n` +
        `   这是导致 405 错误的根本原因！\n` +
        `   解决方案: 将 VITE_API_BASE_URL 改为 /api`
      )
    } else {
      results.passed.push('✅ VITE_API_BASE_URL 与 vite base 无冲突')
    }
    
    // 规则 2: 两者不应相同
    if (apiBaseUrlFromEnv === viteBase) {
      results.warnings.push(
        `⚠️  VITE_API_BASE_URL 和 vite base 相同 (${apiBaseUrlFromEnv})\n` +
        `   通常它们应该是不同的值`
      )
    }
  }
  
  // 验证请求链路完整性
  log('info', '\n   📊 完整请求链路验证:')
  log('info', `      浏览器 URL: https://admin.qimengzhiyue.cn${viteBase || '/admin'}/login`)
  log('info', `      API 请求基础: ${apiBaseUrlFromEnv || '/api'}`)
  log('info', `      实际请求示例: https://admin.qimengzhiyue.cn${apiBaseUrlFromEnv || '/api'}/v1/auth/login`)
  log('info', `      后端路由匹配: ${EXPECTED_CONFIG.BACKEND_PREFIX}/auth/login`)
  
  if (apiBaseUrlFromEnv === EXPECTED_CONFIG.VITE_API_BASE_URL) {
    results.passed.push('✅ 请求链路完整且正确')
  }
}

/**
 * 生成检查报告
 */
function generateReport() {
  console.log('\n' + '='.repeat(70))
  log('blue', '🔍 API 路径配置检查报告')
  log('blue', `   检查时间: ${new Date().toLocaleString('zh-CN')}`)
  log('blue', `   项目路径: ${PROJECT_ROOT}`)
  console.log('='.repeat(70))
  
  // 执行所有检查
  checkEnvProduction()
  checkViteConfig()
  checkRequestJs()
  checkApiDefinitions()
  checkRouterConfig()
  checkConsistency()
  
  // 输出结果摘要
  console.log('\n' + '='.repeat(70))
  log('blue', '📊 检查结果摘要')
  console.log('='.repeat(70))
  
  console.log('\n✅ 通过项:')
  if (results.passed.length > 0) {
    results.passed.forEach(item => log('green', `   ${item}`))
  } else {
    log('yellow', '   无')
  }
  
  if (results.warnings.length > 0) {
    console.log('\n⚠️  警告:')
    results.warnings.forEach(item => log('yellow', `   ${item}`))
  }
  
  if (results.errors.length > 0) {
    console.log('\n❌ 错误:')
    results.errors.forEach(item => log('red', `   ${item}`))
  }
  
  if (results.info.length > 0) {
    console.log('\nℹ️  信息:')
    results.info.forEach(item => log('cyan', `   ${item}`))
  }
  
  // 最终结论
  console.log('\n' + '='.repeat(70))
  const totalIssues = results.errors.length + results.warnings.length
  
  if (results.errors.length === 0) {
    log('green', '🎉 配置检查通过！所有关键配置项正确，可以安全部署。')
    console.log('='.repeat(70) + '\n')
    process.exit(0)
  } else {
    log('red', `🚨 发现 ${results.errors.length} 个严重错误和 ${results.warnings.length} 个警告！`)
    log('red', '请修复上述错误后再进行部署。\n')
    
    // 提供修复建议
    if (results.errors.some(e => e.includes('/admin'))) {
      log('yellow', '\n💡 快速修复指南:')
      log('yellow', '   1. 编辑 qiguanqianduan/.env.production')
      log('yellow', '   2. 将 VITE_API_BASE_URL=/admin/api 改为 VITE_API_BASE_URL=/api')
      log('yellow', '   3. 重新运行 npm run build')
      log('yellow', '   4. 再次运行本脚本验证\n')
    }
    
    console.log('='.repeat(70) + '\n')
    process.exit(1)
  }
}

// 主程序入口
try {
  generateReport()
} catch (error) {
  log('red', `\n💥 脚本执行出错: ${error.message}`)
  log('red', error.stack)
  process.exit(2)
}
