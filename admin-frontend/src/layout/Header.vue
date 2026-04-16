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
      
      <el-breadcrumb separator="/" class="breadcrumb">
        <el-breadcrumb-item>
          <el-icon class="breadcrumb-icon"><HomeFilled /></el-icon>
          {{ currentRoute.meta.title || '首页' }}
        </el-breadcrumb-item>
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
        @focus="handleSearchFocus"
        @blur="handleSearchBlur"
      />

      <!-- 全屏切换 -->
      <el-tooltip content="全屏" placement="bottom">
        <el-icon class="header-icon" @click="toggleFullScreen">
          <FullScreen />
        </el-icon>
      </el-tooltip>

      <!-- 通知中心 -->
      <NotificationCenter />

      <!-- 用户信息下拉菜单 -->
      <el-dropdown trigger="click" @command="handleCommand" class="user-dropdown">
        <div class="user-info" :class="{ 'user-info-active': userMenuActive }">
          <el-avatar :size="32" icon="UserFilled" class="user-avatar" />
          <span class="username">管理员</span>
          <el-icon class="user-arrow"><ArrowDown /></el-icon>
        </div>
        <template #dropdown>
          <el-dropdown-menu class="user-menu">
            <el-dropdown-item command="profile" class="user-menu-item">
              <el-icon class="menu-item-icon"><User /></el-icon>个人中心
            </el-dropdown-item>
            <el-dropdown-item command="settings" class="user-menu-item">
              <el-icon class="menu-item-icon"><Setting /></el-icon>系统设置
            </el-dropdown-item>
            <el-dropdown-item divided command="logout" class="user-menu-item">
              <el-icon class="menu-item-icon"><SwitchButton /></el-icon>退出登录
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
import NotificationCenter from '@/components/NotificationCenter.vue'

const route = useRoute()
const router = useRouter()

const currentRoute = computed(() => route)
const searchText = ref('')
const userMenuActive = ref(false)
const searchFocused = ref(false)

const emit = defineEmits(['toggle-sidebar'])

const handleSearch = () => {
  if (searchText.value) {
    ElMessage.info(`搜索: ${searchText.value}`)
  }
}

const handleSearchFocus = () => {
  searchFocused.value = true
}

const handleSearchBlur = () => {
  searchFocused.value = false
}

const toggleFullScreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
}

const handleCommand = (command) => {
  userMenuActive.value = false
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
  position: relative;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
}

.collapse-trigger {
  cursor: pointer;
  color: #606266;
  transition: all 0.3s ease;
  border-radius: 4px;
  padding: 4px;
  
  &:hover {
    color: #409eff;
    background-color: rgba(64, 158, 255, 0.1);
  }
}

.breadcrumb {
  font-size: 14px;
  
  .breadcrumb-icon {
    font-size: 16px;
    margin-right: 4px;
    color: #409eff;
  }
  
  .el-breadcrumb__inner {
    color: #606266;
    font-weight: 500;
    
    &:hover {
      color: #409eff;
    }
  }
  
  .el-breadcrumb__separator {
    color: #c0c4cc;
    margin: 0 8px;
  }
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-input {
  width: 240px;
  transition: all 0.3s ease;
  
  &.is-focused {
    width: 280px;
  }
  
  .el-input__wrapper {
    border-radius: 20px;
    transition: all 0.3s ease;
    
    &:hover {
      box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.1);
    }
    
    &.is-focus {
      box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
    }
  }
}

.header-icon {
  font-size: 18px;
  color: #606266;
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  transition: all 0.3s ease;
  position: relative;
  
  &:hover {
    color: #409eff;
    background-color: rgba(64, 158, 255, 0.1);
    transform: translateY(-1px);
  }
}

.notification-icon {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
  }
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 12px;
  border-radius: 20px;
  transition: all 0.3s ease;
  position: relative;
  
  &:hover {
    background-color: #f5f7fa;
    transform: translateY(-1px);
  }
  
  &.user-info-active {
    background-color: #f5f7fa;
  }
}

.user-avatar {
  transition: all 0.3s ease;
  
  &:hover {
    transform: scale(1.1);
  }
}

.username {
  font-size: 14px;
  color: #303133;
  font-weight: 500;
  white-space: nowrap;
}

.user-arrow {
  font-size: 12px;
  color: #909399;
  transition: all 0.3s ease;
  
  .user-info:hover & {
    color: #409eff;
    transform: rotate(180deg);
  }
}

.user-menu {
  width: 180px;
  
  .user-menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    transition: all 0.3s ease;
    
    &:hover {
      background-color: #f5f7fa;
    }
  }
  
  .menu-item-icon {
    font-size: 16px;
    color: #606266;
  }
}

/* 响应式设计 */
@media screen and (max-width: 768px) {
  .header-left {
    gap: 12px;
  }
  
  .breadcrumb {
    display: none;
  }
  
  .search-input {
    width: 200px;
    
    &.is-focused {
      width: 240px;
    }
  }
  
  .username {
    display: none;
  }
  
  .header-right {
    gap: 8px;
  }
}

@media screen and (max-width: 480px) {
  .search-input {
    display: none;
  }
}
</style>