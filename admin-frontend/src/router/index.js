import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '@/layout/MainLayout.vue'
import ErrorFallback from '@/components/ErrorFallback.vue'
import PageLoading from '@/components/PageLoading.vue'

const lazyLoad = (viewPath) => {
  return () => import(/* webpackChunkName: "[request]" */ `@/views/${viewPath}.vue`)
    .catch((error) => {
      console.error(`[Router] 懒加载失败: ${viewPath}`, error)
      return import('@/components/ErrorFallback.vue')
    })
}

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: lazyLoad('Login'),
    meta: {
      title: '登录',
      requiresAuth: false,
      keepAlive: false,
      preload: true,
      public: true
    }
  },
  {
    path: '/',
    component: MainLayout,
    redirect: '/dashboard',
    meta: { requiresAuth: true },
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: lazyLoad('Dashboard'),
        meta: {
          title: '仪表盘',
          icon: 'DataAnalysis',
          requiresAuth: true,
          keepAlive: true,
          preload: true
        }
      },
      {
        path: 'products',
        name: 'Products',
        component: lazyLoad('Products'),
        meta: {
          title: '商品管理',
          icon: 'Goods',
          requiresAuth: true,
          keepAlive: true,
          preload: true
        }
      },
      {
        path: 'categories',
        name: 'Categories',
        component: lazyLoad('Categories'),
        meta: {
          title: '分类管理',
          icon: 'Menu',
          requiresAuth: true,
          keepAlive: false,
          preload: false
        }
      },
      {
        path: 'orders',
        name: 'Orders',
        component: lazyLoad('Orders'),
        meta: {
          title: '订单管理',
          icon: 'Document',
          requiresAuth: true,
          keepAlive: true,
          preload: true
        }
      },
      {
        path: 'customers',
        name: 'Customers',
        component: lazyLoad('Customers'),
        meta: {
          title: '客户资料管理',
          icon: 'UserFilled',
          requiresAuth: true,
          keepAlive: false,
          preload: false
        }
      },
      {
        path: 'coupons',
        name: 'Coupons',
        component: lazyLoad('Coupons'),
        meta: {
          title: '优惠券管理',
          icon: 'Ticket',
          requiresAuth: true,
          keepAlive: false,
          preload: false
        }
      },
      {
        path: 'content-manage',
        name: 'ContentManage',
        component: lazyLoad('ContentManage'),
        meta: {
          title: '内容管理',
          icon: 'Document',
          requiresAuth: true,
          keepAlive: false,
          preload: false
        }
      },
      {
        path: 'profile',
        name: 'UserProfile',
        component: lazyLoad('UserProfile'),
        meta: {
          title: '个人账号',
          icon: 'User',
          requiresAuth: true,
          keepAlive: false,
          preload: false
        }
      },
      {
        path: 'notifications',
        name: 'Notifications',
        component: lazyLoad('Notifications'),
        meta: {
          title: '通知中心',
          icon: 'Bell',
          requiresAuth: true,
          keepAlive: true,
          preload: false
        }
      },
      {
        path: 'system',
        name: 'System',
        meta: {
          title: '系统配置',
          icon: 'Setting',
          requiresAuth: true
        },
        children: [
          {
            path: 'settings',
            name: 'SystemSettings',
            component: lazyLoad('system/Settings'),
            meta: {
              title: '参数设置',
              requiresAuth: true,
              keepAlive: false,
              preload: false
            }
          },
          {
            path: 'logs',
            name: 'SystemLogs',
            component: lazyLoad('system/Logs'),
            meta: {
              title: '日志管理',
              requiresAuth: true,
              keepAlive: false,
              preload: false
            }
          },
          {
            path: 'security',
            name: 'SystemSecurity',
            component: lazyLoad('system/Security'),
            meta: {
              title: '安全策略',
              requiresAuth: true,
              keepAlive: false,
              preload: false
            }
          }
        ]
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: ErrorFallback,
    meta: {
      title: '页面未找到',
      requiresAuth: false,
      public: true
    }
  }
]

const router = createRouter({
  history: createWebHistory('/admin'),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(savedPosition)
        }, 100)
      })
    } else if (to.hash) {
      return {
        el: to.hash,
        behavior: 'smooth',
        top: 20
      }
    } else {
      return { top: 0, left: 0, behavior: 'smooth' }
    }
  }
})

let navigationCount = 0
let lastNavigationTime = Date.now()

const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15分钟

function getLoginAttempts() {
  const attempts = localStorage.getItem('_login_attempts')
  return attempts ? parseInt(attempts, 10) : 0
}

function setLoginAttempts(count) {
  localStorage.setItem('_login_attempts', count.toString())
}

function getLockoutEndTime() {
  const endTime = localStorage.getItem('_lockout_end')
  return endTime ? parseInt(endTime, 10) : 0
}

function setLockoutEndTime(time) {
  localStorage.setItem('_lockout_end', time.toString())
}

function isLockedOut() {
  const lockoutEnd = getLockoutEndTime()
  if (lockoutEnd > Date.now()) {
    return true
  }
  
  if (lockoutEnd > 0 && lockoutEnd <= Date.now()) {
    localStorage.removeItem('_lockout_end')
    localStorage.removeItem('_login_attempts')
  }
  
  return false
}

function incrementLoginAttempts() {
  const current = getLoginAttempts() + 1
  setLoginAttempts(current)
  
  if (current >= MAX_LOGIN_ATTEMPTS) {
    const lockoutEnd = Date.now() + LOCKOUT_DURATION_MS
    setLockoutEndTime(lockoutEnd)
    return lockoutEnd
  }
  
  return null
}

function resetLoginAttempts() {
  localStorage.removeItem('_login_attempts')
  localStorage.removeItem('_lockout_end')
}

function isValidToken(token) {
  if (!token || typeof token !== 'string') return false
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    
    if (!payload.exp) return false
    
    const currentTime = Math.floor(Date.now() / 1000)
    const isExpired = payload.exp < currentTime
    
    if (isExpired) {
      console.warn('[Auth] Token已过期，过期时间:', new Date(payload.exp * 1000).toLocaleString())
    }
    
    return !isExpired
  } catch (e) {
    console.warn('[Auth] Token解析失败:', e.message)
    return !!token && token.length > 20
  }
}

function clearAuthData() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  localStorage.removeItem('_login_attempts')
  localStorage.removeItem('_lockout_end')
}

router.beforeEach((to, from, next) => {
  const currentTime = Date.now()
  const timeDiff = currentTime - lastNavigationTime
  navigationCount++

  console.log(`[Router #${navigationCount}] 导航触发:`, {
    from: from.fullPath,
    to: to.fullPath,
    timeSinceLastNav: `${timeDiff}ms`,
    timestamp: new Date().toLocaleTimeString()
  })

  if (to.meta.title) {
    document.title = `${to.meta.title} - 绮管后台`
  } else {
    document.title = '绮管后台'
  }

  const token = localStorage.getItem('token')

  if (to.meta.public || to.meta.requiresAuth === false) {
    if (to.path === '/login' && token && isValidToken(token)) {
      console.log('[Router] 已登录且token有效，跳过登录页')
      
      const redirectPath = to.query.redirect || '/dashboard'
      next(redirectPath)
      return
    }
    
    next()
    return
  }

  if (!token || !isValidToken(token)) {
    console.warn('[Router] 未认证或token无效/过期，重定向到登录页')
    
    clearAuthData()
    
    const redirectPath = to.fullPath === '/' ? '/dashboard' : to.fullPath
    next({ 
      path: '/login', 
      query: { 
        redirect: redirectPath,
        reason: !token ? 'no_token' : 'expired' 
      } 
    })
    return
  }

  if (to.path === '/login') {
    next('/dashboard')
    return
  }

  next()

  lastNavigationTime = currentTime
})

router.beforeResolve(async (to) => {
  if (to.meta.preload) {
    try {
      const matchedComponents = to.matched.flatMap(record =>
        Object.values(record.components || {})
      )

      for (const component of matchedComponents) {
        if (typeof component === 'function') {
          await component()
        }
      }
    } catch (error) {
      console.error('[Router] 预加载失败:', error)
    }
  }
})

router.afterEach((to, from) => {
  const loadTime = Date.now() - lastNavigationTime

  console.log(`[Router] 导航完成:`, {
    to: to.fullPath,
    from: from.fullPath,
    loadTime: `${loadTime}ms`,
    scrollRestored: !!to.meta.keepAlive
  })

  window.dispatchEvent(new CustomEvent('routeChangeComplete', {
    detail: { to: to.fullPath, from: from.fullPath }
  }))
})

router.onError((error) => {
  console.error('[Router] 全局路由错误:', error)

  if (error.message.includes('Failed to fetch dynamically imported module')) {
    console.warn('[Router] 动态导入模块加载失败，可能是网络问题或缓存问题')

    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          if (name.includes('qiguan-')) {
            caches.delete(name)
          }
        })
      }).catch(e => console.error('[Router] 清除缓存失败:', e))
    }

    const currentPath = window.location.pathname
    if (!currentPath.includes('/login')) {
      window.location.reload()
    }
  }
})

export default router
export { PageLoading, ErrorFallback }

export const authUtils = {
  getLoginAttempts,
  setLoginAttempts,
  getLockoutEndTime,
  setLockoutEndTime,
  isLockedOut,
  incrementLoginAttempts,
  resetLoginAttempts,
  isValidToken,
  clearAuthData,
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_DURATION_MS
}