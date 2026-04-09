import request from '@/utils/request'

export const healthApi = {
  check: () => request.get('/v1/health')
}

export const categoryApi = {
  getList: (params) => request.get('/v1/categories', { params }),
  getCategories: (params) => request.get('/v1/categories', { params }),
  add: (data) => request.post('/v1/categories', data),
  addCategory: (data) => request.post('/v1/categories', data),
  update: (id, data) => request.put(`/v1/categories/${id}`, data),
  updateCategory: (id, data) => request.put(`/v1/categories/${id}`, data),
  delete: (id) => request.delete(`/v1/categories/${id}`),
  deleteCategory: (id) => request.delete(`/v1/categories/${id}`)
}

export const productApi = {
  getList: (params) => request.get('/v1/products', { params }),
  getProducts: (params) => request.get('/v1/products', { params }),
  add: (data) => request.post('/v1/products', data),
  addProduct: (data) => request.post('/v1/products', data),
  update: (id, data) => request.put(`/v1/products/${id}`, data),
  updateProduct: (id, data) => request.put(`/v1/products/${id}`, data),
  delete: (id) => request.delete(`/v1/products/${id}`),
  deleteProduct: (id) => request.delete(`/v1/products/${id}`)
}

export const orderApi = {
  getList: (params) => request.get('/v1/orders', { params }),
  getOrders: (params) => request.get('/v1/orders', { params }),
  create: (data) => request.post('/v1/orders', data),
  cancel: (id) => request.put(`/v1/orders/${id}/cancel`),
  cancelOrder: (id) => request.put(`/v1/orders/${id}/cancel`),
  getOrderDetail: (id) => request.get(`/v1/orders/${id}`)
}

export const userApi = {
  getList: (params) => request.get('/v1/users', { params }),
  getUsers: (params) => request.get('/v1/users', { params }),
  add: (data) => request.post('/v1/users', data),
  addUser: (data) => request.post('/v1/users', data),
  update: (id, data) => request.put(`/v1/users/${id}`, data),
  updateUser: (id, data) => request.put(`/v1/users/${id}`, data),
  delete: (id) => request.delete(`/v1/users/${id}`),
  deleteUser: (id) => request.delete(`/v1/users/${id}`)
}

export const dashboardApi = {
  getOverview: () => request.get('/v1/dashboard/overview'),
  getSalesData: (params) => request.get('/v1/dashboard/sales', { params })
}

export const couponApi = {
  getList: (params) => request.get('/v1/coupons', { params }),
  getCoupons: (params) => request.get('/v1/coupons', { params }),
  add: (data) => request.post('/v1/coupons', data),
  addCoupon: (data) => request.post('/v1/coupons', data),
  update: (id, data) => request.put(`/v1/coupons/${id}`, data),
  updateCoupon: (id, data) => request.put(`/v1/coupons/${id}`, data),
  delete: (id) => request.delete(`/v1/coupons/${id}`),
  deleteCoupon: (id) => request.delete(`/v1/coupons/${id}`),
  getDetail: (id) => request.get(`/v1/coupons/${id}`),
  getStats: (id) => request.get(`/v1/coupons/${id}/stats`),
  getOverviewStats: () => request.get('/v1/coupons/stats/overview')
}

export const contentApi = {
  // Banner管理
  getBanners: (params) => request.get('/v1/content/banners', { params }),
  createBanner: (data) => request.post('/v1/content/banners', data),
  updateBanner: (id, data) => request.put(`/v1/content/banners/${id}`, data),
  deleteBanner: (id) => request.delete(`/v1/content/banners/${id}`),
  reorderBanners: (orders) => request.put('/v1/content/banners/reorder', orders),

  // 首页配置
  getHomepageConfig: () => request.get('/v1/content/homepage/config'),
  updateHomepageConfig: (data) => request.put('/v1/content/homepage/config', data),
  getHomepagePreview: () => request.get('/v1/content/homepage/preview'),

  // 文件上传
  uploadImage: (formData) => {
    return request.post('/v1/content/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  }
}
