<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <h2>绮管电商后台</h2>
        <p>E-commerce Management System</p>
      </div>

      <el-form ref="formRef" :model="form" :rules="rules" class="login-form">
        <el-form-item prop="username">
          <el-input
            v-model="form.username"
            placeholder="用户名"
            prefix-icon="User"
            size="large"
            @keyup.enter="handleLogin"
          />
        </el-form-item>

        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="密码"
            prefix-icon="Lock"
            size="large"
            show-password
            @keyup.enter="handleLogin"
          />
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            size="large"
            class="login-btn"
            :loading="loading"
            @click="handleLogin"
          >
            登 录
          </el-button>
        </el-form-item>
      </el-form>

      <div class="login-tips">
        <p>请使用管理员账号登录</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import request from '@/utils/request'

const router = useRouter()
const formRef = ref(null)
const loading = ref(false)

const form = reactive({
  username: '',
  password: ''
})

const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度至少6位', trigger: 'blur' }
  ]
}

const handleLogin = async () => {
  if (!formRef.value) return

  await formRef.value.validate(async (valid) => {
    if (!valid) return

    loading.value = true
    try {
      const res = await request.post('/v1/auth/login', {
        username: String(form.username || '').trim(),
        password: String(form.password || '')
      })

      console.log('[LOGIN] API Response:', res)
      console.log('[LOGIN] res.success:', res.success)
      console.log('[LOGIN] res.data:', res.data)
      console.log('[LOGIN] res.data?.token:', res.data?.token)

      if (res.success && res.data?.token) {
        localStorage.setItem('token', res.data.token)
        localStorage.setItem('user', JSON.stringify(res.data.user))
        ElMessage.success('登录成功！')
        router.push('/dashboard')
      } else {
        ElMessage.error(res.error?.message || '登录失败')
      }
    } catch (error) {
      console.error('[LOGIN] Error details:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        timestamp: new Date().toISOString()
      })

      if (error.response?.status === 401) {
        ElMessage.error('用户名或密码错误')
      } else if (error.response?.status === 403) {
        ElMessage.error(error.response?.data?.error?.message || '账号已被禁用或未激活')
      } else if (error.response?.status === 500) {
        ElMessage.error('服务器内部错误，请稍后重试')
      } else if (!error.response) {
        ElMessage.error('无法连接到服务器，请检查网络连接')
      } else {
        ElMessage.error(error.response?.data?.error?.message || error.message || '登录失败，请稍后重试')
      }
    } finally {
      loading.value = false
    }
  })
}
</script>

<style scoped>
.login-container {
  width: 100%;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-card {
  width: 420px;
  padding: 40px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.login-header {
  text-align: center;
  margin-bottom: 30px;
}

.login-header h2 {
  font-size: 28px;
  color: #303133;
  margin: 0 0 8px 0;
  font-weight: 600;
}

.login-header p {
  color: #909399;
  font-size: 14px;
  margin: 0;
}

.login-form {
  padding: 0 10px;
}

.login-btn {
  width: 100%;
  height: 44px;
  font-size: 16px;
  border-radius: 8px;
}

.login-tips {
  text-align: center;
  margin-top: 15px;
  color: #909399;
  font-size: 12px;
}

.login-tips p {
  margin: 5px 0;
}
</style>
