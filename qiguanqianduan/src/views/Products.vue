<template>
  <div class="products-container">
    <!-- 工具栏 -->
    <el-card shadow="never" class="toolbar-card">
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
        </div>
        <div class="toolbar-right">
          <el-select v-model="filters.category" placeholder="全部分类" clearable style="width: 150px;">
            <el-option v-for="cat in categories" :key="cat.id" :label="cat.name" :value="cat.id" />
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
    </el-card>

    <!-- 数据表格 -->
    <el-card shadow="never" class="table-card" v-loading="loading">
      <el-table
        :data="tableData"
        stripe
        border
        @selection-change="handleSelectionChange"
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

        <el-table-column prop="price" label="价格(¥)" width="100" align="center">
          <template #default="{ row }">
            <span class="price">{{ row.price?.toFixed(2) }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="stock" label="库存" width="80" align="center">
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

        <el-table-column prop="created_at" label="创建时间" width="170" />

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
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { productApi, categoryApi } from '@/api'

const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const currentId = ref(null)
const selectedRows = ref([])
const tableData = ref([])
const categories = ref([])
const fileList = ref([])

// 筛选条件
const filters = reactive({
  category: '',
  keyword: ''
})

// 分页
const pagination = reactive({
  page: 1,
  limit: 10,
  total: 0
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
    if (filters.keyword) params.keyword = filters.keyword
    
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

// 选择变化
const handleSelectionChange = (rows) => {
  selectedRows.value = rows
}

// 文件变化
const handleFileChange = (file) => {
  formData.image = URL.createObjectURL(file.raw)
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
.products-container {
  padding: 0;
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

.price {
  font-weight: 600;
  color: #e6a23c;
}

.low-stock {
  color: #f56c6c;
  font-weight: bold;
}

.pagination-wrapper {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
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