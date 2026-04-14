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
          <span class="title">客户资料管理</span>
          <span class="subtitle">小程序客户信息</span>
        </div>
        <div class="toolbar-right">
          <el-select v-model="filters.status" placeholder="全部状态" clearable style="width: 120px;">
            <el-option label="正常" value="active" />
            <el-option label="禁用" value="inactive" />
            <el-option label="封禁" value="banned" />
          </el-select>
          <el-input v-model="filters.keyword" placeholder="搜索昵称/姓名/手机..." prefix-icon="Search" clearable style="width: 240px;" @keyup.enter="fetchData" />
          <el-button type="primary" @click="fetchData">搜索</el-button>
        </div>
      </div>
    </template>

    <el-table :data="tableData" stripe border style="width: 100%">
      <el-table-column label="客户信息" min-width="220">
        <template #default="{ row }">
          <div class="customer-cell">
            <el-avatar :size="40" :src="row.avatar_url" :icon="UserFilled" style="background-color: #67c23a; flex-shrink: 0;" />
            <div class="customer-info">
              <div class="nickname">{{ row.nickname || '未设置昵称' }}</div>
              <div class="openid">{{ row.openid ? row.openid.substring(0, 16) + '...' : '' }}</div>
            </div>
          </div>
        </template>
      </el-table-column>

      <el-table-column prop="real_name" label="收货姓名" width="100" align="center">
        <template #default="{ row }">
          {{ row.real_name || '-' }}
        </template>
      </el-table-column>

      <el-table-column prop="phone" label="手机号" width="130" align="center">
        <template #default="{ row }">
          {{ row.phone || '-' }}
        </template>
      </el-table-column>

      <el-table-column label="收货地址" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <span v-if="row.full_address">{{ row.full_address }}</span>
          <span v-else-if="row.province || row.city || row.district">{{ [row.province, row.city, row.district, row.detail_address].filter(Boolean).join('') }}</span>
          <span v-else class="text-muted">-</span>
        </template>
      </el-table-column>

      <el-table-column prop="status" label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)" size="small" effect="dark">
            {{ statusText(row.status) }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column prop="created_at" label="注册时间" width="160" />

      <el-table-column label="操作" width="180" align="center" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" text size="small" @click="handleView(row)">
            <el-icon><View /></el-icon>详情
          </el-button>
          <el-button type="primary" text size="small" @click="handleEdit(row)">
            <el-icon><Edit /></el-icon>编辑
          </el-button>
          <el-button 
            :type="row.status === 'active' ? 'warning' : 'success'" 
            text size="small"
            @click="handleToggleStatus(row)"
          >
            {{ row.status === 'active' ? '禁用' : '启用' }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </ListPageContainer>

  <!-- 详情/编辑对话框 -->
  <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px" destroy-on-close @closed="resetForm">
    <el-form ref="formRef" :model="formData" :rules="rules" label-width="100px" :disabled="isView">
      <el-divider content-position="left">基本信息</el-divider>
      
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="微信昵称">
            <el-input v-model="formData.nickname" disabled placeholder="来自微信" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="OpenID">
            <el-input v-model="formData.openid" disabled />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="头像">
            <el-avatar :size="60" :src="formData.avatar_url" :icon="UserFilled" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="性别">
            <el-radio-group v-model="formData.gender" :disabled="isView">
              <el-radio :value="0">未知</el-radio>
              <el-radio :value="1">男</el-radio>
              <el-radio :value="2">女</el-radio>
            </el-radio-group>
          </el-form-item>
        </el-col>
      </el-row>

      <el-divider content-position="left">收货信息</el-divider>

      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="收货姓名" prop="real_name">
            <el-input v-model="formData.real_name" placeholder="请输入收货姓名" :disabled="isView" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="手机号" prop="phone">
            <el-input v-model="formData.phone" placeholder="请输入手机号" :disabled="isView" maxlength="11" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="所在地区">
        <el-cascader
          v-model="regionValue"
          :options="regionOptions"
          :disabled="isView"
          placeholder="请选择省/市/区"
          style="width: 100%;"
          @change="handleRegionChange"
        />
      </el-form-item>

      <el-form-item label="详细地址">
        <el-input v-model="formData.detail_address" type="textarea" :rows="2" placeholder="请输入详细地址" :disabled="isView" />
      </el-form-item>

      <el-divider content-position="left">账户设置</el-divider>

      <el-form-item label="账户状态">
        <el-switch 
          v-model="formData.status" 
          active-value="active" 
          inactive-value="inactive" 
          active-text="正常" 
          inactive-text="禁用"
          :disabled="isView"
        />
      </el-form-item>

      <el-form-item v-if="!isView" label="">
        <el-alert title="修改后将自动更新客户的完整收货地址" type="info" :closable="false" show-icon />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="dialogVisible = false">{{ isView ? '关闭' : '取消' }}</el-button>
      <el-button v-if="!isView" type="primary" :loading="submitting" @click="handleSubmit">确定保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { UserFilled, View, Edit } from '@element-plus/icons-vue'
import { customerApi } from '@/api'
import ListPageContainer from '@/components/ListPageContainer.vue'
import { usePagination } from '@/composables/usePagination'
import { useTableLoading } from '@/composables/useTableLoading'

const { pagination } = usePagination(10)
const { loading } = useTableLoading()

const submitting = ref(false)
const dialogVisible = ref(false)
const isView = ref(false)
const isEdit = ref(false)
const currentId = ref(null)
const tableData = ref([])

const filters = reactive({ status: '', keyword: '' })

const formRef = ref()
const formData = reactive({
  nickname: '',
  openid: '',
  avatar_url: '',
  real_name: '',
  phone: '',
  gender: 0,
  province: '',
  city: '',
  district: '',
  detail_address: '',
  full_address: '',
  status: 'active'
})

const regionValue = ref([])
const regionOptions = [
  { value: '广东省', label: '广东省', children: [
    { value: '深圳市', label: '深圳市', children: [
      { value: '南山区', label: '南山区' },
      { value: '福田区', label: '福田区' },
      { value: '罗湖区', label: '罗湖区' }
    ]}
  ]},
  { value: '北京市', label: '北京市', children: [
    { value: '北京市', label: '北京市', children: [
      { value: '朝阳区', label: '朝阳区' },
      { value: '海淀区', label: '海淀区' }
    ]}
  ]}
]

const rules = {
  real_name: [{ max: 50, message: '姓名不能超过50个字符', trigger: 'blur' }],
  phone: [{ pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }]
}

const dialogTitle = computed(() => {
  if (isView.value) return '客户详情'
  if (isEdit.value) return '编辑客户资料'
  return ''
})

const STATUS_TYPE_MAP = { active: 'success', inactive: 'warning', banned: 'danger' }
const STATUS_TEXT_MAP = { active: '正常', inactive: '禁用', banned: '封禁' }

const statusType = (status) => {
  if (!status) return 'info'
  return STATUS_TYPE_MAP[status] || 'info'
}

const statusText = (status) => {
  if (!status) return '未知'
  return STATUS_TEXT_MAP[status] || status || '未知'
}

const fetchData = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      limit: pagination.limit,
      ...(filters.status && { status: filters.status }),
      ...(filters.keyword && { keyword: filters.keyword })
    }

    const res = await customerApi.getList(params)

    tableData.value = res.data?.list || []
    pagination.total = res.data?.pagination?.total || 0
  } catch (error) {
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

const handleView = (row) => {
  openCustomerDialog(row, true, false)
}

const handleEdit = (row) => {
  openCustomerDialog(row, false, true)
}

const openCustomerDialog = (row, viewMode, editMode) => {
  isView.value = viewMode
  isEdit.value = editMode
  currentId.value = row.id
  Object.assign(formData, {
    ...row,
    gender: row.gender || 0,
    province: row.province || '',
    city: row.city || '',
    district: row.district || '',
    detail_address: row.detail_address || ''
  })
  regionValue.value = [row.province, row.city, row.district].filter(Boolean)
  dialogVisible.value = true
}

const handleRegionChange = (val) => {
  if (val && val.length >= 3) {
    formData.province = val[0] || ''
    formData.city = val[1] || ''
    formData.district = val[2] || ''
  }
}

const handleToggleStatus = async (row) => {
  const action = row.status === 'active' ? '禁用' : '启用'
  const newStatus = row.status === 'active' ? 'inactive' : 'active'

  await ElMessageBox.confirm(`确定要${action}该客户吗？`, '提示', { type: 'warning' })

  try {
    await customerApi.update(row.id, { status: newStatus })
    ElMessage.success(`${action}成功`)
    fetchData()
  } catch (error) {
  }
}

const handleSubmit = async () => {
  const isValid = await formRef.value?.validate().catch(() => false)
  if (!isValid) return

  submitting.value = true

  try {
    const submitData = { ...formData }

    if (submitData.province || submitData.city || submitData.district || submitData.detail_address) {
      submitData.full_address = [submitData.province, submitData.city, submitData.district, submitData.detail_address].join('')
    }

    await customerApi.update(currentId.value, submitData)
    ElMessage.success('保存成功')
    dialogVisible.value = false
    fetchData()
  } catch (error) {
  } finally {
    submitting.value = false
  }
}

const resetForm = () => {
  if (formRef.value) formRef.value.resetFields()
  regionValue.value = []
}

onMounted(() => fetchData())
</script>

<style scoped>
.title { font-size: 16px; font-weight: 600; color: #303133; }
.subtitle { font-size: 13px; color: #909399; }

.customer-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}
.customer-info { overflow: hidden; }
.nickname { font-weight: 500; color: #303133; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.openid { font-size: 12px; color: #909399; margin-top: 2px; }
.text-muted { color: #c0c4cc; }
</style>
