<template>
  <div class="dashboard-container" v-loading="loading">
    <!-- 第一行: 8个核心统计卡片 -->
    <el-row :gutter="20" class="stat-cards">
      <el-col :xs="12" :sm="8" :md="6" :lg="3" v-for="(item, index) in statCards" :key="index">
        <el-card shadow="hover" class="stat-card" :class="`stat-card-${index}`">
          <div class="stat-content">
            <div class="stat-info">
              <div class="stat-title">{{ item.title }}</div>
              <div class="stat-value">{{ item.value }}</div>
              <div class="stat-trend" :class="item.trendType === 'up' ? 'up' : 'down'">
                <el-icon v-if="item.trendType === 'up'"><Top /></el-icon>
                <el-icon v-else><Bottom /></el-icon>
                {{ item.trend }} {{ item.trendLabel }}
              </div>
            </div>
            <div class="stat-icon" :style="{ backgroundColor: item.iconBg }">
              <el-icon :size="28" :color="item.iconColor"><component :is="item.icon" /></el-icon>
            </div>
          </div>
          <div class="stat-bar" :style="{ backgroundColor: item.barColor }"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 第二行: 图表区域 (收入趋势 + 订单状态) -->
    <el-row :gutter="20" class="chart-section">
      <el-col :xs="24" :lg="16">
        <el-card shadow="hover" class="chart-card">
          <template #header>
            <div class="card-header">
              <span>📈 收入趋势分析</span>
              <el-radio-group v-model="salesPeriod" size="small" @change="loadSalesData">
                <el-radio-button value="7">近7天</el-radio-button>
                <el-radio-button value="30">近30天</el-radio-button>
                <el-radio-button value="90">近90天</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div ref="revenueChartRef" style="height: 380px;"></div>
        </el-card>
      </el-col>

      <el-col :xs="24" :lg="8">
        <el-card shadow="hover" class="chart-card">
          <template #header>
            <span>📊 订单状态分布</span>
          </template>
          <div ref="statusChartRef" style="height: 380px;"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 第三行: 图表区域 (收藏排行 + 用户增长) -->
    <el-row :gutter="20" class="chart-section">
      <el-col :xs="24" :lg="12">
        <el-card shadow="hover" class="chart-card">
          <template #header>
            <span>⭐ 商品收藏排行榜 Top10</span>
          </template>
          <div ref="favoriteChartRef" style="height: 350px;"></div>
        </el-card>
      </el-col>

      <el-col :xs="24" :lg="12">
        <el-card shadow="hover" class="chart-card">
          <template #header>
            <div class="card-header">
              <span>👥 用户增长趋势</span>
              <el-radio-group v-model="userGrowthPeriod" size="small" @change="updateUserGrowthChart">
                <el-radio-button value="7">7天</el-radio-button>
                <el-radio-button value="30">30天</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div ref="userGrowthChartRef" style="height: 350px;"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 第四行: 实时动态区 -->
    <el-row :gutter="20" class="realtime-section">
      <el-col :span="24">
        <el-card shadow="hover" class="realtime-card">
          <template #header>
            <div class="card-header realtime-header">
              <span>🔔 最近订单动态</span>
              <div class="action-buttons">
                <el-button type="primary" size="small" @click="$router.push('/orders')">
                  查看所有订单
                </el-button>
                <el-button type="success" size="small" @click="$router.push('/products')">
                  管理商品
                </el-button>
                <el-button type="warning" size="small" @click="$router.push('/users')">
                  查看用户
                </el-button>
                <el-button type="info" size="small" @click="loadData" :loading="loading">
                  刷新数据
                </el-button>
              </div>
            </div>
          </template>

          <div class="orders-list-container"
               @mouseenter="pauseScroll"
               @mouseleave="resumeScroll">
            <div class="orders-scroll-wrapper" ref="scrollWrapperRef">
              <div class="order-item" v-for="(order, index) in recentOrders" :key="index">
                <div class="order-left">
                  <div class="order-time">{{ timeAgo(order.createdAt) }}</div>
                  <div class="order-user">
                    <el-avatar :size="32" :icon="UserFilled" />
                    <span class="username">{{ order.username || '匿名用户' }}</span>
                  </div>
                </div>
                <div class="order-center">
                  <div class="order-products">
                    <span v-for="(item, idx) in order.items?.slice(0, 2)" :key="idx" class="product-tag">
                      {{ item.productName }} x{{ item.quantity }}
                    </span>
                    <span v-if="order.items?.length > 2" class="more-items">
                      等{{ order.items.length }}件商品
                    </span>
                  </div>
                  <div class="order-no">订单号: {{ order.orderNo }}</div>
                </div>
                <div class="order-right">
                  <div class="order-amount">¥{{ formatMoney(order.totalAmount) }}</div>
                  <el-tag :type="getStatusType(order.status)" size="small" effect="dark">
                    {{ getStatusText(order.status) }}
                  </el-tag>
                </div>
              </div>
              <div v-if="recentOrders.length === 0" class="empty-orders">
                <el-empty description="暂无订单数据" />
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import * as echarts from 'echarts'
import { UserFilled, Top, Bottom, User, ShoppingCart, Money, Goods,
         TrendCharts, Star, Ticket, Monitor } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { dashboardApi } from '@/api'

const loading = ref(false)
const salesPeriod = ref('30')
const userGrowthPeriod = ref('30')

const revenueChartRef = ref(null)
const statusChartRef = ref(null)
const favoriteChartRef = ref(null)
const userGrowthChartRef = ref(null)
const scrollWrapperRef = ref(null)

let revenueChart = null
let statusChart = null
let favoriteChart = null
let userGrowthChart = null
let scrollInterval = null
let scrollPosition = 0

const statCards = ref([
  {
    title: '总用户数',
    value: '0',
    trend: '15.7%',
    trendType: 'up',
    trendLabel: '较上月',
    icon: 'User',
    iconBg: '#ecf5ff',
    iconColor: '#409eff',
    barColor: '#409eff'
  },
  {
    title: '总订单数',
    value: '0',
    trend: '8.1%',
    trendType: 'up',
    trendLabel: '较上月',
    icon: 'ShoppingCart',
    iconBg: '#f0f9eb',
    iconColor: '#67c23a',
    barColor: '#67c23a'
  },
  {
    title: '总收入',
    value: '¥0',
    trend: '-2.4%',
    trendType: 'down',
    trendLabel: '较上月',
    icon: 'Money',
    iconBg: '#fdf6ec',
    iconColor: '#e6a23c',
    barColor: '#e6a23c'
  },
  {
    title: '总商品数',
    value: '0',
    trend: '12.3%',
    trendType: 'up',
    trendLabel: '较上月',
    icon: 'Goods',
    iconBg: '#f4f4f5',
    iconColor: '#909399',
    barColor: '#909399'
  },
  {
    title: '购物车转化率',
    value: '64.0%',
    trend: '5.2%',
    trendType: 'up',
    trendLabel: '转化率',
    icon: 'TrendCharts',
    iconBg: '#fef0f0',
    iconColor: '#f56c6c',
    barColor: '#f56c6c'
  },
  {
    title: '收藏总数',
    value: '0',
    trend: '23.1%',
    trendType: 'up',
    trendLabel: '较上周',
    icon: 'Star',
    iconBg: '#fdf2f7',
    iconColor: '#eb6fb3',
    barColor: '#eb6fb3'
  },
  {
    title: '活跃优惠券',
    value: '0',
    trend: '57.1%',
    trendType: 'up',
    trendLabel: '使用率',
    icon: 'Ticket',
    iconBg: '#e6f7ff',
    iconColor: '#13c2c2',
    barColor: '#13c2c2'
  },
  {
    title: '在线用户',
    value: '0',
    trend: '实时',
    trendType: 'up',
    trendLabel: '',
    icon: 'Monitor',
    iconBg: '#f0f5ff',
    iconColor: '#1890ff',
    barColor: '#1890ff'
  }
])

const recentOrders = ref([])
let dashboardData = ref(null)

const formatMoney = (value) => {
  return parseFloat(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const formatNumber = (value) => {
  return Number(value || 0).toLocaleString('zh-CN')
}

const timeAgo = (dateStr) => {
  if (!dateStr) return ''
  const now = new Date()
  const date = new Date(dateStr)
  const diff = now - date
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`
  return date.toLocaleDateString('zh-CN')
}

const getStatusType = (status) => {
  if (!status) return 'info'
  const map = {
    pending: 'warning',
    paid: '',
    shipped: 'success',
    completed: 'success',
    cancelled: 'danger'
  }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  if (!status) return '未知'
  const map = {
    pending: '待付款',
    paid: '已付款',
    shipped: '已发货',
    completed: '已完成',
    cancelled: '已取消'
  }
  return map[status] || status || '未知'
}

const initRevenueChart = () => {
  if (!revenueChartRef.value) return

  if (revenueChart) revenueChart.dispose()
  revenueChart = echarts.init(revenueChartRef.value)

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#eee',
      borderWidth: 1,
      textStyle: { color: '#333' }
    },
    legend: {
      data: ['销售额', '订单量'],
      top: 0,
      textStyle: { color: '#666' }
    },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '50px', containLabel: true },
    xAxis: {
      type: 'category',
      data: [],
      axisLine: { lineStyle: { color: '#dcdfe6' } },
      axisLabel: { color: '#909399', fontSize: 11 }
    },
    yAxis: [
      {
        type: 'value',
        name: '销售额(元)',
        position: 'left',
        axisLine: { show: false },
        splitLine: { lineStyle: { type: 'dashed', color: '#ebeef5' } },
        axisLabel: { color: '#909399' }
      },
      {
        type: 'value',
        name: '订单数',
        position: 'right',
        axisLine: { show: false },
        splitLine: { show: false },
        axisLabel: { color: '#909399' }
      }
    ],
    series: [
      {
        name: '销售额',
        type: 'line',
        smooth: true,
        yAxisIndex: 0,
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(64, 158, 255, 0.35)' },
            { offset: 1, color: 'rgba(64, 158, 255, 0.05)' }
          ])
        },
        lineStyle: { width: 3, color: '#409eff' },
        itemStyle: { color: '#409eff' },
        data: []
      },
      {
        name: '订单量',
        type: 'bar',
        yAxisIndex: 1,
        barWidth: '45%',
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#67c23a' },
            { offset: 1, color: '#95d475' }
          ])
        },
        data: []
      }
    ]
  }

  revenueChart.setOption(option)
}

const initStatusChart = () => {
  if (!statusChartRef.value) return

  if (statusChart) statusChart.dispose()
  statusChart = echarts.init(statusChartRef.value)

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      right: '5%',
      top: 'center',
      textStyle: { color: '#666', fontSize: 13 }
    },
    graphic: {
      type: 'text',
      left: 'center',
      top: 'center',
      style: {
        text: '0',
        textAlign: 'center',
        fill: '#303133',
        fontSize: 28,
        fontWeight: 'bold'
      }
    },
    series: [{
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['40%', '50%'],
      avoidLabelOverlap: false,
      label: { show: false },
      emphasis: {
        label: { show: true, fontSize: 16, fontWeight: 'bold' }
      },
      labelLine: { show: false },
      data: [],
      itemStyle: {
        borderRadius: 8,
        borderColor: '#fff',
        borderWidth: 3
      },
      color: ['#f56c6c', '#e6a23c', '#409eff', '#67c23a', '#909399']
    }]
  }

  statusChart.setOption(option)
}

const initFavoriteChart = () => {
  if (!favoriteChartRef.value) return

  if (favoriteChart) favoriteChart.dispose()
  favoriteChart = echarts.init(favoriteChartRef.value)

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: function(params) {
        const data = params[0]
        return `${data.name}<br/>收藏数: <strong>${data.value}</strong>`
      }
    },
    grid: { left: '3%', right: '12%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { type: 'dashed', color: '#ebeef5' } },
      axisLabel: { color: '#909399' }
    },
    yAxis: {
      type: 'category',
      data: [],
      axisLine: { lineStyle: { color: '#dcdfe6' } },
      axisTick: { show: false },
      axisLabel: {
        color: '#606266',
        fontSize: 12,
        formatter: function(value) {
          return value.length > 12 ? value.slice(0, 12) + '...' : value
        }
      }
    },
    series: [{
      type: 'bar',
      barWidth: '55%',
      data: [],
      itemStyle: {
        borderRadius: [0, 6, 6, 0],
        color: function(params) {
          const colors = [
            '#f56c6c', '#e6a23c', '#409eff', '#67c23a', '#eb6fb3',
            '#13c2c2', '#1890ff', '#722ed1', '#fa8c16', '#52c41a'
          ]
          return new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: colors[params.dataIndex % colors.length] },
            { offset: 1, color: colors[params.dataIndex % colors.length] + '99' }
          ])
        }
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowColor: 'rgba(0, 0, 0, 0.2)'
        }
      }
    }]
  }

  favoriteChart.setOption(option)
}

const initUserGrowthChart = () => {
  if (!userGrowthChartRef.value) return

  if (userGrowthChart) userGrowthChart.dispose()
  userGrowthChart = echarts.init(userGrowthChartRef.value)

  const option = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#eee',
      borderWidth: 1,
      textStyle: { color: '#333' }
    },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '40px', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: [],
      axisLine: { lineStyle: { color: '#dcdfe6' } },
      axisLabel: { color: '#909399', fontSize: 11 }
    },
    yAxis: {
      type: 'value',
      name: '新增用户',
      axisLine: { show: false },
      splitLine: { lineStyle: { type: 'dashed', color: '#ebeef5' } },
      axisLabel: { color: '#909399' }
    },
    series: [{
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 8,
      sampling: 'lttb',
      lineStyle: { width: 3, color: '#1890ff' },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(24, 144, 255, 0.4)' },
          { offset: 1, color: 'rgba(24, 144, 255, 0.05)' }
        ])
      },
      itemStyle: {
        color: '#1890ff',
        borderColor: '#fff',
        borderWidth: 2
      },
      data: []
    }]
  }

  userGrowthChart.setOption(option)
}

const loadSalesData = async () => {
  try {
    const res = await dashboardApi.getSalesData({ period: salesPeriod.value })
    if (res.data?.data && revenueChart) {
      const salesData = res.data.data
      const dates = salesData.map(d => d.date.slice(5))
      const revenues = salesData.map(d => d.revenue)
      const orders = salesData.map(d => d.orders)

      revenueChart.setOption({
        xAxis: { data: dates },
        series: [
          { data: revenues },
          { data: orders }
        ]
      })
    }
  } catch (error) {
    console.error('加载销售数据失败:', error)
  }
}

const updateUserGrowthChart = () => {
  if (!dashboardData.value?.userGrowth?.trend || !userGrowthChart) return

  const period = parseInt(userGrowthPeriod.value)
  const trend = dashboardData.value.userGrowth.trend.slice(-period)
  const dates = trend.map(d => d.date.slice(5))
  const counts = trend.map(d => d.count)

  userGrowthChart.setOption({
    xAxis: { data: dates },
    series: [{ data: counts }]
  })
}

const loadData = async () => {
  loading.value = true
  try {
    const overviewRes = await dashboardApi.getOverview()

    if (overviewRes.data?.data) {
      const d = overviewRes.data.data
      dashboardData.value = d

      statCards.value[0].value = formatNumber(d.totalUsers)
      statCards.value[1].value = formatNumber(d.totalOrders)
      statCards.value[2].value = `¥${formatMoney(d.totalRevenue)}`
      statCards.value[3].value = formatNumber(d.totalProducts)

      if (d.cartStats) {
        const conversionRate = d.cartStats.activeCarts && d.cartStats.totalCarts
          ? ((d.cartStats.activeCarts / d.cartStats.totalCarts) * 100).toFixed(1)
          : '0.0'
        statCards.value[4].value = `${conversionRate}%`
      }

      if (d.favoriteStats) {
        statCards.value[5].value = formatNumber(d.favoriteStats.totalFavorites)
      }

      if (d.couponStats) {
        statCards.value[6].value = String(d.couponStats.activeCoupons)
      }

      if (d.realtimeMetrics) {
        statCards.value[7].value = String(d.realtimeMetrics.onlineUsers)
      }

      if (d.recentOrders && Array.isArray(d.recentOrders)) {
        recentOrders.value = d.recentOrders
      }

      await nextTick()

      updateStatusChart(d.orderStatusDistribution || {})
      updateFavoriteChart(d.favoriteStats?.topFavoritedProducts || [])
      updateUserGrowthChartWithFullData(d.userGrowth?.trend || [])
    }

    await loadSalesData()
  } catch (error) {
    console.error('加载数据失败:', error)
    ElMessage.error('加载仪表盘数据失败')
  } finally {
    loading.value = false
  }
}

const updateStatusChart = (distribution) => {
  if (!statusChart) return

  const statusMap = {
    pending: { name: '待付款', color: '#f56c6c' },
    paid: { name: '已付款', color: '#e6a23c' },
    shipped: { name: '已发货', color: '#409eff' },
    completed: { name: '已完成', color: '#67c23a' },
    cancelled: { name: '已取消', color: '#909399' }
  }

  const data = Object.entries(distribution).map(([key, value]) => ({
    name: statusMap[key]?.name || key,
    value: value,
    itemStyle: { color: statusMap[key]?.color }
  }))

  const total = data.reduce((sum, item) => sum + item.value, 0)

  statusChart.setOption({
    series: [{ data }],
    graphic: {
      style: { text: String(total) }
    }
  })
}

const updateFavoriteChart = (topProducts) => {
  if (!favoriteChart || !topProducts.length) return

  const names = topProducts.map(p => p.productName).reverse()
  const values = topProducts.map(p => p.favoriteCount).reverse()

  favoriteChart.setOption({
    yAxis: { data: names },
    series: [{ data: values }]
  })
}

const updateUserGrowthChartWithFullData = (trend) => {
  if (!userGrowthChart || !trend.length) return

  const period = parseInt(userGrowthPeriod.value)
  const displayTrend = trend.slice(-period)
  const dates = displayTrend.map(d => d.date.slice(5))
  const counts = displayTrend.map(d => d.count)

  userGrowthChart.setOption({
    xAxis: { data: dates },
    series: [{ data: counts }]
  })
}

const handleResize = () => {
  revenueChart?.resize()
  statusChart?.resize()
  favoriteChart?.resize()
  userGrowthChart?.resize()
}

const startAutoScroll = () => {
  if (scrollInterval) return
  scrollInterval = setInterval(() => {
    if (!scrollWrapperRef.value || recentOrders.value.length <= 5) return
    scrollPosition += 1
    if (scrollPosition >= scrollWrapperRef.value.scrollHeight / 2) {
      scrollPosition = 0
    }
    scrollWrapperRef.value.scrollTop = scrollPosition
  }, 50)
}

const pauseScroll = () => {
  if (scrollInterval) {
    clearInterval(scrollInterval)
    scrollInterval = null
  }
}

const resumeScroll = () => {
  startAutoScroll()
}

onMounted(async () => {
  await loadData()
  await nextTick()

  initRevenueChart()
  initStatusChart()
  initFavoriteChart()
  initUserGrowthChart()

  window.addEventListener('resize', handleResize)

  setTimeout(() => {
    startAutoScroll()
  }, 1000)

  setInterval(loadData, 300000)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  pauseScroll()
  revenueChart?.dispose()
  statusChart?.dispose()
  favoriteChart?.dispose()
  userGrowthChart?.dispose()
})

watch(salesPeriod, async () => {
  await loadSalesData()
})

watch(userGrowthPeriod, () => {
  updateUserGrowthChart()
})
</script>

<style scoped>
.dashboard-container {
  padding: 0;
  background: #f5f7fa;
  min-height: calc(100vh - 84px);
}

.stat-cards {
  margin-bottom: 20px;
  padding: 0;
}

.stat-card {
  margin-bottom: 16px;
  border-radius: 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  position: relative;

  &:hover {
    transform: translateY(-6px);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
  }

  .el-card__body {
    padding: 20px;
  }
}

.stat-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
  z-index: 1;
}

.stat-info {
  flex: 1;
}

.stat-title {
  font-size: 13px;
  color: #909399;
  margin-bottom: 8px;
  font-weight: 500;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: 26px;
  font-weight: 700;
  color: #303133;
  margin-bottom: 8px;
  line-height: 1.2;
}

.stat-trend {
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;

  &.up { color: #67c23a; }
  &.down { color: #f56c6c; }
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transition: transform 0.3s ease;

  .stat-card:hover & {
    transform: scale(1.1) rotate(5deg);
  }
}

.stat-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  transition: width 0.3s ease;
}

.chart-section {
  margin-bottom: 20px;
}

.chart-card {
  border-radius: 12px;
  min-height: 440px;

  .el-card__header {
    padding: 16px 20px;
    border-bottom: 1px solid #f0f0f0;
  }

  .el-card__body {
    padding: 16px 20px;
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  font-size: 15px;
  color: #303133;
}

.realtime-section {
  margin-bottom: 20px;
}

.realtime-card {
  border-radius: 12px;

  .el-card__header {
    padding: 16px 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px 12px 0 0;

    .card-header {
      color: #fff;
    }
  }
}

.realtime-header {
  .action-buttons {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;

    .el-button {
      background: rgba(255, 255, 255, 0.2);
      border-color: rgba(255, 255, 255, 0.3);
      color: #fff;

      &:hover {
        background: rgba(255, 255, 255, 0.3);
        border-color: rgba(255, 255, 255, 0.5);
        color: #fff;
      }
    }
  }
}

.orders-list-container {
  max-height: 380px;
  overflow: hidden;
  position: relative;
}

.orders-scroll-wrapper {
  max-height: 380px;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.order-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #f5f5f5;
  transition: all 0.3s ease;
  background: #fff;

  &:hover {
    background: #fafafa;
    transform: translateX(4px);
  }

  &:last-child {
    border-bottom: none;
  }
}

.order-left {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 120px;
}

.order-time {
  font-size: 12px;
  color: #909399;
  font-weight: 500;
}

.order-user {
  display: flex;
  align-items: center;
  gap: 8px;

  .username {
    font-size: 14px;
    color: #303133;
    font-weight: 500;
  }
}

.order-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0 20px;
}

.order-products {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;

  .product-tag {
    font-size: 13px;
    color: #606266;
    background: #f5f7fa;
    padding: 4px 10px;
    border-radius: 4px;
  }

  .more-items {
    font-size: 12px;
    color: #909399;
    padding: 4px 0;
  }
}

.order-no {
  font-size: 11px;
  color: #c0c4cc;
  font-family: monospace;
}

.order-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  min-width: 120px;
}

.order-amount {
  font-size: 18px;
  font-weight: 700;
  color: #f56c6c;
  font-family: 'DIN Alternate', sans-serif;
}

.empty-orders {
  padding: 40px 0;
}

@media (max-width: 768px) {
  .stat-card {
    margin-bottom: 12px;
  }

  .stat-value {
    font-size: 22px;
  }

  .stat-icon {
    width: 48px;
    height: 48px;
  }

  .order-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .order-right {
    align-items: flex-start;
    flex-direction: row;
    justify-content: space-between;
    width: 100%;
  }

  .realtime-header {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }

  .action-buttons {
    width: 100%;
  }
}
</style>
