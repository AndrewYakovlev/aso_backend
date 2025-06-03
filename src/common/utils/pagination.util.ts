// src/common/utils/pagination.util.ts
import { PaginatedResult } from '../interfaces/paginated-result.interface'

export class PaginationUtil {
  static createPaginatedResult<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
  ): PaginatedResult<T> {
    const totalPages = Math.ceil(total / limit)
    const hasNext = page < totalPages
    const hasPrev = page > 1

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNext,
        hasPrev,
      },
    }
  }

  static getSkip(page: number, limit: number): number {
    return (page - 1) * limit
  }

  static validatePagination(page: number, limit: number): { page: number; limit: number } {
    const validPage = Math.max(1, page)
    const validLimit = Math.min(100, Math.max(1, limit))

    return {
      page: validPage,
      limit: validLimit,
    }
  }

  static getPaginationMeta(total: number, page: number, limit: number) {
    const totalPages = Math.ceil(total / limit)
    const from = total === 0 ? 0 : (page - 1) * limit + 1
    const to = Math.min(page * limit, total)

    return {
      from,
      to,
      total,
      currentPage: page,
      lastPage: totalPages,
      perPage: limit,
    }
  }
}
