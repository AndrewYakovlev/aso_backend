// src/common/utils/crypto.util.ts
import * as crypto from 'crypto'
import * as bcrypt from 'bcrypt'

export class CryptoUtil {
  private static readonly SALT_ROUNDS = 10

  /**
   * Hash password using bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, CryptoUtil.SALT_ROUNDS)
  }

  /**
   * Compare password with hash
   */
  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
  }

  /**
   * Generate random token
   */
  static generateToken(length = 32): string {
    return crypto.randomBytes(length).toString('hex')
  }

  /**
   * Generate OTP code
   */
  static generateOTP(length = 6, numbersOnly = true): string {
    const charset = numbersOnly ? '0123456789' : '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    let otp = ''

    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, charset.length)
      otp += charset[randomIndex]
    }

    return otp
  }

  /**
   * Generate secure random string
   */
  static generateSecureRandomString(length: number): string {
    const buffer = crypto.randomBytes(Math.ceil((length * 3) / 4))
    return buffer.toString('base64').slice(0, length).replace(/\+/g, '0').replace(/\//g, '0')
  }

  /**
   * Hash text using SHA256
   */
  static sha256(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex')
  }

  /**
   * Create HMAC
   */
  static createHmac(text: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(text).digest('hex')
  }

  /**
   * Encrypt text using AES
   */
  static encrypt(text: string, secret: string): string {
    const algorithm = 'aes-256-cbc'
    const key = crypto.scryptSync(secret, 'salt', 32)
    const iv = crypto.randomBytes(16)

    const cipher = crypto.createCipheriv(algorithm, key, iv)
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    return iv.toString('hex') + ':' + encrypted
  }

  /**
   * Decrypt text using AES
   */
  static decrypt(encryptedText: string, secret: string): string {
    const algorithm = 'aes-256-cbc'
    const key = crypto.scryptSync(secret, 'salt', 32)

    const parts = encryptedText.split(':')
    const iv = Buffer.from(parts[0], 'hex')
    const encrypted = parts[1]

    const decipher = crypto.createDecipheriv(algorithm, key, iv)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  }

  /**
   * Generate UUID v4
   */
  static generateUUID(): string {
    return crypto.randomUUID()
  }

  /**
   * Generate session ID
   */
  static generateSessionId(): string {
    return `sess_${CryptoUtil.generateToken(32)}`
  }

  /**
   * Create signature for data
   */
  static createSignature(data: any, secret: string): string {
    const payload = typeof data === 'string' ? data : JSON.stringify(data)
    return CryptoUtil.createHmac(payload, secret)
  }

  /**
   * Verify signature
   */
  static verifySignature(data: any, signature: string, secret: string): boolean {
    const expectedSignature = CryptoUtil.createSignature(data, secret)
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  }

  /**
   * Generate API key
   */
  static generateApiKey(prefix = 'sk'): string {
    const timestamp = Date.now().toString(36)
    const random = CryptoUtil.generateToken(24)
    return `${prefix}_${timestamp}_${random}`
  }

  /**
   * Mask API key for display
   */
  static maskApiKey(apiKey: string, visibleChars = 8): string {
    if (apiKey.length <= visibleChars * 2) {
      return apiKey
    }

    const start = apiKey.slice(0, visibleChars)
    const end = apiKey.slice(-visibleChars)
    return `${start}...${end}`
  }
}
