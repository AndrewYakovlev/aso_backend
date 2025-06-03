// src/modules/auth/auth.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing'
import { UnauthorizedException, BadRequestException } from '@nestjs/common'
import { AuthService } from './auth.service'
import { OtpService } from './services/otp.service'
import { TokenService } from './services/token.service'
import { SmsService } from './services/sms.service'
import { UsersService } from '../users/users.service'
import { AnonymousUsersService } from '../users/anonymous-users.service'
import { ConfigService } from '@nestjs/config'
import { LoggerService } from '../../logger/logger.service'
import { RedisService } from '../../redis/redis.service'
import { TestUtils } from '../../../test/test.utils'

describe('AuthService', () => {
  let service: AuthService
  let otpService: OtpService
  let tokenService: TokenService
  let smsService: SmsService
  let usersService: UsersService
  let anonymousUsersService: AnonymousUsersService

  const mockUser = TestUtils.createTestUser({
    id: 'user-123',
    phone: '+79001234567',
    role: 'CUSTOMER',
  })

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: OtpService,
          useValue: {
            generateOtp: jest.fn(),
            verifyOtp: jest.fn(),
            getOtp: jest.fn(),
            deleteOtp: jest.fn(),
          },
        },
        {
          provide: TokenService,
          useValue: {
            generateTokens: jest.fn(),
            generateAnonymousToken: jest.fn(),
            saveRefreshToken: jest.fn(),
            getRefreshToken: jest.fn(),
            deleteRefreshToken: jest.fn(),
          },
        },
        {
          provide: SmsService,
          useValue: {
            sendOtp: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findByPhone: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: AnonymousUsersService,
          useValue: {
            create: jest.fn(),
            findBySessionId: jest.fn(),
            updateActivity: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: TestUtils.createMockConfigService(),
        },
        {
          provide: LoggerService,
          useValue: TestUtils.createMockLoggerService(),
        },
        {
          provide: RedisService,
          useValue: TestUtils.createMockRedisService(),
        },
      ],
    }).compile()

    service = module.get<AuthService>(AuthService)
    otpService = module.get<OtpService>(OtpService)
    tokenService = module.get<TokenService>(TokenService)
    smsService = module.get<SmsService>(SmsService)
    usersService = module.get<UsersService>(UsersService)
    anonymousUsersService = module.get<AnonymousUsersService>(AnonymousUsersService)
  })

  describe('createAnonymousSession', () => {
    it('should create anonymous session successfully', async () => {
      const mockAnonymousUser = {
        id: 'anon-123',
        sessionId: 'sess_123456',
        userAgent: 'Mozilla/5.0',
        ipAddress: '127.0.0.1',
      }

      jest.spyOn(anonymousUsersService, 'create').mockResolvedValue(mockAnonymousUser as any)
      jest.spyOn(tokenService, 'generateAnonymousToken').mockReturnValue('anonymous-token')

      const result = await service.createAnonymousSession('Mozilla/5.0', '127.0.0.1')

      expect(result).toEqual({
        token: 'anonymous-token',
        sessionId: 'sess_123456',
        expiresIn: undefined,
      })
      expect(anonymousUsersService.create).toHaveBeenCalledWith({
        userAgent: 'Mozilla/5.0',
        ipAddress: '127.0.0.1',
      })
    })
  })

  describe('sendOtp', () => {
    const phone = '+79001234567'
    const code = '123456'

    it('should send OTP successfully', async () => {
      jest.spyOn(otpService, 'getOtp').mockResolvedValue(null)
      jest.spyOn(otpService, 'generateOtp').mockResolvedValue({
        code,
        expiresIn: 300,
      })
      jest.spyOn(smsService, 'sendOtp').mockResolvedValue(undefined)

      const result = await service.sendOtp(phone)

      expect(result).toEqual({
        message: 'OTP код отправлен на указанный номер',
        expiresIn: 300,
      })
      expect(smsService.sendOtp).toHaveBeenCalledWith(phone, code)
    })

    it('should throw error if OTP already sent', async () => {
      jest.spyOn(otpService, 'getOtp').mockResolvedValue({
        code,
        attempts: 0,
        createdAt: new Date(),
      })

      await expect(service.sendOtp(phone)).rejects.toThrow(BadRequestException)
    })

    it('should handle SMS sending failure', async () => {
      jest.spyOn(otpService, 'getOtp').mockResolvedValue(null)
      jest.spyOn(otpService, 'generateOtp').mockResolvedValue({
        code,
        expiresIn: 300,
      })
      jest.spyOn(smsService, 'sendOtp').mockRejectedValue(new Error('SMS failed'))

      await expect(service.sendOtp(phone)).rejects.toThrow(BadRequestException)
      expect(otpService.deleteOtp).toHaveBeenCalledWith(phone)
    })
  })

  describe('verifyOtp', () => {
    const phone = '+79001234567'
    const code = '123456'
    const tokens = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      tokenType: 'Bearer',
      expiresIn: 900,
    }

    it('should verify OTP and return tokens for existing user', async () => {
      jest.spyOn(otpService, 'verifyOtp').mockResolvedValue(true)
      jest.spyOn(usersService, 'findByPhone').mockResolvedValue(mockUser as any)
      jest.spyOn(tokenService, 'generateTokens').mockResolvedValue(tokens)

      const result = await service.verifyOtp(phone, code)

      expect(result).toMatchObject({
        ...tokens,
        user: expect.objectContaining({
          id: mockUser.id,
          phone: mockUser.phone,
        }),
      })
      expect(otpService.deleteOtp).toHaveBeenCalledWith(phone)
      expect(tokenService.saveRefreshToken).toHaveBeenCalledWith(mockUser.id, tokens.refreshToken)
    })

    it('should create new user if not exists', async () => {
      jest.spyOn(otpService, 'verifyOtp').mockResolvedValue(true)
      jest.spyOn(usersService, 'findByPhone').mockResolvedValue(null)
      jest.spyOn(usersService, 'create').mockResolvedValue(mockUser as any)
      jest.spyOn(tokenService, 'generateTokens').mockResolvedValue(tokens)

      const result = await service.verifyOtp(phone, code)

      expect(usersService.create).toHaveBeenCalledWith({ phone })
      expect(result.user).toBeDefined()
    })

    it('should throw error for invalid OTP', async () => {
      jest.spyOn(otpService, 'verifyOtp').mockResolvedValue(false)

      await expect(service.verifyOtp(phone, code)).rejects.toThrow(UnauthorizedException)
    })
  })

  describe('refreshTokens', () => {
    const refreshToken = 'old-refresh-token'
    const newTokens = {
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      tokenType: 'Bearer',
      expiresIn: 900,
    }

    it('should refresh tokens successfully', async () => {
      jest.spyOn(tokenService, 'getRefreshToken').mockResolvedValue(refreshToken)
      jest.spyOn(usersService, 'findById').mockResolvedValue(mockUser as any)
      jest.spyOn(tokenService, 'generateTokens').mockResolvedValue(newTokens)

      const result = await service.refreshTokens(mockUser.id, refreshToken)

      expect(result).toMatchObject(newTokens)
      expect(tokenService.saveRefreshToken).toHaveBeenCalledWith(
        mockUser.id,
        newTokens.refreshToken,
      )
    })

    it('should throw error for invalid refresh token', async () => {
      jest.spyOn(tokenService, 'getRefreshToken').mockResolvedValue('different-token')

      await expect(service.refreshTokens(mockUser.id, refreshToken)).rejects.toThrow(
        UnauthorizedException,
      )
    })

    it('should throw error if user not found', async () => {
      jest.spyOn(tokenService, 'getRefreshToken').mockResolvedValue(refreshToken)
      jest.spyOn(usersService, 'findById').mockResolvedValue(null)

      await expect(service.refreshTokens(mockUser.id, refreshToken)).rejects.toThrow(
        UnauthorizedException,
      )
    })
  })

  describe('logout', () => {
    it('should logout user successfully', async () => {
      await service.logout(mockUser.id)

      expect(tokenService.deleteRefreshToken).toHaveBeenCalledWith(mockUser.id)
    })
  })
})
