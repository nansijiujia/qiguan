import request from '@/utils/request'

export const healthApi = {
  check: () => request.get('/v1/health')
}

export const categoryApi = {
  getList: (params) => request.get('/v1/categories', { params }),
  add: (data) => request.post('/v1/categories', data),
  update: (id, data) => request.put(`/v1/categories/${id}`, data),
  delete: (id) => request.delete(`/v1/categories/${id}`)
}

export const productApi = {
  getList: (params) => request.get('/v1/products', { params }),
  add: (data) => request.post('/v1/products', data),
  update: (id, data) => request.put(`/v1/products/${id}`, data),
  delete: (id) => request.delete(`/v1/products/${id}`)
}

export const orderApi = {
  getList: (params) => request.get('/v1/orders', { params }),
  create: (data) => request.post('/v1/orders', data),
  cancel: (id) => request.put(`/v1/orders/${id}/cancel`)
}

export const userApi = {
  getList: (params) => request.get('/v1/users', { params }),
  add: (data) => request.post('/v1/users', data),
  update: (id, data) => request.put(`/v1/users/${id}`, data),
  delete: (id) => request.delete(`/v1/users/${id}`)
}

export const dashboardApi = {
  getOverview: () => request.get('/v1/dashboard/overview'),
  getSalesData: (params) => request.get('/v1/dashboard/sales', { params })
}
