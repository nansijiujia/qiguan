<template>
  <div class="error-boundary">
    <slot v-if="!hasError" />
    <div v-else class="error-fallback-container">
      <div class="error-content">
        <div class="error-icon">
          <el-icon :size="64" color="#f56c6c">
            <WarningFilled />
          </el-icon>
        </div>

        <h2 class="error-title">页面出现错误</h2>
        <p class="error-message">{{ userFriendlyMessage }}</p>

        <div class="error-actions">
          <el-button type="primary" @click="handleRetry">
            <el-icon><RefreshRight /></el-icon>
            重新尝试
          </el-button>
          <el-button @click="goHome">
            <el-icon><HomeFilled /></el-icon>
            返回首页
          </el-button>
        </div>

        <div v-if="isDev || showDetails" class="error-details">
          <div class="details-header" @click="toggleDetails">
            <span>错误详情</span>
            <el-icon :class="{ 'is-expanded': detailsExpanded }">
              <ArrowDown />
            </el-icon>
          </div>

          <transition name="slide">
            <div v-show="detailsExpanded" class="details-content">
              <div class="detail-item">
                <label>错误类型:</label>
                <span>{{ error?.name || 'Unknown' }}</span>
              </div>
              <div class="detail-item">
                <label>错误消息:</label>
                <span>{{ error?.message }}</span>
              </div>
              <div v-if="isDev && error?.stack" class="detail-item stack-trace">
                <label>堆栈信息:</label>
                <pre>{{ error.stack }}</pre>
              </div>
              <div v-if="errorInfo" class="detail-item">
                <label>组件信息:</label>
                <span>{{ errorInfo }}</span>
              </div>
              <div class="detail-item">
                <label>发生时间:</label>
                <span>{{ errorTime }}</span>
              </div>
              <div class="detail-item">
                <label>当前页面:</label>
                <span>{{ currentUrl }}</span>
              </div>
            </div>
          </transition>
        </div>

        <p v-if="!isDev && !showDetails" class="error-hint">
          如问题持续存在，请联系技术支持
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onErrorCaptured, provide } from 'vue'
import { useRouter } from 'vue-router'
import { WarningFilled, RefreshRight, HomeFilled, ArrowDown } from '@element-plus/icons-vue'
import { reportErrorToServer } from '@/services/error-reporter'

const props = defineProps({
  fallbackMessage: {
    type: String,
    default: ''
  },
  showDetails: {
    type: Boolean,
    default: false
  },
  onError: {
    type: Function,
    default: null
  }
})

const emit = defineEmits(['error', 'reset'])

const router = useRouter()
const hasError = ref(false)
const error = ref(null)
const errorInfo = ref('')
const errorTime = ref('')
const detailsExpanded = ref(false)

const isDev = import.meta.env.DEV

const userFriendlyMessage = computed(() => {
  if (props.fallbackMessage) return props.fallbackMessage

  const msg = error.value?.message || ''

  if (msg.includes('Network') || msg.includes('网络')) {
    return '网络连接异常，请检查您的网络设置'
  }
  if (msg.includes('timeout') || msg.includes('超时')) {
    return '请求超时，请稍后重试'
  }
  if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('登录')) {
    return '登录已过期，请重新登录'
  }
  if (msg.includes('403') || msg.includes('Forbidden') || msg.includes('权限')) {
    return '您没有权限执行此操作'
  }

  return '页面加载时出现意外错误'
})

const currentUrl = computed(() => window.location.href)

provide('resetErrorBoundary', resetError)

function toggleDetails() {
  detailsExpanded.value = !detailsExpanded.value
}

function handleRetry() {
  resetError()
}

function goHome() {
  router.push('/')
}

function resetError() {
  hasError.value = false
  error.value = null
  errorInfo.value = ''
  errorTime.value = ''
  detailsExpanded.value = false
  emit('reset')
}

onErrorCaptured((err, instance, info) => {
  console.error('[ErrorBoundary] 捕获到错误:', err)
  console.error('[ErrorBoundary] 错误信息:', info)
  console.error('[ErrorBoundary] 错误组件:', instance?.$options?.name)

  hasError.value = true
  error.value = err
  errorInfo.value = info
  errorTime.value = new Date().toLocaleString('zh-CN')

  const errorData = {
    message: err.message,
    stack: err.stack,
    component: instance?.$options?.name || 'Unknown',
    info: info,
    url: window.location.href,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    source: 'error-boundary'
  }

  reportErrorToServer(errorData).catch(reportErr => {
    console.warn('[ErrorBoundary] 错误上报失败:', reportErr)
  })

  if (props.onError) {
    props.onError({ error: err, instance, info })
  }

  emit('error', { error: err, instance, info })

  return false
})
</script>

<style scoped>
.error-boundary {
  width: 100%;
  height: 100%;
}

.error-fallback-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 84px);
  padding: 40px 20px;
}

.error-content {
  max-width: 600px;
  width: 100%;
  text-align: center;
  background: #fff;
  border-radius: 12px;
  padding: 48px 32px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
}

.error-icon {
  margin-bottom: 24px;
}

.error-title {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 12px 0;
}

.error-message {
  font-size: 16px;
  color: #606266;
  margin: 0 0 32px 0;
  line-height: 1.5;
}

.error-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-bottom: 24px;
}

.error-details {
  margin-top: 24px;
  border-top: 1px solid #ebeef5;
  padding-top: 20px;
}

.details-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  color: #909399;
  font-size: 14px;
  padding: 8px 0;
  transition: color 0.3s;
}

.details-header:hover {
  color: #409eff;
}

.details-header .el-icon {
  transition: transform 0.3s;
}

.details-header .el-icon.is-expanded {
  transform: rotate(180deg);
}

.details-content {
  margin-top: 16px;
  text-align: left;
  background: #fafafa;
  border-radius: 8px;
  padding: 16px;
  max-height: 400px;
  overflow-y: auto;
}

.detail-item {
  margin-bottom: 12px;
  font-size: 13px;
}

.detail-item:last-child {
  margin-bottom: 0;
}

.detail-item label {
  display: inline-block;
  min-width: 80px;
  color: #909399;
  font-weight: 500;
}

.detail-item span {
  color: #606266;
  word-break: break-all;
}

.detail-item.stack-trace pre {
  margin: 8px 0 0 0;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 12px;
  line-height: 1.6;
  color: #c7254e;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.error-hint {
  margin-top: 16px;
  font-size: 13px;
  color: #909399;
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  max-height: 0;
}

.slide-enter-to,
.slide-leave-from {
  opacity: 1;
  max-height: 400px;
}
</style>
