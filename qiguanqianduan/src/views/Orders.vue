<template>
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

    <el-table :data="tableData" stripe border style="width: 100%">
      <el-table-column prop="order_no" label="订单号" width="200" fixed>
        <template #default="{ row }">
          <span class="order-no">{{ row.order_no }}</span>
        </template>
      </el-table-column>

      <el-table-column prop="customer_name" label="客户" width="120" />

      <el-table-column label="商品信息" min-width="180">
        <template #default="{ row }">
          <div class="product-info">{{ row.productNames || '暂无' }}</div>
        </template>
      </el-table-column>

      <el-table-column prop="total_amount" label="总金额(¥)" width="110" align="center">
        <template #default="{ row }">
          <span class="amount">¥{{ row.total_amount?.toFixed(2) }}</span>
        </template>
      </el-table-column>

      <el-table-column prop="payment_method" label="支付方式" width="100" align="center" />

      <el-table-column prop="status" label="状态" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)" size="small" effect="dark">
            {{ getStatusText(row.status) }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column prop="created_at" label="创建时间" width="170" />

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
    <el-drawer v-model="drawerVisible" :title="'订单详情 - ' + currentOrder?.order_no" size="500px">
      <div v-loading="detailLoading" class="detail-content">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="订单号">{{ currentOrder?.order_no }}</el-descriptions-item>
          <el-descriptions-item label="客户">{{ currentOrder?.customer_name }}</el-descriptions-item>
          <el-descriptions-item label="总金额">
            <span class="amount">¥{{ currentOrder?.total_amount?.toFixed(2) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="支付方式">{{ currentOrder?.payment_method }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getStatusType(currentOrder?.status)" effect="dark">
              {{ getStatusText(currentOrder?.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ currentOrder?.created_at }}</el-descriptions-item>
        </el-descriptions>

        <h4 style="margin: 24px 0 12px;">商品清单</h4>
        <el-table :data="currentOrder?.items || []" size="small">
          <el-table-column prop="name" label="商品名称" />
          <el-table-column prop="quantity" label="数量" width="80" align="center" />
          <el-table-column prop="price" label="单价" width="100" align="center">
            <template #default="{ row }">¥{{ row.price?.toFixed(2) }}</template>
          </el-table-column>
          <el-table-column prop="subtotal" label="小计" width="110" align="center">
            <template #default="{ row }"><b>¥{{ row.subtotal?.toFixed(2) }}</b></template>
          </el-table-column>
        </el-table>

        <h4 style="margin: 24px 0 12px;">物流信息</h4>
        <el-timeline>
          <el-timeline-item timestamp="2026-04-07 10:30" color="#409eff" placement="top">
          <el-card>订单创建成功</el-card></el-timeline-item>
          <el-timeline-item :timestamp="currentOrder?.paid_at || '待付款'" :color="['paid','shipped','delivered'].includes(currentOrder?.status) ? '#67c23a' : '#e6a23c'" placement="top">
          <el-card>{{ ['paid','shipped','delivered'].includes(currentOrder?.status) ? '已付款' : '等待付款' }}</el-card></el-timeline-item>
          <el-timeline-item :timestamp="currentOrder?.shipped_at || '待发货'" :color="['shipped','delivered'].includes(currentOrder?.status) ? '#409eff' : '#909399'" placement="top">
          <el-card>{{ ['shipped','delivered'].includes(currentOrder?.status) ? '已发货' : '等待发货' }}</el-card></el-timeline-item>
          <el-timeline-item :timestamp="currentOrder?.delivered_at || '待送达'" :color="currentOrder?.status === 'delivered' ? '#67c23a' : '#909399'" placement="top">
          <el-card>{{ currentOrder?.status === 'delivered' ? '已送达' : '等待送达' }}</el-card></el-timeline-item>
        </el-timeline>
      </div>
    </el-drawer>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { View } from '@element-plus/icons-vue'
import { orderApi } from '@/api'
import ListPageContainer from '@/components/ListPageContainer.vue'
import { usePagination } from '@/composables/usePagination'
import { useTableLoading } from '@/composables/useTableLoading'

const { pagination } = usePagination(10)
const { loading } = useTableLoading()

const detailLoading = ref(false)
const drawerVisible = ref(false)
const currentOrder = ref(null)
const tableData = ref([])

const filters = reactive({ status: '', keyword: '' })

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

const fetchData = async () => {
  loading.value = true
  try {
    const params = { page: pagination.page, limit: pagination.limit }
    if (filters.status) params.status = filters.status
    if (filters.keyword) params.keyword = filters.keyword
    
    const res = await orderApi.getOrders(params)
    if (res.data?.data) {
      tableData.value = (res.data.data.list || []).map(o => ({
        ...o,
        productNames: o.items?.map(i => i.name).join('、')
      }))
      pagination.total = res.data.data.pagination?.total || 0
    }
  } catch (error) { ElMessage.error('获取订单列表失败') }
  finally { loading.value = false }
}

const showDetail = async (row) => {
  drawerVisible.value = true
  detailLoading.value = true
  
  try {
    const res = await orderApi.getOrderDetail(row.id)
    if (res.data?.data) {
      currentOrder.value = res.data.data
    } else {
      currentOrder.value = row
    }
  } catch (error) {
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
.order-no { font-family: monospace; font-weight: 600; color: #303133; }
.amount { font-weight: 700; color: #e6a23c; }
.product-info { color: #606266; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.detail-content { padding-right: 20px; }
</style>