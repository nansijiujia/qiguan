const LOG_STORAGE_KEY = 'user_action_logs'
const MAX_LOGS = 500
const PERFORMANCE_LOG_KEY = 'performance_metrics'
const MAX_PERF_LOGS = 200

const ACTION_TYPES = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  READ: 'read',
  NAVIGATION: 'navigation',
  EXPORT: 'export',
  IMPORT: 'import',
  SEARCH: 'search',
  FILTER: 'filter',
  SORT: 'sort',
  CUSTOM: 'custom'
}

let logBuffer = []
let isInitialized = false
let currentRoute = ''

function generateLogId() {
  return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function getUserInfo() {
  try {
    const userStr = localStorage.getItem('user')
    return userStr ? JSON.parse(userStr) : null
  } catch (e) {
    return null
  }
}

function loadLogsFromStorage() {
  try {
    const stored = localStorage.getItem(LOG_STORAGE_KEY)
    if (stored) {
      logBuffer = JSON.parse(stored)
      console.debug(`[Logger] 加载了 ${logBuffer.length} 条历史日志`)
    }
  } catch (err) {
    console.warn('[Logger] 加载日志失败:', err)
    logBuffer = []
  }
}

function saveLogsToStorage() {
  try {
    if (logBuffer.length > MAX_LOGS) {
      logBuffer = logBuffer.slice(-MAX_LOGS)
    }
    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logBuffer))
  } catch (err) {
    console.warn('[Logger] 保存日志失败:', err)
    if (err.name === 'QuotaExceededError') {
      logBuffer = logBuffer.slice(-Math.floor(MAX_LOGS / 2))
      saveLogsToStorage()
    }
  }
}

function createLogEntry(actionType, details = {}) {
  const user = getUserInfo()
  
  return {
    id: generateLogId(),
    timestamp: new Date().toISOString(),
    actionType,
    userId: user?.id || user?.userId || 'anonymous',
    username: user?.username || user?.name || 'anonymous',
    url: window.location.href,
    route: currentRoute || window.location.pathname,
    userAgent: navigator.userAgent,
    ...details
  }
}

export function initLogger() {
  if (isInitialized) return
  
  loadLogsFromStorage()
  isInitialized = true
  console.debug('[Logger] 日志系统已初始化')
}

export function logAction(actionType, description, metadata = {}) {
  if (!isInitialized) initLogger()
  
  const validAction = Object.values(ACTION_TYPES).includes(actionType) ? actionType : ACTION_TYPES.CUSTOM
  
  const entry = createLogEntry(validAction, {
    description,
    metadata,
    environment: import.meta.env.MODE
  })
  
  logBuffer.push(entry)
  saveLogsToStorage()
  
  if (import.meta.env.DEV) {
    console.debug(`[Logger] [${validAction.toUpperCase()}] ${description}`, metadata)
  }
  
  return entry.id
}

export function logLogin(userId, username, method = 'password') {
  return logAction(ACTION_TYPES.LOGIN, `用户登录`, {
    loginMethod: method,
    targetUser: { id: userId, username }
  })
}

export function logLogout() {
  return logAction(ACTION_TYPES.LOGOUT, `用户登出`)
}

export function logCRUD(operation, resource, resourceId, details = {}) {
  const operationMap = {
    create: ACTION_TYPES.CREATE,
    update: ACTION_TYPES.UPDATE,
    delete: ACTION_TYPES.DELETE,
    read: ACTION_TYPES.READ
  }
  
  const actionType = operationMap[operation] || ACTION_TYPES.CUSTOM
  const descriptions = {
    create: `创建${resource}`,
    update: `更新${resource}`,
    delete: `删除${resource}`,
    read: `查看${resource}`
  }
  
  return logAction(actionType, descriptions[operation] || `${operation}${resource}`, {
    resource,
    resourceId,
    ...details
  })
}

export function logNavigation(to, from = '') {
  currentRoute = to
  
  return logAction(ACTION_TYPES.NAVIGATION, `页面导航`, {
    from,
    to,
    title: document.title
  })
}

export function logSearch(query, type = 'general') {
  return logAction(ACTION_TYPES.SEARCH, `搜索操作`, {
    query,
    searchType: type
  })
}

export function logExport(format, dataCount, resource = '') {
  return logAction(ACTION_TYPES.EXPORT, `导出数据`, {
    format,
    dataCount,
    resource
  })
}

export function logPerformance(metricName, duration, metadata = {}) {
  try {
    let perfLogs = []
    const stored = localStorage.getItem(PERFORMANCE_LOG_KEY)
    
    if (stored) {
      perfLogs = JSON.parse(stored)
    }
    
    perfLogs.push({
      id: generateLogId(),
      timestamp: new Date().toISOString(),
      metricName,
      duration,
      url: window.location.href,
      route: currentRoute,
      ...metadata
    })
    
    if (perfLogs.length > MAX_PERF_LOGS) {
      perfLogs = perfLogs.slice(-MAX_PERF_LOGS)
    }
    
    localStorage.setItem(PERFORMANCE_LOG_KEY, JSON.stringify(perfLogs))
    
    if (import.meta.env.DEV) {
      console.debug(`[PerfLogger] ${metricName}: ${duration}ms`)
    }
  } catch (err) {
    console.warn('[Performance Logger] 记录失败:', err)
  }
}

export function getLogs(filters = {}) {
  if (!isInitialized) initLogger()
  
  let filteredLogs = [...logBuffer]
  
  if (filters.actionType) {
    filteredLogs = filteredLogs.filter(log => log.actionType === filters.actionType)
  }
  
  if (filters.startDate) {
    const start = new Date(filters.startDate).getTime()
    filteredLogs = filteredLogs.filter(log => new Date(log.timestamp).getTime() >= start)
  }
  
  if (filters.endDate) {
    const end = new Date(filters.endDate).getTime()
    filteredLogs = filteredLogs.filter(log => new Date(log.timestamp).getTime() <= end)
  }
  
  if (filters.userId) {
    filteredLogs = filteredLogs.filter(log => log.userId === filters.userId)
  }
  
  if (filters.limit) {
    filteredLogs = filteredLogs.slice(-filters.limit)
  }
  
  return filteredLogs.reverse()
}

export function getPerformanceLogs(limit = 50) {
  try {
    const stored = localStorage.getItem(PERFORMANCE_LOG_KEY)
    if (!stored) return []
    
    const logs = JSON.parse(stored)
    return logs.slice(-limit).reverse()
  } catch (err) {
    console.warn('[Logger] 获取性能日志失败:', err)
    return []
  }
}

export function clearLogs() {
  logBuffer = []
  localStorage.removeItem(LOG_STORAGE_KEY)
  localStorage.removeItem(PERFORMANCE_LOG_KEY)
  console.debug('[Logger] 所有日志已清除')
}

export function exportLogs(format = 'json') {
  const logs = getLogs()
  
  if (format === 'json') {
    return JSON.stringify(logs, null, 2)
  }
  
  if (format === 'csv') {
    const headers = ['timestamp', 'actionType', 'description', 'userId', 'username', 'url']
    const csvRows = [headers.join(',')]
    
    logs.forEach(log => {
      const row = headers.map(header => {
        const value = log[header] || ''
        return `"${String(value).replace(/"/g, '""')}"`
      })
      csvRows.push(row.join(','))
    })
    
    return csvRows.join('\n')
  }
  
  return logs
}

export async function uploadLogs(apiEndpoint = '/api/v1/logs/user-actions') {
  const logs = getLogs({ limit: 100 })
  
  if (logs.length === 0) {
    console.debug('[Logger] 没有需要上传的日志')
    return { success: true, message: '没有新日志' }
  }

  try {
    const service = (await import('@/utils/request')).default
    
    await service.post(apiEndpoint, {
      logs,
      uploadedAt: new Date().toISOString(),
      clientInfo: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        appVersion: import.meta.env.VITE_APP_VERSION || 'unknown'
      }
    })

    console.log(`[Logger] 成功上传 ${logs.length} 条日志`)

    const remainingLogs = logs.slice(logs.length)
    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(remainingLogs))

    return { success: true, count: logs.length }
  } catch (err) {
    console.error('[Logger] 日志上传失败:', err)
    throw err
  }
}

export function getLogStats() {
  if (!isInitialized) initLogger()

  const stats = {
    totalLogs: logBuffer.length,
    byActionType: {},
    dateRange: { earliest: null, latest: null },
    uniqueUsers: new Set()
  }

  logBuffer.forEach(log => {
    stats.byActionType[log.actionType] = (stats.byActionType[log.actionType] || 0) + 1
    
    if (!stats.dateRange.earliest || log.timestamp < stats.dateRange.earliest) {
      stats.dateRange.earliest = log.timestamp
    }
    if (!stats.dateRange.latest || log.timestamp > stats.dateRange.latest) {
      stats.dateRange.latest = log.timestamp
    }
    
    if (log.userId && log.userId !== 'anonymous') {
      stats.uniqueUsers.add(log.userId)
    }
  })

  stats.uniqueUsers = stats.uniqueUsers.size

  return stats
}

export { ACTION_TYPES }

export default {
  initLogger,
  logAction,
  logLogin,
  logLogout,
  logCRUD,
  logNavigation,
  logSearch,
  logExport,
  logPerformance,
  getLogs,
  getPerformanceLogs,
  clearLogs,
  exportLogs,
  uploadLogs,
  getLogStats,
  ACTION_TYPES
}
