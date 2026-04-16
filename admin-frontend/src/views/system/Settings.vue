<template>
  <div class="settings-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>参数设置</span>
        </div>
      </template>
      <el-form :model="settings" label-width="120px" class="settings-form">
        <el-form-item label="系统名称">
          <el-input v-model="settings.systemName" placeholder="请输入系统名称" />
        </el-form-item>
        <el-form-item label="系统版本">
          <el-input v-model="settings.systemVersion" placeholder="请输入系统版本" />
        </el-form-item>
        <el-form-item label="API地址">
          <el-input v-model="settings.apiUrl" placeholder="请输入API地址" />
        </el-form-item>
        <el-form-item label="上传限制">
          <el-input-number v-model="settings.uploadLimit" :min="1" :max="100" :step="1" />
          <span class="unit">MB</span>
        </el-form-item>
        <el-form-item label="缓存时间">
          <el-input-number v-model="settings.cacheTime" :min="1" :max="720" :step="1" />
          <span class="unit">分钟</span>
        </el-form-item>
        <el-form-item label="邮件服务器">
          <el-input v-model="settings.smtpServer" placeholder="请输入SMTP服务器地址" />
        </el-form-item>
        <el-form-item label="邮件端口">
          <el-input-number v-model="settings.smtpPort" :min="1" :max="65535" :step="1" />
        </el-form-item>
        <el-form-item label="邮件账号">
          <el-input v-model="settings.smtpUsername" placeholder="请输入邮件账号" />
        </el-form-item>
        <el-form-item label="邮件密码">
          <el-input v-model="settings.smtpPassword" type="password" placeholder="请输入邮件密码" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="saveSettings">保存设置</el-button>
          <el-button @click="resetSettings">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { systemApi } from '@/api'

const settings = ref({
  systemName: '绮管后台管理系统',
  systemVersion: '1.0.0',
  apiUrl: '/api',
  uploadLimit: 10,
  cacheTime: 60,
  smtpServer: 'smtp.qq.com',
  smtpPort: 465,
  smtpUsername: '',
  smtpPassword: ''
})

const loadSettings = async () => {
  try {
    const response = await systemApi.getSettings()
    if (response.success) {
      settings.value = { ...settings.value, ...response.data }
    }
  } catch (error) {
    ElMessage.error('加载设置失败')
  }
}

const saveSettings = async () => {
  try {
    const response = await systemApi.saveSettings(settings.value)
    if (response.success) {
      ElMessage.success('保存成功')
    }
  } catch (error) {
    ElMessage.error('保存失败')
  }
}

const resetSettings = () => {
  settings.value = {
    systemName: '绮管后台管理系统',
    systemVersion: '1.0.0',
    apiUrl: '/api',
    uploadLimit: 10,
    cacheTime: 60,
    smtpServer: 'smtp.qq.com',
    smtpPort: 465,
    smtpUsername: '',
    smtpPassword: ''
  }
}

onMounted(() => {
  loadSettings()
})
</script>

<style scoped>
.settings-container {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.settings-form {
  margin-top: 20px;
}

.unit {
  margin-left: 10px;
  color: #606266;
}
</style>