import service from '@/utils/request'

const ERROR_REPORT_API = '/api/v1/logs'
const BATCH_SIZE = 5
const BATCH_INTERVAL = 30000
const RATE_LIMIT_WINDOW = 60000
const MAX_ERRORS_PER_MINUTE = 5

const STORAGE_KEY = 'error_report_queue'
const RATE_LIMIT_KEY_PREFIX = 'error_rate_limit_'

let errorQueue = []
let flushTimer = null
let isFlushing = false
const rateLimitMap = new Map()

function getErrorKey(errorData) {
  return `${errorData.message}_${errorData.component || 'unknown'}`
}

function isRateLimited(errorKey) {
  const now = Date.now()
  const lastReportTime = rateLimitMap.get(errorKey)
  
  if (!lastReportTime) return false
  
  if (now - lastReportTime < RATE_LIMIT_WINDOW) {
    const countKey = `${RATE_LIMIT_KEY_PREFIX}${errorKey}_count`
    const count = parseInt(localStorage.getItem(countKey) || '0', 10)
    return count >= MAX_ERRORS_PER_MINUTE
  }
  
  return false
}

function updateRateLimit(errorKey) {
  const now = Date.now()
  rateLimitMap.set(errorKey, now)
  
  const countKey = `${RATE_LIMIT_KEY_PREFIX}${errorKey}_count`
  const currentCount = parseInt(localStorage.getItem(countKey) || '0', 10)
  localStorage.setItem(countKey, (currentCount + 1).toString())
  
  setTimeout(() => {
    const newCount = parseInt(localStorage.getItem(countKey) || '0', 10) - 1
    if (newCount <= 0) {
      localStorage.removeItem(countKey)
    } else {
      localStorage.setItem(countKey, newCount.toString())
    }
  }, RATE_LIMIT_WINDOW)
}

function loadQueueFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      errorQueue = JSON.parse(stored)
      console.debug(`[ErrorReporter] 从本地存储加载了 ${errorQueue.length} 条待上报错误`)
    }
  } catch (err) {
    console.warn('[ErrorReporter] 加载本地错误队列失败:', err)
    errorQueue = []
  }
}

function saveQueueToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(errorQueue))
  } catch (err) {
    console.warn('[ErrorReporter] 保存错误队列到本地失败:', err)
  }
}

function clearQueueFromStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (err) {
    console.warn('[ErrorReporter] 清除本地错误队列失败:', err)
  }
}

async function flushErrors() {
  if (isFlushing || errorQueue.length === 0) return
  
  isFlushing = true
  
  try {
    const errorsToSend = errorQueue.splice(0, BATCH_SIZE)
    
    if (errorsToSend.length === 0) {
      isFlushing = false
      return
    }

    await service.post(ERROR_REPORT_API, {
      type: 'frontend_error',
      errors: errorsToSend,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    })

    console.debug(`[ErrorReporter] 成功上报 ${errorsToSend.length} 条错误`)

    if (errorQueue.length > 0) {
      scheduleFlush()
    } else {
      clearQueueFromStorage()
      if (flushTimer) {
        clearTimeout(flushTimer)
        flushTimer = null
      }
    }
  } catch (err) {
    console.warn('[ErrorReporter] 错误上报失败，已回退到队列:', err.message)
    errorQueue.forEach(errItem => {
      if (!errorQueue.find(e => e.timestamp === errItem.timestamp && e.message === errItem.message)) {
        errorQueue.push(errItem)
      }
    })
    saveQueueToStorage()
  } finally {
    isFlushing = false
  }
}

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer)
  
  flushTimer = setTimeout(() => {
    flushErrors()
  }, BATCH_INTERVAL)
}

function setupOnlineListener() {
  window.addEventListener('online', () => {
    console.debug('[ErrorReporter] 网络恢复，尝试重新上报')
    setTimeout(() => {
      flushErrors()
    }, 1000)
  })
}

loadQueueFromStorage()
setupOnlineListener()

if (errorQueue.length > 0) {
  scheduleFlush()
}

export async function reportErrorToServer(errorData) {
  if (!errorData || !errorData.message) {
    console.warn('[ErrorReporter] 无效的错误数据，跳过上报')
    return
  }

  const errorKey = getErrorKey(errorData)

  if (isRateLimited(errorKey)) {
    console.debug(`[ErrorReporter] 错误已被限流: ${errorKey}`)
    return
  }

  updateRateLimit(errorKey)

  const enrichedError = {
    ...errorData,
    id: generateErrorId(),
    reportedAt: new Date().toISOString(),
    environment: import.meta.env.MODE,
    appVersion: import.meta.env.VITE_APP_VERSION || 'unknown'
  }

  errorQueue.push(enrichedError)
  saveQueueToStorage()

  console.debug(`[ErrorReporter] 错误已加入队列，当前队列长度: ${errorQueue.length}`)

  if (errorQueue.length >= BATCH_SIZE) {
    await flushErrors()
  } else if (!flushTimer) {
    scheduleFlush()
  }
}

export function getErrorQueueStatus() {
  return {
    queueLength: errorQueue.length,
    isFlushing,
    rateLimitedKeys: Array.from(rateLimitMap.keys()).length
  }
}

export async function forceFlush() {
  await flushErrors()
}

export function clearErrorQueue() {
  errorQueue = []
  clearQueueFromStorage()
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
}

export function setBatchConfig({ batchSize, batchInterval }) {
  if (batchSize) BATCH_SIZE = batchSize
  if (batchInterval) BATCH_INTERVAL = batchInterval
}

function generateErrorId() {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}
