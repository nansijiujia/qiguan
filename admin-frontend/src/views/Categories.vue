<template>
  <div class="categories-container" v-if="!hasError">
    <ListPageContainer
      :loading="loading"
      :pagination="pagination"
      @size-change="handlePageChange"
      @current-change="handlePageChange"
    >
      <template #toolbar>
        <div class="toolbar">
          <el-button type="primary" @click="handleAdd" :disabled="loading">
            <el-icon><Plus /></el-icon>添加分类
          </el-button>
          <el-input
            v-model="keyword"
            placeholder="搜索分类..."
            prefix-icon="Search"
            clearable
            style="width: 260px;"
            :disabled="loading"
            @keyup.enter="handleSearch"
          />
          <el-button 
            v-if="isUsingCache" 
            type="warning" 
            size="small" 
            plain
            @click="forceRefresh"
            :loading="loading"
          >
            <el-icon><Refresh /></el-icon>网络异常，显示缓存数据
          </el-button>
        </div>
      </template>

      <!-- 加载骨架屏 -->
      <template v-if="loading && tableData.length === 0">
        <el-skeleton :rows="5" animated />
      </template>

      <!-- 空状态展示 -->
      <template v-else-if="!loading && filteredData.length === 0 && !hasError">
        <el-empty description="暂无分类数据">
          <el-button type="primary" @click="handleAdd">添加第一个分类</el-button>
        </el-empty>
      </template>

      <!-- 错误状态展示 -->
      <template v-else-if="hasError && !loading">
        <div class="error-state">
          <el-result icon="error" :title="errorTitle" :sub-title="errorMessage">
            <template #extra>
              <el-button type="primary" @click="retryFetch">重试</el-button>
            </template>
          </el-result>
        </div>
      </template>

      <!-- 数据表格 -->
      <el-table 
        v-show="!loading || tableData.length > 0"
        :data="tableData" 
        stripe 
        border 
        style="width: 100%"
        v-loading="loading"
        empty-text="暂无匹配的分类数据"
      >
        <el-table-column prop="name" label="分类名称" min-width="200">
          <template #default="{ row }">
            <div class="category-name">
              <el-icon :size="18" color="#409eff"><Folder /></el-icon>
              {{ safeString(row.name, '未命名分类') }}
              <el-tag v-if="row.parent_id" size="small" type="info" class="child-tag">子类</el-tag>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="排序" width="80" align="center">
          <template #default="{ row }">
            {{ safeToInt(row.sortOrder ?? row.sort_order, 0) }}
          </template>
        </el-table-column>

        <el-table-column label="状态" width="120" align="center">
          <template #default="{ row }">
            <div class="status-cell">
              <el-switch
                :model-value="getStatusBoolean(row.status)"
                active-value="true"
                inactive-value="false"
                @change="(val) => handleStatusChange(row, val ? 'active' : 'inactive')"
                :loading="row._statusLoading"
                :disabled="row._statusLoading"
              />
              <span class="status-text" :class="`status-${safeString(row.status, 'unknown')}`">
                {{ getStatusLabel(row.status) }}
              </span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="商品数" width="90" align="center">
          <template #default="{ row }">
            <el-tag type="info" size="small">{{ safeToInt(row.productCount ?? row.product_count ?? 0, 0) }}</el-tag>
          </template>
        </el-table-column>

        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">
            {{ safeDate(row.created_at) }}
          </template>
        </el-table-column>

        <el-table-column label="操作" width="180" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" text size="small" @click="handleEdit(row)" :disabled="row._loading || loading">
              <el-icon><Edit /></el-icon>编辑
            </el-button>
            <el-button 
              type="danger" 
              text 
              size="small" 
              @click="handleDelete(row)" 
              :disabled="row._loading || loading || safeToInt(row.productCount ?? row.product_count ?? 0, 0) > 0"
            >
              <el-icon><Delete /></el-icon>删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </ListPageContainer>

    <!-- 添加/编辑对话框 -->
    <el-dialog 
      v-model="dialogVisible" 
      :title="isEdit ? '编辑分类' : '添加分类'" 
      width="480px" 
      destroy-on-close
      :close-on-click-modal="false"
      :close-on-press-escape="!submitting"
    >
      <el-form ref="formRef" :model="formData" :rules="rules" label-width="80px">
        <el-form-item label="名称" prop="name">
          <el-input 
            v-model="formData.name" 
            placeholder="请输入分类名称" 
            maxlength="50" 
            show-word-limit 
            clearable
            :disabled="submitting"
          />
        </el-form-item>

        <el-form-item label="父分类">
          <el-select 
            v-model="formData.parentId" 
            placeholder="无（顶级分类）" 
            clearable 
            style="width: 100%;"
            :loading="categoriesLoading"
            :disabled="submitting"
          >
            <el-option
              v-for="item in categoryOptions"
              :key="safeToString(item.id)"
              :label="safeString(item.name, '未命名分类')"
              :value="item.id"
              :disabled="item.id === currentId"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="排序值" prop="sortOrder">
          <el-input-number 
            v-model="formData.sortOrder" 
            :min="0" 
            :max="9999" 
            style="width: 100%;"
            :disabled="submitting"
          />
        </el-form-item>

        <el-form-item label="状态">
          <el-switch 
            v-model="formData.status" 
            active-value="active" 
            inactive-value="inactive" 
            active-text="启用" 
            inactive-text="禁用"
            :disabled="submitting"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false" :disabled="submitting">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>

  <!-- 错误边界回退UI -->
  <div v-else class="error-boundary">
    <el-result
      icon="warning"
      title="页面出现异常"
      sub-title="组件渲染时发生错误，请尝试刷新页面或联系管理员"
    >
      <template #extra>
        <el-button type="primary" @click="recoverFromError">
          <el-icon><Refresh /></el-icon>重新加载
        </el-button>
        <el-button v-if="isDevelopment" @click="showErrorDetails = true">
          查看错误详情
        </el-button>
      </template>
    </el-result>
    
    <!-- 开发模式错误详情 -->
    <el-dialog v-model="showErrorDetails" title="错误详情" width="600px">
      <pre class="error-details">{{ boundaryError }}</pre>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick, onErrorCaptured } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { categoryApi } from '@/api'
import ListPageContainer from '@/components/ListPageContainer.vue'
import { usePagination } from '@/composables/usePagination'
import { useTableLoading } from '@/composables/useTableLoading'
import {
  safeString,
  safeToUpper,
  safeToLower,
  safeToInt,
  safeToFloat,
  safeDate,
  safeJsonParse,
  safeTrim,
  safeToString,
  safeToBoolean
} from '@/utils/format'

const { pagination } = usePagination(10)
const { loading } = useTableLoading()

// 错误边界相关状态
const hasError = ref(false)
const boundaryError = ref(null)
const showErrorDetails = ref(false)
const isDevelopment = import.meta.env?.DEV || import.meta.env?.MODE === 'development'

// 缓存机制
const cacheKey = 'categories_cache'
const cacheExpiry = 5 * 60 * 1000 // 5分钟过期
const isUsingCache = ref(false)

// UI状态
const submitting = ref(false)
const categoriesLoading = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const currentId = ref(null)
const keyword = ref('')
const tableData = ref([])
const filteredData = ref([])
const errorTitle = ref('加载失败')
const errorMessage = ref('')

// 表单相关
const formRef = ref()
const formData = reactive({ name: '', parentId: null, sortOrder: 0, status: 'active' })
const categoryOptions = ref([])
const rules = {
  name: [
    { required: true, message: '请输入分类名称', trigger: 'blur' },
    { min: 1, max: 50, message: '分类名称长度应在1-50个字符之间', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9\u4e00-\u9fa5\s\-_]+$/, message: '分类名称包含非法字符', trigger: 'blur' }
  ],
  sortOrder: [
    { type: 'number', min: 0, max: 9999, message: '排序值应在0-9999之间', trigger: 'blur' }
  ]
}

// 状态枚举映射（安全映射）
const statusMap = {
  'active': { label: '启用', type: 'success', boolean: true },
  'inactive': { label: '禁用', type: 'danger', boolean: false },
  'unknown': { label: '未知', type: 'info', boolean: false }
}

/**
 * 安全获取状态标签
 */
const getStatusLabel = (status) => {
  const statusKey = safeString(status, 'unknown').toLowerCase()
  return statusMap[statusKey]?.label || statusMap['unknown'].label
}

/**
 * 安全获取状态布尔值
 */
const getStatusBoolean = (status) => {
  const statusKey = safeString(status, 'unknown').toLowerCase()
  return statusMap[statusKey]?.boolean ?? false
}

/**
 * 错误捕获钩子（Vue错误边界）
 */
onErrorCaptured((error, instance, info) => {
  console.error('[Categories ErrorBoundary] 捕获到错误:', error)
  console.error('[Categories ErrorBoundary] 组件信息:', instance?.$options?.name)
  console.error('[Categories ErrorBoundary] 错误信息:', info)
  
  hasError.value = true
  boundaryError.value = {
    message: error.message,
    stack: error.stack,
    componentInfo: info,
    timestamp: new Date().toISOString()
  }
  
  return false // 阻止错误继续向上传播
})

/**
 * 从错误中恢复
 */
const recoverFromError = () => {
  hasError.value = false
  boundaryError.value = null
  showErrorDetails.value = false
  tableData.value = []
  fetchData(true)
}

/**
 * 缓存管理工具
 */
const cacheManager = {
  /**
   * 获取缓存数据
   */
  get() {
    try {
      const cached = localStorage.getItem(cacheKey)
      if (!cached) return null
      
      const parsed = safeJsonParse(cached, null)
      if (!parsed) return null
      
      // 检查是否过期
      const now = Date.now()
      if (now - parsed.timestamp > cacheExpiry) {
        localStorage.removeItem(cacheKey)
        return null
      }
      
      return parsed.data
    } catch (e) {
      console.warn('[Categories Cache] 读取缓存失败:', e)
      return null
    }
  },
  
  /**
   * 设置缓存数据
   */
  set(data) {
    try {
      const cacheData = {
        data: data,
        timestamp: Date.now()
      }
      localStorage.setItem(cacheKey, JSON.stringify(cacheData))
    } catch (e) {
      console.warn('[Categories Cache] 写入缓存失败:', e)
    }
  },
  
  /**
   * 清除缓存
   */
  clear() {
    try {
      localStorage.removeItem(cacheKey)
    } catch (e) {
      console.warn('[Categories Cache] 清除缓存失败:', e)
    }
  }
}

/**
 * 强制刷新（清除缓存后重新获取）
 */
const forceRefresh = () => {
  cacheManager.clear()
  isUsingCache.value = false
  fetchData(true)
}

/**
 * 重试获取数据
 */
const retryFetch = () => {
  hasError.value = false
  errorMessage.value = ''
  errorTitle.value = ''
  fetchData(true)
}

/**
 * 获取友好的错误消息
 */
const getErrorMessage = (error) => {
  if (!error) return '网络错误，请检查网络连接'
  
  if (error.response) {
    const status = safeToInt(error.response.status, 0)
    const serverMsg = safeString(
      error.response.data?.error?.message || 
      error.response.data?.message ||
      error.response.data?.error,
      ''
    )
    
    switch (status) {
      case 400: return serverMsg || '请求参数错误，请检查输入内容'
      case 401: return '登录已过期，请重新登录'
      case 403: return '没有权限执行此操作'
      case 404: return '请求的资源不存在或已被删除'
      case 409: return serverMsg || '数据冲突，请刷新后重试'
      case 422: return serverMsg || '数据验证失败，请检查表单内容'
      case 500: return '服务器内部错误，请稍后重试'
      case 502: return '服务器网关错误，请稍后重试'
      case 503: return '服务暂时不可用，请稍后重试'
      default: return serverMsg || `请求失败 (${status})`
    }
  }
  
  if (error.message) {
    const errorMsg = safeToLower(error.message, '')
    if (errorMsg.includes('network') || errorMsg.includes('net::err')) {
      return '网络连接失败，请检查网络设置'
    }
    if (errorMsg.includes('timeout')) {
      return '请求超时，请稍后重试'
    }
    if (errorMsg.includes('abort')) {
      return '请求已取消'
    }
    return safeString(error.message, '未知错误')
  }
  
  return '未知错误，请联系管理员'
}

/**
 * 核心数据获取函数（带多层降级策略）
 * @param {boolean} forceRefresh - 是否强制刷新（忽略缓存）
 */
const fetchData = async (forceRefreshFlag = false) => {
  if (loading.value && !forceRefreshFlag) return
  
  loading.value = true
  isUsingCache.value = false
  hasError.value = false
  
  try {
    // 尝试从API获取数据
    let res
    
    try {
      res = await categoryApi.getCategories()
      
      // API调用成功，更新缓存
      if (res?.data) {
        const rawData = res.data.list || res.data || []
        if (Array.isArray(rawData) && rawData.length > 0) {
          cacheManager.set(rawData)
        }
      }
    } catch (apiError) {
      console.warn('[Categories] API调用失败，尝试使用缓存:', apiError)
      
      // API失败，尝试使用缓存
      const cachedData = cacheManager.get()
      
      if (cachedData && Array.isArray(cachedData)) {
        isUsingCache.value = true
        ElMessage.warning('网络连接异常，当前显示的是缓存数据')
        
        // 构造模拟的响应对象
        res = { data: { list: cachedData } }
      } else {
        // 无缓存可用，抛出错误
        throw apiError
      }
    }
    
    // 验证和处理响应数据
    if (!res?.data) {
      console.warn('[Categories] API返回数据格式异常:', res)
      throw new Error('返回数据格式异常')
    }
    
    let data = res.data.list || res.data || []
    
    if (!Array.isArray(data)) {
      console.error('[Categories] 返回数据不是数组:', typeof data)
      data = []
    }

    // 安全的搜索过滤逻辑（带完整的空值保护）
    if (keyword.value && safeTrim(keyword.value).length > 0) {
      const searchKeyword = safeToLower(safeTrim(keyword.value), '')
      
      if (searchKeyword.length > 0) {
        data = data.filter(item => {
          if (!item) return false
          
          const itemName = safeToLower(safeString(item.name, ''), '')
          const itemId = safeToString(item.id, '')
          
          return itemName.includes(searchKeyword) || 
                 itemId.includes(searchKeyword)
        })
      }
    }

    // 存储过滤后的完整数据（用于分页）
    filteredData.value = [...data]
    
    // 客户端分页
    const startIndex = (pagination.page - 1) * pagination.limit
    const endIndex = pagination.page * pagination.limit
    
    // 安全的数据映射（所有字段都使用安全函数包装）
    tableData.value = data.slice(startIndex, endIndex).map(item => ({
      id: item.id ?? null,
      name: safeString(item.name, '未命名分类'),
      sortOrder: safeToInt(item.sort_order ?? item.sortOrder, 0),
      status: safeString(item.status, 'active').toLowerCase(),
      productCount: safeToInt(item.product_count ?? item.productCount, 0),
      created_at: item.created_at ?? null,
      parent_id: item.parent_id ?? null,
      _statusLoading: false,
      _loading: false
    }))
    
    pagination.total = data.length
    
    // 安全地构建分类选项列表
    categoryOptions.value = data
      .filter(item => item && item.id !== currentId.value)
      .map(item => ({ 
        id: item.id ?? null, 
        name: safeString(item.name, '未命名分类')
      }))
      
  } catch (error) {
    console.error('[Categories] 获取分类列表失败:', error)
    
    const errorMsg = getErrorMessage(error)
    errorMessage.value = errorMsg
    errorTitle.value = '加载失败'
    hasError.value = true
    
    ElMessage.error(errorMsg)
    
    tableData.value = []
    filteredData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

/**
 * 分页变化处理
 */
const handlePageChange = () => {
  if (!loading.value) {
    // 从filteredData重新切片，避免重复请求API
    const startIndex = (pagination.page - 1) * pagination.limit
    const endIndex = pagination.page * pagination.limit
    tableData.value = filteredData.value.slice(startIndex, endIndex)
  }
}

/**
 * 搜索处理
 */
const handleSearch = () => {
  pagination.page = 1
  fetchData(true)
}

/**
 * 添加分类
 */
const handleAdd = () => {
  isEdit.value = false
  currentId.value = null
  Object.assign(formData, { 
    name: '', 
    parentId: null, 
    sortOrder: 0, 
    status: 'active' 
  })
  
  nextTick(() => {
    dialogVisible.value = true
  })
}

/**
 * 编辑分类
 */
const handleEdit = (row) => {
  if (!row || !row.id) {
    ElMessage.warning('无效的分类数据')
    return
  }
  
  isEdit.value = true
  currentId.value = row.id
  
  Object.assign(formData, {
    name: safeString(row.name, ''),
    parentId: row.parent_id ?? null,
    sortOrder: safeToInt(row.sortOrder ?? row.sort_order, 0),
    status: safeString(row.status, 'active').toLowerCase() === 'active' ? 'active' : 'inactive'
  })
  
  nextTick(() => {
    dialogVisible.value = true
  })
}

/**
 * 删除分类（带完整错误处理和二次确认）
 */
const handleDelete = async (row) => {
  if (!row || !row.id) {
    ElMessage.warning('无效的分类数据，无法执行删除操作')
    return
  }
  
  const categoryName = safeString(row.name, '未命名分类')
  const productCount = safeToInt(row.productCount ?? row.product_count, 0)
  
  // 前置校验：检查是否有关联商品
  if (productCount > 0) {
    ElMessage.warning(`该分类"${categoryName}"下存在 ${productCount} 个商品，请先移除商品后再删除`)
    return
  }
  
  try {
    // 二次确认弹窗
    await ElMessageBox.confirm(
      `确定要删除分类"${categoryName}"吗？`, 
      '确认删除', 
      { 
        type: 'warning',
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        dangerouslyUseHTMLString: false,
        distinguishCancelAndClose: true
      }
    )

    row._loading = true
    
    try {
      await categoryApi.deleteCategory(row.id)
      
      ElMessage.success(`分类"${categoryName}"已成功删除`)
      
      // 清除缓存并刷新列表
      cacheManager.clear()
      fetchData(true)
    } catch (deleteError) {
      // 特殊处理：资源不存在的情况
      if (deleteError.response?.status === 404) {
        ElMessage.warning(`分类"${categoryName}"不存在或已被删除`)
        fetchData(true)
        return
      }
      
      // 特殊处理：冲突情况（如有关联商品）
      if (deleteError.response?.status === 409) {
        const conflictMsg = safeString(
          deleteError.response.data?.error?.message ||
          deleteError.response.data?.message,
          '该分类存在关联数据，无法删除'
        )
        ElMessage.error(conflictMsg)
        return
      }
      
      // 其他错误
      throw deleteError
    }
  } catch (error) {
    // 用户取消操作
    if (error === 'cancel' || error?.action === 'cancel' || error?.action === 'close') {
      return
    }
    
    // 其他错误
    console.error('[Categories] 删除失败:', error)
    const errorMsg = getErrorMessage(error)
    ElMessage.error(errorMsg || `删除分类"${categoryName}"失败，请稍后重试`)
  } finally {
    if (row) {
      row._loading = false
    }
  }
}

/**
 * 状态切换处理
 */
const handleStatusChange = async (row, val) => {
  if (!row || !row.id) return
  
  row._statusLoading = true
  
  try {
    // 只发送必要字段，不发送前端临时字段
    const updateData = {
      status: safeString(val, 'inactive').toLowerCase(),
      updated_at: new Date().toISOString()
    }
    
    await categoryApi.updateCategory(row.id, updateData)
    row.status = updateData.status
    
    const statusLabel = getStatusLabel(updateData.status)
    ElMessage.success(`状态已更新为"${statusLabel}"`)
  } catch (error) {
    console.error('[Categories] 状态更新失败:', error)
    
    const errorMsg = getErrorMessage(error)
    ElMessage.error(errorMsg || '状态更新失败，请稍后重试')
    
    // 回滚状态
    fetchData(true)
  } finally {
    row._statusLoading = false
  }
}

/**
 * 表单提交（添加/编辑）
 */
const handleSubmit = async () => {
  if (!formRef.value) return
  
  // 表单验证
  try {
    await formRef.value.validate()
  } catch (validationError) {
    console.warn('[Categories] 表单验证失败:', validationError)
    return
  }
  
  submitting.value = true

  try {
    // 安全地构建提交数据
    const submitData = {
      name: safeTrim(formData.name, ''),
      parent_id: formData.parentId ?? null,
      sort_order: safeToInt(formData.sortOrder, 0),
      status: safeString(formData.status, 'active').toLowerCase()
    }
    
    // 名称必填验证
    if (!submitData.name || submitData.name.length === 0) {
      ElMessage.warning('分类名称不能为空')
      return
    }
    
    // 名称长度验证
    if (submitData.name.length > 50) {
      ElMessage.warning('分类名称不能超过50个字符')
      return
    }

    if (isEdit.value) {
      await categoryApi.updateCategory(currentId.value, submitData)
      ElMessage.success('分类信息更新成功')
    } else {
      await categoryApi.addCategory(submitData)
      ElMessage.success('新分类添加成功')
    }
    
    // 关闭对话框并刷新
    dialogVisible.value = false
    cacheManager.clear()
    fetchData(true)
  } catch (error) {
    console.error('[Categories] 提交失败:', error)
    
    const errorMsg = getErrorMessage(error)
    const actionText = isEdit.value ? '更新' : '添加'
    ElMessage.error(errorMsg || `${actionText}失败，请稍后重试`)
  } finally {
    submitting.value = false
  }
}

// 初始化加载数据
onMounted(() => {
  fetchData()
})
</script>

<style scoped>
.categories-container {
  width: 100%;
  height: 100%;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.category-name { 
  display: flex; 
  align-items: center; 
  gap: 8px; 
  font-weight: 500; 
}

.child-tag {
  margin-left: 8px;
}

.status-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.status-text {
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 4px;
}

.status-active {
  color: #67c23a;
  background-color: #f0f9eb;
}

.status-inactive {
  color: #f56c6c;
  background-color: #fef0f0;
}

.status-unknown {
  color: #909399;
  background-color: #f4f4f5;
}

.error-state {
  padding: 40px 20px;
  text-align: center;
}

.error-boundary {
  padding: 60px 20px;
  text-align: center;
  min-height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.error-details {
  background-color: #f5f7fa;
  padding: 16px;
  border-radius: 4px;
  overflow: auto;
  max-height: 400px;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #f56c6c;
}
</style>
