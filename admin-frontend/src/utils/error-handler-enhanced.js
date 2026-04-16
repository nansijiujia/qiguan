/**
 * 增强版全局错误捕获器
 * 提供全面的运行时错误监控、收集和上报功能
 * @version 2.0
 */

import { reportErrorToServer } from '../services/error-reporter'
import { logAction } from './logger'

const isProduction = import.meta.env.PROD
const isDevelopment = import.meta.env.DEV

let errorQueue = []
let isFlushing = false
const MAX_QUEUE_SIZE = 50
const FLUSH_INTERVAL = 5000

function generateErrorId() {
  return `ERR_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
}

function formatErrorForLog(errorInfo) {
  return {
    ...errorInfo,
    errorId: generateErrorId(),
    env: isProduction ? 'production' : 'development',
    timestamp: new Date().toISOString()
  }
}

function addToQueue(errorInfo) {
  if (errorQueue.length < MAX_QUEUE_SIZE) {
    errorQueue.push(errorInfo)
  }
}

async function flushErrorQueue() {
  if (isFlushing || errorQueue.length === 0) return
  
  isFlushing = true
  const batch = [...errorQueue]
  errorQueue = []

  try {
    for (const error of batch) {
      await reportErrorToServer(error).catch(() => {})
    }
  } catch (e) {
    console.warn('[Error Handler] 批量上报失败:', e.message)
  } finally {
    isFlushing = false
  }
}

setInterval(flushErrorQueue, FLUSH_INTERVAL)

window.addEventListener('beforeunload', () => {
  if (errorQueue.length > 0) {
    navigator.sendBeacon('/api/v1/system/errors', JSON.stringify(errorQueue))
  }
})

export function initGlobalErrorHandler() {
  
  window.onerror = function(message, source, lineno, colno, error) {
    const errorInfo = formatErrorForLog({
      type: 'JAVASCRIPT_ERROR',
      message: String(message),
      source: source || '',
      line: lineno || 0,
      column: colno || 0,
      stack: error?.stack || null,
      url: window.location.href,
      userAgent: navigator.userAgent,
      referrer: document.referrer,
      screenResolution: `${screen.width}x${screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`
    })

    console.error('[Global Error] JavaScript运行时错误:', {
      message: errorInfo.message,
      location: `${errorInfo.source}:${errorInfo.line}:${errorInfo.column}`,
      errorId: errorInfo.errorId
    })

    if (isDevelopment && message) {
      console.groupCollapsed('%c[详细堆栈信息]', 'color: #f56c6c; font-weight: bold;')
      console.log(error?.stack || 'No stack trace available')
      console.groupEnd()
    }

    addToQueue(errorInfo)
    logAction('error', `JavaScript错误: ${message}`, { errorId: errorInfo.errorId })

    return true
  }

  window.addEventListener('unhandledrejection', function(event) {
    const reason = event.reason
    
    const errorInfo = formatErrorForLog({
      type: 'UNHANDLED_PROMISE_REJECTION',
      message: reason?.message || String(reason),
      stack: reason?.stack || null,
      reasonType: reason?.constructor?.name || typeof reason,
      reason: String(reason).substring(0, 500),
      url: window.location.href,
      userAgent: navigator.userAgent
    })

    console.error('[Global Error] 未捕获的Promise拒绝:', {
      message: errorInfo.message,
      reasonType: errorInfo.reasonType,
      errorId: errorInfo.errorId
    })

    if (isDevelopment) {
      console.warn('[Promise Rejection Details]', reason)
    }

    addToQueue(errorInfo)
    logAction('error', `Promise未处理拒绝: ${errorInfo.message}`, { 
      errorId: errorInfo.errorId,
      reasonType: errorInfo.reasonType
    })

    if (!isDevelopment) {
      event.preventDefault()
    }
  })

  window.addEventListener('error', function(event) {
    if (!event.target || !event.target.tagName) return

    const targetTag = event.target.tagName.toUpperCase()
    
    if (['IMG', 'SCRIPT', 'LINK', 'VIDEO', 'AUDIO', 'SOURCE'].includes(targetTag)) {
      const errorInfo = formatErrorForLog({
        type: 'RESOURCE_LOAD_ERROR',
        tagName: targetTag,
        src: event.target.src || event.target.href || '',
        url: window.location.href,
        outerHTML: event.target.outerHTML?.substring(0, 200)
      })

      console.warn(`[Resource Error] 资源加载失败 [${targetTag}]:`, {
        src: errorInfo.src,
        errorId: errorInfo.errorId
      })

      addToQueue(errorInfo)
      logAction('warning', `资源加载失败: ${targetTag} - ${errorInfo.src}`, {
        errorId: errorInfo.errorId
      })
    }
  }, true)

  window.addEventListener('securitypolicyviolation', function(event) {
    const errorInfo = formatErrorForLog({
      type: 'CSP_VIOLATION',
      violatedDirective: event.violatedDirective,
      blockedURI: event.blockedURI || '',
      sourceFile: event.sourceFile || '',
      lineNumber: event.lineNumber || 0,
      columnNumber: event.columnNumber || 0
    })

    console.warn('[CSP Violation] 安全策略违规:', {
      directive: errorInfo.violatedDirective,
      blockedURI: errorInfo.blockedURI,
      errorId: errorInfo.errorId
    })

    addToQueue(errorInfo)
    logAction('warning', `CSP违规: ${event.violatedDirective}`)
  })

  let consoleErrorCount = 0
  const originalConsoleError = console.error
  console.error = function(...args) {
    consoleErrorCount++
    
    if (consoleErrorCount <= 100) {
      const errorInfo = formatErrorForLog({
        type: 'CONSOLE_ERROR',
        message: args.map(arg => {
          if (arg instanceof Error) return arg.message
          return typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        }).join(' '),
        argsCount: args.length
      })

      if (consoleErrorCount % 10 === 1) {
        addToQueue(errorInfo)
      }
    }

    originalConsoleError.apply(console, args)
  }

  console.log('[Error Handler] ✅ 全局错误捕获系统已初始化')
  console.log(`[Error Handler] 环境: ${isProduction ? '生产' : '开发'}模式`)
}

export function setupVueErrorHandler(app) {
  
  app.config.errorHandler = (err, instance, info) => {
    const errorInfo = formatErrorForLog({
      type: 'VUE_COMPONENT_ERROR',
      message: err.message,
      stack: err.stack,
      componentName: instance?.$options?.name || instance?.$options?.__name || 'AnonymousComponent',
      props: instance?.$props ? JSON.stringify(instance.$props).substring(0, 300) : null,
      info: info || '',
      routePath: window.location.pathname
    })

    console.error('[Vue Error] 组件渲染/执行错误:', {
      component: errorInfo.componentName,
      message: errorInfo.message,
      info: errorInfo.info,
      errorId: errorInfo.errorId
    })

    if (isDevelopment) {
      console.groupCollapsed('%c[Vue组件错误详情]', 'color: #e6a23c; font-weight: bold;')
      console.log('Error Object:', err)
      console.log('Component Instance:', instance)
      console.log('Error Info:', info)
      console.log('Stack Trace:', err.stack)
      console.groupEnd()
    }

    addToQueue(errorInfo)
    logAction('error', `Vue组件错误 [${errorInfo.componentName}]: ${err.message}`, {
      errorId: errorInfo.errorId,
      component: errorInfo.componentName,
      info: info
    })
  }

  app.config.warningHandler = (msg, instance, trace) => {
    const shouldWarn = isDevelopment || 
                       /error|fail|deprecated|invalid/i.test(msg)

    if (shouldWarn) {
      const warningInfo = formatErrorForLog({
        type: 'VUE_WARNING',
        message: msg,
        componentName: instance?.$options?.name || 'Unknown',
        trace: trace || ''
      })

      console.warn('[Vue Warning]', {
        message: msg,
        component: warningInfo.componentName,
        trace: trace
      })

      logAction('warning', `Vue警告: ${msg}`, {
        component: warningInfo.componentName
      })
    }
  }

  console.log('[Error Handler] ✅ Vue错误处理器已配置')
}

export function getErrorStats() {
  return {
    queueLength: errorQueue.length,
    maxQueueSize: MAX_QUEUE_SIZE,
    environment: isProduction ? 'production' : 'development'
  }
}

export function forceFlushErrors() {
  return flushErrorQueue()
}

if (typeof window !== 'undefined') {
  window.__ERROR_HANDLER_STATS = getErrorStats
  window.__FORCE_FLUSH_ERRORS = forceFlushErrors
}
