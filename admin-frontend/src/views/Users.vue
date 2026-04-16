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
          <el-icon><Plus /></el-icon>添加用户
        </el-button>
        <div class="toolbar-right">
          <el-select v-model="filters.role" placeholder="全部角色" clearable style="width: 130px;">
            <el-option label="管理员" value="admin" />
            <el-option label="普通用户" value="customer" />
          </el-select>
          <el-input v-model="filters.keyword" placeholder="搜索用户名/邮箱..." prefix-icon="Search" clearable style="width: 240px;" @keyup.enter="fetchData" />
          <el-button type="primary" @click="fetchData">搜索</el-button>
        </div>
      </div>
    </template>

    <el-table :data="tableData" stripe border style="width: 100%">
      <el-table-column prop="username" label="用户名" min-width="120">
        <template #default="{ row }">
          <div class="user-cell">
            <el-avatar :size="32" :icon="UserFilled" style="background-color: #409eff;" />
            <span>{{ row.username }}</span>
          </div>
        </template>
      </el-table-column>

      <el-table-column prop="email" label="邮箱" min-width="180" show-overflow-tooltip />

      <el-table-column prop="role" label="角色" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="row.role === 'admin' ? 'danger' : 'info'" size="small" effect="dark">
            {{ row.role === 'admin' ? '管理员' : '普通用户' }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column prop="status" label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-switch
            :model-value="row.status === 'active'"
            @change="(val) => handleStatusChange(row, val)"
            active-text=""
            inactive-text=""
            :disabled="row.role === 'admin'"
          />
        </template>
      </el-table-column>

      <el-table-column prop="created_at" label="注册时间" width="170" />

      <el-table-column prop="last_login" label="最后登录" width="170" />

      <el-table-column label="操作" width="200" align="center" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" text size="small" @click="handleEdit(row)">
            <el-icon><Edit /></el-icon>编辑
          </el-button>
          <el-button 
            :type="row.status === 'active' ? 'warning' : 'success'" 
            text size="small"
            @click="handleToggleStatus(row)"
            :disabled="row.role === 'admin'"
          >
            {{ row.status === 'active' ? '禁用' : '启用' }}
          </el-button>
          <el-button type="danger" text size="small" @click="handleDelete(row)" :disabled="row.role === 'admin'">
            <el-icon><Delete /></el-icon>删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </ListPageContainer>

  <!-- 添加/编辑对话框 -->
  <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑用户' : '添加用户'" width="520px" destroy-on-close @closed="resetForm">
    <el-form ref="formRef" :model="formData" :rules="rules" label-width="80px">
      <el-form-item label="用户名" prop="username">
        <el-input v-model="formData.username" placeholder="请输入用户名" maxlength="20" show-word-limit />
      </el-form-item>

      <el-form-item label="邮箱" prop="email">
        <el-input v-model="formData.email" placeholder="请输入邮箱地址" maxlength="50" />
      </el-form-item>

      <el-form-item v-if="!isEdit" label="密码" prop="password">
        <el-input v-model="formData.password" type="password" placeholder="请输入密码" show-password maxlength="30" />
      </el-form-item>

      <el-form-item label="角色" prop="role">
        <el-select v-model="formData.role" placeholder="请选择角色" style="width: 100%;">
          <el-option label="管理员" value="admin" />
          <el-option label="普通用户" value="customer" />
        </el-select>
      </el-form-item>

      <el-form-item label="状态">
        <el-switch 
          v-model="formData.status" 
          active-value="active" 
          inactive-value="inactive" 
          active-text="启用" 
          inactive-text="禁用" 
        />
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
import { UserFilled } from '@element-plus/icons-vue'
import { userApi } from '@/api'
import ListPageContainer from '@/components/ListPageContainer.vue'
import { usePagination } from '@/composables/usePagination'
import { useTableLoading } from '@/composables/useTableLoading'

const { pagination } = usePagination(10)
const { loading } = useTableLoading()

const submitting = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const currentId = ref(null)
const tableData = ref([])

const filters = reactive({ role: '', keyword: '' })

const formRef = ref()
const formData = reactive({
  username: '',
  email: '',
  password: '',
  role: 'customer',
  status: 'active'
})

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }
  ],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

const fetchData = async () => {
  loading.value = true
  try {
    const params = { page: pagination.page, limit: pagination.limit }
    if (filters.role) params.role = filters.role
    if (filters.keyword) params.keyword = filters.keyword
    
    const res = await userApi.getUsers(params)
    if (res.data?.data) {
      tableData.value = res.data.data.list || []
      pagination.total = res.data.data.pagination?.total || 0
    }
  } catch (error) {
    ElMessage.error('获取用户列表失败')
  } finally {
    loading.value = false
  }
}

const handleAdd = () => {
  isEdit.value = false
  currentId.value = null
  Object.assign(formData, { username: '', email: '', password: '', role: 'customer', status: 'active' })
  dialogVisible.value = true
}

const handleEdit = (row) => {
  isEdit.value = true
  currentId.value = row.id
  Object.assign(formData, { ...row, password: '' })
  dialogVisible.value = true
}

const handleDelete = async (row) => {
  await ElMessageBox.confirm(`确定要删除用户"${row.username}"吗？`, '提示', { type: 'warning' })
  
  try {
    await userApi.deleteUser(row.id)
    ElMessage.success('删除成功')
    fetchData()
  } catch (error) {
    ElMessage.error('删除失败')
  }
}

const handleToggleStatus = async (row) => {
  const action = row.status === 'active' ? '禁用' : '启用'
  
  await ElMessageBox.confirm(`确定要${action}用户"${row.username}"吗？`, '提示', { type: 'warning' })
  
  try {
    const newStatus = row.status === 'active' ? 'inactive' : 'active'
    await userApi.updateUser(row.id, { ...row, status: newStatus })
    ElMessage.success(`${action}成功`)
    fetchData()
  } catch (error) {
    ElMessage.error(`${action}失败`)
  }
}

const handleStatusChange = async (row, val) => {
  try {
    const newStatus = val ? 'active' : 'inactive'
    await userApi.updateUser(row.id, { ...row, status: newStatus })
    ElMessage.success(val ? '已启用' : '已禁用')
    fetchData()
  } catch (error) {
    ElMessage.error('状态更新失败')
  }
}

const handleSubmit = async () => {
  await formRef.value.validate()
  submitting.value = true
  
  try {
    if (isEdit.value) {
      const submitData = { ...formData }
      if (!submitData.password) delete submitData.password
      await userApi.updateUser(currentId.value, submitData)
      ElMessage.success('更新成功')
    } else {
      await userApi.addUser(formData)
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

const resetForm = () => {
  formRef.value?.resetFields()
}

onMounted(() => fetchData())
</script>

<style scoped>
.user-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 500;
}
</style>
