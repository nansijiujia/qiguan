<template>
  <div class="content-manage-container">
    <el-tabs v-model="activeTab" type="border-card">
      <!-- Tab 1: Banner管理 -->
      <el-tab-pane label="📸 Banner管理" name="banners">
        <div class="tab-content">
          <!-- 工具栏 -->
          <div class="toolbar">
            <el-button type="primary" @click="handleAddBanner">
              <el-icon><Plus /></el-icon>上传Banner
            </el-button>
            <el-tag type="info">共 {{ banners.length }} 个Banner</el-tag>
          </div>

          <!-- Banner卡片列表 -->
          <div class="banner-grid" v-loading="bannerLoading">
            <!-- 错误提示和重试 -->
            <el-alert
              v-if="bannerError && !bannerLoading"
              :title="'加载失败: ' + bannerError"
              type="error"
              show-icon
              :closable="true"
              @close="bannerError = ''"
              style="margin-bottom: 16px;"
            >
              <template #default>
                <el-button type="primary" size="small" @click="retryFetchBanners" style="margin-top: 8px;">
                  🔄 重新加载
                </el-button>
              </template>
            </el-alert>

            <el-card
              v-for="banner in banners"
              :key="banner.id"
              class="banner-card"
              shadow="hover"
            >
              <div class="banner-image-wrapper">
                <el-image
                  :src="banner.image_url"
                  :preview-src-list="[banner.image_url]"
                  fit="cover"
                  class="banner-image"
                >
                  <template #error>
                    <div class="image-error">
                      <el-icon :size="40"><PictureFilled /></el-icon>
                    </div>
                  </template>
                </el-image>
                <div class="position-badge">
                  <el-tag size="small" type="warning">#{{ banner.position }}</el-tag>
                </div>
              </div>

              <div class="banner-info">
                <h4 class="banner-title">{{ banner.title || '未命名Banner' }}</h4>

                <div class="banner-meta">
                  <el-switch
                    v-model="banner.status"
                    active-value="active"
                    inactive-value="inactive"
                    @change="(val) => handleToggleStatus(banner, val)"
                    active-text="启用"
                    inactive-text="禁用"
                  />
                </div>

                <div class="banner-actions">
                  <el-button type="primary" text size="small" @click="handleEditBanner(banner)">
                    <el-icon><Edit /></el-icon>编辑
                  </el-button>
                  <el-button
                    type="success"
                    text
                    size="small"
                    :disabled="banner.position <= 0"
                    @click="handleMoveUp(banner)"
                  >
                    <el-icon><Top /></el-icon>上移
                  </el-button>
                  <el-button
                    type="warning"
                    text
                    size="small"
                    @click="handleMoveDown(banner)"
                  >
                    <el-icon><Bottom /></el-icon>下移
                  </el-button>
                  <el-button type="danger" text size="small" @click="handleDeleteBanner(banner)">
                    <el-icon><Delete /></el-icon>删除
                  </el-button>
                </div>
              </div>
            </el-card>

            <el-card v-if="banners.length === 0 && !bannerLoading" class="empty-card">
              <el-empty description="暂无Banner数据" />
            </el-card>
          </div>

          <!-- 预览区域 -->
          <el-divider content-position="left">📱 手机预览</el-divider>
          <div class="preview-container">
            <div class="phone-frame">
              <el-carousel height="200px" :autoplay="true" :interval="3000">
                <el-carousel-item v-for="banner in banners.filter(b => b.status === 'active')" :key="banner.id">
                  <img :src="banner.image_url" alt="" style="width:100%;height:100%;object-fit:cover;" />
                </el-carousel-item>
              </el-carousel>
              <p v-if="banners.filter(b => b.status === 'active').length === 0" class="no-banner-tip">
                暂无启用的Banner
              </p>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- Tab 2: 推荐商品配置 -->
      <el-tab-pane label="🎯 推荐商品配置" name="recommended">
        <div class="tab-content">
          <el-card shadow="never">
            <template #header>
              <div class="card-header">
                <span>推荐商品列表</span>
                <el-button type="primary" size="small" @click="saveRecommendedProducts" :loading="savingRecommended">
                  保存配置
                </el-button>
              </div>
            </template>

            <div class="product-selector">
              <el-select
                v-model="selectedProductForRecommend"
                filterable
                remote
                reserve-keyword
                placeholder="搜索并选择商品添加到推荐列表..."
                :remote-method="searchProducts"
                :loading="searchLoading"
                style="width: 400px;"
                @change="addRecommendedProduct"
              >
                <el-option
                  v-for="item in searchResults"
                  :key="item.id"
                  :label="item.name"
                  :value="item.id"
                >
                  <span>{{ item.name }}</span>
                  <span style="float:right;color:#999;font-size:12px;">{{ safeFormatPrice(item.price) }}</span>
                </el-option>
              </el-select>
            </div>

            <div class="selected-products-grid" v-loading="loadingRecommended">
              <!-- 错误提示和重试 -->
              <el-alert
                v-if="recommendedError && !loadingRecommended"
                :title="'加载失败: ' + recommendedError"
                type="error"
                show-icon
                :closable="true"
                @close="recommendedError = ''"
                style="grid-column: 1 / -1; margin-bottom: 16px;"
              >
                <template #default>
                  <el-button type="primary" size="small" @click="retryFetchRecommendedProducts" style="margin-top: 8px;">
                    🔄 重新加载
                  </el-button>
                </template>
              </el-alert>

              <el-card
                v-for="(product, index) in recommendedProductsList"
                :key="product.id"
                class="product-card"
                shadow="hover"
              >
                <div class="product-image-wrapper">
                  <el-image
                    :src="product.image || 'https://via.placeholder.com/150x150'"
                    fit="cover"
                    class="product-image"
                  >
                    <template #error>
                      <div class="image-error-small"><el-icon><PictureFilled /></el-icon></div>
                    </template>
                  </el-image>
                  <div class="product-index-badge">{{ index + 1 }}</div>
                </div>
                <h5 class="product-name">{{ product.name }}</h5>
                <p class="product-price">{{ safeFormatPrice(product.price) }}</p>
                <el-button
                  type="danger"
                  text
                  size="small"
                  @click="removeRecommendedProduct(product.id)"
                  style="width:100%"
                >
                  移除
                </el-button>
              </el-card>

              <el-empty v-if="recommendedProductsList.length === 0 && !loadingRecommended" description="暂无推荐商品" :image-size="80" />
            </div>
          </el-card>
        </div>
      </el-tab-pane>

      <!-- Tab 3: 热门商品配置 -->
      <el-tab-pane label="🔥 热门商品配置" name="hot">
        <div class="tab-content">
          <el-card shadow="never">
            <template #header>
              <div class="card-header">
                <span>热门商品列表</span>
                <el-button type="primary" size="small" @click="saveHotProducts" :loading="savingHot">
                  保存配置
                </el-button>
              </div>
            </template>

            <div class="product-selector">
              <el-select
                v-model="selectedProductForHot"
                filterable
                remote
                reserve-keyword
                placeholder="搜索并选择商品添加到热门列表..."
                :remote-method="searchProducts"
                :loading="searchLoading"
                style="width: 400px;"
                @change="addHotProduct"
              >
                <el-option
                  v-for="item in searchResults"
                  :key="item.id"
                  :label="item.name"
                  :value="item.id"
                >
                  <span>{{ item.name }}</span>
                  <span style="float:right;color:#999;font-size:12px;">¥{{ item.price }}</span>
                </el-option>
              </el-select>
            </div>

            <div class="selected-products-grid" v-loading="loadingHot">
              <!-- 错误提示和重试 -->
              <el-alert
                v-if="hotError && !loadingHot"
                :title="'加载失败: ' + hotError"
                type="error"
                show-icon
                :closable="true"
                @close="hotError = ''"
                style="grid-column: 1 / -1; margin-bottom: 16px;"
              >
                <template #default>
                  <el-button type="primary" size="small" @click="retryFetchHotProducts" style="margin-top: 8px;">
                    🔄 重新加载
                  </el-button>
                </template>
              </el-alert>

              <el-card
                v-for="(product, index) in hotProductsList"
                :key="product.id"
                class="product-card"
                shadow="hover"
              >
                <div class="product-image-wrapper">
                  <el-image
                    :src="product.image || 'https://via.placeholder.com/150x150'"
                    fit="cover"
                    class="product-image"
                  >
                    <template #error>
                      <div class="image-error-small"><el-icon><PictureFilled /></el-icon></div>
                    </template>
                  </el-image>
                  <div class="product-index-badge hot">{{ index + 1 }}</div>
                </div>
                <h5 class="product-name">{{ product.name }}</h5>
                <p class="product-price">{{ safeFormatPrice(product.price) }}</p>
                <el-button
                  type="danger"
                  text
                  size="small"
                  @click="removeHotProduct(product.id)"
                  style="width:100%"
                >
                  移除
                </el-button>
              </el-card>

              <el-empty v-if="hotProductsList.length === 0 && !loadingHot" description="暂无热门商品" :image-size="80" />
            </div>
          </el-card>
        </div>
      </el-tab-pane>

      <!-- Tab 4: 公告编辑 -->
      <el-tab-pane label="📢 公告编辑" name="announcement">
        <div class="tab-content">
          <!-- 错误提示和重试 -->
          <el-alert
            v-if="announcementError"
            :title="'加载失败: ' + announcementError"
            type="error"
            show-icon
            :closable="true"
            @close="announcementError = ''"
            style="margin-bottom: 16px;"
          >
            <template #default>
              <el-button type="primary" size="small" @click="retryFetchAnnouncement" style="margin-top: 8px;">
                🔄 重新加载
              </el-button>
            </template>
          </el-alert>

          <el-row :gutter="20">
            <el-col :span="12">
              <el-card shadow="never">
                <template #header>
                  <div class="card-header">
                    <span>公告内容编辑</span>
                    <div>
                      <el-tag type="info" size="small" v-if="autoSaveTimer">
                        自动保存中...
                      </el-tag>
                      <el-button type="primary" size="small" @click="saveAnnouncement" :loading="savingAnnouncement">
                        发布公告
                      </el-button>
                    </div>
                  </div>
                </template>

                <el-input
                  v-model="announcementContent"
                  type="textarea"
                  :rows="15"
                  placeholder="请输入公告内容（支持HTML标签）..."
                  @input="onAnnouncementChange"
                />

                <div class="editor-tips">
                  <p><strong>提示：</strong></p>
                  <ul>
                    <li>支持HTML标签进行格式化</li>
                    <li>草稿每30秒自动保存到本地</li>
                    <li>点击"发布公告"立即发布到首页</li>
                  </ul>
                </div>
              </el-card>
            </el-col>

            <el-col :span="12">
              <el-card shadow="never">
                <template #header>
                  <span>实时预览</span>
                </template>

                <div class="preview-box" v-html="announcementContent || '<p style=\'color:#999;text-align:center;\'>预览区域</p>'"></div>
              </el-card>
            </el-col>
          </el-row>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- Banner上传/编辑对话框 -->
    <el-dialog
      v-model="bannerDialogVisible"
      :title="isEditBanner ? '编辑Banner' : '上传新Banner'"
      width="650px"
      destroy-on-close
      @closed="resetBannerForm"
    >
      <el-form ref="bannerFormRef" :model="bannerForm" :rules="bannerFormRules" label-width="100px">
        <el-form-item label="标题" prop="title">
          <el-input v-model="bannerForm.title" placeholder="请输入Banner标题（可选）" maxlength="200" show-word-limit />
        </el-form-item>

        <el-form-item label="Banner图片" prop="image_url">
          <el-upload
            class="banner-uploader"
            action="#"
            :show-file-list="true"
            :auto-upload="false"
            :limit="1"
            :file-list="bannerFileList"
            accept="image/jpeg,image/png,image/gif"
            :on-change="handleBannerFileChange"
            :before-upload="beforeBannerUpload"
            list-type="picture"
          >
            <el-button type="primary"><el-icon><Upload /></el-icon>选择图片</el-button>
            <template #tip>
              <div class="upload-tip">支持 JPG/PNG/GIF 格式，大小不超过 5MB</div>
            </template>
          </el-upload>
          <div v-if="bannerForm.image_url && !bannerFileList.length" class="current-image">
            <el-image :src="bannerForm.image_url" style="max-width:300px;max-height:150px;" fit="contain" :preview-src-list="[bannerForm.image_url]" />
          </div>
        </el-form-item>

        <el-form-item label="链接类型" prop="link_type">
          <el-radio-group v-model="bannerForm.link_type">
            <el-radio value="none">无链接</el-radio>
            <el-radio value="url">自定义URL</el-radio>
            <el-radio value="product">商品链接</el-radio>
            <el-radio value="category">分类链接</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item v-if="bannerForm.link_type === 'url'" label="跳转URL" prop="link_url">
          <el-input v-model="bannerForm.link_url" placeholder="请输入完整的URL地址" />
        </el-form-item>

        <el-form-item label="排序位置" prop="position">
          <el-input-number v-model="bannerForm.position" :min="0" :step="1" />
          <span class="form-tip">数值越小越靠前</span>
        </el-form-item>

        <el-form-item label="有效期">
          <el-date-picker
            v-model="bannerForm.dateRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DD HH:mm:ss"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="bannerDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submittingBanner" @click="submitBannerForm">{{ isEditBanner ? '更新' : '创建' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, PictureFilled, Edit, Top, Bottom, Delete, Upload } from '@element-plus/icons-vue'
import { contentApi, productApi } from '@/api'
import { safeFormatPrice } from '@/utils/format'

const activeTab = ref('banners')

// ============================================================
// Banner管理相关状态
// ============================================================
const banners = ref([])
const bannerLoading = ref(false)
const bannerError = ref('')
const bannerDialogVisible = ref(false)
const isEditBanner = ref(false)
const currentBannerId = ref(null)
const submittingBanner = ref(false)
const bannerFormRef = ref()
const bannerFileList = ref([])

const bannerForm = reactive({
  title: '',
  image_url: '',
  link_type: 'none',
  link_url: '',
  position: 0,
  dateRange: null,
  start_time: '',
  end_time: ''
})

const bannerFormRules = {
  image_url: [{ required: true, message: '请上传或填写图片URL', trigger: 'change' }]
}

// ============================================================
// 推荐商品相关状态
// ============================================================
const recommendedProductsList = ref([])
const loadingRecommended = ref(false)
const recommendedError = ref('')
const savingRecommended = ref(false)
const selectedProductForRecommend = ref(null)

// ============================================================
// 热门商品相关状态
// ============================================================
const hotProductsList = ref([])
const loadingHot = ref(false)
const hotError = ref('')
const savingHot = ref(false)
const selectedProductForHot = ref(null)

// ============================================================
// 商品搜索相关状态
// ============================================================
const searchResults = ref([])
const searchLoading = ref(false)

// ============================================================
// 公告编辑相关状态
// ============================================================
const announcementContent = ref('')
const savingAnnouncement = ref(false)
const announcementError = ref('')
const autoSaveTimer = ref(null)

// ============================================================
// Banner管理方法
// ============================================================

const fetchBanners = async () => {
  bannerLoading.value = true
  bannerError.value = ''
  try {
    const res = await contentApi.getBanners()
    if (res.data?.data) {
      banners.value = res.data.data
      console.log('[Banner] ✅ 成功加载', banners.value.length, '个Banner')
    } else {
      console.warn('[Banner] ⚠️ 返回数据格式异常:', res.data)
      banners.value = []
    }
  } catch (error) {
    console.error('[Banner] ❌ 获取Banner列表失败:', error)
    const errorMessage = error.response?.data?.error?.message || error.message || '网络连接失败，请检查网络后重试'
    bannerError.value = errorMessage
    ElMessage.error(`获取Banner列表失败: ${errorMessage}`)
  } finally {
    bannerLoading.value = false
  }
}

const retryFetchBanners = async () => {
  await fetchBanners()
}

const handleAddBanner = () => {
  isEditBanner.value = false
  currentBannerId.value = null
  Object.assign(bannerForm, {
    title: '',
    image_url: '',
    link_type: 'none',
    link_url: '',
    position: 0,
    dateRange: null,
    start_time: '',
    end_time: ''
  })
  bannerFileList.value = []
  bannerDialogVisible.value = true
}

const handleEditBanner = (banner) => {
  isEditBanner.value = true
  currentBannerId.value = banner.id
  Object.assign(bannerForm, {
    title: banner.title || '',
    image_url: banner.image_url || '',
    link_type: banner.link_type || 'none',
    link_url: banner.link_url || '',
    position: banner.position || 0,
    dateRange: (banner.start_time && banner.end_time) ? [banner.start_time, banner.end_time] : null,
    start_time: banner.start_time || '',
    end_time: banner.end_time || ''
  })
  bannerFileList.value = []
  bannerDialogVisible.value = true
}

const handleDeleteBanner = async (banner) => {
  await ElMessageBox.confirm(`确定要删除Banner"${banner.title || '未命名'}"吗？`, '提示', { type: 'warning' })

  try {
    await contentApi.deleteBanner(banner.id)
    ElMessage.success('删除成功')
    fetchBanners()
  } catch (error) {
    ElMessage.error('删除失败')
  }
}

const handleToggleStatus = async (banner, newStatus) => {
  try {
    await contentApi.updateBanner(banner.id, { status: newStatus })
    ElMessage.success(newStatus === 'active' ? '已启用' : '已禁用')
  } catch (error) {
    banner.status = newStatus === 'active' ? 'inactive' : 'active'
    ElMessage.error('状态更新失败')
  }
}

const handleMoveUp = async (banner) => {
  const currentIndex = banners.value.findIndex(b => b.id === banner.id)
  if (currentIndex <= 0) return

  const targetIndex = currentIndex - 1
  const targetBanner = banners.value[targetIndex]

  const orders = [
    { id: banner.id, position: targetBanner.position },
    { id: targetBanner.id, position: banner.position }
  ]

  try {
    await contentApi.reorderBanners({ orders })
    await fetchBanners()
    ElMessage.success('上移成功')
  } catch (error) {
    ElMessage.error('调整顺序失败')
  }
}

const handleMoveDown = async (banner) => {
  const currentIndex = banners.value.findIndex(b => b.id === banner.id)
  if (currentIndex >= banners.value.length - 1) return

  const targetIndex = currentIndex + 1
  const targetBanner = banners.value[targetIndex]

  const orders = [
    { id: banner.id, position: targetBanner.position },
    { id: targetBanner.id, position: banner.position }
  ]

  try {
    await contentApi.reorderBanners({ orders })
    await fetchBanners()
    ElMessage.success('下移成功')
  } catch (error) {
    ElMessage.error('调整顺序失败')
  }
}

const handleBannerFileChange = (file) => {
  if (file.raw) {
    uploadBannerImage(file.raw)
  }
}

const beforeBannerUpload = (file) => {
  const isImage = ['image/jpeg', 'image/png', 'image/gif'].includes(file.type)
  const isLt5M = file.size / 1024 / 1024 < 5

  if (!isImage) {
    ElMessage.error('只能上传 JPG/PNG/GIF 格式的图片!')
    return false
  }
  if (!isLt5M) {
    ElMessage.error('图片大小不能超过 5MB!')
    return false
  }
  return true
}

const uploadBannerImage = async (file) => {
  const formData = new FormData()
  formData.append('file', file)

  try {
    const res = await contentApi.uploadImage(formData)
    if (res.data?.data?.url) {
      bannerForm.image_url = res.data.data.url
      ElMessage.success('图片上传成功')
    }
  } catch (error) {
    ElMessage.error('图片上传失败')
  }
}

const submitBannerForm = async () => {
  await bannerFormRef.value.validate()

  if (!bannerForm.image_url) {
    ElMessage.warning('请先上传图片或填写图片URL')
    return
  }

  submittingBanner.value = true
  try {
    const submitData = {
      ...bannerForm,
      start_time: bannerForm.dateRange?.[0] || bannerForm.start_time,
      end_time: bannerForm.dateRange?.[1] || bannerForm.end_time
    }

    if (isEditBanner.value) {
      await contentApi.updateBanner(currentBannerId.value, submitData)
      ElMessage.success('更新成功')
    } else {
      await contentApi.createBanner(submitData)
      ElMessage.success('创建成功')
    }

    bannerDialogVisible.value = false
    fetchBanners()
  } catch (error) {
    ElMessage.error(isEditBanner.value ? '更新失败' : '创建失败')
  } finally {
    submittingBanner.value = false
  }
}

const resetBannerForm = () => {
  bannerFormRef.value?.resetFields()
}

// ============================================================
// 商品搜索方法
// ============================================================

const searchProducts = async (query) => {
  if (!query || query.trim() === '') {
    searchResults.value = []
    return
  }

  searchLoading.value = true
  try {
    const res = await productApi.getProducts({ keyword: query, limit: 20 })
    if (res.data?.data?.list) {
      searchResults.value = res.data.data.list
    }
  } catch (error) {
    console.error('搜索商品失败:', error)
  } finally {
    searchLoading.value = false
  }
}

// ============================================================
// 推荐商品方法
// ============================================================

const fetchRecommendedProducts = async () => {
  loadingRecommended.value = true
  recommendedError.value = ''
  try {
    const res = await contentApi.getHomepageConfig()
    if (res.data?.data?.recommended_products?.value) {
      const ids = JSON.parse(res.data.data.recommended_products.value)
      if (ids.length > 0) {
        const productsRes = await productApi.getProducts({})
        if (productsRes.data?.data?.list) {
          recommendedProductsList.value = productsRes.data.data.list.filter(p => ids.includes(p.id))
          console.log('[Recommended] ✅ 成功加载', recommendedProductsList.value.length, '个推荐商品')
        }
      } else {
        recommendedProductsList.value = []
        console.log('[Recommended] ℹ️ 推荐商品列表为空')
      }
    } else {
      recommendedProductsList.value = []
      console.log('[Recommended] ℹ️ 未配置推荐商品')
    }
  } catch (error) {
    console.error('[Recommended] ❌ 获取推荐商品失败:', error)
    const errorMessage = error.response?.data?.error?.message || error.message || '网络连接失败，请检查网络后重试'
    recommendedError.value = errorMessage
    ElMessage.error(`获取推荐商品失败: ${errorMessage}`)
    recommendedProductsList.value = []
  } finally {
    loadingRecommended.value = false
  }
}

const retryFetchRecommendedProducts = async () => {
  await fetchRecommendedProducts()
}

const addRecommendedProduct = (productId) => {
  const exists = recommendedProductsList.value.find(p => p.id === productId)
  if (exists) {
    ElMessage.warning('该商品已在推荐列表中')
    selectedProductForRecommend.value = null
    return
  }

  const product = searchResults.value.find(p => p.id === productId)
  if (product) {
    recommendedProductsList.value.push({ ...product })
    ElMessage.success('已添加到推荐列表')
  }
  selectedProductForRecommend.value = null
}

const removeRecommendedProduct = (productId) => {
  recommendedProductsList.value = recommendedProductsList.value.filter(p => p.id !== productId)
}

const saveRecommendedProducts = async () => {
  savingRecommended.value = true
  try {
    const ids = recommendedProductsList.value.map(p => p.id)
    await contentApi.updateHomepageConfig({
      recommended_products: ids
    })
    ElMessage.success('推荐商品配置保存成功')
  } catch (error) {
    ElMessage.error('保存失败')
  } finally {
    savingRecommended.value = false
  }
}

// ============================================================
// 热门商品方法
// ============================================================

const fetchHotProducts = async () => {
  loadingHot.value = true
  hotError.value = ''
  try {
    const res = await contentApi.getHomepageConfig()
    if (res.data?.data?.hot_products?.value) {
      const ids = JSON.parse(res.data.data.hot_products.value)
      if (ids.length > 0) {
        const productsRes = await productApi.getProducts({})
        if (productsRes.data?.data?.list) {
          hotProductsList.value = productsRes.data.data.list.filter(p => ids.includes(p.id))
          console.log('[HotProducts] ✅ 成功加载', hotProductsList.value.length, '个热门商品')
        }
      } else {
        hotProductsList.value = []
        console.log('[HotProducts] ℹ️ 热门商品列表为空')
      }
    } else {
      hotProductsList.value = []
      console.log('[HotProducts] ℹ️ 未配置热门商品')
    }
  } catch (error) {
    console.error('[HotProducts] ❌ 获取热门商品失败:', error)
    const errorMessage = error.response?.data?.error?.message || error.message || '网络连接失败，请检查网络后重试'
    hotError.value = errorMessage
    ElMessage.error(`获取热门商品失败: ${errorMessage}`)
    hotProductsList.value = []
  } finally {
    loadingHot.value = false
  }
}

const retryFetchHotProducts = async () => {
  await fetchHotProducts()
}

const addHotProduct = (productId) => {
  const exists = hotProductsList.value.find(p => p.id === productId)
  if (exists) {
    ElMessage.warning('该商品已在热门列表中')
    selectedProductForHot.value = null
    return
  }

  const product = searchResults.value.find(p => p.id === productId)
  if (product) {
    hotProductsList.value.push({ ...product })
    ElMessage.success('已添加到热门列表')
  }
  selectedProductForHot.value = null
}

const removeHotProduct = (productId) => {
  hotProductsList.value = hotProductsList.value.filter(p => p.id !== productId)
}

const saveHotProducts = async () => {
  savingHot.value = true
  try {
    const ids = hotProductsList.value.map(p => p.id)
    await contentApi.updateHomepageConfig({
      hot_products: ids
    })
    ElMessage.success('热门商品配置保存成功')
  } catch (error) {
    ElMessage.error('保存失败')
  } finally {
    savingHot.value = false
  }
}

// ============================================================
// 公告编辑方法
// ============================================================

const fetchAnnouncement = async () => {
  announcementError.value = ''
  try {
    const res = await contentApi.getHomepageConfig()
    if (res.data?.data?.announcement?.value) {
      announcementContent.value = res.data.data.announcement.value
      console.log('[Announcement] ✅ 成功加载公告内容')
    } else {
      console.log('[Announcement] ℹ️ 未配置公告')
    }
  } catch (error) {
    console.error('[Announcement] ❌ 获取公告失败:', error)
    const errorMessage = error.response?.data?.error?.message || error.message || '网络连接失败，请检查网络后重试'
    announcementError.value = errorMessage
    ElMessage.error(`获取公告失败: ${errorMessage}`)
  }
}

const retryFetchAnnouncement = async () => {
  await fetchAnnouncement()
}

const saveAnnouncement = async () => {
  savingAnnouncement.value = true
  try {
    await contentApi.updateHomepageConfig({
      announcement: announcementContent.value
    })
    ElMessage.success('公告发布成功')
    localStorage.removeItem('announcement_draft')
  } catch (error) {
    ElMessage.error('发布失败')
  } finally {
    savingAnnouncement.value = false
  }
}

const onAnnouncementChange = () => {
  localStorage.setItem('announcement_draft', announcementContent.value)
  startAutoSave()
}

const startAutoSave = () => {
  if (autoSaveTimer.value) clearTimeout(autoSaveTimer.value)
  autoSaveTimer.value = setTimeout(() => {
    localStorage.setItem('announcement_draft', announcementContent.value)
  }, 30000)
}

const loadDraftFromLocalStorage = () => {
  const draft = localStorage.getItem('announcement_draft')
  if (draft) {
    announcementContent.value = draft
  }
}

// ============================================================
// 生命周期
// ============================================================

watch(activeTab, (newTab) => {
  switch (newTab) {
    case 'banners':
      fetchBanners()
      break
    case 'recommended':
      fetchRecommendedProducts()
      break
    case 'hot':
      fetchHotProducts()
      break
    case 'announcement':
      fetchAnnouncement()
      loadDraftFromLocalStorage()
      break
  }
})

onMounted(() => {
  fetchBanners()
})

onUnmounted(() => {
  if (autoSaveTimer.value) clearTimeout(autoSaveTimer.value)
})
</script>

<style scoped>
.content-manage-container {
  padding: 0;
}

.tab-content {
  padding: 20px;
}

/* Banner管理样式 */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.banner-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  margin-bottom: 30px;
}

.banner-card {
  border-radius: 12px;
  overflow: hidden;
}

.banner-image-wrapper {
  position: relative;
  width: 100%;
  height: 180px;
  overflow: hidden;
  background-color: #f5f7fa;
}

.banner-image {
  width: 100%;
  height: 100%;
}

.position-badge {
  position: absolute;
  top: 10px;
  right: 10px;
}

.banner-info {
  padding: 16px;
}

.banner-title {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.banner-meta {
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.banner-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid #ebeef5;
}

.empty-card {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

/* 预览区域 */
.preview-container {
  display: flex;
  justify-content: center;
  padding: 20px 0;
}

.phone-frame {
  width: 375px;
  border: 3px solid #303133;
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  background-color: #000;
  padding: 10px;
}

.no-banner-tip {
  color: #fff;
  text-align: center;
  padding: 60px 0;
  font-size: 14px;
}

/* 商品配置样式 */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.product-selector {
  margin-bottom: 20px;
}

.selected-products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
  min-height: 200px;
}

.product-card {
  border-radius: 12px;
  text-align: center;
}

.product-image-wrapper {
  position: relative;
  width: 100%;
  height: 150px;
  overflow: hidden;
  border-radius: 8px;
  background-color: #f5f7fa;
  margin-bottom: 12px;
}

.product-image {
  width: 100%;
  height: 100%;
}

.product-index-badge {
  position: absolute;
  top: 6px;
  left: 6px;
  width: 24px;
  height: 24px;
  background-color: #409eff;
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
}

.product-index-badge.hot {
  background-color: #e6a23c;
}

.product-name {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0 8px;
}

.product-price {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: #e6a23c;
}

/* 公告编辑样式 */
.editor-tips {
  margin-top: 16px;
  padding: 12px;
  background-color: #f5f7fa;
  border-radius: 8px;
  font-size: 13px;
  color: #909399;
}

.editor-tips ul {
  margin: 8px 0 0 0;
  padding-left: 20px;
}

.editor-tips li {
  line-height: 1.8;
}

.preview-box {
  min-height: 350px;
  padding: 20px;
  background-color: #fafafa;
  border-radius: 8px;
  border: 1px dashed #dcdfe6;
  line-height: 1.8;
  word-wrap: break-word;
}

/* 上传组件样式 */
.banner-uploader {
  width: 100%;
}

.upload-tip {
  color: #909399;
  font-size: 12px;
  margin-top: 4px;
}

.current-image {
  margin-top: 12px;
  padding: 12px;
  background-color: #f5f7fa;
  border-radius: 8px;
  text-align: center;
}

.form-tip {
  margin-left: 12px;
  color: #909399;
  font-size: 12px;
}

/* 图片错误占位 */
.image-error {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f7fa;
  color: #c0c4cc;
}

.image-error-small {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f7fa;
  color: #c0c4cc;
}

/* 错误提示增强样式 */
:deep(.el-alert) {
  border-radius: 8px;
}

:deep(.el-alert__title) {
  font-size: 14px;
  font-weight: 500;
}

/* 加载状态优化 */
:deep(.el-loading-mask) {
  background-color: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(4px);
}
</style>
