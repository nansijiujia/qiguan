<template>
  <div class="page-loading" :class="`loading-${type}`">
    <!-- Spinner 模式 -->
    <div v-if="type === 'spinner'" class="spinner-container">
      <div class="spinner"></div>
      <p v-if="text" class="loading-text">{{ text }}</p>
    </div>

    <!-- Skeleton 骨架屏模式 -->
    <div v-else-if="type === 'skeleton'" class="skeleton-container">
      <div class="skeleton-header">
        <div class="skeleton-title"></div>
        <div class="skeleton-actions">
          <div class="skeleton-btn"></div>
          <div class="skeleton-btn"></div>
        </div>
      </div>

      <div class="skeleton-filters">
        <div class="skeleton-input" v-for="i in 4" :key="i"></div>
      </div>

      <div class="skeleton-table">
        <div class="table-header">
          <div class="th" v-for="i in 5" :key="i"></div>
        </div>
        <div class="table-body">
          <div class="tr" v-for="row in 8" :key="row">
            <div class="td" v-for="col in 5" :key="col"></div>
          </div>
        </div>
      </div>

      <div class="skeleton-pagination">
        <div class="pagination-item" v-for="i in 7" :key="i"></div>
      </div>
    </div>

    <!-- Dots 点阵模式 -->
    <div v-else-if="type === 'dots'" class="dots-container">
      <div class="dots">
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      </div>
      <p v-if="text" class="loading-text">{{ text }}</p>
    </div>
  </div>
</template>

<script setup>
defineProps({
  type: {
    type: String,
    default: 'spinner',
    validator: (value) => ['spinner', 'skeleton', 'dots'].includes(value)
  },
  text: {
    type: String,
    default: ''
  }
})
</script>

<style scoped>
.page-loading {
  padding: 20px;
  min-height: 400px;
}

/* Spinner 样式 */
.spinner-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 3px solid #e4e7ed;
  border-top-color: #409eff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  margin-top: 16px;
  color: #909399;
  font-size: 14px;
}

/* Skeleton 骨架屏样式 */
.skeleton-container {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
}

.skeleton-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.skeleton-title {
  width: 200px;
  height: 28px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

.skeleton-actions {
  display: flex;
  gap: 12px;
}

.skeleton-btn {
  width: 90px;
  height: 36px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

.skeleton-filters {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.skeleton-input {
  flex: 1;
  min-width: 150px;
  max-width: 200px;
  height: 36px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton-table {
  border: 1px solid #ebeef5;
  border-radius: 4px;
  overflow: hidden;
}

.table-header {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  background: #fafafa;
  border-bottom: 1px solid #ebeef5;
  padding: 12px 16px;
}

.th {
  height: 20px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 3px;
}

.table-body {
  padding: 0;
}

.tr {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  padding: 14px 16px;
  border-bottom: 1px solid #f5f7fa;
}

.tr:last-child {
  border-bottom: none;
}

.td {
  height: 18px;
  background: linear-gradient(90deg, #f5f5f5 25%, #eeeeee 50%, #f5f5f5 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 3px;
}

.skeleton-pagination {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 20px;
}

.pagination-item {
  width: 36px;
  height: 32px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

/* Dots 点阵样式 */
.dots-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
}

.dots {
  display: flex;
  gap: 8px;
}

.dot {
  width: 12px;
  height: 12px;
  background: #409eff;
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
}

.dot:nth-child(1) {
  animation-delay: -0.32s;
}

.dot:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}
</style>
