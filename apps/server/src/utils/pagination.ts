/**
 * Pagination utility — content negotiation.
 *
 * If `?page=` is present in the query, returns `{ data: [...], total }`.
 * Otherwise returns the bare array (Flowise default for non-paginated requests).
 */

export interface PaginationQuery {
  page?: string | undefined
  limit?: string | undefined
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
}

/** Apply pagination and return the appropriate response shape. */
export function paginate<T>(items: T[], query: PaginationQuery): T[] | PaginatedResponse<T> {
  if (query.page == null) {
    // No pagination requested — return bare array
    return items
  }

  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.max(1, Number(query.limit) || 12)
  const start = (page - 1) * limit
  const data = items.slice(start, start + limit)

  return { data, total: items.length }
}
