<template>
  <el-popover
    :visible="popoverVisible"
    placement="bottom-end"
    :width="380"
    trigger="click"
    popper-class="notification-popover"
    @show="handlePopoverShow"
    @hide="popoverVisible = false"
  >
    <template #reference>
      <el-badge :value="unreadCount" :max="99" :hidden="unreadCount === 0">
        <el-icon class="header-icon notification-icon" :class="{ 'has-unread': unreadCount > 0 }">
          <Bell />
        </el-icon>
      </el-badge>
    </template>

    <div class="notification-panel">
      <div class="panel-header">
        <span class="panel-title">通知中心</span>
        <el-button
          v-if="unreadCount > 0"
          type="primary"
          link
          size="small"
          :loading="markAllLoading"
          @click="handleMarkAllRead"
        >
          全部标为已读
        </el-button>
      </div>

      <div v-loading="listLoading" class="notification-list">
        <template v-if="notifications.length > 0">
          <div
            v-for="item in notifications"
            :key="item.id"
            class="notification-item"
            @click="handleItemClick(item)"
          >
            <div class="priority-indicator" :class="`priority-${item.priority}`"></div>
            <div class="notification-body">
              <p class="notification-title">{{ item.title }}</p>
              <p class="notification-desc" v-if="item.content">{{ item.content }}</p>
              <span class="notification-time">{{ formatRelativeTime(item.createdAt) }}</span>
            </div>
          </div>
        </template>
        <el-empty v-else description="暂无新通知" :image-size="80" />
      </div>

      <div class="panel-footer">
        <router-link to="/admin/notifications" class="view-all-link" @click="popoverVisible = false">
          查看全部
          <el-icon><ArrowRight /></el-icon>
        </router-link>
      </div>
    </div>
  </el-popover>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Bell, ArrowRight } from '@element-plus/icons-vue'
import request from '@/utils/request'

const router = useRouter()

const popoverVisible = ref(false)
const unreadCount = ref(0)
const notifications = ref([])
const listLoading = ref(false)
const markAllLoading = ref(false)
let pollingTimer = null

function formatRelativeTime(dateString) {
  const now = new Date()
  const date = new Date(dateString)
  const diff = now - date

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`
  return date.toLocaleDateString('zh-CN')
}

async function fetchUnreadCount() {
  try {
    const res = await request.get('/api/v1/notifications/unread-count', { cache: false })
    unreadCount.value = res.data?.count ?? res.count ?? 0
  } catch (e) {
    console.warn('获取未读数失败:', e.message)
  }
}

async function fetchNotifications() {
  listLoading.value = true
  try {
    const res = await request.get('/api/v1/notifications', {
      params: { status: 'unread', pageSize: 10 },
      cache: false
    })
    notifications.value = res.data?.list ?? res.list ?? []
  } catch (e) {
    console.warn('获取通知列表失败:', e.message)
    notifications.value = []
  } finally {
    listLoading.value = false
  }
}

function handlePopoverShow() {
  fetchNotifications()
}

async function handleItemClick(item) {
  try {
    await request.put(`/api/v1/notifications/${item.id}/read`, {}, { cache: false })
    notifications.value = notifications.value.filter(n => n.id !== item.id)
    await fetchUnreadCount()
    if (item.link) {
      popoverVisible.value = false
      router.push(item.link)
    }
  } catch (e) {
    ElMessage.error('标记已读失败')
  }
}

async function handleMarkAllRead() {
  markAllLoading.value = true
  try {
    await request.put('/api/v1/notifications/read-all', {}, { cache: false })
    ElMessage.success('已全部标记为已读')
    notifications.value = []
    await fetchUnreadCount()
  } catch (e) {
    ElMessage.error('操作失败，请重试')
  } finally {
    markAllLoading.value = false
  }
}

function startPolling() {
  pollingTimer = setInterval(fetchUnreadCount, 30000)
}

function stopPolling() {
  if (pollingTimer) {
    clearInterval(pollingTimer)
    pollingTimer = null
  }
}

onMounted(() => {
  fetchUnreadCount()
  startPolling()
})

onUnmounted(() => {
  stopPolling()
})
</script>

<style scoped>
.header-icon {
  font-size: 18px;
  color: #606266;
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  transition: all 0.3s ease;

  &:hover {
    color: #409eff;
    background-color: rgba(64, 158, 255, 0.1);
    transform: translateY(-1px);
  }
}

.notification-icon.has-unread {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

.notification-panel {
  display: flex;
  flex-direction: column;
  max-height: 420px;
}

.panel-header {
  padding: 12px 16px;
  border-bottom: 1px solid #ebeef5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.panel-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.notification-list {
  overflow-y: auto;
  flex: 1;
  min-height: 120px;
  max-height: 300px;
}

.notification-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: #f5f7fa;
  }
}

.priority-indicator {
  width: 4px;
  height: 100%;
  min-height: 36px;
  border-radius: 2px;
  flex-shrink: 0;
  margin-top: 2px;
}

.priority-urgent { background-color: #F56C6C; }
.priority-high { background-color: #E6A23C; }
.priority-medium { background-color: #409EFF; }
.priority-low { background-color: #909399; }

.notification-body {
  flex: 1;
  min-width: 0;
}

.notification-title {
  margin: 0 0 4px 0;
  font-size: 14px;
  color: #303133;
  font-weight: 500;
  line-height: 1.4;
  word-break: break-word;
}

.notification-desc {
  margin: 0 0 4px 0;
  font-size: 12px;
  color: #606266;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.notification-time {
  font-size: 12px;
  color: #909399;
}

.panel-footer {
  padding: 10px 16px;
  border-top: 1px solid #ebeef5;
  text-align: center;
  flex-shrink: 0;
}

.view-all-link {
  font-size: 13px;
  color: #409eff;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 0.8;
  }
}
</style>

<style>
.notification-popover {
  padding: 0 !important;
  border-radius: 8px !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1) !important;
}
</style>
