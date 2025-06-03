// src/common/utils/string.util.ts
export class StringUtil {
  /**
   * Generate a slug from a string
   */
  static slugify(text: string): string {
    return text
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
      .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
      .replace(/-{2,}/g, '-') // Replace multiple hyphens with single
  }

  /**
   * Generate a random string
   */
  static generateRandomString(length: number, charset?: string): string {
    const defaultCharset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    const chars = charset || defaultCharset
    let result = ''

    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }

    return result
  }

  /**
   * Truncate string with ellipsis
   */
  static truncate(text: string, length: number, suffix = '...'): string {
    if (text.length <= length) {
      return text
    }
    return text.substring(0, length - suffix.length) + suffix
  }

  /**
   * Capitalize first letter
   */
  static capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
  }

  /**
   * Convert camelCase to snake_case
   */
  static camelToSnake(text: string): string {
    return text.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
  }

  /**
   * Convert snake_case to camelCase
   */
  static snakeToCamel(text: string): string {
    return text.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
  }

  /**
   * Format phone number for display
   */
  static formatPhone(phone: string): string {
    const cleaned = phone.replace(/\D/g, '')

    if (cleaned.length === 11 && cleaned.startsWith('7')) {
      // Russian format: +7 (XXX) XXX-XX-XX
      return `+7 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7, 9)}-${cleaned.slice(9)}`
    }

    return phone
  }

  /**
   * Clean phone number for storage
   */
  static cleanPhone(phone: string): string {
    let cleaned = phone.replace(/\D/g, '')

    // Convert 8 to 7 for Russian numbers
    if (cleaned.length === 11 && cleaned.startsWith('8')) {
      cleaned = '7' + cleaned.slice(1)
    }

    // Add 7 if missing for Russian numbers
    if (cleaned.length === 10) {
      cleaned = '7' + cleaned
    }

    return '+' + cleaned
  }

  /**
   * Generate order number
   */
  static generateOrderNumber(prefix = 'ORD'): string {
    const timestamp = Date.now().toString(36).toUpperCase()
    const random = StringUtil.generateRandomString(4, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')
    return `${prefix}-${timestamp}-${random}`
  }

  /**
   * Mask sensitive data
   */
  static mask(text: string, visibleStart = 3, visibleEnd = 3, maskChar = '*'): string {
    if (text.length <= visibleStart + visibleEnd) {
      return text
    }

    const start = text.slice(0, visibleStart)
    const end = text.slice(-visibleEnd)
    const maskLength = text.length - visibleStart - visibleEnd
    const mask = maskChar.repeat(maskLength)

    return start + mask + end
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  /**
   * Extract initials from name
   */
  static getInitials(name: string): string {
    return name
      .split(' ')
      .map((part) => part.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2)
  }
}
