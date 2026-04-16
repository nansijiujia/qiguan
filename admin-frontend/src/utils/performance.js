const isPerformanceMonitorEnabled = import.meta.env.VITE_ENABLE_PERFORMANCE_MONITOR === 'true'

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      fcp: null,
      lcp: null,
      fid: null,
      cls: 0,
      apiRequests: [],
      routeChanges: [],
      memoryUsage: []
    }
    
    this.routeStartTime = null
    this.apiStartTime = null
    
    if (isPerformanceMonitorEnabled) {
      this.init()
    }
  }
  
  init() {
    if ('PerformanceObserver' in window) {
      this.observeFCP()
      this.observeLCP()
      this.observeFID()
      this.observeCLS()
    }
    
    this.startMemoryMonitoring()
    console.log('[Performance Monitor] ✅ 已启动')
  }
  
  observeFCP() {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          this.metrics.fcp = entry.startTime
          console.log(`[Performance] FCP: ${entry.startTime.toFixed(2)}ms`)
          break
        }
      }
    })
    observer.observe({ type: 'paint', buffered: true })
  }
  
  observeLCP() {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const lastEntry = entries[entries.length - 1]
      this.metrics.lcp = lastEntry.startTime
      console.log(`[Performance] LCP: ${lastEntry.startTime.toFixed(2)}ms`)
    })
    observer.observe({ type: 'largest-contentful-paint', buffered: true })
  }
  
  observeFID() {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'first-input') {
          this.metrics.fid = entry.processingStart - entry.startTime
          console.log(`[Performance] FID: ${this.metrics.fid.toFixed(2)}ms`)
          break
        }
      }
    })
    observer.observe({ type: 'first-input', buffered: true })
  }
  
  observeCLS() {
    let clsValue = 0
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value
        }
      }
      this.metrics.cls = clsValue
      console.log(`[Performance] CLS: ${clsValue.toFixed(4)}`)
    })
    observer.observe({ type: 'layout-shift', buffered: true })
  }
  
  startRouteChange(routeName) {
    this.routeStartTime = performance.now()
    console.log(`[Performance] 🚀 路由切换开始: ${routeName}`)
  }
  
  endRouteChange(routeName) {
    if (!this.routeStartTime) return
    
    const duration = performance.now() - this.routeStartTime
    const metric = {
      route: routeName,
      duration: duration.toFixed(2),
      timestamp: new Date().toISOString()
    }
    
    this.metrics.routeChanges.push(metric)
    console.log(`[Performance] ✅ 路由切换完成: ${routeName} (${duration.toFixed(2)}ms)`)
    
    this.routeStartTime = null
    
    return duration
  }
  
  startAPICall(apiUrl, method = 'GET') {
    this.apiStartTime = performance.now()
    return { url: apiUrl, method, startTime: this.apiStartTime }
  }
  
  endAPICall(apiInfo, success = true) {
    if (!apiInfo || !apiInfo.startTime) return
    
    const duration = performance.now() - apiInfo.startTime
    const metric = {
      url: apiInfo.url,
      method: apiInfo.method,
      duration: duration.toFixed(2),
      success,
      timestamp: new Date().toISOString()
    }
    
    this.metrics.apiRequests.push(metric)
    console.log(
      `[Performance] ${success ? '✅' : '❌'} API ${apiInfo.method} ${apiInfo.url} (${duration.toFixed(2)}ms)`
    )
    
    return duration
  }
  
  startMemoryMonitoring() {
    if ('memory' in performance) {
      setInterval(() => {
        const memory = performance.memory
        const usage = {
          usedJSHeapSize: (memory.usedJSHeapSize / 1024 / 1024).toFixed(2),
          totalJSHeapSize: (memory.totalJSHeapSize / 1024 / 1024).toFixed(2),
          jsHeapSizeLimit: (memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2),
          timestamp: new Date().toISOString()
        }
        
        this.metrics.memoryUsage.push(usage)
        
        if (parseFloat(usage.usedJSHeapSize) > 100) {
          console.warn(
            `[Performance] ⚠️ 内存使用过高: ${usage.usedJSHeapSize}MB / ${usage.totalJSHeapSize}MB`
          )
        }
      }, 30000)
    }
  }
  
  getMetrics() {
    return {
      ...this.metrics,
      summary: {
        fcp: this.metrics.fcp ? `${this.metrics.fcp.toFixed(2)}ms` : 'N/A',
        lcp: this.metrics.lcp ? `${this.metrics.lcp.toFixed(2)}ms` : 'N/A',
        fid: this.metrics.fid ? `${this.metrics.fid.toFixed(2)}ms` : 'N/A',
        cls: this.metrics.cls ? this.metrics.cls.toFixed(4) : 'N/A',
        avgApiTime: this.getAverageApiTime(),
        avgRouteTime: this.getAverageRouteTime()
      }
    }
  }
  
  getAverageApiTime() {
    if (this.metrics.apiRequests.length === 0) return 'N/A'
    
    const totalTime = this.metrics.apiRequests.reduce(
      (sum, req) => sum + parseFloat(req.duration), 
      0
    )
    return `${(totalTime / this.metrics.apiRequests.length).toFixed(2)}ms`
  }
  
  getAverageRouteTime() {
    if (this.metrics.routeChanges.length === 0) return 'N/A'
    
    const totalTime = this.metrics.routeChanges.reduce(
      (sum, route) => sum + parseFloat(route.duration), 
      0
    )
    return `${(totalTime / this.metrics.routeChanges.length).toFixed(2)}ms`
  }
  
  generateReport() {
    const metrics = this.getMetrics()
    
    console.group('📊 性能监控报告')
    console.log('🎨 核心Web指标:', {
      '首屏绘制 (FCP)': metrics.summary.fcp,
      '最大内容绘制 (LCP)': metrics.summary.lcp,
      '首次输入延迟 (FID)': metrics.summary.fid,
      '累积布局偏移 (CLS)': metrics.summary.cls
    })
    console.log('⚡ API性能:', {
      '总请求数': metrics.apiRequests.length,
      '平均响应时间': metrics.summary.avgApiTime
    })
    console.log('🔄 路由性能:', {
      '总切换次数': metrics.routeChanges.length,
      '平均切换时间': metrics.summary.avgRouteTime
    })
    console.groupEnd()
    
    return metrics
  }
}

const performanceMonitor = new PerformanceMonitor()

export default performanceMonitor

export function usePerformance() {
  return {
    startRouteChange: (routeName) => performanceMonitor.startRouteChange(routeName),
    endRouteChange: (routeName) => performanceMonitor.endRouteChange(routeName),
    startAPICall: (url, method) => performanceMonitor.startAPICall(url, method),
    endAPICall: (apiInfo, success) => performanceMonitor.endAPICall(apiInfo, success),
    getMetrics: () => performanceMonitor.getMetrics(),
    generateReport: () => performanceMonitor.generateReport()
  }
}
