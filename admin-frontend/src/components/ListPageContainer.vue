<template>
  <div class="list-page-container">
    <!-- 工具栏插槽 -->
    <el-card v-if="$slots.toolbar" shadow="never" class="toolbar-card">
      <slot name="toolbar" />
    </el-card>

    <!-- 主内容插槽 -->
    <el-card shadow="never" class="table-card" v-loading="loading">
      <slot />

      <!-- 分页组件 -->
      <div v-if="showPagination && pagination" class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.limit"
          :total="pagination.total"
          :page-sizes="pageSizes"
          :layout="layout"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
defineProps({
  loading: {
    type: Boolean,
    default: false
  },
  showPagination: {
    type: Boolean,
    default: true
  },
  pagination: {
    type: Object,
    default: () => ({
      page: 1,
      limit: 10,
      total: 0
    })
  },
  pageSizes: {
    type: Array,
    default: () => [10, 20, 50]
  },
  layout: {
    type: String,
    default: 'total, sizes, prev, pager, next'
  }
})

const emit = defineEmits(['size-change', 'current-change'])

const handleSizeChange = (size) => {
  emit('size-change', size)
}

const handleCurrentChange = (page) => {
  emit('current-change', page)
}
</script>

<style scoped>
.list-page-container {
  padding: 0;
}
</style>
