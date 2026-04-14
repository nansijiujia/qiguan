<template>
  <div class="logs-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>日志管理</span>
          <el-tabs v-model="activeTab" @tab-click="handleTabClick">
            <el-tab-pane label="操作日志" name="operation"></el-tab-pane>
            <el-tab-pane label="错误日志" name="error"></el-tab-pane>
          </el-tabs>
        </div>
      </template>
      <div class="logs-content">
        <el-form :inline="true" :model="searchForm" class="search-form">
          <el-form-item label="关键字">
            <el-input v-model="searchForm.keyword" placeholder="请输入关键字" style="width: 200px" />
          </el-form-item>
          <el-form-item label="时间范围">
            <el-date-picker
              v-model="searchForm.dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              style="width: 240px"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="searchLogs">查询</el-button>
            <el-button @click="resetSearch">重置</el-button>
          </el-form-item>
        </el-form>
        <el-table :data="logsData" style="width: 100%" :loading="loading">
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="user" label="操作用户" width="120" />
          <el-table-column prop="action" label="操作" width="150" />
          <el-table-column prop="description" label="描述" />
          <el-table-column prop="ip" label="IP地址" width="120" />
          <el-table-column prop="createdAt" label="操作时间" width="180" />
        </el-table>
        <div class="pagination-container">
          <el-pagination
            background
            layout="prev, pager, next"
            :total="total"
            :page-size="pageSize"
            :current-page="currentPage"
            @current-change="handlePageChange"
          />
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { systemApi } from '@/api'

const activeTab = ref('operation')
const searchForm = ref({
  keyword: '',
  dateRange: []
})
const logsData = ref([])
const loading = ref(false)
const total = ref(0)
const pageSize = ref(10)
const currentPage = ref(1)

const loadLogs = async () => {
  loading.value = true
  try {
    const response = await systemApi.getLogs({
      type: activeTab.value,
      keyword: searchForm.value.keyword,
      startDate: searchForm.value.dateRange[0] || '',
      endDate: searchForm.value.dateRange[1] || '',
      page: currentPage.value,
      pageSize: pageSize.value
    })
    if (response.success) {
      logsData.value = response.data.list
      total.value = response.data.total
    }
  } catch (error) {
    ElMessage.error('加载日志失败')
  } finally {
    loading.value = false
  }
}

const handleTabClick = () => {
  currentPage.value = 1
  loadLogs()
}

const searchLogs = () => {
  currentPage.value = 1
  loadLogs()
}

const resetSearch = () => {
  searchForm.value = {
    keyword: '',
    dateRange: []
  }
  currentPage.value = 1
  loadLogs()
}

const handlePageChange = (page) => {
  currentPage.value = page
  loadLogs()
}

onMounted(() => {
  loadLogs()
})
</script>

<style scoped>
.logs-container {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logs-content {
  margin-top: 20px;
}

.search-form {
  margin-bottom: 20px;
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>