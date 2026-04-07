import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import router from '@/router'

const service = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json;charset=UTF-8'
  }
})

service.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    console.error('Request error:', error)
    return Promise.reject(error)
  }
)

service.interceptors.response.use(
  (response) => {
    const res = response.data
    if (res.code && res.code !== 200 && res.code !== 0) {
      ElMessage.error(res.message || '请求失败')
      if (res.code === 401) {
        ElMessageBox.confirm('登录已过期，请重新登录', '提示', {
          confirmButtonText: '重新登录',
          cancelButtonText: '取消',
          type: 'warning'
        }).then(() => {
          localStorage.removeItem('token')
          router.push('/login')
        })
      }
      return Promise.reject(new Error(res.message || 'Error'))
    }
    return res
  },
  (error) => {
    console.error('Response error:', error)
    let message = error.message || '网络错误'
    if (error.response) {
      switch (error.response.status) {
        case 400:
          message = '请求错误(400)'
          break
        case 401:
          message = '未授权，请重新登录(401)'
          localStorage.removeItem('token')
          router.push('/login')
          break
        case 403:
          message = '拒绝访问(403)'
          break
        case 404:
          message = '请求地址不存在(404)'
          break
        case 500:
          message = '服务器内部错误(500)'
          break
        default:
          message = `连接错误(${error.response.status})`
      }
    }
    ElMessage.error(message)
    return Promise.reject(error)
  }
)

export default service
