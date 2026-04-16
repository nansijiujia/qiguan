<template>
  <div class="login-container">
    <!-- 背景装饰 -->
    <div class="bg-decoration"></div>
    
    <div class="login-card">
      <!-- 头部Logo区域 -->
      <div class="login-header">
        <div class="logo-icon">
          <el-icon :size="40" color="#409EFF"><Shop /></el-icon>
        </div>
        <h2>绮管电商后台</h2>
        <p>E-commerce Management System</p>
        <div class="version-tag">v1.0.0</div>
      </div>

      <!-- 锁定提示 -->
      <div v-if="isLockedOut" class="lockout-warning">
        <el-alert
          :title="`账户已锁定，请等待 ${remainingLockoutTime} 后重试`"
          type="error"
          :closable="false"
          show-icon
          effect="dark"
        >
          <template #default>
            <p class="lockout-tip">连续 {{ maxAttempts }} 次登录失败，为保障账号安全已临时锁定</p>
          </template>
        </el-alert>
      </div>

      <!-- 登录表单 -->
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        class="login-form"
        @submit.prevent
      >
        <el-form-item prop="username">
          <el-input
            v-model="form.username"
            placeholder="请输入用户名"
            prefix-icon="User"
            size="large"
            clearable
            :disabled="isLockedOut"
            @keyup.enter="handleLogin"
          />
        </el-form-item>

        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码（至少6位）"
            prefix-icon="Lock"
            size="large"
            show-password
            :disabled="isLockedOut"
            @keyup.enter="handleLogin"
          />
        </el-form-item>

        <!-- 登录选项 -->
        <div class="login-options">
          <el-checkbox v-model="rememberMe">记住登录状态</el-checkbox>
        </div>

        <el-form-item>
          <el-button
            type="primary"
            size="large"
            class="login-btn"
            :loading="loading"
            :disabled="isLockedOut"
            @click="handleLogin"
          >
            {{ isLockedOut ? '账户已锁定' : '登 录 系 统' }}
          </el-button>
        </el-form-item>
      </el-form>

      <!-- 底部信息 -->
      <div class="login-footer">
        <div class="security-notice">
          <el-icon><Lock /></el-icon>
          <span>安全连接 (HTTPS)</span>
        </div>
        <p class="tips-text">
          请使用管理员账号登录 · 首次登录建议修改默认密码
        </p>
        
        <!-- 尝试次数提示 -->
        <div v-if="attemptsCount > 0 && !isLockedOut" class="attempts-warning">
          <el-progress 
            :percentage="(attemptsCount / maxAttempts) * 100" 
            :stroke-width="6"
            :show-text="false"
            :color="getProgressColor()"
            status="exception"
          />
          <span class="attempts-text">
            已失败 {{ attemptsCount }}/{{ maxAttempts }} 次，再错将临时锁定
          </span>
        </div>
      </div>
    </div>

    <!-- 版权信息 -->
    <div class="copyright">
      © 2024 绮管电商 版权所有 | 技术支持
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Shop, Lock, User } from '@element-plus/icons-vue'
import request from '@/utils/request'
import { authUtils } from '@/router'

const router = useRouter()
const route = useRoute()
const formRef = ref(null)
const loading = ref(false)
const rememberMe = ref(true)

let lockoutCheckInterval = null

const form = reactive({
  username: '',
  password: ''
})

const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 2, max: 50, message: '用户名长度2-50个字符', trigger: 'blur' },
    {
      pattern: /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/,
      message: '用户名只能包含字母、数字、下划线和中文',
      trigger: 'blur'
    }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 100, message: '密码长度6-100位', trigger: 'blur' }
  ]
}

const isLockedOut = ref(authUtils.isLockedOut())
const attemptsCount = ref(authUtils.getLoginAttempts())
const maxAttempts = authUtils.MAX_LOGIN_ATTEMPTS

const remainingLockoutTime = computed(() => {
  if (!isLockedOut.value) return ''
  
  const lockoutEnd = authUtils.getLockoutEndTime()
  const remaining = Math.max(0, Math.ceil((lockoutEnd - Date.now()) / 1000))
  
  if (remaining <= 0) return ''
  
  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60
  
  return `${minutes}分${seconds}秒`
})

const getProgressColor = () => {
  const ratio = attemptsCount.value / maxAttempts
  if (ratio >= 0.8) return '#F56C6C'
  if (ratio >= 0.5) return '#E6A23C'
  return '#409EFF'
}

function updateLockoutStatus() {
  isLockedOut.value = authUtils.isLockedOut()
  attemptsCount.value = authUtils.getLoginAttempts()
  
  if (!isLockedOut.value && lockoutCheckInterval) {
    clearInterval(lockoutCheckInterval)
    lockoutCheckInterval = null
  }
}

async function handleLogin() {
  if (!formRef.value) return
  
  if (isLockedOut.value) {
    ElMessage.warning('账户已锁定，请稍后重试')
    return
  }

  try {
    await formRef.value.validate()
  } catch (validationError) {
    console.warn('[LOGIN] 表单验证失败:', validationError)
    return
  }

  loading.value = true
  
  const loginStartTime = Date.now()

  try {
    const res = await request.post('/v1/auth/login', {
      username: String(form.username || '').trim(),
      password: String(form.password || '')
    })

    const responseTime = Date.now() - loginStartTime
    
    console.log(`[LOGIN] API响应时间: ${responseTime}ms`)
    console.log('[LOGIN] Response:', res)

    if (res.success && res.data?.token) {
      localStorage.setItem('token', res.data.token)
      
      if (res.data.user) {
        localStorage.setItem('user', JSON.stringify(res.data.user))
      }

      authUtils.resetLoginAttempts()
      
      ElMessage.success({
        message: '登录成功！欢迎回来',
        duration: 2000,
        showClose: true
      })

      const redirectPath = route.query.redirect || '/dashboard'
      
      setTimeout(() => {
        router.push(redirectPath)
      }, 500)
    } else {
      handleLoginFailure(res.error?.message || '登录失败')
    }
  } catch (error) {
    const responseTime = Date.now() - loginStartTime
    console.error(`[LOGIN] 错误响应时间: ${responseTime}ms`)
    
    handleLoginError(error)
  } finally {
    loading.value = false
  }
}

function handleLoginFailure(message) {
  const lockoutEnd = authUtils.incrementLoginAttempts()
  attemptsCount.value = authUtils.getLoginAttempts()
  
  if (lockoutEnd) {
    isLockedOut.value = true
    startLockoutCountdown()
    
    ElMessage.error('登录失败次数过多，账户已临时锁定15分钟')
    return
  }
  
  const remaining = maxAttempts - attemptsCount.value
  
  ElMessage.error({
    message: `${message}（剩余尝试次数：${remaining}次）`,
    duration: 4000,
    showClose: true
  })
}

function handleLoginError(error) {
  console.error('[LOGIN] Error details:', {
    message: error.message,
    status: error.response?.status,
    data: error.response?.data,
    timestamp: new Date().toISOString()
  })

  const lockoutEnd = authUtils.incrementLoginAttempts()
  attemptsCount.value = authUtils.getLoginAttempts()

  let errorMessage = '登录失败，请稍后重试'

  if (error.response?.status === 401) {
    errorMessage = '用户名或密码错误'
  } else if (error.response?.status === 403) {
    errorMessage = error.response?.data?.error?.message || '账号已被禁用或未激活'
  } else if (error.response?.status === 429) {
    errorMessage = '请求过于频繁，请稍后再试'
  } else if (error.response?.status === 500) {
    errorMessage = '服务器内部错误，请联系管理员'
  } else if (!error.response) {
    if (error.message.includes('timeout')) {
      errorMessage = '请求超时，请检查网络连接'
    } else if (error.message.includes('Network') || error.message.includes('network')) {
      errorMessage = '网络连接失败，请检查网络设置'
    } else {
      errorMessage = `无法连接到服务器: ${error.message}`
    }
  } else {
    errorMessage = error.response?.data?.error?.message || error.message || errorMessage
  }

  if (lockoutEnd) {
    isLockedOut.value = true
    startLockoutCountdown()
    ElMessage.error('登录失败次数过多，账户已临时锁定15分钟')
    return
  }

  const remaining = maxAttempts - attemptsCount.value
  
  ElMessage.error({
    message: `${errorMessage}${remaining > 0 ? `（剩余${remaining}次机会）` : ''}`,
    duration: 5000,
    showClose: true
  })
}

function startLockoutCountdown() {
  if (lockoutCheckInterval) clearInterval(lockoutCheckInterval)
  
  lockoutCheckInterval = setInterval(updateLockoutStatus, 1000)
}

onMounted(() => {
  updateLockoutStatus()
  
  if (route.query.reason === 'expired') {
    ElMessage.warning('登录已过期，请重新登录')
  } else if (route.query.reason === 'no_token') {
    ElMessage.info('请先登录以访问系统')
  }
})

onUnmounted(() => {
  if (lockoutCheckInterval) {
    clearInterval(lockoutCheckInterval)
  }
})
</script>

<style scoped>
.login-container {
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
  position: relative;
  overflow: hidden;
  padding: 20px;
}

.bg-decoration {
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px);
  background-size: 50px 50px;
  animation: bgFloat 20s ease-in-out infinite;
}

@keyframes bgFloat {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(-20px, -20px); }
}

.login-card {
  width: 440px;
  padding: 48px 40px 36px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  box-shadow: 
    0 25px 60px rgba(0, 0, 0, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.1);
  position: relative;
  z-index: 10;
  animation: cardAppear 0.6s ease-out;
}

@keyframes cardAppear {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.logo-icon {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  width: 72px;
  height: 72px;
  border-radius: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  margin-bottom: 16px;
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
}

.login-header h2 {
  font-size: 28px;
  color: #303133;
  margin: 0 0 8px 0;
  font-weight: 700;
  letter-spacing: 1px;
}

.login-header p {
  color: #909399;
  font-size: 14px;
  margin: 0 0 12px 0;
}

.version-tag {
  display: inline-block;
  padding: 4px 12px;
  background: #f0f2f5;
  color: #909399;
  font-size: 11px;
  border-radius: 12px;
  font-weight: 500;
}

.lockout-warning {
  margin-bottom: 24px;
  animation: shake 0.5s ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}

.lockout-tip {
  margin: 8px 0 0 0;
  font-size: 13px;
  line-height: 1.5;
}

.login-form {
  padding: 0 8px;
}

.login-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  font-size: 14px;
  color: #606266;
}

.login-btn {
  width: 100%;
  height: 46px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 10px;
  letter-spacing: 2px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  transition: all 0.3s ease;
}

.login-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
}

.login-btn:active:not(:disabled) {
  transform: translateY(0);
}

.login-footer {
  margin-top: 28px;
  text-align: center;
}

.security-notice {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #67c23a;
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 12px;
  padding: 6px 12px;
  background: #f0f9eb;
  border-radius: 6px;
}

.tips-text {
  color: #909399;
  font-size: 12px;
  margin: 0 0 16px 0;
  line-height: 1.6;
}

.attempts-warning {
  margin-top: 16px;
  padding: 12px;
  background: #fef0f0;
  border-radius: 8px;
  border-left: 3px solid #f56c6c;
}

.attempts-warning .el-progress {
  margin-bottom: 8px;
}

.attempts-text {
  font-size: 12px;
  color: #f56c6c;
  font-weight: 500;
}

.copyright {
  margin-top: 32px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  text-align: center;
  z-index: 10;
  position: relative;
}

@media screen and (max-width: 480px) {
  .login-card {
    width: 100%;
    max-width: 380px;
    padding: 32px 24px 28px;
  }
  
  .login-header h2 {
    font-size: 24px;
  }
}
</style>