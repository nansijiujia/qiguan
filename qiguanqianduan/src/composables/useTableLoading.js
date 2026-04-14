/**
 * useTableLoading - 表格加载状态管理 Composable
 *
 * 功能：
 * - 管理 loading 状态
 * - 提供 withLoading 包装函数
 * - 自动错误处理
 *
 * 使用示例：
 * const { loading, withLoading } = useTableLoading()
 *
 * const fetchData = withLoading(async () => {
 *   const res = await api.getList(params)
 *   tableData.value = res.data
 * })
 */

import { ref } from 'vue'

export function useTableLoading() {
  const loading = ref(false)

  /**
   * 包装异步函数，自动管理 loading 状态
   * @param {Function} asyncFn - 异步函数
   * @returns {Function} 包装后的函数
   */
  const withLoading = (asyncFn) => {
    return async (...args) => {
      loading.value = true
      try {
        return await asyncFn(...args)
      } finally {
        loading.value = false
      }
    }
  }

  return {
    loading,
    withLoading
  }
}
