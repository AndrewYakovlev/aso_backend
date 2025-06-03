// src/common/utils/date.util.ts
export class DateUtil {
  /**
   * Format date to Russian locale string
   */
  static formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString('ru-RU', options)
  }

  /**
   * Format date and time to Russian locale string
   */
  static formatDateTime(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleString('ru-RU', options)
  }

  /**
   * Get relative time string (e.g., "2 часа назад")
   */
  static getRelativeTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffSecs = Math.floor(diffMs / 1000)
    const diffMins = Math.floor(diffSecs / 60)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffSecs < 60) {
      return 'только что'
    } else if (diffMins < 60) {
      return `${diffMins} ${DateUtil.pluralize(diffMins, 'минуту', 'минуты', 'минут')} назад`
    } else if (diffHours < 24) {
      return `${diffHours} ${DateUtil.pluralize(diffHours, 'час', 'часа', 'часов')} назад`
    } else if (diffDays < 7) {
      return `${diffDays} ${DateUtil.pluralize(diffDays, 'день', 'дня', 'дней')} назад`
    } else {
      return DateUtil.formatDate(d)
    }
  }

  /**
   * Add days to date
   */
  static addDays(date: Date, days: number): Date {
    const result = new Date(date)
    result.setDate(result.getDate() + days)
    return result
  }

  /**
   * Add hours to date
   */
  static addHours(date: Date, hours: number): Date {
    const result = new Date(date)
    result.setHours(result.getHours() + hours)
    return result
  }

  /**
   * Add minutes to date
   */
  static addMinutes(date: Date, minutes: number): Date {
    const result = new Date(date)
    result.setMinutes(result.getMinutes() + minutes)
    return result
  }

  /**
   * Get start of day
   */
  static startOfDay(date: Date): Date {
    const result = new Date(date)
    result.setHours(0, 0, 0, 0)
    return result
  }

  /**
   * Get end of day
   */
  static endOfDay(date: Date): Date {
    const result = new Date(date)
    result.setHours(23, 59, 59, 999)
    return result
  }

  /**
   * Get date range for period
   */
  static getDateRange(period: 'today' | 'week' | 'month' | 'year'): { start: Date; end: Date } {
    const now = new Date()
    let start: Date
    let end: Date = DateUtil.endOfDay(now)

    switch (period) {
      case 'today':
        start = DateUtil.startOfDay(now)
        break
      case 'week':
        start = new Date(now)
        start.setDate(now.getDate() - now.getDay() + 1) // Monday
        start = DateUtil.startOfDay(start)
        break
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'year':
        start = new Date(now.getFullYear(), 0, 1)
        break
    }

    return { start, end }
  }

  /**
   * Check if date is in range
   */
  static isInRange(date: Date, start: Date, end: Date): boolean {
    return date >= start && date <= end
  }

  /**
   * Get working days between dates (excluding weekends)
   */
  static getWorkingDays(start: Date, end: Date): number {
    let count = 0
    const current = new Date(start)

    while (current <= end) {
      const dayOfWeek = current.getDay()
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        count++
      }
      current.setDate(current.getDate() + 1)
    }

    return count
  }

  /**
   * Format duration in milliseconds to human readable
   */
  static formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) {
      return `${days} ${DateUtil.pluralize(days, 'день', 'дня', 'дней')}`
    } else if (hours > 0) {
      return `${hours} ${DateUtil.pluralize(hours, 'час', 'часа', 'часов')}`
    } else if (minutes > 0) {
      return `${minutes} ${DateUtil.pluralize(minutes, 'минута', 'минуты', 'минут')}`
    } else {
      return `${seconds} ${DateUtil.pluralize(seconds, 'секунда', 'секунды', 'секунд')}`
    }
  }

  /**
   * Russian pluralization helper
   */
  private static pluralize(count: number, one: string, two: string, many: string): string {
    const mod10 = count % 10
    const mod100 = count % 100

    if (mod10 === 1 && mod100 !== 11) {
      return one
    } else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
      return two
    } else {
      return many
    }
  }
}
