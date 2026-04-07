<template>
  <div class="header-container">
    <!-- 左侧：折叠按钮和面包屑 -->
    <div class="header-left">
      <el-icon 
        class="collapse-trigger" 
        :size="20" 
        @click="$emit('toggle-sidebar')"
      >
        <Fold />
      </el-icon>
      
      <el-breadcrumb separator="/">
        <el-breadcrumb-item>{{ currentRoute.meta.title || '首页' }}</el-breadcrumb-item>
        <el-breadcrumb-item v-if="currentRoute.meta.subTitle">
          {{ currentRoute.meta.subTitle }}
        </el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <!-- 右侧：工具栏 -->
    <div class="header-right">
      <!-- 搜索框 -->
      <el-input
        v-model="searchText"
        placeholder="搜索..."
        :prefix-icon="Search"
        clearable
        class="search-input"
        @keyup.enter="handleSearch"
      />

      <!-- 全屏切换 -->
      <el-tooltip content="全屏" placement="bottom">
        <el-icon class="header-icon" @click="toggleFullScreen">
          <FullScreen />
        </el-icon>
      </el-tooltip>

      <!-- 通知 -->
      <el-badge :value="3" :max="99">
        <el-icon class="header-icon">
          <Bell />
        </el-icon>
      </el-badge>

      <!-- 用户信息下拉菜单 -->
      <el-dropdown trigger="click" @command="handleCommand">
        <div class="user-info">
          <el-avatar :size="32" icon="UserFilled" />
          <span class="username">管理员</span>
          <el-icon><ArrowDown /></el-icon>
        </div>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="profile">
              <el-icon><User /></el-icon>个人中心
            </el-dropdown-item>
            <el-dropdown-item command="settings">
              <el-icon><Setting /></el-icon>系统设置
            </el-dropdown-item>
            <el-dropdown-item divided command="logout">
              <el-icon><SwitchButton /></el-icon>退出登录
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()

const currentRoute = computed(() => route)
const searchText = ref('')

const emit = defineEmits(['toggle-sidebar'])

const handleSearch = () => {
  if (searchText.value) {
    ElMessage.info(`搜索: ${searchText.value}`)
  }
}

const toggleFullScreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
}

const handleCommand = (command) => {
  switch (command) {
    case 'profile':
      router.push('/profile')
      break
    case 'settings':
      ElMessage.info('系统设置功能开发中...')
      break
    case 'logout':
      ElMessage.success('已退出登录')
      router.push('/login')
      break
  }
}
</script>

<style scoped>
.header-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.collapse-trigger {
  cursor: pointer;
  color: #606266;
  transition: all 0.3s;
  
  &:hover {
    color: #409eff;
  }
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.search-input {
  width: 240px;
}

.header-icon {
  font-size: 18px;
  color: #606266;
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  transition: all 0.3s;
  
  &:hover {
    color: #409eff;
    background-color: rgba(64, 158, 255, 0.1);
  }
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 12px;
  border-radius: 6px;
  transition: all 0.3s;
  
  &:hover {
    background-color: #f5f7fa;
  }
}

.username {
  font-size: 14px;
  color: #303133;
  font-weight: 500;
}
</style>