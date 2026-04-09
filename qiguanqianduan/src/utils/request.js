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

    if (res.success === false) {
      const errorCode = res.error?.code || 'UNKNOWN'
      const errorMsg = res.error?.message || '请求失败'

      console.warn(`[API Error] ${errorCode}: ${errorMsg}`, {
        url: response.config.url,
        method: response.config.method,
        status: response.status,
        data: res
      })

      switch (errorCode) {
        case 'UNAUTHORIZED':
        case 'TOKEN_EXPIRED':
          handleUnauthorized()
          break
        case 'FORBIDDEN':
          ElMessage.error('权限不足，无法执行此操作')
          break
        default:
          ElMessage.error(errorMsg)
      }

      return Promise.reject(new Error(errorMsg))
    }

    return res
  },
  (error) => {
    console.error('[API Request Failed]', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      message: error.message
    })

    let message = error.message || '网络错误'

    if (error.response) {
      const status = error.response.status

      switch (status) {
        case 400:
          message = error.response.data?.error?.message || '请求参数错误'
          break
        case 401:
          handleUnauthorized()
          message = '登录已过期'
          break
        case 403:
          message = '权限不足，拒绝访问'
          break
        case 404:
          message = '请求的资源不存在'
          break
        case 500:
          message = '服务器内部错误，请稍后重试'
          break
        default:
          message = error.response.data?.error?.message || `请求失败(${status})`
      }
    } else if (error.code === 'ECONNABORTED') {
      message = '请求超时，请检查网络连接'
    }

    if (error.response?.status !== 401) {
      ElMessage.error(message)
    }

    return Promise.reject(error)
  }
)

function handleUnauthorized() {
  console.warn('[Auth] Token无效或已过期，即将跳转到登录页')

  localStorage.removeItem('token')
  localStorage.removeItem('user')

  ElMessage.warning({
    message: '登录已过期，请重新登录',
    duration: 2000,
    onClose: () => {
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
  })
}

export default service
