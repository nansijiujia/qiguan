<template>
  <ListPageContainer
    :loading="loading"
    :pagination="pagination"
    @size-change="fetchData"
    @current-change="fetchData"
  >
    <template #toolbar>
      <div class="toolbar">
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>添加分类
        </el-button>
        <el-input
          v-model="keyword"
          placeholder="搜索分类..."
          prefix-icon="Search"
          clearable
          style="width: 260px;"
          @keyup.enter="fetchData"
        />
      </div>
    </template>

    <el-table :data="tableData" stripe border style="width: 100%">
      <el-table-column prop="name" label="分类名称" min-width="200">
        <template #default="{ row }">
          <div class="category-name">
            <el-icon :size="18" color="#409eff"><Folder /></el-icon>
            {{ row.name }}
          </div>
        </template>
      </el-table-column>

      <el-table-column prop="sortOrder" label="排序" width="80" align="center" />

      <el-table-column prop="status" label="状态" width="100" align="center">
        <template #default="{ row }">
          <el-switch
            v-model="row.status"
            active-value="active"
            inactive-value="inactive"
            @change="(val) => handleStatusChange(row, val)"
          />
        </template>
      </el-table-column>

      <el-table-column prop="productCount" label="商品数" width="90" align="center">
        <template #default="{ row }">
          <el-tag type="info" size="small">{{ row.productCount || 0 }}</el-tag>
        </template>
      </el-table-column>

      <el-table-column prop="created_at" label="创建时间" width="180" />

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
  </ListPageContainer>

  <!-- 添加/编辑对话框 -->
  <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑分类' : '添加分类'" width="480px" destroy-on-close>
    <el-form ref="formRef" :model="formData" :rules="rules" label-width="80px">
      <el-form-item label="名称" prop="name">
        <el-input v-model="formData.name" placeholder="请输入分类名称" maxlength="30" show-word-limit />
      </el-form-item>

      <el-form-item label="排序值" prop="sortOrder">
        <el-input-number v-model="formData.sortOrder" :min="0" :max="9999" style="width: 100%;" />
      </el-form-item>

      <el-form-item label="状态">
        <el-switch v-model="formData.status" active-value="active" inactive-value="inactive" active-text="启用" inactive-text="禁用" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { categoryApi } from '@/api'
import ListPageContainer from '@/components/ListPageContainer.vue'
import { usePagination } from '@/composables/usePagination'
import { useTableLoading } from '@/composables/useTableLoading'

const { pagination } = usePagination(10)
const { loading } = useTableLoading()

const submitting = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const currentId = ref(null)
const keyword = ref('')
const tableData = ref([])

const formRef = ref()
const formData = reactive({ name: '', sortOrder: 0, status: 'active' })
const rules = {
  name: [{ required: true, message: '请输入分类名称', trigger: 'blur' }]
}

const fetchData = async () => {
  loading.value = true
  try {
    const res = await categoryApi.getCategories()
    if (res.data?.data) {
      let data = res.data.data
      if (keyword.value) {
        data = data.filter(item => item.name?.includes(keyword.value))
      }
      tableData.value = data.slice((pagination.page - 1) * pagination.limit, pagination.page * pagination.limit)
      pagination.total = data.length
    }
  } catch (error) {
    ElMessage.error('获取分类列表失败')
  } finally {
    loading.value = false
  }
}

const handleAdd = () => {
  isEdit.value = false
  currentId.value = null
  Object.assign(formData, { name: '', sortOrder: 0, status: 'active' })
  dialogVisible.value = true
}

const handleEdit = (row) => {
  isEdit.value = true
  currentId.value = row.id
  Object.assign(formData, row)
  dialogVisible.value = true
}

const handleDelete = async (row) => {
  await ElMessageBox.confirm(`确定要删除分类"${row.name}"吗？`, '提示', { type: 'warning' })

  try {
    await categoryApi.deleteCategory(row.id)
    ElMessage.success('删除成功')
    fetchData()
  } catch (error) {
    ElMessage.error('删除失败')
  }
}

const handleStatusChange = async (row, val) => {
  try {
    await categoryApi.updateCategory(row.id, { ...row, status: val })
    ElMessage.success('状态更新成功')
  } catch (error) {
    ElMessage.error('状态更新失败')
    fetchData()
  }
}

const handleSubmit = async () => {
  await formRef.value.validate()
  submitting.value = true

  try {
    if (isEdit.value) {
      await categoryApi.updateCategory(currentId.value, formData)
      ElMessage.success('更新成功')
    } else {
      await categoryApi.addCategory(formData)
      ElMessage.success('添加成功')
    }
    dialogVisible.value = false
    fetchData()
  } catch (error) {
    ElMessage.error(isEdit.value ? '更新失败' : '添加失败')
  } finally {
    submitting.value = false
  }
}

onMounted(() => fetchData())
</script>

<style scoped>
.category-name { display: flex; align-items: center; gap: 8px; font-weight: 500; }
</style>
