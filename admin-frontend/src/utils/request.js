import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import router from '@/router'
import { showError } from './error-handler'

const DEFAULT_TIMEOUT = 10000
const UPLOAD_TIMEOUT = 30000
const MAX_CONCURRENT_REQUESTS = 5
const CACHE_DURATION = 5 * 60 * 1000 // 5分钟缓存过期时间
const LOCAL_STORAGE_CACHE_PREFIX = 'api_cache_'

const pendingRequests = new Set()
let activeRequestCount = 0
const requestQueue = []

const requestCache = new Map()

const retryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  retryableMethods: ['get'],
  retryableStatusCodes: [500, 502, 503, 504],
  retryableErrorCodes: ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ERR_NETWORK']
}

const ERROR_CODE_MAP = {
  400: '请求参数错误',
  401: '未授权，请重新登录',
  403: '权限不足',
  404: '请求的资源不存在',
  409: '数据冲突，请刷新后重试',
  500: '服务器内部错误，请稍后重试',
  502: '服务重启中，请稍后重试',
  503: '服务暂时不可用，请稍后重试',
  504: '网关超时，服务暂时不可用'
}

const service = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: DEFAULT_TIMEOUT,
  headers: {
    'Content-Type': 'application/json;charset=UTF-8'
  }
})

function generateCacheKey(config) {
  const paramsHash = config.params ? JSON.stringify(config.params) : ''
  return `${LOCAL_STORAGE_CACHE_PREFIX}${config.method}_${config.url}_${paramsHash}`
}

function getFromMemoryCache(cacheKey) {
  const cached = requestCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data
  }
  if (cached) {
    requestCache.delete(cacheKey)
  }
  return null
}

function setToMemoryCache(cacheKey, data) {
  requestCache.set(cacheKey, {
    data,
    timestamp: Date.now()
  })
}

function getFromLocalStorage(cacheKey) {
  try {
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      const parsed = JSON.parse(cached)
      if (Date.now() - parsed.timestamp < CACHE_DURATION) {
        return parsed.data
      }
      localStorage.removeItem(cacheKey)
    }
  } catch (e) {
    console.warn('[LocalStorage Cache] Failed to read cache:', e)
  }
  return null
}

function setToLocalStorage(cacheKey, data) {
  try {
    localStorage.setItem(cacheKey, JSON.stringify({
      data,
      timestamp: Date.now()
    }))
  } catch (e) {
    console.warn('[LocalStorage Cache] Failed to write cache:', e)
    clearOldestCacheEntries()
    try {
      localStorage.setItem(cacheKey, JSON.stringify({
        data,
        timestamp: Date.now()
      }))
    } catch (e2) {
      console.error('[LocalStorage Cache] Cache storage is full:', e2)
    }
  }
}

function clearOldestCacheEntries() {
  try {
    const keysToRemove = []
    let oldestTimestamp = Infinity
    let oldestKey = null

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(LOCAL_STORAGE_CACHE_PREFIX)) {
        try {
          const item = JSON.parse(localStorage.getItem(key))
          if (item.timestamp < oldestTimestamp) {
            oldestTimestamp = item.timestamp
            oldestKey = key
          }
        } catch (e) {}
      }
    }

    if (oldestKey) {
      localStorage.removeItem(oldestKey)
      console.debug(`[LocalStorage Cache] Removed oldest cache entry: ${oldestKey}`)
    }
  } catch (e) {
    console.error('[LocalStorage Cache] Failed to clear old entries:', e)
  }
}

async function waitForSlot() {
  if (activeRequestCount < MAX_CONCURRENT_REQUESTS) {
    activeRequestCount++
    return true
  }

  return new Promise((resolve) => {
    requestQueue.push(resolve)
  })
}

function releaseRequestSlot() {
  activeRequestCount--
  if (requestQueue.length > 0 && activeRequestCount < MAX_CONCURRENT_REQUESTS) {
    const nextRequest = requestQueue.shift()
    activeRequestCount++
    nextRequest(true)
  }
}

function getRetryDelay(attemptNumber) {
  const delay = retryConfig.baseDelay * Math.pow(2, attemptNumber - 1)
  const jitter = Math.random() * 200
  return delay + jitter
}

function shouldRetryBasedOnError(error) {
  if (!error.config || error.config.method !== 'get') {
    return false
  }

  if (!error.response) {
    const errorCode = error.code || ''
    const errorMessage = error.message || ''

    const isNetworkError = retryConfig.retryableErrorCodes.some(code =>
      errorCode.includes(code) || errorMessage.toLowerCase().includes(code.toLowerCase())
    )

    const isTimeoutError = errorCode === 'ECONNABORTED' ||
                          errorMessage.toLowerCase().includes('timeout')

    return isNetworkError || isTimeoutError
  }

  const status = error.response.status
  return retryConfig.retryableStatusCodes.includes(status)
}

async function executeWithRetry(config) {
  let lastError = null

  for (let attempt = 0; attempt <= retryConfig.maxAttempts; attempt++) {
    try {
      if (attempt > 0) {
        config.retryAttempts = attempt
        const delay = getRetryDelay(attempt)
        console.warn(`[Retry] Attempt ${attempt}/${retryConfig.maxAttempts} for ${config.url} after ${Math.round(delay)}ms`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }

      return await service(config)
    } catch (error) {
      lastError = error

      if (attempt === retryConfig.maxAttempts || !shouldRetryBasedOnError(error)) {
        console.error(`[Retry Failed] All attempts exhausted or non-retryable error for ${config.url}`, {
          attempts: attempt + 1,
          error: error.message,
          code: error.code
        })
        throw error
      }

      console.warn(`[Retry] Attempt ${attempt + 1} failed for ${config.url}, will retry...`, {
        error: error.message,
        code: error.code,
        status: error.response?.status
      })
    }
  }

  throw lastError
}

function getErrorMessage(error) {
  if (!error.response) {
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return '请求超时，请检查网络连接'
    }

    const networkErrors = {
      ECONNREFUSED: '后端服务未启动或端口不可达',
      ENOTFOUND: '无法解析服务器地址 (DNS解析失败)',
      ERR_NETWORK: '网络连接中断，请检查网络设置',
      ECONNRESET: '网络连接被重置'
    }

    return networkErrors[error.code] || '网络连接失败，请检查网络'
  }

  const status = error.response.status
  const serverMessage = error.response.data?.error?.message
  const serverCode = error.response.data?.error?.code

  if (ERROR_CODE_MAP[status]) {
    return ERROR_CODE_MAP[status]
  }

  if (serverMessage) {
    return serverMessage
  }

  return `请求失败(${status})`
}

function getErrorCode(error) {
  if (error.response) {
    return error.response.status
  }

  if (error.code) {
    return error.code
  }

  return 'UNKNOWN_ERROR'
}

service.interceptors.request.use(
  async (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    if (!config.signal) {
      const controller = new AbortController()
      config.signal = controller.signal
      config._abortController = controller
    }

    if (config.isUpload || config.url?.includes('/upload')) {
      config.timeout = UPLOAD_TIMEOUT
    }

    if (config.method === 'get' && config.cache !== false) {
      const cacheKey = generateCacheKey(config)

      const memoryCachedData = getFromMemoryCache(cacheKey)
      if (memoryCachedData !== null) {
        console.debug(`[Memory Cache Hit] ${config.url}`)
        return Promise.resolve({
          data: memoryCachedData,
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          cached: true,
          fromMemoryCache: true
        })
      }

      const localStorageCachedData = getFromLocalStorage(cacheKey)
      if (localStorageCachedData !== null) {
        console.debug(`[LocalStorage Cache Hit] ${config.url}`)
        setToMemoryCache(cacheKey, localStorageCachedData)
        return Promise.resolve({
          data: localStorageCachedData,
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          cached: true,
          fromLocalStorageCache: true
        })
      }

      config._cacheKey = cacheKey
    }

    await waitForSlot()
    pendingRequests.add(config)

    config.metadata = { startTime: Date.now() }
    config.retryAttempts = config.retryAttempts || 0

    return config
  },
  (error) => {
    console.error('Request error:', error)
    releaseRequestSlot()
    return Promise.reject(error)
  }
)

service.interceptors.response.use(
  (response) => {
    releaseRequestSlot()
    pendingRequests.delete(response.config)

    if (response.cached) {
      return response.data
    }

    const duration = Date.now() - response.config.metadata.startTime
    console.debug(`[API Response] ${response.config.method.toUpperCase()} ${response.config.url} (${duration}ms)`)

    const res = response.data

    if (response.config._cacheKey && response.config.cache !== false) {
      setToMemoryCache(response.config._cacheKey, res)
      setToLocalStorage(response.config._cacheKey, res)
    }

    if (['post', 'put', 'delete', 'patch'].includes(response.config.method)) {
      invalidateRelatedCaches(response.config.url)
    }

    if (res.success === false) {
      const errorCode = res.error?.code || 'UNKNOWN'
      const errorMsg = res.error?.message || '请求失败'

      console.warn(`[API Error] ${errorCode}: ${errorMsg}`, {
        url: response.config.url,
        method: response.config.method,
        status: response.status,
        data: res
      })

      switch (errorCode) {
        case 'UNAUTHORIZED':
        case 'TOKEN_EXPIRED':
          handleUnauthorized()
          break
        case 'FORBIDDEN':
          showError({ code: 403, message: '权限不足，无法执行此操作' })
          break
        default:
          if (errorCode === 'CONFLICT') {
            ElMessage.warning(errorMsg)
          } else {
            showError({ message: errorMsg })
          }
      }

      return Promise.reject(new Error(errorMsg))
    }

    return res
  },
  async (error) => {
    if (error.config) {
      releaseRequestSlot()
      pendingRequests.delete(error.config)
    }

    if (error.code === 'ERR_CANCELED' || axios.isCancel(error)) {
      console.debug('[Request Cancelled]', error.config?.url)
      return Promise.reject(error)
    }

    if (shouldRetryBasedOnError(error)) {
      try {
        return await executeWithRetry(error.config)
      } catch (retryError) {
        error = retryError
      }
    }

    const errorMessage = getErrorMessage(error)
    const errorCode = getErrorCode(error)

    console.error('[API Request Failed]', {
      url: error.config?.url,
      method: error.config?.method,
      code: errorCode,
      message: errorMessage,
      originalError: error.message
    })

    if (errorCode === 401) {
      handleUnauthorized()
    } else {
      if (error.config?._cacheKey && error.config?.method === 'get') {
        const cachedData = getFromLocalStorage(error.config._cacheKey)
        if (cachedData) {
          console.warn(`[Cache Fallback] Using cached data for ${error.config.url} due to error`)
          ElMessage.warning('网络异常，正在显示缓存数据')
          return cachedData
        }

        console.warn(`[Cache Fallback] No cache available for ${error.config.url}`)
      }

      showError({
        code: errorCode,
        message: errorMessage,
        retryCallback: () => service(error.config)
      })
    }

    error.userMessage = errorMessage
    error.userCode = errorCode

    return Promise.reject(error)
  }
)

function shouldRetry(statusCode) {
  return statusCode >= 500 && statusCode < 600
}

function handleUnauthorized() {
  console.warn('[Auth] Token无效或已过期，即将跳转到登录页')

  localStorage.removeItem('token')
  localStorage.removeItem('user')

  clearAllPendingRequests()
  clearRequestCache()

  ElMessage.warning({
    message: '登录已过期，请重新登录',
    duration: 2000,
    showClose: true,
    onClose: () => {
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
  })
}

function invalidateRelatedCaches(url) {
  if (!url) return

  const urlPattern = url.split('?')[0]

  try {
    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(LOCAL_STORAGE_CACHE_PREFIX) && key.includes(urlPattern)) {
        keysToRemove.push(key)
      }
    }

    keysToRemove.forEach(key => {
      localStorage.removeItem(key)
      requestCache.delete(key)
    })

    if (keysToRemove.length > 0) {
      console.debug(`[Cache Invalidated] Cleared ${keysToRemove.length} cache entries related to ${urlPattern}`)
    }
  } catch (e) {
    console.error('[Cache Invalidation] Failed to clear caches:', e)
  }
}

export function clearRequestCache() {
  requestCache.clear()

  try {
    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(LOCAL_STORAGE_CACHE_PREFIX)) {
        keysToRemove.push(key)
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key))
    console.debug(`[Cache Cleared] Cleared ${keysToRemove.length} localStorage cache entries`)
  } catch (e) {
    console.error('[Cache Clear] Failed to clear localStorage caches:', e)
  }

  console.debug('[Cache Cleared] All request caches cleared')
}

export function invalidateCache(pattern) {
  if (!pattern) {
    clearRequestCache()
    return
  }

  for (const key of requestCache.keys()) {
    if (key.includes(pattern)) {
      requestCache.delete(key)
    }
  }

  try {
    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(LOCAL_STORAGE_CACHE_PREFIX) && key.includes(pattern)) {
        keysToRemove.push(key)
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key))
  } catch (e) {
    console.error('[Cache Invalidation] Failed to invalidate localStorage caches:', e)
  }

  console.debug(`[Cache Invalidated] Cache entries matching "${pattern}" cleared`)
}

export function cancelAllRequests(reason = 'Component unmounted') {
  console.warn(`[Cancel All] Cancelling all pending requests: ${reason}`)

  for (const config of pendingRequests) {
    if (config._abortController) {
      config._abortController.abort(reason)
    }
  }

  pendingRequests.clear()
}

function clearAllPendingRequests() {
  pendingRequests.clear()
  requestQueue.length = 0
  activeRequestCount = 0
}

export function createAbortController() {
  return new AbortController()
}

export function getRequestStats() {
  return {
    activeRequests: activeRequestCount,
    queuedRequests: requestQueue.length,
    memoryCacheSize: requestCache.size,
    localStorageCacheSize: (() => {
      try {
        let count = 0
        for (let i = 0; i < localStorage.length; i++) {
          if (localStorage.key(i)?.startsWith(LOCAL_STORAGE_CACHE_PREFIX)) {
            count++
          }
        }
        return count
      } catch (e) {
        return 0
      }
    })(),
    pendingRequests: pendingRequests.size
  }
}

export function configureRequest(options = {}) {
  if (options.timeout) {
    service.defaults.timeout = options.timeout
  }

  if (options.maxRetries !== undefined) {
    retryConfig.maxAttempts = options.maxRetries
  }

  if (options.cacheDuration) {
    CACHE_DURATION = options.cacheDuration
  }

  console.debug('[Request Config] Configuration updated:', options)
}

export default service
