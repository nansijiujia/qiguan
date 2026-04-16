<template>
  <div class="error-fallback">
    <div class="error-container">
      <div class="error-icon">
        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="32" cy="32" r="30" stroke="#f56c6c" stroke-width="2" fill="#fef0f0"/>
          <path d="M32 18v16M32 42v4" stroke="#f56c6c" stroke-width="3" stroke-linecap="round"/>
        </svg>
      </div>

      <h2 class="error-title">页面加载失败</h2>
      <p class="error-message">{{ errorMessage || '抱歉，页面加载时出现了问题' }}</p>

      <div v-if="showDetails" class="error-details">
        <pre>{{ errorDetails }}</pre>
      </div>

      <button
        class="toggle-details-btn"
        @click="showDetails = !showDetails"
      >
        {{ showDetails ? '收起详情' : '查看详情' }}
      </button>

      <div class="error-actions">
        <el-button type="primary" @click="handleRetry" :loading="retrying">
          <el-icon><RefreshRight /></el-icon>
          重新加载
        </el-button>
        <el-button @click="goHome">
          <el-icon><HomeFilled /></el-icon>
          返回首页
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { RefreshRight, HomeFilled } from '@element-plus/icons-vue'

const props = defineProps({
  error: {
    type: [Error, String, Object],
    default: null
  }
})

const router = useRouter()
const route = useRoute()
const retrying = ref(false)
const showDetails = ref(false)

const errorMessage = computed(() => {
  if (!props.error) return null
  if (typeof props.error === 'string') return props.error
  return props.error.message || '未知错误'
})

const errorDetails = computed(() => {
  if (!props.error) return '无错误信息'
  if (typeof props.error === 'string') return props.error
  return JSON.stringify({
    message: props.error.message,
    stack: props.error.stack,
    route: route.fullPath,
    timestamp: new Date().toISOString()
  }, null, 2)
})

const handleRetry = async () => {
  retrying.value = true
  try {
    await router.replace(route.fullPath)
  } catch (e) {
    console.error('重试失败:', e)
  } finally {
    setTimeout(() => {
      retrying.value = false
    }, 1000)
  }
}

const goHome = () => {
  router.push('/dashboard')
}
</script>

<style scoped>
.error-fallback {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  padding: 40px 20px;
}

.error-container {
  text-align: center;
  max-width: 500px;
}

.error-icon {
  margin-bottom: 24px;
}

.error-icon svg {
  width: 120px;
  height: 120px;
}

.error-title {
  font-size: 24px;
  color: #303133;
  margin-bottom: 12px;
  font-weight: 600;
}

.error-message {
  font-size: 14px;
  color: #909399;
  margin-bottom: 20px;
  line-height: 1.6;
}

.error-details {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  text-align: left;
  max-height: 300px;
  overflow-y: auto;
}

.error-details pre {
  font-size: 12px;
  color: #606266;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.toggle-details-btn {
  background: none;
  border: none;
  color: #409eff;
  cursor: pointer;
  font-size: 14px;
  padding: 8px 16px;
  margin-bottom: 20px;
  transition: all 0.3s;
}

.toggle-details-btn:hover {
  color: #66b1ff;
  text-decoration: underline;
}

.error-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.error-actions .el-button {
  min-width: 120px;
}
</style>
