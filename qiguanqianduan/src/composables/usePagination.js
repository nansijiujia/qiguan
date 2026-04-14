/**
 * usePagination - 分页逻辑 Composable
 *
 * 功能：
 * - 管理分页状态（page, limit, total）
 * - 提供分页重置方法
 * - 支持自定义默认值
 *
 * 使用示例：
 * const { pagination, resetPage, setTotal } = usePagination(10)
 */

import { reactive } from 'vue'

export function usePagination(defaultLimit = 10) {
  const pagination = reactive({
    page: 1,
    limit: defaultLimit,
    total: 0
  })

  /**
   * 重置到第一页
   */
  const resetPage = () => {
    pagination.page = 1
  }

  /**
   * 设置总数
   * @param {number} total - 总记录数
   */
  const setTotal = (total) => {
    pagination.total = total
  }

  /**
   * 重置全部（包括总数）
   */
  const resetAll = () => {
    pagination.page = 1
    pagination.limit = defaultLimit
    pagination.total = 0
  }

  return {
    pagination,
    resetPage,
    setTotal,
    resetAll
  }
}
