<template>
  <div class="security-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>安全策略配置</span>
        </div>
      </template>
      <el-form :model="securitySettings" label-width="120px" class="security-form">
        <el-collapse>
          <el-collapse-item title="密码策略">
            <el-form-item label="密码最小长度">
              <el-input-number v-model="securitySettings.passwordMinLength" :min="6" :max="20" :step="1" />
            </el-form-item>
            <el-form-item label="密码复杂度">
              <el-select v-model="securitySettings.passwordComplexity" placeholder="请选择">
                <el-option label="简单" value="simple" />
                <el-option label="中等" value="medium" />
                <el-option label="复杂" value="complex" />
              </el-select>
            </el-form-item>
            <el-form-item label="密码过期时间">
              <el-input-number v-model="securitySettings.passwordExpiryDays" :min="0" :max="365" :step="1" />
              <span class="unit">天 (0表示永不过期)</span>
            </el-form-item>
          </el-collapse-item>
          <el-collapse-item title="登录策略">
            <el-form-item label="登录失败次数限制">
              <el-input-number v-model="securitySettings.loginFailLimit" :min="1" :max="10" :step="1" />
            </el-form-item>
            <el-form-item label="登录失败锁定时间">
              <el-input-number v-model="securitySettings.loginLockMinutes" :min="1" :max="1440" :step="1" />
              <span class="unit">分钟</span>
            </el-form-item>
            <el-form-item label="会话超时时间">
              <el-input-number v-model="securitySettings.sessionTimeoutMinutes" :min="5" :max="480" :step="5" />
              <span class="unit">分钟</span>
            </el-form-item>
          </el-collapse-item>
          <el-collapse-item title="访问控制">
            <el-form-item label="IP白名单">
              <el-input v-model="securitySettings.ipWhitelist" type="textarea" placeholder="多个IP用逗号分隔" rows="3" />
            </el-form-item>
            <el-form-item label="启用HTTPS">
              <el-switch v-model="securitySettings.httpsEnabled" />
            </el-form-item>
            <el-form-item label="启用CSRF保护">
              <el-switch v-model="securitySettings.csrfProtection" />
            </el-form-item>
          </el-collapse-item>
        </el-collapse>
        <el-form-item style="margin-top: 20px">
          <el-button type="primary" @click="saveSecuritySettings">保存设置</el-button>
          <el-button @click="resetSecuritySettings">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { systemApi } from '@/api'

const securitySettings = ref({
  passwordMinLength: 8,
  passwordComplexity: 'medium',
  passwordExpiryDays: 90,
  loginFailLimit: 5,
  loginLockMinutes: 30,
  sessionTimeoutMinutes: 60,
  ipWhitelist: '',
  httpsEnabled: true,
  csrfProtection: true
})

const loadSecuritySettings = async () => {
  try {
    const response = await systemApi.getSecuritySettings()
    if (response.success) {
      securitySettings.value = { ...securitySettings.value, ...response.data }
    }
  } catch (error) {
    ElMessage.error('加载安全设置失败')
  }
}

const saveSecuritySettings = async () => {
  try {
    const response = await systemApi.saveSecuritySettings(securitySettings.value)
    if (response.success) {
      ElMessage.success('保存成功')
    }
  } catch (error) {
    ElMessage.error('保存失败')
  }
}

const resetSecuritySettings = () => {
  securitySettings.value = {
    passwordMinLength: 8,
    passwordComplexity: 'medium',
    passwordExpiryDays: 90,
    loginFailLimit: 5,
    loginLockMinutes: 30,
    sessionTimeoutMinutes: 60,
    ipWhitelist: '',
    httpsEnabled: true,
    csrfProtection: true
  }
}

onMounted(() => {
  loadSecuritySettings()
})
</script>

<style scoped>
.security-container {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.security-form {
  margin-top: 20px;
}

.unit {
  margin-left: 10px;
  color: #606266;
}
</style>