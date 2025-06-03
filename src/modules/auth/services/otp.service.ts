// src/modules/auth/services/otp.service.ts
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { RedisService } from '../../../redis/redis.service'
import { CacheKeys } from '../../../redis/redis.constants'
import { CryptoUtil } from '@common/utils/crypto.util'

interface OtpData {
  code: string
  attempts: number
  createdAt: Date
}

@Injectable()
export class OtpService {
  private readonly otpLength: number
  private readonly otpExpiration: number
  private readonly maxAttempts = 3

  constructor(
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.otpLength = this.configService.get<number>('jwt.otp.length', 6)
    this.otpExpiration = this.configService.get<number>('jwt.otp.expiration', 300) // 5 минут
  }

  async generateOtp(phone: string): Promise<{ code: string; expiresIn: number }> {
    const code = CryptoUtil.generateOTP(this.otpLength)

    const otpData: OtpData = {
      code,
      attempts: 0,
      createdAt: new Date(),
    }

    // Сохраняем в Redis
    await this.redis.set(`${CacheKeys.OTP}${phone}`, otpData, this.otpExpiration)

    return {
      code,
      expiresIn: this.otpExpiration,
    }
  }

  async verifyOtp(phone: string, code: string): Promise<boolean> {
    const key = `${CacheKeys.OTP}${phone}`
    const otpData = await this.redis.get<OtpData>(key)

    if (!otpData) {
      return false
    }

    // Проверяем количество попыток
    if (otpData.attempts >= this.maxAttempts) {
      await this.redis.del(key)
      return false
    }

    // Увеличиваем счетчик попыток
    otpData.attempts++
    await this.redis.set(key, otpData, this.otpExpiration)

    // Проверяем код
    if (otpData.code !== code) {
      // Если это была последняя попытка, удаляем OTP
      if (otpData.attempts >= this.maxAttempts) {
        await this.redis.del(key)
      }
      return false
    }

    return true
  }

  async getOtp(phone: string): Promise<OtpData | null> {
    return this.redis.get<OtpData>(`${CacheKeys.OTP}${phone}`)
  }

  async deleteOtp(phone: string): Promise<void> {
    await this.redis.del(`${CacheKeys.OTP}${phone}`)
  }

  async getRemainingAttempts(phone: string): Promise<number> {
    const otpData = await this.getOtp(phone)
    if (!otpData) {
      return this.maxAttempts
    }
    return Math.max(0, this.maxAttempts - otpData.attempts)
  }

  async getTimeToExpire(phone: string): Promise<number> {
    const ttl = await this.redis.ttl(`${CacheKeys.OTP}${phone}`)
    return ttl > 0 ? ttl : 0
  }
}
