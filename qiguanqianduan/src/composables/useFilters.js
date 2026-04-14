/**
 * useFilters - 筛选器逻辑 Composable
 *
 * 功能：
 * - 管理筛选条件状态
 * - 提供重置方法
 * - 支持动态字段定义
 *
 * 使用示例：
 * const { filters, resetFilters, hasActiveFilters, getFilterParams } = useFilters({
 *   status: '',
 *   keyword: ''
 * })
 */

import { reactive, computed } from 'vue'

export function useFilters(defaultFilters = {}) {
  const filters = reactive({ ...defaultFilters })

  /**
   * 重置筛选条件到初始值
   */
  const resetFilters = () => {
    Object.keys(defaultFilters).forEach(key => {
      filters[key] = defaultFilters[key]
    })
  }

  /**
   * 检查是否有激活的筛选条件
   */
  const hasActiveFilters = computed(() => {
    return Object.entries(filters).some(([key, value]) => {
      const defaultValue = defaultFilters[key]
      if (Array.isArray(value)) {
        return value.length > 0
      }
      return value !== defaultValue && value !== '' && value !== null && value !== undefined
    })
  })

  /**
   * 获取非空的筛选参数（用于API调用）
   */
  const getFilterParams = () => {
    const params = {}
    Object.entries(filters).forEach(([key, value]) => {
      if (
        value !== '' &&
        value !== null &&
        value !== undefined &&
        !(Array.isArray(value) && value.length === 0)
      ) {
        params[key] = value
      }
    })
    return params
  }

  return {
    filters,
    resetFilters,
    hasActiveFilters,
    getFilterParams
  }
}
