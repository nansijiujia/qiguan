<template>
  <div class="notifications-page">
    <el-breadcrumb separator="/" class="breadcrumb">
      <el-breadcrumb-item :to="{ path: '/dashboard' }">首页</el-breadcrumb-item>
      <el-breadcrumb-item>通知中心</el-breadcrumb-item>
    </el-breadcrumb>

    <div class="page-header">
      <h2 class="page-title">通知中心</h2>
      <el-button type="primary" @click="handleMarkAllRead" :disabled="loading">
        <el-icon><Check /></el-icon>全部标为已读
      </el-button>
    </div>

    <ListPageContainer
      :loading="loading"
      :pagination="pagination"
      @size-change="handleSizeChange"
      @current-change="handleCurrentChange"
    >
      <template #toolbar>
        <div class="filter-bar">
          <div class="filter-left">
            <el-select v-model="filters.type" placeholder="全部类型" clearable style="width: 140px;" @change="fetchData">
              <el-option label="订单通知" value="order" />
              <el-option label="系统通知" value="system" />
              <el-option label="安全通知" value="security" />
              <el-option label="操作通知" value="action" />
            </el-select>
            <el-select v-model="filters.status" placeholder="全部状态" clearable style="width: 120px;" @change="fetchData">
              <el-option label="未读" value="unread" />
              <el-option label="已读" value="read" />
              <el-option label="已归档" value="archived" />
            </el-select>
          </div>
          <div class="filter-right">
            <el-input v-model="filters.keyword" placeholder="搜索标题和内容..." prefix-icon="Search" clearable style="width: 260px;" @keyup.enter="fetchData" />
            <el-button type="primary" @click="fetchData">
              <el-icon><Search /></el-icon>搜索
            </el-button>
            <el-button @click="resetFilters">重置</el-button>
          </div>
        </div>
      </template>

      <template #batch-toolbar v-if="selectedIds.length > 0">
        <div class="batch-toolbar">
          <span class="selected-info">已选择 {{ selectedIds.length }} 项</span>
          <el-button type="primary" size="small" @click="handleBatchRead">
            <el-icon><Check /></el-icon>批量标为已读
          </el-button>
          <el-button type="danger" size="small" @click="handleBatchDelete">
            <el-icon><Delete /></el-icon>批量删除
          </el-button>
          <el-button size="small" @click="clearSelection">取消选择</el-button>
        </div>
      </template>

      <template #empty>
        <el-empty v-if="!loading && tableData.length === 0" description="暂无通知记录">
          <el-button type="primary" @click="fetchData">刷新数据</el-button>
        </el-empty>
      </template>

      <el-table
        ref="tableRef"
        :data="tableData"
        stripe
        border
        style="width: 100%"
        @selection-change="handleSelectionChange"
        @row-click="handleRowClick"
      >
        <el-table-column type="selection" width="50" align="center" fixed />

        <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip fixed>
          <template #default="{ row }">
            <div class="title-cell" :class="{ 'is-unread': row.status === 'unread' }">
              <el-icon v-if="row.status === 'unread'" class="unread-dot"><InfoFilled /></el-icon>
              <span>{{ row.title }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="type" label="类型" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="getTypeTagType(row.type)" size="small" effect="dark">
              {{ getTypeText(row.type) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="priority" label="优先级" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getPriorityTagType(row.priority)" size="small" effect="plain">
              {{ getPriorityText(row.priority) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="created_at" label="创建时间" width="170" align="center">
          <template #default="{ row }">
            {{ safeFormatDate(row.created_at) }}
          </template>
        </el-table-column>

        <el-table-column label="操作" width="160" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" text size="small" @click.stop="showDetail(row)">
              <el-icon><View /></el-icon>详情
            </el-button>
            <el-popconfirm title="确定要删除这条通知吗？" confirm-button-text="确定" cancel-button-text="取消" @confirm="handleDelete(row)">
              <template #reference>
                <el-button type="danger" text size="small" @click.stop>
                  <el-icon><Delete /></el-icon>删除
                </el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </ListPageContainer>

    <el-drawer
      v-model="drawerVisible"
      :title="currentNotification?.title || '通知详情'"
      direction="rtl"
      size="480px"
      :before-close="handleDrawerClose"
      class="notification-drawer"
    >
      <div v-if="currentNotification" class="detail-content">
        <div class="detail-section">
          <h4 class="section-title">基本信息</h4>
          <div class="detail-item">
            <label>标题：</label>
            <span>{{ currentNotification.title }}</span>
          </div>
          <div class="detail-item">
            <label>内容：</label>
            <p class="content-text">{{ currentNotification.content }}</p>
          </div>
        </div>

        <div class="detail-section">
          <h4 class="section-title">状态信息</h4>
          <div class="detail-item">
            <label>类型：</label>
            <el-tag :type="getTypeTagType(currentNotification.type)" size="small" effect="dark">
              {{ getTypeText(currentNotification.type) }}
            </el-tag>
          </div>
          <div class="detail-item">
            <label>状态：</label>
            <el-tag :type="getStatusTagType(currentNotification.status)" size="small">
              {{ getStatusText(currentNotification.status) }}
            </el-tag>
          </div>
          <div class="detail-item">
            <label>优先级：</label>
            <el-tag :type="getPriorityTagType(currentNotification.priority)" size="small" effect="plain">
              {{ getPriorityText(currentNotification.priority) }}
            </el-tag>
          </div>
        </div>

        <div class="detail-section" v-if="currentNotification.related_object">
          <h4 class="section-title">关联对象</h4>
          <div class="detail-item">
            <label>关联类型：</label>
            <span>{{ currentNotification.related_type || '-' }}</span>
          </div>
          <div class="detail-item">
            <label>关联ID：</label>
            <el-link
              v-if="currentNotification.type === 'order' && currentNotification.related_id"
              type="primary"
              :underline="false"
              @click="goToOrderDetail(currentNotification.related_id)"
            >
              {{ currentNotification.related_id }}
              <el-icon><Link /></el-icon>
            </el-link>
            <span v-else>{{ currentNotification.related_id || '-' }}</span>
          </div>
        </div>

        <div class="detail-section">
          <h4 class="section-title">时间信息</h4>
          <div class="detail-item">
            <label>创建时间：</label>
            <span>{{ safeFormatDate(currentNotification.created_at) }}</span>
          </div>
          <div class="detail-item">
            <label>阅读时间：</label>
            <span>{{ currentNotification.read_at ? safeFormatDate(currentNotification.read_at) : '未读' }}</span>
          </div>
        </div>

        <div class="drawer-actions">
          <el-button
            v-if="currentNotification.status === 'unread'"
            type="primary"
            @click="handleMarkAsRead(currentNotification.id)"
          >
            标为已读
          </el-button>
          <el-button @click="drawerVisible = false">关闭</el-button>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Search,
  Check,
  Delete,
  View,
  InfoFilled,
  Link
} from '@element-plus/icons-vue'
import ListPageContainer from '@/components/ListPageContainer.vue'
import request from '@/utils/request'

const router = useRouter()
const tableRef = ref(null)
const loading = ref(false)
const tableData = ref([])
const selectedIds = ref([])
const drawerVisible = ref(false)
const currentNotification = ref(null)

const filters = reactive({
  type: '',
  status: '',
  keyword: '',
  page: 1,
  pageSize: 20
})

const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0
})

const fetchData = async () => {
  loading.value = true
  try {
    const params = {
      type: filters.type || undefined,
      status: filters.status || undefined,
      keyword: filters.keyword || undefined,
      page: filters.page,
      pageSize: filters.pageSize
    }
    const response = await request.get('/v1/notifications', { params })
    tableData.value = response.data?.list || response.data || []
    pagination.total = response.data?.total || 0
    pagination.page = filters.page
    pagination.limit = filters.pageSize
  } catch (error) {
    console.error('获取通知列表失败:', error)
    ElMessage.error('获取通知列表失败')
  } finally {
    loading.value = false
  }
}

const handleSizeChange = (size) => {
  filters.pageSize = size
  filters.page = 1
  fetchData()
}

const handleCurrentChange = (page) => {
  filters.page = page
  fetchData()
}

const resetFilters = () => {
  filters.type = ''
  filters.status = ''
  filters.keyword = ''
  filters.page = 1
  fetchData()
}

const handleSelectionChange = (selection) => {
  selectedIds.value = selection.map(item => item.id)
}

const clearSelection = () => {
  tableRef.value?.clearSelection()
  selectedIds.value = []
}

const handleRowClick = (row) => {
  showDetail(row)
}

const showDetail = async (row) => {
  currentNotification.value = row
  drawerVisible.value = true
  if (row.status === 'unread') {
    try {
      await request.put(`/v1/notifications/${row.id}/read`)
      row.status = 'read'
      row.read_at = new Date().toISOString()
    } catch (error) {
      console.error('标记已读失败:', error)
    }
  }
}

const handleDrawerClose = (done) => {
  done()
}

const handleMarkAsRead = async (id) => {
  try {
    await request.put(`/v1/notifications/${id}/read`)
    ElMessage.success('标记成功')
    if (currentNotification.value && currentNotification.value.id === id) {
      currentNotification.value.status = 'read'
      currentNotification.value.read_at = new Date().toISOString()
    }
    fetchData()
  } catch (error) {
    console.error('标记已读失败:', error)
    ElMessage.error('操作失败')
  }
}

const handleBatchRead = async () => {
  if (selectedIds.value.length === 0) return
  try {
    await ElMessageBox.confirm(
      `确定要将选中的 ${selectedIds.value.length} 条通知标为已读吗？`,
      '批量标为已读',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'info' }
    )
    for (const id of selectedIds.value) {
      await request.put(`/v1/notifications/${id}/read`)
    }
    ElMessage.success(`成功将 ${selectedIds.value.length} 条通知标为已读`)
    clearSelection()
    fetchData()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('批量标为已读失败:', error)
      ElMessage.error('操作失败')
    }
  }
}

const handleBatchDelete = async () => {
  if (selectedIds.value.length === 0) return
  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedIds.value.length} 条通知吗？此操作不可恢复！`,
      '批量删除',
      { confirmButtonText: '确定删除', cancelButtonText: '取消', type: 'warning' }
    )
    for (const id of selectedIds.value) {
      await request.delete(`/v1/notifications/${id}`)
    }
    ElMessage.success(`成功删除 ${selectedIds.value.length} 条通知`)
    clearSelection()
    fetchData()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('批量删除失败:', error)
      ElMessage.error('操作失败')
    }
  }
}

const handleDelete = async (row) => {
  try {
    await request.delete(`/v1/notifications/${row.id}`)
    ElMessage.success('删除成功')
    fetchData()
  } catch (error) {
    console.error('删除失败:', error)
    ElMessage.error('删除失败')
  }
}

const handleMarkAllRead = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要将所有未读通知标为已读吗？',
      '全部标为已读',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'info' }
    )
    await request.put('/v1/notifications/read-all')
    ElMessage.success('所有通知已标为已读')
    fetchData()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('全部标为已读失败:', error)
      ElMessage.error('操作失败')
    }
  }
}

const goToOrderDetail = (orderId) => {
  drawerVisible.value = false
  router.push({ path: '/orders', query: { search: orderId } })
}

const getTypeTagType = (type) => {
  const map = {
    order: '',
    system: 'info',
    security: 'danger',
    action: 'warning'
  }
  return map[type] || 'info'
}

const getTypeText = (type) => {
  const map = {
    order: '订单通知',
    system: '系统通知',
    security: '安全通知',
    action: '操作通知'
  }
  return map[type] || type
}

const getStatusTagType = (status) => {
  const map = {
    unread: 'danger',
    read: 'success',
    archived: 'info'
  }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = {
    unread: '未读',
    read: '已读',
    archived: '已归档'
  }
  return map[status] || status
}

const getPriorityTagType = (priority) => {
  const map = {
    low: 'info',
    medium: 'warning',
    high: 'danger',
    urgent: 'danger'
  }
  return map[priority] || 'info'
}

const getPriorityText = (priority) => {
  const map = {
    low: '低',
    medium: '中',
    high: '高',
    urgent: '紧急'
  }
  return map[priority] || priority
}

const safeFormatDate = (dateStr) => {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return '-'
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  } catch (e) {
    return '-'
  }
}

onMounted(() => {
  fetchData()
})
</script>

<style scoped>
.notifications-page {
  padding: 20px;
  background-color: #f5f7fa;
  min-height: calc(100vh - 84px);
}

.breadcrumb {
  margin-bottom: 16px;
  font-size: 14px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
  margin: 0;
}

.filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.filter-left {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.filter-right {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.batch-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background-color: #ecf5ff;
  border-radius: 6px;
  margin-bottom: 16px;
}

.selected-info {
  color: #409eff;
  font-weight: 500;
  font-size: 14px;
}

.title-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;

  &.is-unread {
    font-weight: 600;
    color: #303133;
  }

  &:hover {
    color: #409eff;
  }
}

.unread-dot {
  color: #f56c6c;
  font-size: 10px;
}

.notification-drawer {
  :deep(.el-drawer__header) {
    margin-bottom: 20px;
    padding: 16px 20px;
    border-bottom: 1px solid #ebeef5;
  }

  :deep(.el-drawer__body) {
    padding: 0 20px 20px;
  }
}

.detail-content {
  height: 100%;
  overflow-y: auto;
}

.detail-section {
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid #ebeef5;

  &:last-of-type {
    border-bottom: none;
  }
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 16px 0;
  position: relative;
  padding-left: 12px;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 16px;
    background-color: #409eff;
    border-radius: 2px;
  }
}

.detail-item {
  display: flex;
  align-items: flex-start;
  margin-bottom: 12px;
  line-height: 1.6;

  label {
    width: 80px;
    color: #909399;
    font-size: 13px;
    flex-shrink: 0;
  }

  span {
    color: #303133;
    font-size: 14px;
    word-break: break-all;
  }
}

.content-text {
  margin: 0;
  color: #606266;
  font-size: 14px;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
}

.drawer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 32px;
  padding-top: 20px;
  border-top: 1px solid #ebeef5;
}

@media screen and (max-width: 768px) {
  .notifications-page {
    padding: 12px;
  }

  .filter-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-left,
  .filter-right {
    flex-direction: column;
  }

  .filter-left > *,
  .filter-right > * {
    width: 100% !important;
  }

  .page-header {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }

  .page-title {
    font-size: 20px;
  }

  .notification-drawer {
    :deep(.el-drawer) {
      width: 100% !important;
    }
  }

  .batch-toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .selected-info {
    text-align: center;
  }
}
</style>
