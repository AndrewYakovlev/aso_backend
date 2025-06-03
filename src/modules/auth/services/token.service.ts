// src/modules/auth/services/token.service.ts
import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { RedisService } from '../../../redis/redis.service'
import { CacheKeys } from '../../../redis/redis.constants'
import { TokenResponseDto } from '../dto/token-response.dto'

export interface JwtPayload {
  userId: string
  phone: string
  role: string
  type: 'access' | 'refresh'
}

export interface AnonymousJwtPayload {
  sessionId: string
  isAnonymous: true
  type: 'anonymous'
}

@Injectable()
export class TokenService {
  private readonly accessTokenSecret: string
  private readonly accessTokenExpiration: string
  private readonly refreshTokenSecret: string
  private readonly refreshTokenExpiration: string
  private readonly refreshTokenTTL: number

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
  ) {
    // Получаем конфигурацию с проверкой
    const accessTokenSecret = this.configService.get<string>('jwt.access.secret')
    const accessTokenExpiration = this.configService.get<string>('jwt.access.expiresIn')
    const refreshTokenSecret = this.configService.get<string>('jwt.refresh.secret')
    const refreshTokenExpiration = this.configService.get<string>('jwt.refresh.expiresIn')

    // Проверяем обязательные значения
    if (!accessTokenSecret) {
      throw new Error('JWT access token secret is not configured (JWT_SECRET)')
    }
    if (!accessTokenExpiration) {
      throw new Error('JWT access token expiration is not configured (JWT_ACCESS_TOKEN_EXPIRATION)')
    }
    if (!refreshTokenSecret) {
      throw new Error('JWT refresh token secret is not configured (JWT_REFRESH_TOKEN_SECRET)')
    }
    if (!refreshTokenExpiration) {
      throw new Error(
        'JWT refresh token expiration is not configured (JWT_REFRESH_TOKEN_EXPIRATION)',
      )
    }

    this.accessTokenSecret = accessTokenSecret
    this.accessTokenExpiration = accessTokenExpiration
    this.refreshTokenSecret = refreshTokenSecret
    this.refreshTokenExpiration = refreshTokenExpiration

    // Конвертируем время жизни refresh токена в секунды для Redis
    this.refreshTokenTTL = this.parseExpirationToSeconds(this.refreshTokenExpiration)
  }

  async generateTokens(payload: Omit<JwtPayload, 'type'>): Promise<TokenResponseDto> {
    const accessPayload: JwtPayload = { ...payload, type: 'access' }
    const refreshPayload: JwtPayload = { ...payload, type: 'refresh' }

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.accessTokenSecret,
        expiresIn: this.accessTokenExpiration,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.refreshTokenSecret,
        expiresIn: this.refreshTokenExpiration,
      }),
    ])

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.parseExpirationToSeconds(this.accessTokenExpiration),
    }
  }

  generateAnonymousToken(sessionId: string): string {
    const payload: AnonymousJwtPayload = {
      sessionId,
      isAnonymous: true,
      type: 'anonymous',
    }

    return this.jwtService.sign(payload, {
      secret: this.accessTokenSecret,
      expiresIn: this.accessTokenExpiration,
    })
  }

  async verifyAccessToken(token: string): Promise<JwtPayload> {
    return this.jwtService.verifyAsync<JwtPayload>(token, {
      secret: this.accessTokenSecret,
    })
  }

  async verifyRefreshToken(token: string): Promise<JwtPayload> {
    return this.jwtService.verifyAsync<JwtPayload>(token, {
      secret: this.refreshTokenSecret,
    })
  }

  async verifyAnonymousToken(token: string): Promise<AnonymousJwtPayload> {
    return this.jwtService.verifyAsync<AnonymousJwtPayload>(token, {
      secret: this.accessTokenSecret,
    })
  }

  async saveRefreshToken(userId: string, refreshToken: string): Promise<void> {
    await this.redis.set(
      `${CacheKeys.SESSION}refresh:${userId}`,
      refreshToken,
      this.refreshTokenTTL,
    )
  }

  async getRefreshToken(userId: string): Promise<string | null> {
    return this.redis.get<string>(`${CacheKeys.SESSION}refresh:${userId}`)
  }

  async deleteRefreshToken(userId: string): Promise<void> {
    await this.redis.del(`${CacheKeys.SESSION}refresh:${userId}`)
  }

  async isRefreshTokenValid(userId: string, refreshToken: string): Promise<boolean> {
    const savedToken = await this.getRefreshToken(userId)
    return savedToken === refreshToken
  }

  private parseExpirationToSeconds(expiration: string): number {
    const match = expiration.match(/^(\d+)([smhd])$/)
    if (!match) {
      throw new Error(`Invalid expiration format: ${expiration}`)
    }

    const [, value, unit] = match
    const numValue = parseInt(value, 10)

    switch (unit) {
      case 's':
        return numValue
      case 'm':
        return numValue * 60
      case 'h':
        return numValue * 60 * 60
      case 'd':
        return numValue * 60 * 60 * 24
      default:
        throw new Error(`Unknown time unit: ${unit}`)
    }
  }
}
