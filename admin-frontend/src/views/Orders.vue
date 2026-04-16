<template>
  <div class="orders-page">
    <!-- 错误提示横幅 -->
    <el-alert
      v-if="error"
      :title="error"
      type="error"
      show-icon
      closable
      @close="error = ''"
      style="margin-bottom: 16px;"
    >
      <template #default>
        <el-button type="primary" size="small" @click="fetchData" style="margin-top: 8px;">
          重试
        </el-button>
      </template>
    </el-alert>

    <ListPageContainer
      :loading="loading"
      :pagination="pagination"
      @size-change="fetchData"
      @current-change="fetchData"
    >
      <template #toolbar>
        <div class="toolbar">
          <div class="toolbar-left">
            <el-select v-model="filters.status" placeholder="全部状态" clearable style="width: 140px;">
              <el-option label="待付款" value="pending" />
              <el-option label="已付款" value="paid" />
              <el-option label="已发货" value="shipped" />
              <el-option label="已送达" value="delivered" />
              <el-option label="已取消" value="cancelled" />
            </el-select>
          </div>
          <div class="toolbar-right">
            <el-input v-model="filters.keyword" placeholder="搜索订单号/客户..." prefix-icon="Search" clearable style="width: 260px;" @keyup.enter="fetchData" />
            <el-button type="primary" @click="fetchData">搜索</el-button>
            <el-button @click="handleExport">导出</el-button>
          </div>
        </div>
      </template>

      <!-- 空状态 -->
      <template #empty>
        <el-empty v-if="!loading && tableData.length === 0" description="暂无订单数据">
          <el-button type="primary" @click="fetchData">刷新数据</el-button>
        </el-empty>
      </template>

      <el-table :data="tableData" stripe border style="width: 100%">
      <el-table-column prop="order_no" label="订单号" width="200" fixed>
        <template #default="{ row }">
          <span class="order-no">{{ row.order_no }}</span>
        </template>
      </el-table-column>

      <el-table-column prop="customer_name" label="客户" width="120">
        <template #default="{ row }">
          {{ row.customer_name || row.customer_username || '-' }}
        </template>
      </el-table-column>

      <el-table-column label="商品信息" min-width="180">
        <template #default="{ row }">
          <div class="product-info">{{ row.productNames || '暂无' }}</div>
        </template>
      </el-table-column>

      <el-table-column prop="total_amount" label="总金额(¥)" width="110" align="center">
        <template #default="{ row }">
          <span class="amount">¥{{ formatAmount(row.total_amount) }}</span>
        </template>
      </el-table-column>

      <el-table-column label="支付方式" width="100" align="center">
        <template #default="{ row }">
          {{ paymentMethodText(row.payment_method) }}
        </template>
      </el-table-column>

      <el-table-column prop="status" label="状态" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)" size="small" effect="dark">
            {{ getStatusText(row.status) }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column label="创建时间" width="170">
        <template #default="{ row }">
          {{ safeFormatDate(row.created_at) }}
        </template>
      </el-table-column>

      <el-table-column label="操作" width="220" align="center" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" text size="small" @click="showDetail(row)">
            <el-icon><View /></el-icon>详情
          </el-button>
          <el-button 
            v-if="row.status === 'pending'" 
            type="warning" text size="small"
            @click="handleStatusChange(row, 'cancel')"
          >取消</el-button>
          <el-button 
            v-if="row.status === 'paid'" 
            type="success" text size="small"
            @click="handleStatusChange(row, 'ship')"
          >发货</el-button>
          <el-button 
            v-if="row.status === 'shipped'" 
            type="info" text size="small"
            @click="handleStatusChange(row, 'confirm')"
          >确认收货</el-button>
        </template>
      </el-table-column>
    </el-table>
  </ListPageContainer>

    <!-- 订单详情抽屉 -->
    <el-drawer v-model="drawerVisible" :title="'订单详情 - ' + (currentOrder?.order_no || '')" size="560px">
      <div v-loading="detailLoading" class="detail-content">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="订单号">
            <span class="order-no">{{ currentOrder?.order_no || '-' }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="客户">{{ currentOrder?.customer_name || currentOrder?.customer_username || '-' }}</el-descriptions-item>
          <el-descriptions-item label="总金额">
            <span class="amount">¥{{ formatAmount(currentOrder?.total_amount) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="支付方式">
            <el-tag size="small" :type="currentOrder?.payment_method ? '' : 'info'">{{ paymentMethodText(currentOrder?.payment_method) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getStatusType(currentOrder?.status)" effect="dark" size="small">
              {{ getStatusText(currentOrder?.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ safeFormatDate(currentOrder?.created_at) }}</el-descriptions-item>
        </el-descriptions>

        <h4 style="margin: 24px 0 12px;">商品清单</h4>
        <el-table :data="currentOrder?.items || []" size="small">
          <el-table-column width="80" align="center">
            <template #default="{ row }">
              <el-image
                v-if="row.image"
                :src="row.image"
                :preview-src-list="[row.image]"
                fit="cover"
                style="width: 60px; height: 60px; border-radius: 4px;"
              />
              <div v-else style="width: 60px; height: 60px; background: #f5f7fa; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #c0c4cc; font-size: 12px;">无图</div>
            </template>
          </el-table-column>
          <el-table-column prop="product_name" label="商品名称" min-width="140">
            <template #default="{ row }">
              <span class="product-name-cell">{{ row.product_name || row.name || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="quantity" label="数量" width="70" align="center" />
          <el-table-column prop="price" label="单价(¥)" width="90" align="center">
            <template #default="{ row }">¥{{ formatAmount(row.price) }}</template>
          </el-table-column>
          <el-table-column label="小计(¥)" width="100" align="center">
            <template #default="{ row }"><b>¥{{ formatAmount((Number(row.quantity) || 0) * (Number(row.price) || 0)) }}</b></template>
          </el-table-column>
        </el-table>

        <h4 style="margin: 24px 0 12px;">收货信息</h4>
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="收货人">{{ shippingInfo.receiver_name || '-' }}</el-descriptions-item>
          <el-descriptions-item label="联系电话">{{ maskPhone(shippingInfo.phone) }}</el-descriptions-item>
          <el-descriptions-item label="收货地址">{{ fullAddress }}</el-descriptions-item>
        </el-descriptions>

        <h4 style="margin: 24px 0 12px;">物流时间线</h4>
        <el-timeline>
          <el-timeline-item :timestamp="currentOrder?.created_at || '-'" color="#409eff" placement="top">
            <el-card><b>订单创建成功</b></el-card></el-timeline-item>
          <el-timeline-item :timestamp="currentOrder?.paid_at || '待付款'" :color="['paid','shipped','delivered'].includes(currentOrder?.status) ? '#67c23a' : '#e6a23c'" placement="top">
            <el-card>{{ ['paid','shipped','delivered'].includes(currentOrder?.status) ? '已付款' : '等待付款' }}</el-card></el-timeline-item>
          <el-timeline-item :timestamp="currentOrder?.shipped_at || '待发货'" :color="['shipped','delivered'].includes(currentOrder?.status) ? '#409eff' : '#909399'" placement="top">
            <el-card>{{ ['shipped','delivered'].includes(currentOrder?.status) ? '已发货' : '等待发货' }}</el-card></el-timeline-item>
          <el-timeline-item :timestamp="currentOrder?.delivered_at || '待送达'" :color="currentOrder?.status === 'delivered' ? '#67c23a' : '#909399'" placement="top">
            <el-card>{{ currentOrder?.status === 'delivered' ? '已送达' : '等待送达' }}</el-card></el-timeline-item>
        </el-timeline>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { View } from '@element-plus/icons-vue'
import { orderApi } from '@/api'
import ListPageContainer from '@/components/ListPageContainer.vue'
import { usePagination } from '@/composables/usePagination'
import { useTableLoading } from '@/composables/useTableLoading'
import { safeFormatDate, safeFormatPrice } from '@/utils/format'

const { pagination } = usePagination(10)
const { loading } = useTableLoading()

const error = ref('')
const detailLoading = ref(false)
const drawerVisible = ref(false)
const currentOrder = ref(null)
const tableData = ref([])

const filters = reactive({ status: '', keyword: '' })

const formatAmount = (val) => {
  const num = Number(val)
  return isNaN(num) ? '0.00' : num.toFixed(2)
}

const getStatusType = (s) => {
  if (!s) return 'info'
  const statusMap = { pending: 'warning', paid: '', shipped: 'success', delivered: 'success', cancelled: 'danger' }
  return statusMap[s] || 'info'
}
const getStatusText = (s) => {
  if (!s) return '未知'
  const textMap = { pending: '待付款', paid: '已付款', shipped: '已发货', delivered: '已送达', cancelled: '已取消' }
  return textMap[s] || s || '未知'
}

const paymentMethodText = (m) => {
  if (!m) return '未设置'
  const map = { alipay: '支付宝', wechat: '微信支付', bank: '银行卡', cash: '货到付款' }
  return map[m] || m
}

const maskPhone = (phone) => {
  if (!phone) return '-'
  const str = String(phone)
  if (str.length >= 7) return str.slice(0, 3) + '****' + str.slice(-4)
  return str
}

const shippingInfo = computed(() => {
  const addr = currentOrder.value?.shipping_address
  if (!addr || typeof addr === 'string') {
    try { return JSON.parse(addr || '{}') } catch { return {} }
  }
  return addr
})

const fullAddress = computed(() => {
  const info = shippingInfo.value
  const parts = [info.province, info.city, info.district, info.street, info.detail].filter(Boolean)
  return parts.length > 0 ? parts.join('') : '-'
})

const fetchData = async () => {
  loading.value = true
  error.value = ''
  try {
    const params = { page: pagination.page, limit: pagination.limit }
    if (filters.status) params.status = filters.status
    if (filters.keyword) params.keyword = filters.keyword

    const res = await orderApi.getOrders(params)
    if (res?.data && typeof res.data === 'object') {
      const list = Array.isArray(res.data.list) ? res.data.list : []
      tableData.value = list.map(o => ({
        ...o,
        productNames: (Array.isArray(o.items) ? o.items : []).map(i => i.name || i.product_name).join('、') || ''
      }))
      pagination.total = res.data.pagination?.total ?? (Array.isArray(list) ? list.length : 0)
    } else {
      tableData.value = []
      pagination.total = 0
    }
  } catch (err) {
    console.error('获取订单列表失败:', err)
    let errMsg = '网络请求失败，请稍后重试'
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      errMsg = '请求超时，请检查网络后重试'
    } else if (err.response) {
      const status = err.response.status
      if (status >= 500) {
        errMsg = '服务器内部错误，请联系管理员'
      } else if (status === 401) {
        errMsg = '登录已过期，请重新登录'
      } else if (status === 403) {
        errMsg = '没有权限访问'
      } else if (status === 404) {
        errMsg = '请求的资源不存在'
      } else {
        errMsg = err.response.data?.message || err.message || errMsg
      }
    } else if (err.request) {
      errMsg = '网络连接失败，请检查网络'
    }
    error.value = errMsg
    tableData.value = []
    pagination.total = 0
    ElMessage.error(errMsg)
  } finally {
    loading.value = false
  }
}

const showDetail = async (row) => {
  drawerVisible.value = true
  detailLoading.value = true

  try {
    const res = await orderApi.getOrderDetail(row.id)
    currentOrder.value = res?.data || row
  } catch (detailErr) {
    console.error('获取订单详情失败:', detailErr)
    currentOrder.value = row
  } finally {
    detailLoading.value = false
  }
}

const handleStatusChange = async (row, action) => {
  const actions = { cancel: '取消', ship: '发货', confirm: '确认收货' }
  
  await ElMessageBox.confirm(`确定要${actions[action]}此订单吗？`, '提示', { type: 'warning' })
  
  try {
    const apiMap = { cancel: orderApi.cancelOrder, ship: orderApi.shipOrder, confirm: orderApi.confirmOrder }
    await apiMap[action](row.id)
    ElMessage.success(`${actions[action]}成功`)
    fetchData()
  } catch (error) {
    ElMessage.error(`${actions[action]}失败`)
  }
}

const handleExport = () => {
  ElMessage.info('导出功能开发中...')
}

onMounted(() => fetchData())
</script>

<style scoped>
.order-no { font-family: 'Courier New', Consolas, monospace; font-weight: 600; color: #303133; letter-spacing: 0.5px; }
.amount { font-weight: 700; color: #e6a23c; }
.product-info { color: #606266; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.product-name-cell { overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

.detail-content { padding-right: 20px; }
</style>