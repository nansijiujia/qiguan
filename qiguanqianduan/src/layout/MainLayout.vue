<template>
  <el-container class="layout-container">
    <!-- 侧边栏 -->
    <el-aside :width="isCollapse ? '64px' : '250px'" class="sidebar" :class="{ 'sidebar-mobile': isMobile }">
      <Sidebar :is-collapse="isCollapse" @toggle="toggleSidebar" />
    </el-aside>
    
    <!-- 主内容区域 -->
    <el-container class="main-container">
      <!-- 顶部导航 -->
      <el-header class="header">
        <Header @toggle-sidebar="toggleSidebar" />
      </el-header>
      
      <!-- 内容区域 -->
      <el-main class="main-content">
        <router-view v-slot="{ Component }">
          <transition name="fade-transform" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
      
      <!-- 状态栏 -->
      <el-footer class="status-bar">
        <div class="status-left">
          <span class="status-text">当前用户: 管理员</span>
          <span class="status-text">系统状态: 正常</span>
        </div>
        <div class="status-right">
          <span class="status-text">版本: v1.0.0</span>
          <span class="status-text">{{ currentTime }}</span>
        </div>
      </el-footer>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import Sidebar from './Sidebar.vue'
import Header from './Header.vue'

const isCollapse = ref(false)
const isMobile = ref(false)
const currentTime = ref('')
let timeInterval = null

// 计算当前时间
const updateTime = () => {
  const now = new Date()
  currentTime.value = now.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// 检测屏幕尺寸
const checkScreenSize = () => {
  isMobile.value = window.innerWidth < 768
  if (isMobile.value) {
    isCollapse.value = true
  }
}

const toggleSidebar = () => {
  isCollapse.value = !isCollapse.value
}

onMounted(() => {
  updateTime()
  timeInterval = setInterval(updateTime, 1000)
  checkScreenSize()
  window.addEventListener('resize', checkScreenSize)
})

onUnmounted(() => {
  if (timeInterval) {
    clearInterval(timeInterval)
  }
  window.removeEventListener('resize', checkScreenSize)
})
</script>

<style scoped>
.layout-container {
  height: 100vh;
  width: 100%;
  display: flex;
  flex-direction: row;
}

.sidebar {
  background-color: #181824;
  transition: width 0.3s ease, transform 0.3s ease;
  overflow: hidden;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.15);
  position: relative;
  z-index: 20;
}

.sidebar-mobile {
  position: fixed;
  height: 100vh;
  top: 0;
  left: 0;
  z-index: 1000;
}

.main-container {
  display: flex;
  flex-direction: column;
  flex: 1;
  height: 100%;
  background-color: #f5f7fa;
}

.header {
  height: 60px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: #fff;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  z-index: 10;
}

.main-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  background-color: #f5f7fa;
}

.status-bar {
  height: 40px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: #fff;
  border-top: 1px solid #ebeef5;
  font-size: 12px;
  color: #909399;
}

.status-left,
.status-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.status-text {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 页面过渡动画 */
.fade-transform-enter-active,
.fade-transform-leave-active {
  transition: all 0.3s ease;
}

.fade-transform-enter-from {
  opacity: 0;
  transform: translateX(-30px);
}

.fade-transform-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

/* 响应式设计 */
@media screen and (max-width: 768px) {
  .main-content {
    padding: 12px;
  }
  
  .header {
    padding: 0 12px;
  }
  
  .status-bar {
    padding: 0 12px;
    font-size: 11px;
  }
  
  .status-left,
  .status-right {
    gap: 8px;
  }
}

@media screen and (max-width: 480px) {
  .sidebar {
    transform: translateX(-100%);
  }
  
  .sidebar:not(.is-collapsed) {
    transform: translateX(0);
  }
}
</style>