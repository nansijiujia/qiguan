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
          <el-button type="primary" @click="handleAdd">
            <el-icon><Plus /></el-icon>添加商品
          </el-button>
          <el-button 
            type="danger" 
            :disabled="!selectedRows.length"
            @click="handleBatchDelete"
          >
            <el-icon><Delete /></el-icon>批量删除
          </el-button>
          <el-button 
            type="warning" 
            :disabled="!selectedRows.length"
            @click="handleBatchStatus"
          >
            <el-icon><Operation /></el-icon>批量修改状态
          </el-button>
          <el-button 
            type="info" 
            @click="handleExport"
          >
            <el-icon><Download /></el-icon>导出数据
          </el-button>
          <el-upload
            class="upload-demo"
            :show-file-list="false"
            :auto-upload="false"
            :on-change="handleImport"
            accept=".xlsx,.xls,.csv"
          >
            <el-button type="success">
              <el-icon><Upload /></el-icon>导入数据
            </el-button>
          </el-upload>
        </div>
        <div class="toolbar-right">
          <el-select v-model="filters.category" placeholder="全部分类" clearable style="width: 150px;">
            <el-option v-for="cat in categories" :key="cat.id" :label="cat.name" :value="cat.id" />
          </el-select>
          <el-select v-model="filters.status" placeholder="全部状态" clearable style="width: 120px;">
            <el-option label="上架" value="active" />
            <el-option label="下架" value="inactive" />
          </el-select>
          <el-input 
            v-model="filters.keyword" 
            placeholder="搜索商品名称..." 
            prefix-icon="Search"
            clearable
            style="width: 240px;"
            @keyup.enter="fetchData"
          />
          <el-button type="primary" @click="fetchData">搜索</el-button>
        </div>
      </div>
    </template>

    <el-table
      :data="tableData"
      stripe
      border
      @selection-change="handleSelectionChange"
      @sort-change="handleSortChange"
      style="width: 100%"
    >
        <el-table-column type="selection" width="50" align="center" />
        
        <el-table-column label="商品图片" width="100" align="center">
          <template #default="{ row }">
            <el-image
              :src="row.image || 'https://via.placeholder.com/60x60'"
              :preview-src-list="[row.image]"
              fit="cover"
              style="width: 60px; height: 60px; border-radius: 8px;"
              lazy
            >
              <template #error>
                <div class="image-error"><el-icon :size="24"><PictureFilled /></el-icon></div>
              </template>
            </el-image>
          </template>
        </el-table-column>

        <el-table-column prop="name" label="商品名称" min-width="180" show-overflow-tooltip />
        
        <el-table-column prop="category_name" label="分类" width="120" align="center">
          <template #default="{ row }">
            <el-tag size="small">{{ row.category_name || '未分类' }}</el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="price" label="价格(¥)" width="100" align="center" sortable>
          <template #default="{ row }">
            <span class="price">{{ row.price?.toFixed(2) }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="stock" label="库存" width="80" align="center" sortable>
          <template #default="{ row }">
            <span :class="{ 'low-stock': row.stock < 10 }">{{ row.stock }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="status" label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'danger'" size="small">
              {{ row.status === 'active' ? '上架' : '下架' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="created_at" label="创建时间" width="170" sortable />

        <el-table-column label="操作" width="160" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" text size="small" @click="handleEdit(row)">
              <el-icon><Edit /></el-icon>编辑
            </el-button>
            <el-button type="danger" text size="small" @click="handleDelete(row)">
              <el-icon><Delete /></el-icon>删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

    <!-- 添加/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="600px"
      destroy-on-close
      @closed="resetForm"
    >
      <el-form ref="formRef" :model="formData" :rules="formRules" label-width="100px">
        <el-form-item label="商品名称" prop="name">
          <el-input v-model="formData.name" placeholder="请输入商品名称" maxlength="50" show-word-limit />
        </el-form-item>

        <el-form-item label="商品描述" prop="description">
          <el-input
            v-model="formData.description"
            type="textarea"
            :rows="3"
            placeholder="请输入商品描述"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="价格(¥)" prop="price">
              <el-input-number v-model="formData.price" :min="0" :precision="2" :step="0.01" style="width: 100%;" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="库存" prop="stock">
              <el-input-number v-model="formData.stock" :min="0" :step="1" style="width: 100%;" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="分类" prop="category_id">
          <el-select v-model="formData.category_id" placeholder="请选择分类" style="width: 100%;">
            <el-option v-for="cat in categories" :key="cat.id" :label="cat.name" :value="cat.id" />
          </el-select>
        </el-form-item>

        <el-form-item label="商品图片">
          <el-upload
            action="#"
            list-type="picture-card"
            :auto-upload="false"
            :limit="5"
            :file-list="fileList"
            accept="image/*"
            @change="handleFileChange"
          >
            <el-icon :size="28"><Plus /></el-icon>
          </el-upload>
        </el-form-item>

        <el-form-item label="状态">
          <el-switch
            v-model="formData.status"
            active-value="active"
            inactive-value="inactive"
            active-text="上架"
            inactive-text="下架"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <!-- 批量修改状态对话框 -->
    <el-dialog
      v-model="batchStatusVisible"
      title="批量修改状态"
      width="400px"
      destroy-on-close
    >
      <el-form :model="batchStatusForm" label-width="80px">
        <el-form-item label="目标状态">
          <el-radio-group v-model="batchStatusForm.status">
            <el-radio label="active">上架</el-radio>
            <el-radio label="inactive">下架</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="batchStatusVisible = false">取消</el-button>
        <el-button type="primary" :loading="batchStatusLoading" @click="handleBatchStatusSubmit">确定</el-button>
      </template>
    </el-dialog>
  </ListPageContainer>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Delete, Upload, Download, Operation, PictureFilled } from '@element-plus/icons-vue'
import { productApi, categoryApi } from '@/api'
import ListPageContainer from '@/components/ListPageContainer.vue'
import { usePagination } from '@/composables/usePagination'
import { useTableLoading } from '@/composables/useTableLoading'

const { pagination } = usePagination(10)
const { loading } = useTableLoading()
import * as XLSX from 'xlsx'

const submitting = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const currentId = ref(null)
const selectedRows = ref([])
const tableData = ref([])
const categories = ref([])
const fileList = ref([])

// 批量修改状态
const batchStatusVisible = ref(false)
const batchStatusLoading = ref(false)
const batchStatusForm = reactive({
  status: 'active'
})

// 筛选条件
const filters = reactive({
  category: '',
  status: '',
  keyword: ''
})

// 排序
const sortConfig = reactive({
  prop: '',
  order: ''
})



// 表单数据
const formRef = ref()
const formData = reactive({
  name: '',
  description: '',
  price: 0,
  stock: 0,
  category_id: '',
  image: '',
  status: 'active'
})

const formRules = {
  name: [{ required: true, message: '请输入商品名称', trigger: 'blur' }],
  price: [{ required: true, message: '请输入价格', trigger: 'blur' }]
}

const dialogTitle = computed(() => isEdit.value ? '编辑商品' : '添加商品')

// 获取列表数据
const fetchData = async () => {
  loading.value = true
  try {
    const params = { page: pagination.page, limit: pagination.limit }
    if (filters.category) params.category_id = filters.category
    if (filters.status) params.status = filters.status
    if (filters.keyword) params.keyword = filters.keyword
    if (sortConfig.prop) params.sort = sortConfig.prop
    if (sortConfig.order) params.order = sortConfig.order === 'ascending' ? 'asc' : 'desc'
    
    const res = await productApi.getProducts(params)
    if (res.data?.data) {
      tableData.value = res.data.data.list || []
      pagination.total = res.data.data.pagination?.total || 0
    }
  } catch (error) {
    ElMessage.error('获取商品列表失败')
  } finally {
    loading.value = false
  }
}

// 获取分类列表
const fetchCategories = async () => {
  try {
    const res = await categoryApi.getCategories()
    if (res.data?.data) {
      categories.value = res.data.data
    }
  } catch (error) {
    console.error('获取分类失败:', error)
  }
}

// 添加
const handleAdd = () => {
  isEdit.value = false
  currentId.value = null
  Object.assign(formData, { name: '', description: '', price: 0, stock: 0, category_id: '', image: '', status: 'active' })
  fileList.value = []
  dialogVisible.value = true
}

// 编辑
const handleEdit = (row) => {
  isEdit.value = true
  currentId.value = row.id
  Object.assign(formData, row)
  if (row.image) fileList.value = [{ url: row.image, name: 'image' }]
  dialogVisible.value = true
}

// 删除
const handleDelete = async (row) => {
  await ElMessageBox.confirm(`确定要删除商品"${row.name}"吗？`, '提示', { type: 'warning' })
  
  try {
    await productApi.deleteProduct(row.id)
    ElMessage.success('删除成功')
    fetchData()
  } catch (error) {
    ElMessage.error('删除失败')
  }
}

// 批量删除
const handleBatchDelete = async () => {
  await ElMessageBox.confirm(`确定要删除选中的 ${selectedRows.value.length} 个商品吗？`, '提示', { type: 'warning' })
  
  try {
    for (const item of selectedRows.value) {
      await productApi.deleteProduct(item.id)
    }
    ElMessage.success('批量删除成功')
    fetchData()
  } catch (error) {
    ElMessage.error('批量删除失败')
  }
}

// 批量修改状态
const handleBatchStatus = () => {
  batchStatusVisible.value = true
}

// 批量修改状态提交
const handleBatchStatusSubmit = async () => {
  batchStatusLoading.value = true
  try {
    for (const item of selectedRows.value) {
      await productApi.updateProduct(item.id, { status: batchStatusForm.status })
    }
    ElMessage.success('批量修改状态成功')
    batchStatusVisible.value = false
    fetchData()
  } catch (error) {
    ElMessage.error('批量修改状态失败')
  } finally {
    batchStatusLoading.value = false
  }
}

// 选择变化
const handleSelectionChange = (rows) => {
  selectedRows.value = rows
}

// 排序变化
const handleSortChange = (sort) => {
  sortConfig.prop = sort.prop
  sortConfig.order = sort.order
  fetchData()
}

// 文件变化
const handleFileChange = (file) => {
  formData.image = URL.createObjectURL(file.raw)
}

// 导出数据
const handleExport = () => {
  // 准备导出数据
  const exportData = tableData.value.map(item => ({
    '商品ID': item.id,
    '商品名称': item.name,
    '商品描述': item.description || '',
    '价格(¥)': item.price?.toFixed(2) || '0.00',
    '库存': item.stock || 0,
    '分类': item.category_name || '未分类',
    '状态': item.status === 'active' ? '上架' : '下架',
    '创建时间': item.created_at || ''
  }))

  // 创建工作簿
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(exportData)
  XLSX.utils.book_append_sheet(workbook, worksheet, '商品数据')

  // 导出文件
  XLSX.writeFile(workbook, `商品数据_${new Date().toISOString().split('T')[0]}.xlsx`)
  ElMessage.success('导出成功')
}

// 导入数据
const handleImport = async (file) => {
  const fileReader = new FileReader()
  fileReader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target.result)
      const workbook = XLSX.read(data, { type: 'array' })
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(worksheet)

      // 处理导入数据
      const importData = jsonData.map(item => {
        // 查找分类ID
        const category = categories.value.find(cat => cat.name === item['分类'])
        return {
          name: item['商品名称'],
          description: item['商品描述'] || '',
          price: parseFloat(item['价格(¥)']) || 0,
          stock: parseInt(item['库存']) || 0,
          category_id: category?.id || null,
          status: item['状态'] === '上架' ? 'active' : 'inactive'
        }
      })

      // 批量导入
      for (const item of importData) {
        await productApi.addProduct(item)
      }

      ElMessage.success(`成功导入 ${importData.length} 条数据`)
      fetchData()
    } catch (error) {
      ElMessage.error('导入失败，请检查文件格式')
    }
  }
  fileReader.readAsArrayBuffer(file.raw)
}

// 提交表单 - 增强错误处理
const handleSubmit = async () => {
  await formRef.value.validate()
  
  submitting.value = true
  try {
    if (isEdit.value) {
      await productApi.updateProduct(currentId.value, formData)
      ElMessage.success('更新成功')
    } else {
      await productApi.addProduct(formData)
      ElMessage.success('添加成功')
    }
    dialogVisible.value = false
    fetchData()
  } catch (error) {
    // 显示具体的错误信息
    const errorMsg = error?.response?.data?.message || error?.message || (isEdit.value ? '更新失败' : '添加失败')
    ElMessage.error(errorMsg)
  } finally {
    submitting.value = false
  }
}

// 重置表单
const resetForm = () => {
  formRef.value?.resetFields()
}

onMounted(() => {
  fetchData()
  fetchCategories()
})
</script>

<style scoped>
.price {
  font-weight: 600;
  color: #e6a23c;
}

.low-stock {
  color: #f56c6c;
  font-weight: bold;
}

.image-error {
  width: 60px;
  height: 60px;
  background-color: #f5f7fa;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c0c4cc;
}
</style>