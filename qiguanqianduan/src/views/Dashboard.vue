<template>
  <div class="dashboard-container" v-loading="loading">
    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stat-cards">
      <el-col :xs="24" :sm="12" :md="6" v-for="(item, index) in statCards" :key="index">
        <el-card shadow="hover" class="stat-card" :class="`stat-card-${index}`">
          <div class="stat-content">
            <div class="stat-info">
              <div class="stat-title">{{ item.title }}</div>
              <div class="stat-value">{{ item.value }}</div>
              <div class="stat-trend" :class="item.trend > 0 ? 'up' : 'down'">
                <el-icon><Top v-if="item.trend > 0" /><Bottom v-else /></el-icon>
                {{ Math.abs(item.trend) }}% 较上月
              </div>
            </div>
            <div class="stat-icon" :style="{ backgroundColor: item.iconBg }">
              <el-icon :size="28" :color="item.iconColor"><component :is="item.icon" /></el-icon>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 图表区域 -->
    <el-row :gutter="20" class="chart-section">
      <el-col :xs="24" :lg="16">
        <el-card shadow="hover" class="chart-card">
          <template #header>
            <div class="card-header">
              <span>销售趋势</span>
              <el-radio-group v-model="salesPeriod" size="small">
                <el-radio-button value="7">近7天</el-radio-button>
                <el-radio-button value="30">近30天</el-radio-button>
                <el-radio-button value="90">近90天</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div ref="salesChartRef" style="height: 350px;"></div>
        </el-card>
      </el-col>

      <el-col :xs="24" :lg="8">
        <el-card shadow="hover" class="chart-card">
          <template #header>
            <span>热门商品 TOP5</span>
          </template>
          <div ref="productChartRef" style="height: 350px;"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 最近订单 -->
    <el-card shadow="hover" class="recent-orders">
      <template #header>
        <div class="card-header">
          <span>最近订单</span>
          <el-button type="primary" text @click="$router.push('/orders')">
            查看全部
            <el-icon><ArrowRight /></el-icon>
          </el-button>
        </div>
      </template>
      
      <el-table :data="recentOrders" stripe style="width: 100%">
        <el-table-column prop="order_no" label="订单号" width="180" />
        <el-table-column prop="customer_name" label="客户" width="120" />
        <el-table-column prop="total_amount" label="金额" width="100">
          <template #default="{ row }">
            <span class="amount">¥{{ row.total_amount?.toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'
import * as echarts from 'echarts'
import { dashboardApi, orderApi } from '@/api'

const loading = ref(false)
const salesPeriod = ref('7')
const salesChartRef = ref(null)
const productChartRef = ref(null)
let salesChart = null
let productChart = null

// 统计卡片数据
const statCards = ref([
  { title: '总商品数', value: '1,234', trend: 12.5, icon: 'Goods', iconBg: '#ecf5ff', iconColor: '#409eff' },
  { title: '总订单数', value: '567', trend: 8.3, icon: 'Document', iconBg: '#f0f9eb', iconColor: '#67c23a' },
  { title: '总营收', value: '¥89,432', trend: -2.4, icon: 'Money', iconBg: '#fdf6ec', iconColor: '#e6a23c' },
  { title: '总用户数', value: '8,901', trend: 15.7, icon: 'User', iconBg: '#fef0f0', iconColor: '#f56c6c' }
])

// 最近订单数据
const recentOrders = ref([])

// 状态映射
const getStatusType = (status) => {
  const map = {
    pending: 'warning',
    paid: '',
    shipped: 'success',
    delivered: 'success',
    cancelled: 'danger'
  }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = {
    pending: '待付款',
    paid: '已付款',
    shipped: '已发货',
    delivered: '已送达',
    cancelled: '已取消'
  }
  return map[status] || status
}

// 初始化销售趋势图
const initSalesChart = () => {
  if (!salesChartRef.value) return
  
  if (salesChart) salesChart.dispose()
  salesChart = echarts.init(salesChartRef.value)
  
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' }
    },
    legend: { data: ['销售额', '订单数'] },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
      axisLine: { lineStyle: { color: '#dcdfe6' } }
    },
    yAxis: [
      { type: 'value', name: '销售额(元)', axisLine: { show: false }, splitLine: { lineStyle: { type: 'dashed' } } },
      { type: 'value', name: '订单数', axisLine: { show: false }
    }],
    series: [
      {
        name: '销售额',
        type: 'line',
        smooth: true,
        areaStyle: { opacity: 0.15 },
        data: [3200, 4500, 3800, 5200, 4800, 6500, 7200],
        itemStyle: { color: '#409eff' }
      },
      {
        name: '订单数',
        type: 'bar',
        barWidth: '40%',
        data: [32, 45, 38, 52, 48, 65, 72],
        itemStyle: { 
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#67c23a' },
            { offset: 1, color: '#95d475' }
          ])
        }
      }
    ]
  }
  
  salesChart.setOption(option)
}

// 初始化商品销量图
const initProductChart = () => {
  if (!productChartRef.value) return
  
  if (productChart) productChart.dispose()
  productChart = echarts.init(productChartRef.value)
  
  const option = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'value', axisLine: { show: false }, splitLine: { lineStyle: { type: 'dashed' } } },
    yAxis: {
      type: 'category',
      data: ['无线耳机', '智能手表', '蓝牙音箱', '手机壳', '充电宝'],
      axisLine: { lineStyle: { color: '#dcdfe6' } }
    },
    series: [{
      type: 'bar',
      barWidth: '50%',
      data: [892, 756, 634, 521, 456],
      itemStyle: {
        borderRadius: [0, 4, 4, 0],
        color: (params) => {
          const colors = ['#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#909399']
          return new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: colors[params.dataIndex] },
            { offset: 1, color: colors[params.dataIndex] + '80' }
          ])
        }
      }
    }]
  }
  
  productChart.setOption(option)
}

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    const [overviewRes, ordersRes] = await Promise.all([
      dashboardApi.getOverview(),
      orderApi.getOrders({ limit: 10 })
    ])
    
    if (overviewRes.data?.data) {
      const d = overviewRes.data.data
      statCards.value[0].value = d.totalProducts?.toLocaleString() || '0'
      statCards.value[1].value = d.totalOrders?.toLocaleString() || '0'
      statCards.value[2].value = `¥${d.totalRevenue?.toLocaleString() || '0'}`
      statCards.value[3].value = d.totalUsers?.toLocaleString() || '0'
    }
    
    if (ordersRes.data?.data?.list) {
      recentOrders.value = ordersRes.data.list.slice(0, 10)
    }
  } catch (error) {
    console.error('加载数据失败:', error)
  } finally {
    loading.value = false
  }
}

// 监听窗口大小变化
const handleResize = () => {
  salesChart?.resize()
  productChart?.resize()
}

onMounted(async () => {
  await loadData()
  await nextTick()
  initSalesChart()
  initProductChart()
  window.addEventListener('resize', handleResize)
})

watch(salesPeriod, async () => {
  await loadData()
  initSalesChart()
})
</script>

<style scoped>
.dashboard-container {
  padding: 0;
}

.stat-cards {
  margin-bottom: 20px;
}

.stat-card {
  margin-bottom: 20px;
  border-radius: 12px;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1);
  }
}

.stat-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-info {
  flex: 1;
}

.stat-title {
  font-size: 14px;
  color: #909399;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #303133;
  margin-bottom: 8px;
}

.stat-trend {
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 4px;
  
  &.up { color: #67c23a; }
  &.down { color: #f56c6c; }
}

.stat-icon {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chart-section {
  margin-bottom: 20px;
}

.chart-card {
  border-radius: 12px;
  min-height: 420px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  font-size: 16px;
}

.recent-orders {
  border-radius: 12px;
}

.amount {
  font-weight: 600;
  color: #e6a23c;
}
</style>