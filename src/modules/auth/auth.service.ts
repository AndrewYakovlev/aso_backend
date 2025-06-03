// src/modules/auth/auth.service.ts
import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { OtpService } from './services/otp.service'
import { TokenService } from './services/token.service'
import { SmsService } from './services/sms.service'
import { UsersService } from '../users/users.service'
import { AnonymousUsersService } from '../users/anonymous-users.service'
import { TokenResponseDto } from './dto/token-response.dto'
import { AnonymousTokenDto } from './dto/anonymous-token.dto'
import { UserResponseDto } from '../users/dto/user-response.dto'
import { StringUtil } from '@common/utils/string.util'
import { LoggerService } from '../../logger/logger.service'
import { RedisService } from '../../redis/redis.service'
import { CacheKeys, CacheTTL } from '../../redis/redis.constants'

@Injectable()
export class AuthService {
  constructor(
    private readonly otpService: OtpService,
    private readonly tokenService: TokenService,
    private readonly smsService: SmsService,
    private readonly usersService: UsersService,
    private readonly anonymousUsersService: AnonymousUsersService,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
    private readonly redis: RedisService,
  ) {}

  async createAnonymousSession(userAgent: string, ipAddress: string): Promise<AnonymousTokenDto> {
    const anonymousUser = await this.anonymousUsersService.create({
      userAgent,
      ipAddress,
    })

    const token = this.tokenService.generateAnonymousToken(anonymousUser.sessionId)

    // Сохраняем сессию в Redis с увеличенным TTL (1 год)
    const anonymousSessionTTL = this.tokenService.getAnonymousTokenExpiration()
    await this.redis.set(
      `${CacheKeys.SESSION}anonymous:${anonymousUser.sessionId}`,
      anonymousUser,
      anonymousSessionTTL,
    )

    this.logger.logBusinessEvent('anonymous_session_created', undefined, {
      sessionId: anonymousUser.sessionId,
      ip: ipAddress,
    })

    return {
      token,
      sessionId: anonymousUser.sessionId,
      expiresIn: anonymousSessionTTL,
    }
  }

  async sendOtp(phone: string): Promise<{ message: string; expiresIn: number }> {
    // Нормализуем номер телефона
    const normalizedPhone = StringUtil.cleanPhone(phone)

    // Проверяем, не отправляли ли мы уже код недавно
    const recentOtp = await this.otpService.getOtp(normalizedPhone)
    if (recentOtp) {
      throw new BadRequestException('OTP код уже был отправлен. Попробуйте позже.')
    }

    // Генерируем OTP код
    const { code, expiresIn } = await this.otpService.generateOtp(normalizedPhone)

    // Отправляем SMS
    try {
      await this.smsService.sendOtp(normalizedPhone, code)
    } catch (error) {
      // Исправление: проверяем тип error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const errorStack = error instanceof Error ? error.stack : undefined

      this.logger.error('Failed to send OTP SMS', errorStack, 'AuthService')
      await this.otpService.deleteOtp(normalizedPhone)
      throw new BadRequestException('Не удалось отправить SMS. Попробуйте позже.')
    }

    this.logger.logBusinessEvent('otp_sent', undefined, {
      phone: StringUtil.mask(normalizedPhone, 3, 2),
    })

    return {
      message: 'OTP код отправлен на указанный номер',
      expiresIn,
    }
  }

  async verifyOtp(phone: string, code: string): Promise<TokenResponseDto> {
    // Нормализуем номер телефона
    const normalizedPhone = StringUtil.cleanPhone(phone)

    // Проверяем OTP код
    const isValid = await this.otpService.verifyOtp(normalizedPhone, code)
    if (!isValid) {
      this.logger.logSecurityEvent('invalid_otp_attempt', undefined, {
        phone: StringUtil.mask(normalizedPhone, 3, 2),
      })
      throw new UnauthorizedException('Неверный или истекший OTP код')
    }

    // Удаляем использованный OTP
    await this.otpService.deleteOtp(normalizedPhone)

    // Находим или создаем пользователя
    let user = await this.usersService.findByPhone(normalizedPhone)
    if (!user) {
      user = await this.usersService.create({
        phone: normalizedPhone,
      })
      this.logger.logBusinessEvent('user_registered', user.id, {
        phone: StringUtil.mask(normalizedPhone, 3, 2),
      })
    }

    // Генерируем токены
    const tokens = await this.tokenService.generateTokens({
      userId: user.id,
      phone: user.phone,
      role: user.role,
    })

    // Сохраняем refresh token в Redis
    await this.tokenService.saveRefreshToken(user.id, tokens.refreshToken)

    // Кешируем данные пользователя
    await this.redis.set(`${CacheKeys.USER}${user.id}`, user, CacheTTL.USER)

    this.logger.logBusinessEvent('user_logged_in', user.id, {
      method: 'otp',
    })

    return {
      ...tokens,
      user: UserResponseDto.fromEntity(user),
    }
  }

  async refreshTokens(userId: string, refreshToken: string): Promise<TokenResponseDto> {
    // Проверяем refresh token в Redis
    const savedToken = await this.tokenService.getRefreshToken(userId)
    if (!savedToken || savedToken !== refreshToken) {
      throw new UnauthorizedException('Invalid refresh token')
    }

    // Получаем пользователя
    const user = await this.usersService.findById(userId)
    if (!user) {
      throw new UnauthorizedException('User not found')
    }

    // Генерируем новые токены
    const tokens = await this.tokenService.generateTokens({
      userId: user.id,
      phone: user.phone,
      role: user.role,
    })

    // Обновляем refresh token в Redis
    await this.tokenService.saveRefreshToken(user.id, tokens.refreshToken)

    this.logger.logBusinessEvent('tokens_refreshed', user.id)

    return {
      ...tokens,
      user: UserResponseDto.fromEntity(user),
    }
  }

  async logout(userId: string): Promise<void> {
    // Удаляем refresh token
    await this.tokenService.deleteRefreshToken(userId)

    // Очищаем кеш пользователя
    await this.redis.del(`${CacheKeys.USER}${userId}`)

    this.logger.logBusinessEvent('user_logged_out', userId)
  }

  async getCurrentUser(userId: string): Promise<UserResponseDto> {
    // Пробуем получить из кеша
    const cached = await this.redis.get<any>(`${CacheKeys.USER}${userId}`)
    if (cached) {
      return UserResponseDto.fromEntity(cached)
    }

    // Получаем из БД
    const user = await this.usersService.findById(userId)
    if (!user) {
      throw new UnauthorizedException('User not found')
    }

    // Кешируем
    await this.redis.set(`${CacheKeys.USER}${userId}`, user, CacheTTL.USER)

    return UserResponseDto.fromEntity(user)
  }

  async validateUser(userId: string): Promise<any> {
    const user = await this.usersService.findById(userId)
    if (!user) {
      throw new UnauthorizedException('User not found')
    }
    return user
  }

  async validateAnonymousSession(sessionId: string): Promise<any> {
    // Проверяем в Redis
    const cached = await this.redis.get<any>(`${CacheKeys.SESSION}anonymous:${sessionId}`)
    if (cached) {
      // Обновляем активность
      await this.anonymousUsersService.updateActivity(sessionId)
      return cached
    }

    // Проверяем в БД
    const anonymousUser = await this.anonymousUsersService.findBySessionId(sessionId)
    if (!anonymousUser) {
      throw new UnauthorizedException('Invalid anonymous session')
    }

    // Кешируем
    await this.redis.set(
      `${CacheKeys.SESSION}anonymous:${sessionId}`,
      anonymousUser,
      CacheTTL.SESSION,
    )

    return anonymousUser
  }
}
