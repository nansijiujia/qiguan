import { ElMessage, ElNotification } from 'element-plus'

const DEFAULT_CONFIG = {
  message: {
    duration: 3000,
    showClose: true,
    grouping: true
  },
  notification: {
    duration: 4500,
    position: 'top-right',
    showClose: true
  }
}

const DEBOUNCE_TIME = 1000
const recentMessages = new Map()
const messageQueue = []
let isProcessingQueue = false

function generateMessageKey(type, message) {
  return `${type}:${typeof message === 'string' ? message : JSON.stringify(message)}`
}

function isDuplicateMessage(key) {
  const lastTime = recentMessages.get(key)
  if (lastTime && Date.now() - lastTime < DEBOUNCE_TIME) {
    return true
  }
  recentMessages.set(key, Date.now())
  
  setTimeout(() => {
    recentMessages.delete(key)
  }, DEBOUNCE_TIME * 2)
  
  return false
}

function processQueue() {
  if (isProcessingQueue || messageQueue.length === 0) return
  
  isProcessingQueue = true
  const nextMessage = messageQueue.shift()
  
  try {
    const { type, options, resolve } = nextMessage
    
    let instance
    switch (type) {
      case 'success':
        instance = ElMessage.success(options)
        break
      case 'error':
        instance = ElMessage.error(options)
        break
      case 'warning':
        instance = ElMessage.warning(options)
        break
      case 'info':
        instance = ElMessage.info(options)
        break
      default:
        instance = ElMessage(options)
    }
    
    if (resolve) resolve(instance)
    
    const duration = options.duration || DEFAULT_CONFIG.message.duration
    setTimeout(() => {
      isProcessingQueue = false
      processQueue()
    }, duration + 200)
    
  } catch (err) {
    console.warn('[Notification] 消息处理失败:', err)
    isProcessingQueue = false
    processQueue()
  }
}

function enqueueMessage(type, options) {
  return new Promise((resolve) => {
    messageQueue.push({ type, options, resolve })
    processQueue()
  })
}

export function showMessage(message, options = {}) {
  const { type = 'info', duration, showClose, grouping, center, offset, customClass } = options
  
  const key = generateMessageKey(type, message)
  if (isDuplicateMessage(key)) {
    return null
  }

  const mergedOptions = {
    message,
    type,
    duration: duration || DEFAULT_CONFIG.message.duration,
    showClose: showClose !== undefined ? showClose : DEFAULT_CONFIG.message.showClose,
    grouping: grouping !== undefined ? grouping : DEFAULT_CONFIG.message.grouping,
    ...(center && { center }),
    ...(offset && { offset }),
    ...(customClass && { customClass })
  }

  return enqueueMessage(type, mergedOptions)
}

export function success(message, options = {}) {
  return showMessage(message, { ...options, type: 'success' })
}

export function error(message, options = {}) {
  return showMessage(message, { 
    ...options, 
    type: 'error',
    duration: options.duration || 5000 
  })
}

export function warning(message, options = {}) {
  return showMessage(message, { ...options, type: 'warning' })
}

export function info(message, options = {}) {
  return showMessage(message, { ...options, type: 'info' })
}

export function showNotification(config) {
  const {
    title,
    message,
    type = 'info',
    duration,
    position,
    showClose,
    dangerouslyUseHTMLString,
    onClick,
    onClose,
    customClass
  } = config

  const key = generateMessageKey(`notification:${type}`, title || message)
  if (isDuplicateMessage(key)) {
    return null
  }

  const notificationOptions = {
    title: title || getTitleByType(type),
    message,
    type,
    duration: duration || DEFAULT_CONFIG.notification.duration,
    position: position || DEFAULT_CONFIG.notification.position,
    showClose: showClose !== undefined ? showClose : DEFAULT_CONFIG.notification.showClose,
    ...(dangerouslyUseHTMLString && { dangerouslyUseHTMLString }),
    ...(onClick && { onClick }),
    ...(onClose && { onClose }),
    ...(customClass && { customClass })
  }

  return ElNotification(notificationOptions)
}

export function notifySuccess(title, message, options = {}) {
  return showNotification({ 
    title, 
    message, 
    type: 'success', 
    ...options,
    duration: options.duration || 3000
  })
}

export function notifyError(title, message, options = {}) {
  return showNotification({ 
    title, 
    message, 
    type: 'error', 
    ...options,
    duration: options.duration || 6000
  })
}

export function notifyWarning(title, message, options = {}) {
  return showNotification({ 
    title, 
    message, 
    type: 'warning', 
    ...options 
  })
}

export function notifyInfo(title, message, options = {}) {
  return showNotification({ 
    title, 
    message, 
    type: 'info', 
    ...options 
  })
}

export function clearAll() {
  messageQueue.length = 0
  ElMessage.closeAll()
  ElNotification.closeAll()
  console.debug('[Notification] 所有消息已清除')
}

export function getQueueStatus() {
  return {
    queueLength: messageQueue.length,
    isProcessing: isProcessingQueue,
    recentMessagesCount: recentMessages.size
  }
}

export function setDefaultConfig(config) {
  if (config.message) {
    Object.assign(DEFAULT_CONFIG.message, config.message)
  }
  if (config.notification) {
    Object.assign(DEFAULT_CONFIG.notification, config.notification)
  }
}

function getTitleByType(type) {
  const titles = {
    success: '成功',
    error: '错误',
    warning: '警告',
    info: '提示'
  }
  return titles[type] || '通知'
}

export default {
  showMessage,
  success,
  error,
  warning,
  info,
  showNotification,
  notifySuccess,
  notifyError,
  notifyWarning,
  notifyInfo,
  clearAll,
  getQueueStatus,
  setDefaultConfig
}
