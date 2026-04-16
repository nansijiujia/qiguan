<template>
  <div class="profile-container">
    <el-card shadow="never" class="profile-card">
      <template #header>
        <div class="card-header">
          <el-icon :size="20" color="#409EFF"><User /></el-icon>
          <span>个人账号设置</span>
        </div>
      </template>

      <!-- 用户信息概览 -->
      <div class="user-overview">
        <div class="avatar-section">
          <el-avatar :size="80" :icon="UserFilled" />
          <div class="user-basic-info">
            <h3>{{ userInfo.username || '未登录' }}</h3>
            <p>{{ userInfo.email || '未设置邮箱' }}</p>
            <el-tag size="small" type="success" v-if="userInfo.status === 'active'">正常</el-tag>
            <el-tag size="small" type="danger" v-else>已禁用</el-tag>
          </div>
        </div>
        
        <div class="account-meta">
          <div class="meta-item">
            <span class="label">角色</span>
            <span class="value">{{ userInfo.role || '管理员' }}</span>
          </div>
          <div class="meta-item">
            <span class="label">注册时间</span>
            <span class="value">{{ formatDate(userInfo.created_at) }}</span>
          </div>
          <div class="meta-item">
            <span class="label">最后登录</span>
            <span class="value">{{ formatDate(userInfo.last_login) }}</span>
          </div>
        </div>
      </div>

      <el-divider />

      <!-- 功能选项卡 -->
      <el-tabs v-model="activeTab" type="border-card">
        <!-- 用户名修改 -->
        <el-tab-pane label="修改用户名" name="username">
          <div class="tab-content">
            <el-alert
              title="用户名修改说明"
              type="info"
              :closable="false"
              show-icon
              class="form-tip"
            >
              <template #default>
                <ul>
                  <li>用户名长度2-50个字符</li>
                  <li>只能包含字母、数字、下划线和中文</li>
                  <li>修改后需要重新登录</li>
                </ul>
              </template>
            </el-alert>

            <el-form
              ref="usernameFormRef"
              :model="usernameForm"
              :rules="usernameRules"
              label-width="100px"
              style="max-width: 500px; margin-top: 24px;"
            >
              <el-form-item label="当前用户名">
                <el-input :value="userInfo.username" disabled />
              </el-form-item>

              <el-form-item label="新用户名" prop="newUsername">
                <el-input
                  v-model="usernameForm.newUsername"
                  placeholder="请输入新用户名"
                  maxlength="50"
                  show-word-limit
                  clearable
                />
              </el-form-item>

              <el-form-item label="确认用户名" prop="confirmUsername">
                <el-input
                  v-model="usernameForm.confirmUsername"
                  placeholder="请再次输入新用户名"
                  maxlength="50"
                  clearable
                />
              </el-form-item>

              <el-form-item label="当前密码" prop="password">
                <el-input
                  v-model="usernameForm.password"
                  type="password"
                  placeholder="请输入当前密码以验证身份"
                  show-password
                />
              </el-form-item>

              <el-form-item>
                <el-button
                  type="primary"
                  :loading="usernameLoading"
                  @click="handleUpdateUsername"
                >
                  确认修改
                </el-button>
                <el-button @click="resetUsernameForm">重置</el-button>
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>

        <!-- 密码修改 -->
        <el-tab-pane label="修改密码" name="password">
          <div class="tab-content">
            <el-alert
              title="密码安全建议"
              type="warning"
              :closable="false"
              show-icon
              class="form-tip"
            >
              <template #default>
                <ul>
                  <li>密码长度至少8位，建议12位以上</li>
                  <li>包含大小写字母、数字和特殊字符</li>
                  <li>避免使用生日、手机号等易猜测信息</li>
                  <li>定期更换密码，不要重复使用旧密码</li>
                </ul>
              </template>
            </el-alert>

            <el-form
              ref="passwordFormRef"
              :model="passwordForm"
              :rules="passwordRules"
              label-width="120px"
              style="max-width: 550px; margin-top: 24px;"
            >
              <el-form-item label="当前密码" prop="currentPassword">
                <el-input
                  v-model="passwordForm.currentPassword"
                  type="password"
                  placeholder="请输入当前密码"
                  show-password
                />
              </el-form-item>

              <el-form-item label="新密码" prop="newPassword">
                <el-input
                  v-model="passwordForm.newPassword"
                  type="password"
                  placeholder="请输入新密码（8-100位）"
                  maxlength="100"
                  show-word-limit
                  show-password
                />
                <div class="password-strength" v-if="passwordForm.newPassword">
                  <span class="strength-label">强度：</span>
                  <el-progress 
                    :percentage="passwordStrength.score" 
                    :stroke-width="8"
                    :color="passwordStrength.color"
                    :show-text="false"
                    style="width: 150px;"
                  />
                  <span class="strength-text" :style="{ color: passwordStrength.color }">
                    {{ passwordStrength.label }}
                  </span>
                </div>
              </el-form-item>

              <el-form-item label="确认新密码" prop="confirmPassword">
                <el-input
                  v-model="passwordForm.confirmPassword"
                  type="password"
                  placeholder="请再次输入新密码"
                  show-password
                />
              </el-form-item>

              <el-form-item>
                <el-button
                  type="primary"
                  :loading="passwordLoading"
                  @click="handleUpdatePassword"
                >
                  确认修改
                </el-button>
                <el-button @click="resetPasswordForm">重置</el-button>
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>

        <!-- 账号信息 -->
        <el-tab-pane label="账号信息" name="info">
          <div class="tab-content">
            <el-descriptions :column="2" border>
              <el-descriptions-item label="用户ID">{{ userInfo.id || '-' }}</el-descriptions-item>
              <el-descriptions-item label="用户名">{{ userInfo.username || '-' }}</el-descriptions-item>
              <el-descriptions-item label="邮箱">{{ userInfo.email || '未设置' }}</el-descriptions-item>
              <el-descriptions-item label="角色">{{ userInfo.role || '管理员' }}</el-descriptions-item>
              <el-descriptions-item label="状态">
                <el-tag :type="userInfo.status === 'active' ? 'success' : 'danger'" size="small">
                  {{ userInfo.status === 'active' ? '正常' : '禁用' }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="创建时间">{{ formatDate(userInfo.created_at) }}</el-descriptions-item>
              <el-descriptions-item label="更新时间">{{ formatDate(userInfo.updated_at) }}</el-descriptions-item>
              <el-descriptions-item label="最后登录">{{ formatDate(userInfo.last_login) }}</el-descriptions-item>
            </el-descriptions>

            <el-divider />

            <div class="security-info">
              <h4>🔒 安全提示</h4>
              <ul>
                <li>请勿将账号密码告知他人</li>
                <li>定期检查账号活动日志</li>
                <li>发现异常立即联系管理员</li>
                <li>退出时点击右上角"退出登录"</li>
              </ul>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { User, UserFilled } from '@element-plus/icons-vue'
import request from '@/utils/request'

const activeTab = ref('username')
const usernameFormRef = ref(null)
const passwordFormRef = ref(null)
const usernameLoading = ref(false)
const passwordLoading = ref(false)

const userInfo = reactive({
  id: null,
  username: '',
  email: '',
  role: '',
  status: 'active',
  created_at: '',
  updated_at: '',
  last_login: ''
})

const usernameForm = reactive({
  newUsername: '',
  confirmUsername: '',
  password: ''
})

const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const validateConfirmUsername = (rule, value, callback) => {
  if (value !== usernameForm.newUsername) {
    callback(new Error('两次输入的用户名不一致'))
  } else {
    callback()
  }
}

const validateCurrentPassword = (rule, value, callback) => {
  if (!value || value.length < 6) {
    callback(new Error('请输入正确的当前密码（至少6位）'))
  } else {
    callback()
  }
}

const validateNewPassword = (rule, value, callback) => {
  if (!value) {
    callback(new Error('请输入新密码'))
  } else if (value.length < 8) {
    callback(new Error('密码长度不能少于8位'))
  } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
    callback(new Error('密码需包含大小写字母和数字'))
  } else {
    callback()
  }
}

const validateConfirmPassword = (rule, value, callback) => {
  if (value !== passwordForm.newPassword) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const usernameRules = {
  newUsername: [
    { required: true, message: '请输入新用户名', trigger: 'blur' },
    { min: 2, max: 50, message: '用户名长度2-50个字符', trigger: 'blur' },
    {
      pattern: /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/,
      message: '用户名只能包含字母、数字、下划线和中文',
      trigger: 'blur'
    },
    {
      validator: (rule, value, callback) => {
        if (value === userInfo.username) {
          callback(new Error('新用户名不能与当前用户名相同'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ],
  confirmUsername: [
    { required: true, message: '请确认新用户名', trigger: 'blur' },
    { validator: validateConfirmUsername, trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入当前密码', trigger: 'blur' },
    { validator: validateCurrentPassword, trigger: 'blur' }
  ]
}

const passwordRules = {
  currentPassword: [
    { required: true, message: '请输入当前密码', trigger: 'blur' },
    { min: 6, message: '密码至少6位', trigger: 'blur' },
    { validator: validateCurrentPassword, trigger: 'blur' }
  ],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 8, max: 100, message: '密码长度8-100位', trigger: 'blur' },
    { validator: validateNewPassword, trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value === passwordForm.currentPassword) {
          callback(new Error('新密码不能与当前密码相同'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ],
  confirmPassword: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' }
  ]
}

const passwordStrength = computed(() => {
  const pwd = passwordForm.newPassword || ''
  
  let score = 0
  
  if (pwd.length >= 8) score += 25
  if (pwd.length >= 12) score += 15
  if (/[a-z]/.test(pwd)) score += 10
  if (/[A-Z]/.test(pwd)) score += 15
  if (/\d/.test(pwd)) score += 15
  if (/[^a-zA-Z\d]/.test(pwd)) score += 20

  if (score <= 30) return { score: 25, color: '#F56C6C', label: '弱' }
  if (score <= 60) return { score: 50, color: '#E6A23C', label: '中等' }
  if (score <= 80) return { score: 75, color: '#409EFF', label: '强' }
  return { score: 95, color: '#67C23A', label: '非常强' }
})

function formatDate(dateStr) {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN')
  } catch (e) {
    return '-'
  }
}

async function fetchUserInfo() {
  try {
    const res = await request.get('/v1/auth/profile')

    if (res.success && res.data) {
      Object.assign(userInfo, res.data)
      console.log('[PROFILE] 用户信息获取成功:', userInfo.username)
    } else {
      console.warn('[PROFILE] API返回异常:', res)
      // 尝试降级方案
      fallbackToLocalUser()
    }
  } catch (error) {
    console.error('[PROFILE] 获取用户信息失败:', error)

    // 详细的错误日志
    if (error.response) {
      console.error('[PROFILE] 错误状态码:', error.response.status)
      console.error('[PROFILE] 错误数据:', error.response.data)
    }

    // 尝试降级方案
    fallbackToLocalUser()
  }
}

function fallbackToLocalUser() {
  console.log('[PROFILE] 尝试从本地存储获取用户信息...')

  // 尝试从localStorage获取基本信息
  const userStr = localStorage.getItem('user')
  if (userStr) {
    try {
      const localUser = JSON.parse(userStr)
      Object.assign(userInfo, localUser)
      console.log('[PROFILE] 从本地存储恢复用户信息成功')
    } catch (e) {
      console.warn('[PROFILE] 解析本地用户数据失败:', e)

      // 最终降级：尝试从token解码获取基本信息
      const token = localStorage.getItem('token')
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]))
          userInfo.username = payload.username || '未知用户'
          userInfo.role = payload.role || 'user'
          console.log('[PROFILE] 从token恢复基本信息成功')
        } catch (tokenErr) {
          console.error('[PROFILE] 解析token失败:', tokenErr)
        }
      }
    }
  } else {
    console.warn('[PROFILE] 本地无用户数据，显示未登录状态')
  }
}

async function handleUpdateUsername() {
  if (!usernameFormRef.value) return
  
  try {
    await usernameFormRef.value.validate()
  } catch (validationError) {
    console.warn('[PROFILE] 用户名表单验证失败:', validationError)
    return
  }

  await ElMessageBox.confirm(
    `确定要将用户名修改为 "${usernameForm.newUsername}" 吗？\n\n修改后需要重新登录`,
    '确认修改用户名',
    {
      confirmButtonText: '确定修改',
      cancelButtonText: '取消',
      type: 'warning'
    }
  )

  usernameLoading.value = true
  
  try {
    const res = await request.put('/v1/users/username', {
      new_username: String(usernameForm.newUsername).trim(),
      current_password: String(usernameForm.password)
    })

    if (res.success) {
      ElMessage.success('用户名修改成功！请重新登录')

      // 立即更新本地显示的用户名
      const oldUsername = userInfo.username
      userInfo.username = usernameForm.newUsername

      setTimeout(() => {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = '/login?reason=username_changed&old=' + encodeURIComponent(oldUsername)
      }, 2000)
    } else {
      ElMessage.error(res.error?.message || '修改失败')
    }
  } catch (error) {
    console.error('[PROFILE] 修改用户名失败:', error)
    
    const errorMsg = getErrorMessage(error)
    ElMessage.error(errorMsg)
  } finally {
    usernameLoading.value = false
  }
}

async function handleUpdatePassword() {
  if (!passwordFormRef.value) return
  
  try {
    await passwordFormRef.value.validate()
  } catch (validationError) {
    console.warn('[PROFILE] 密码表单验证失败:', validationError)
    return
  }

  await ElMessageBox.confirm(
    '确定要修改密码吗？\n\n修改成功后将自动跳转到登录页面',
    '确认修改密码',
    {
      confirmButtonText: '确定修改',
      cancelButtonText: '取消',
      type: 'warning'
    }
  )

  passwordLoading.value = true
  
  try {
    const res = await request.put('/v1/users/password', {
      current_password: String(passwordForm.currentPassword),
      new_password: String(passwordForm.newPassword),
      confirm_password: String(passwordForm.confirmPassword)
    })

    if (res.success) {
      ElMessage.success('密码修改成功！请使用新密码重新登录')
      
      resetPasswordForm()
      
      setTimeout(() => {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = '/login?reason=password_changed'
      }, 2000)
    } else {
      ElMessage.error(res.error?.message || '修改失败')
    }
  } catch (error) {
    console.error('[PROFILE] 修改密码失败:', error)
    
    const errorMsg = getErrorMessage(error)
    ElMessage.error(errorMsg)
  } finally {
    passwordLoading.value = false
  }
}

function resetUsernameForm() {
  if (usernameFormRef.value) {
    usernameFormRef.value.resetFields()
  }
  Object.assign(usernameForm, {
    newUsername: '',
    confirmUsername: '',
    password: ''
  })
}

function resetPasswordForm() {
  if (passwordFormRef.value) {
    passwordFormRef.value.resetFields()
  }
  Object.assign(passwordForm, {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
}

function getErrorMessage(error) {
  if (!error) return '操作失败，请稍后重试'

  console.log('[PROFILE] 解析错误信息:', {
    message: error.message,
    status: error.response?.status,
    data: error.response?.data
  })

  // 根据错误码返回具体的用户友好提示
  const errorCode = error.response?.data?.error?.code

  if (error.response?.status === 400) {
    switch (errorCode) {
      case 'PASSWORD_MISMATCH':
        return '两次输入的密码不一致'
      case 'SAME_PASSWORD':
        return '新密码不能与当前密码相同'
      case 'WEAK_PASSWORD':
        return '密码强度不足：需包含大小写字母和数字'
      case 'WRONG_PASSWORD':
        return '当前密码错误，请重新输入'
      case 'INVALID_USERNAME':
        return '用户名格式不正确（只允许字母、数字、下划线和中文）'
      case 'RESERVED_USERNAME':
        return error.response.data.error.message || '该用户名为系统保留名称'
      case 'SAME_USERNAME':
        return '新用户名不能与当前用户名相同'
      case 'DUPLICATE_USERNAME':
        return '该用户名已被其他用户使用'
      default:
        return error.response.data?.error?.message || '请求参数错误，请检查输入'
    }
  }

  if (error.response?.status === 401) {
    return '当前密码错误或会话已过期，请重新登录'
  }

  if (error.response?.status === 403) {
    return '没有权限执行此操作'
  }

  if (error.response?.status === 404) {
    return '接口不存在或用户数据未找到'
  }

  if (error.response?.status === 409) {
    return error.response.data?.error?.message || '数据冲突，请检查输入是否重复'
  }

  if (error.response?.status === 500) {
    console.error('[PROFILE] 服务器500错误详情:', error.response.data)
    return '服务器内部错误，请联系管理员'
  }

  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return '请求超时，请检查网络连接后重试'
  }

  if (error.code === 'ERR_NETWORK') {
    return '网络连接失败，请检查网络设置'
  }

  return error.message || '操作失败，请稍后重试'
}

onMounted(() => {
  fetchUserInfo()
})
</script>

<style scoped>
.profile-container {
  padding: 0;
}

.profile-card {
  border-radius: 12px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
}

.user-overview {
  padding: 20px;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e7ed 100%);
  border-radius: 10px;
  margin-bottom: 16px;
}

.avatar-section {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 20px;
}

.user-basic-info h3 {
  margin: 0 0 6px 0;
  font-size: 20px;
  color: #303133;
}

.user-basic-info p {
  margin: 0 0 8px 0;
  color: #909399;
  font-size: 14px;
}

.account-meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid #dcdfe6;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-item .label {
  font-size: 12px;
  color: #909399;
}

.meta-item .value {
  font-size: 14px;
  color: #303133;
  font-weight: 500;
}

.tab-content {
  padding: 20px 0;
}

.form-tip {
  margin-bottom: 0;
}

.form-tip ul {
  margin: 8px 0 0 0;
  padding-left: 20px;
}

.form-tip li {
  line-height: 1.8;
  font-size: 13px;
  color: #606266;
}

.password-strength {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.strength-label,
.strength-text {
  font-size: 13px;
  font-weight: 500;
}

.security-info {
  background: #f0f9eb;
  padding: 16px 20px;
  border-radius: 8px;
  border-left: 3px solid #67c23a;
}

.security-info h4 {
  margin: 0 0 12px 0;
  color: #67c23a;
  font-size: 15px;
}

.security-info ul {
  margin: 0;
  padding-left: 20px;
}

.security-info li {
  line-height: 2;
  font-size: 14px;
  color: #606266;
}

@media screen and (max-width: 768px) {
  .account-meta {
    grid-template-columns: 1fr;
  }
}
</style>