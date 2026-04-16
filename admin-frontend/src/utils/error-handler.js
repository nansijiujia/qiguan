import { ElMessage } from 'element-plus'

const DEFAULT_DURATION = 5000
let currentMessageInstance = null

export function showError({ code, message, duration = DEFAULT_DURATION, showClose = true, retryCallback = null }) {
  if (currentMessageInstance) {
    currentMessageInstance.close()
  }

  const displayMessage = code ? `[${code}] ${message}` : message

  const options = {
    message: displayMessage,
    type: 'error',
    duration: duration,
    showClose: showClose,
    grouping: true
  }

  if (retryCallback && typeof retryCallback === 'function') {
    options.customClass = 'error-message-with-retry'
  }

  currentMessageInstance = ElMessage.error(options)

  console.error(`[Error Handler] ${displayMessage}`, {
    code,
    originalMessage: message,
    hasRetryCallback: !!retryCallback
  })

  return currentMessageInstance
}

export function showWarning(message, duration = 3000) {
  return ElMessage.warning({
    message,
    duration,
    showClose: true
  })
}

export function showSuccess(message, duration = 2000) {
  return ElMessage.success({
    message,
    duration,
    showClose: false
  })
}

export function clearAllMessages() {
  if (currentMessageInstance) {
    currentMessageInstance.close()
    currentMessageInstance = null
  }
  
  ElMessage.closeAll()
}
