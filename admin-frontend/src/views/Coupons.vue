<template>
  <div class="coupons-container">
    <!-- 顶部统计卡片 -->
    <el-row :gutter="16" class="stats-row">
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card">
          <el-statistic title="总优惠券数" :value="overviewStats.total">
            <template #prefix><el-icon :size="24"><Ticket /></el-icon></template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card stat-active">
          <el-statistic title="活跃券数量" :value="overviewStats.active_count">
            <template #prefix><el-icon :size="24"><CircleCheck /></el-icon></template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card stat-blue">
          <el-statistic title="今日领取" :value="overviewStats.today_received">
            <template #prefix><el-icon :size="24"><Download /></el-icon></template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card stat-orange">
          <el-statistic title="今日使用" :value="overviewStats.today_used">
            <template #prefix><el-icon :size="24"><ShoppingCart /></el-icon></template>
          </el-statistic>
        </el-card>
      </el-col>
    </el-row>

    <!-- 工具栏 -->
    <el-card shadow="never" class="toolbar-card">
      <div class="toolbar">
        <div class="toolbar-left">
          <el-button type="primary" @click="handleAdd">
            <el-icon><Plus /></el-icon>新建优惠券
          </el-button>
        </div>
        <div class="toolbar-right">
          <el-select v-model="filters.status" placeholder="全部状态" clearable style="width: 130px;" @change="handleFilterChange">
            <el-option label="全部状态" value="" />
            <el-option label="活跃" value="active" />
            <el-option label="停用" value="inactive" />
            <el-option label="已过期" value="expired" />
          </el-select>
          <el-select v-model="filters.type" placeholder="全部类型" clearable style="width: 130px;" @change="handleFilterChange">
            <el-option label="全部类型" value="" />
            <el-option label="固定金额" value="fixed" />
            <el-option label="百分比" value="percent" />
          </el-select>
          <el-input 
            v-model="filters.keyword" 
            placeholder="搜索名称/优惠码..." 
            prefix-icon="Search"
            clearable
            style="width: 220px;"
            @input="debounceSearch"
          />
        </div>
      </div>
    </el-card>

    <!-- 数据表格 -->
    <el-card shadow="never" class="table-card" v-loading="loading">
      <el-table
        :data="tableData"
        stripe
        border
        style="width: 100%"
        @sort-change="handleSortChange"
        empty-text="暂无优惠券数据"
      >
        <el-table-column prop="name" label="名称" min-width="150" show-overflow-tooltip sortable="custom" />

        <el-table-column prop="code" label="优惠码" width="180" align="center">
          <template #default="{ row }">
            <div class="code-cell">
              <span>{{ row.code || '-' }}</span>
              <el-button v-if="row.code" type="primary" text size="small" @click="copyCode(row.code)">
                <el-icon><CopyDocument /></el-icon>
              </el-button>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="type" label="类型" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.type === 'fixed' ? '' : 'success'" size="small">
              {{ getTypeLabel(row.type) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="优惠值" width="110" align="center" sortable="custom">
          <template #default="{ row }">
            <span class="value-text" :class="{ 'percent': row.type === 'percent' }">
              {{ formatCouponValue(row) }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="最低消费" width="110" align="center">
          <template #default="{ row }">
            {{ safeFormatPrice(safeToFloat(row.min_order_amount, 0)) }}
          </template>
        </el-table-column>

        <el-table-column label="库存/已用" width="140" align="center">
          <template #default="{ row }">
            <div class="stock-cell">
              <el-progress 
                :percentage="calculateStockPercentage(row)"
                :stroke-width="8"
                :show-text="false"
              />
              <span class="stock-text">{{ safeFormatNumber(safeToInt(row.used_count, 0)) }}/{{ safeFormatNumber(safeToInt(row.stock, 0)) }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="有效期" width="200" align="center">
          <template #default="{ row }">
            <div class="time-cell">
              <div>{{ formatDate(row.start_time) || '-' }}</div>
              <div>~</div>
              <div>{{ formatDate(row.end_time) || '-' }}</div>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="status" label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="200" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" text size="small" @click="handleEdit(row)">
              <el-icon><Edit /></el-icon>编辑
            </el-button>
            <el-button type="info" text size="small" @click="handleViewStats(row)">
              <el-icon><DataAnalysis /></el-icon>统计
            </el-button>
            <el-button type="danger" text size="small" @click="handleDelete(row)">
              <el-icon><Delete /></el-icon>删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.limit"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="fetchData"
          @current-change="fetchData"
        />
      </div>
    </el-card>

    <!-- 新建/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="650px"
      destroy-on-close
      @closed="resetForm"
    >
      <el-form ref="formRef" :model="formData" :rules="formRules" label-width="120px">
        <el-form-item label="优惠券名称" prop="name">
          <el-input v-model="formData.name" placeholder="请输入优惠券名称" maxlength="100" show-word-limit />
        </el-form-item>

        <el-form-item label="优惠码" prop="code">
          <el-input 
            v-model="formData.code" 
            placeholder="留空自动生成（6-32位大写字母或数字）" 
            maxlength="32"
            @input="handleCodeInput"
          >
            <template #append>
              <el-button @click="generateCode">生成</el-button>
            </template>
          </el-input>
          <div class="form-tip">格式要求：6-32位大写字母和数字的组合</div>
        </el-form-item>

        <el-form-item label="优惠券类型" prop="type">
          <el-radio-group v-model="formData.type">
            <el-radio value="fixed">固定金额</el-radio>
            <el-radio value="percent">百分比折扣</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="优惠值" prop="value">
              <el-input-number 
                v-model="formData.value" 
                :min="0.01" 
                :precision="2" 
                :step="1"
                style="width: 100%;"
              />
              <div class="form-tip">{{ formData.type === 'fixed' ? '单位：元' : '单位：% (0-100)' }}</div>
            </el-form-item>
          </el-col>
          <el-col :span="12" v-if="formData.type === 'percent'">
            <el-form-item label="最大减免额">
              <el-input-number 
                v-model="formData.max_discount" 
                :min="0" 
                :precision="2" 
                :step="10"
                placeholder="可选"
                style="width: 100%;"
              />
              <div class="form-tip">单位：元</div>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="最低消费">
              <el-input-number v-model="formData.min_order_amount" :min="0" :precision="2" :step="50" style="width: 100%;" />
              <div class="form-tip">订单满此金额才可用</div>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="库存数量" prop="stock">
              <el-input-number v-model="formData.stock" :min="1" :step="100" style="width: 100%;" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="每人限领">
          <el-input-number v-model="formData.per_user_limit" :min="1" :max="99" style="width: 150px;" />
        </el-form-item>

        <el-form-item label="有效期" prop="dateRange">
          <el-date-picker
            v-model="formData.dateRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%;"
          />
        </el-form-item>

        <el-form-item label="使用说明">
          <el-input
            v-model="formData.description"
            type="textarea"
            :rows="3"
            placeholder="请输入使用说明"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <!-- 统计详情对话框 -->
    <el-dialog
      v-model="statsDialogVisible"
      title="优惠券统计详情"
      width="800px"
      destroy-on-close
    >
      <div v-if="statsData" class="stats-content">
        <el-descriptions :column="3" border class="stats-info">
          <el-descriptions-item label="优惠券名称">{{ statsData.coupon_name || '-' }}</el-descriptions-item>
          <el-descriptions-item label="总领取数">{{ statsData.received_count ?? 0 }}</el-descriptions-item>
          <el-descriptions-item label="已使用数">{{ statsData.used_count ?? 0 }}</el-descriptions-item>
          <el-descriptions-item label="未使用数">{{ statsData.unused_count ?? 0 }}</el-descriptions-item>
          <el-descriptions-item label="已过期数">{{ statsData.expired_count ?? 0 }}</el-descriptions-item>
          <el-descriptions-item label="使用率">{{ statsData.usage_rate ?? 0 }}%</el-descriptions-item>
        </el-descriptions>

        <el-divider content-position="left">最近领取用户</el-divider>
        
        <el-table :data="statsData.recent_users || []" size="small" max-height="300" empty-text="暂无数据">
          <el-table-column prop="user_id" label="用户ID" width="80" />
          <el-table-column prop="username" label="用户名" width="120" />
          <el-table-column prop="status" label="状态" width="90" align="center">
            <template #default="{ row }">
              <el-tag :type="row.status === 'used' ? 'success' : row.status === 'unused' ? '' : 'info'" size="small">
                {{ getUserStatusLabel(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="received_at" label="领取时间" width="170">
            <template #default="{ row }">
              {{ safeFormatDate(row.received_at) }}
            </template>
          </el-table-column>
          <el-table-column prop="used_at" label="使用时间" width="170">
            <template #default="{ row }">
              {{ safeFormatDate(row.used_at) }}
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Ticket, CircleCheck, Download, ShoppingCart, Edit, Delete, DataAnalysis, CopyDocument, Plus } from '@element-plus/icons-vue'
import { couponApi } from '@/api'
import { usePagination } from '@/composables/usePagination'
import { useTableLoading } from '@/composables/useTableLoading'
import { safeFormatDate, safeFormatNumber, safeFormatPrice, safeToUpper, safeToInt, safeToFloat } from '@/utils/format'

const { pagination } = usePagination(10)
const { loading } = useTableLoading()
const submitting = ref(false)
const dialogVisible = ref(false)
const statsDialogVisible = ref(false)
const isEdit = ref(false)
const currentId = ref(null)
const tableData = ref([])
const statsData = ref(null)

// 统计数据
const overviewStats = reactive({
  total: 0,
  active_count: 0,
  today_received: 0,
  today_used: 0
})

// 筛选条件
const filters = reactive({
  status: '',
  type: '',
  keyword: ''
})

let searchTimer = null

// 筛选条件排序
const sortConfig = reactive({
  prop: '',
  order: ''
})

// 表单数据
const formRef = ref()
const formData = reactive({
  name: '',
  code: '',
  type: 'fixed',
  value: 0,
  min_order_amount: 0,
  max_discount: undefined,
  stock: 100,
  per_user_limit: 1,
  dateRange: [],
  description: ''
})

const formRules = {
  name: [{ required: true, message: '请输入优惠券名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择优惠券类型', trigger: 'change' }],
  value: [{ required: true, message: '请输入优惠值', trigger: 'blur' }],
  stock: [{ required: true, message: '请输入库存数量', trigger: 'blur' }],
  dateRange: [{ required: true, message: '请选择有效期', trigger: 'change' }],
  code: [
    { 
      validator: (rule, value, callback) => {
        if (!value || value.trim() === '') {
          callback(); // 允许为空（自动生成）
          return;
        }
        
        const code = value.trim();
        
        // 长度检查
        if (code.length < 6) {
          callback(new Error('优惠码长度不能少于6位'));
          return;
        }
        
        if (code.length > 32) {
          callback(new Error('优惠码长度不能超过32位'));
          return;
        }
        
        // 格式检查：仅允许大写字母和数字
        if (!/^[A-Z0-9]{6,32}$/.test(code)) {
          callback(new Error('优惠码格式不正确：必须为6-32位大写字母或数字'));
          return;
        }
        
        callback();
      },
      trigger: 'blur'
    }
  ]
}

const dialogTitle = computed(() => isEdit.value ? '编辑优惠券' : '新建优惠券')

// 获取列表数据
const fetchData = async () => {
  if (loading.value) return
  
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      limit: pagination.limit
    }

    if (filters.status) params.status = filters.status
    if (filters.type) params.type = filters.type
    if (filters.keyword) params.keyword = filters.keyword
    if (sortConfig.prop && sortConfig.order) {
      params.sortBy = sortConfig.prop
      params.sortOrder = sortConfig.order === 'ascending' ? 'asc' : 'desc'
    }
    
    const res = await couponApi.getList(params)
    
    // 兼容多种响应格式
    if (res?.data?.data) {
      tableData.value = res.data.data.list || []
      pagination.total = res.data.data.pagination?.total || 0
    } else if (res?.data?.list) {
      tableData.value = res.data.list
      pagination.total = res.data.total || 0
    } else {
      console.warn('[Coupons] API响应格式异常:', res)
      tableData.value = []
      pagination.total = 0
    }
  } catch (error) {
    console.error('[Coupons] 获取优惠券列表失败:', error)
    
    const errorMsg = getErrorMessage(error)
    ElMessage.error(errorMsg)
    
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

// 获取全局统计数据
const fetchOverviewStats = async () => {
  try {
    const res = await couponApi.getOverviewStats()
    if (res?.data?.data) {
      Object.assign(overviewStats, res.data.data)
    }
  } catch (error) {
    console.warn('[Coupons] 获取统计数据失败:', error)
    // 统计数据获取失败不影响主流程，仅记录日志
  }
}

// 错误消息提取工具函数
const getErrorMessage = (error) => {
  if (!error) return '网络错误，请检查网络连接'
  
  if (error.response) {
    const status = error.response.status
    const serverMsg = error.response.data?.error?.message || error.response.data?.message
    
    switch (status) {
      case 400: return serverMsg || '请求参数错误'
      case 401: return '未授权，请重新登录'
      case 403: return '没有权限执行此操作'
      case 404: return '请求的资源不存在'
      case 409: return serverMsg || '数据冲突'
      case 500: return '服务器内部错误，请稍后重试'
      default: return serverMsg || `请求失败 (${status})`
    }
  }
  
  if (error.message) {
    if (error.message.includes('Network') || error.message.includes('network')) {
      return '网络连接失败，请检查网络设置'
    }
    if (error.message.includes('timeout')) {
      return '请求超时，请稍后重试'
    }
    return error.message
  }
  
  return '未知错误，请联系管理员'
}

// 防抖搜索
const debounceSearch = () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    pagination.page = 1
    fetchData()
  }, 500)
}

// 筛选变化
const handleFilterChange = () => {
  pagination.page = 1
  fetchData()
}

// 排序变化
const handleSortChange = ({ prop, order }) => {
  sortConfig.prop = prop
  sortConfig.order = order
  fetchData()
}

// 格式化日期
const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  try {
    return String(dateStr).replace('T', ' ').substring(0, 16)
  } catch (e) {
    return '-'
  }
}

// 获取类型标签
const getTypeLabel = (type) => {
  if (!type) return '未知'
  const map = { fixed: '固定金额', percent: '百分比' }
  return map[type] || type || '未知'
}

// 格式化优惠券优惠值（区分类型）
const formatCouponValue = (row) => {
  if (!row) return '-'
  const type = row.type
  const value = safeToFloat(row.value, 0)
  
  if (type === 'fixed') {
    return safeFormatPrice(value)
  } else if (type === 'percent') {
    return `${safeFormatNumber(value)}%`
  }
  return safeFormatNumber(value)
}

// 计算库存使用百分比（除零保护）
const calculateStockPercentage = (row) => {
  if (!row) return 0
  const stock = safeToInt(row.stock, 0)
  const usedCount = safeToInt(row.used_count, 0)
  
  if (stock <= 0) return 0
  
  const percentage = (usedCount / stock) * 100
  return Math.min(Math.max(percentage, 0), 100)
}

// 获取状态类型
const getStatusType = (status) => {
  if (!status) return 'info'
  const map = { active: 'success', inactive: 'info', expired: 'danger' }
  return map[status] || 'info'
}

// 获取状态标签
const getStatusLabel = (status) => {
  if (!status) return '未知'
  const map = { active: '活跃', inactive: '停用', expired: '已过期' }
  return map[status] || status || '未知'
}

// 获取用户状态标签
const getUserStatusLabel = (status) => {
  if (!status) return '未知'
  const map = { used: '已使用', unused: '未使用', expired: '已过期' }
  return map[status] || status || '未知'
}

// 复制优惠码
const copyCode = async (code) => {
  if (!code) {
    ElMessage.warning('优惠码为空')
    return
  }
  
  try {
    await navigator.clipboard.writeText(code)
    ElMessage.success('优惠码已复制')
  } catch (error) {
    console.error('[Coupons] 复制失败:', error)
    ElMessage.error('复制失败，请手动复制')
  }
}

// 生成优惠码 - 修复toUpperCase错误
const generateCode = () => {
  try {
    const timestamp = Date.now().toString().slice(-8)
    
    // 安全生成随机字符串并转大写
    let randomStr = ''
    try {
      randomStr = Math.random().toString(36).substring(2, 6)
      // 使用安全的toUpperCase方法
      randomStr = typeof randomStr === 'string' ? randomStr.toUpperCase() : randomStr
    } catch (e) {
      console.warn('[Coupons] 生成随机字符串失败，使用备用方案:', e)
      randomStr = 'XXXX'
    }
    
    formData.code = `COUPON${timestamp}${randomStr}`
  } catch (error) {
    console.error('[Coupons] 生成优惠码失败:', error)
    ElMessage.error('生成优惠码失败，请手动输入')
    formData.code = `COUPON${Date.now()}`
  }
}

// 处理优惠码输入 - 自动转大写并过滤非法字符
const handleCodeInput = (value) => {
  if (!value) return
  
  // 过滤非大写字母和数字的字符
  const filtered = value.replace(/[^A-Z0-9]/g, '')
  
  // 转大写（防止小写输入）
  const upperCode = filtered.toUpperCase()
  
  // 更新值（避免重复触发）
  if (formData.code !== upperCode) {
    formData.code = upperCode
  }
}

// 添加
const handleAdd = () => {
  isEdit.value = false
  currentId.value = null
  Object.assign(formData, {
    name: '',
    code: '',
    type: 'fixed',
    value: 0,
    min_order_amount: 0,
    max_discount: undefined,
    stock: 100,
    per_user_limit: 1,
    dateRange: [],
    description: ''
  })
  dialogVisible.value = true
}

// 编辑
const handleEdit = (row) => {
  if (!row || !row.id) {
    ElMessage.warning('无效的优惠券数据')
    return
  }
  
  isEdit.value = true
  currentId.value = row.id
  
  Object.assign(formData, {
    name: row.name || '',
    code: row.code || '',
    type: row.type || 'fixed',
    value: row.value || 0,
    min_order_amount: row.min_order_amount || 0,
    max_discount: row.max_discount,
    stock: row.stock || 100,
    per_user_limit: row.per_user_limit || 1,
    dateRange: [row.start_time, row.end_time],
    description: row.description || ''
  })
  dialogVisible.value = true
}

// 删除
const handleDelete = async (row) => {
  if (!row || !row.id) {
    ElMessage.warning('无效的优惠券数据')
    return
  }
  
  try {
    await ElMessageBox.confirm(
      `确定要删除优惠券"${row.name || '未命名'}"吗？`,
      '确认删除',
      { type: 'warning' }
    )
    
    await couponApi.delete(row.id)
    ElMessage.success('删除成功')
    fetchData()
    fetchOverviewStats()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('[Coupons] 删除失败:', error)
      ElMessage.error(getErrorMessage(error) || '删除失败')
    }
  }
}

// 查看统计
const handleViewStats = async (row) => {
  if (!row || !row.id) {
    ElMessage.warning('无效的优惠券数据')
    return
  }
  
  loading.value = true
  try {
    const res = await couponApi.getStats(row.id)
    if (res?.data?.data) {
      statsData.value = res.data.data
      statsDialogVisible.value = true
    } else {
      ElMessage.warning('暂无统计数据')
    }
  } catch (error) {
    console.error('[Coupons] 获取统计数据失败:', error)
    ElMessage.error(getErrorMessage(error) || '获取统计数据失败')
  } finally {
    loading.value = false
  }
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return
  
  try {
    // 表单验证
    await formRef.value.validate()
  } catch (validationError) {
    console.warn('[Coupons] 表单验证失败:', validationError)
    
    // 找到第一个验证失败的字段并给出具体提示
    const firstError = Object.values(validationError)?.[0]?.[0]?.message
    if (firstError) {
      ElMessage.warning(`表单验证未通过：${firstError}`)
    } else {
      ElMessage.warning('请检查表单填写是否完整和正确')
    }
    return
  }
  
  submitting.value = true
  try {
    const data = {
      name: formData.name?.trim(),
      code: formData.code?.trim() || undefined,
      type: formData.type,
      value: formData.value,
      min_order_amount: formData.min_order_amount || 0,
      stock: formData.stock || 100,
      per_user_limit: formData.per_user_limit || 1,
      start_time: formData.dateRange?.[0],
      end_time: formData.dateRange?.[1],
      description: formData.description?.trim() || ''
    }
    
    // 数据验证 - 二次确认
    if (!data.name || data.name.length < 2) {
      ElMessage.warning('优惠券名称不能为空且至少2个字符')
      return
    }
    
    if (!data.start_time || !data.end_time) {
      ElMessage.warning('请选择有效期（开始时间和结束时间）')
      return
    }
    
    // 验证日期逻辑
    const startDate = new Date(data.start_time)
    const endDate = new Date(data.end_time)
    if (startDate >= endDate) {
      ElMessage.warning('开始时间必须早于结束时间')
      return
    }
    
    // 百分比类型特殊验证
    if (formData.type === 'percent') {
      data.max_discount = formData.max_discount
      
      if (!data.value || data.value <= 0) {
        ElMessage.warning('请输入有效的优惠值（大于0）')
        return
      }
      
      if (data.value > 100) {
        ElMessage.warning('百分比折扣不能超过100%')
        return
      }
      
      if (data.max_discount !== undefined && data.max_discount < 0) {
        ElMessage.warning('最大减免金额不能为负数')
        return
      }
    } else {
      // 固定金额类型验证
      if (!data.value || data.value <= 0) {
        ElMessage.warning('请输入有效的优惠金额（大于0）')
        return
      }
      
      if (data.value > 99999) {
        ElMessage.warning('优惠金额不能超过99999元')
        return
      }
    }
    
    // 库存验证
    if (!data.stock || data.stock < 1) {
      ElMessage.warning('库存数量必须大于0')
      return
    }
    
    console.log('[Coupons] 提交数据:', { ...data, code: data.code ? `${data.code.substring(0, 4)}...` : '自动生成' })
    
    if (isEdit.value) {
      await couponApi.update(currentId.value, data)
      ElMessage.success({
        message: '✅ 优惠券更新成功',
        duration: 3000,
        showClose: true
      })
      console.log('[Coupons] ✅ 更新成功 ID:', currentId.value)
    } else {
      const result = await couponApi.add(data)
      ElMessage.success({
        message: '🎉 优惠券创建成功！已添加到列表',
        duration: 3000,
        showClose: true
      })
      console.log('[Coupons] ✅ 创建成功, 返回数据:', result?.data)
    }
    
    dialogVisible.value = false
    
    // 刷新数据
    fetchData()
    fetchOverviewStats()
    
  } catch (error) {
    console.error('[Coupons] ❌ 提交失败:', error)
    
    const errorMsg = getErrorMessage(error)
    
    // 根据错误类型给出更具体的提示
    if (error.response?.status === 400) {
      const serverMsg = error.response.data?.error?.message || ''
      if (serverMsg.includes('已存在') || serverMsg.includes('重复')) {
        ElMessage.error('❌ 创建失败：优惠码已存在，请更换优惠码后重试')
      } else if (serverMsg.includes('格式') || serverMsg.includes('格式不正确')) {
        ElMessage.error(`❌ 格式错误：${serverMsg}`)
      } else {
        ElMessage.error(`❌ 参数错误：${errorMsg}`)
      }
    } else if (error.response?.status === 500) {
      ElMessage.error('❌ 服务器内部错误，请联系管理员或稍后重试')
      console.error('[Coupons] 500错误详情:', error.response.data)
    } else if (error.response?.status === 409) {
      ElMessage.error('❌ 数据冲突，可能优惠券已被其他操作修改')
    } else {
      ElMessage.error(`❌ ${errorMsg || (isEdit.value ? '更新失败' : '创建失败')}`)
    }
  } finally {
    submitting.value = false
  }
}

// 重置表单
const resetForm = () => {
  if (formRef.value) {
    formRef.value.resetFields()
  }
}

onMounted(() => {
  fetchData()
  fetchOverviewStats()
})
</script>

<style scoped>
.coupons-container {
  padding: 0;
}

.stats-row {
  margin-bottom: 16px;
}

.stat-card {
  text-align: center;
  border-radius: 12px;
  transition: all 0.3s;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.stat-active :deep(.el-statistic__head) {
  color: #67c23a;
}

.stat-blue :deep(.el-statistic__head) {
  color: #409eff;
}

.stat-orange :deep(.el-statistic__head) {
  color: #e6a23c;
}

.toolbar-card {
  margin-bottom: 16px;
  border-radius: 12px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.toolbar-left, .toolbar-right {
  display: flex;
  gap: 8px;
  align-items: center;
}

.table-card {
  border-radius: 12px;
}

.code-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-family: monospace;
  font-weight: 600;
  color: #409eff;
}

.value-text {
  font-weight: 600;
  color: #e6a23c;
}

.value-text.percent {
  color: #67c23a;
}

.stock-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stock-text {
  font-size: 12px;
  color: #909399;
}

.time-cell {
  font-size: 12px;
  line-height: 1.5;
  color: #606266;
}

.pagination-wrapper {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.stats-content {
  padding: 10px 0;
}

.stats-info {
  margin-bottom: 20px;
}
</style>