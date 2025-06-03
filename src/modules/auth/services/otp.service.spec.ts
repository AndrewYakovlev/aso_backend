// src/modules/auth/services/otp.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing'
import { OtpService } from './otp.service'
import { ConfigService } from '@nestjs/config'
import { RedisService } from '../../../redis/redis.service'
import { TestUtils } from '../../../../test/test.utils'

describe('OtpService', () => {
  let service: OtpService
  let redisService: RedisService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        {
          provide: RedisService,
          useValue: TestUtils.createMockRedisService(),
        },
        {
          provide: ConfigService,
          useValue: TestUtils.createMockConfigService({
            'jwt.otp.length': 6,
            'jwt.otp.expiration': 300,
          }),
        },
      ],
    }).compile()

    service = module.get<OtpService>(OtpService)
    redisService = module.get<RedisService>(RedisService)
  })

  describe('generateOtp', () => {
    it('should generate OTP code', async () => {
      const phone = '+79001234567'

      const result = await service.generateOtp(phone)

      expect(result).toEqual({
        code: expect.any(String),
        expiresIn: 300,
      })
      expect(result.code).toHaveLength(6)
      expect(redisService.set).toHaveBeenCalledWith(
        `otp:${phone}`,
        expect.objectContaining({
          code: expect.any(String),
          attempts: 0,
          createdAt: expect.any(Date),
        }),
        300,
      )
    })
  })

  describe('verifyOtp', () => {
    const phone = '+79001234567'
    const code = '123456'
    const otpData = {
      code,
      attempts: 0,
      createdAt: new Date(),
    }

    it('should verify correct OTP', async () => {
      jest.spyOn(redisService, 'get').mockResolvedValue(otpData)

      const result = await service.verifyOtp(phone, code)

      expect(result).toBe(true)
      expect(redisService.set).toHaveBeenCalledWith(
        `otp:${phone}`,
        { ...otpData, attempts: 1 },
        300,
      )
    })

    it('should return false for incorrect OTP', async () => {
      jest.spyOn(redisService, 'get').mockResolvedValue(otpData)

      const result = await service.verifyOtp(phone, '999999')

      expect(result).toBe(false)
      expect(redisService.set).toHaveBeenCalledWith(
        `otp:${phone}`,
        { ...otpData, attempts: 1 },
        300,
      )
    })

    it('should return false if OTP not found', async () => {
      jest.spyOn(redisService, 'get').mockResolvedValue(null)

      const result = await service.verifyOtp(phone, code)

      expect(result).toBe(false)
    })

    it('should delete OTP after max attempts', async () => {
      jest.spyOn(redisService, 'get').mockResolvedValue({
        ...otpData,
        attempts: 2, // Last attempt
      })

      const result = await service.verifyOtp(phone, '999999')

      expect(result).toBe(false)
      expect(redisService.del).toHaveBeenCalledWith(`otp:${phone}`)
    })

    it('should handle max attempts exceeded', async () => {
      jest.spyOn(redisService, 'get').mockResolvedValue({
        ...otpData,
        attempts: 3,
      })

      const result = await service.verifyOtp(phone, code)

      expect(result).toBe(false)
      expect(redisService.del).toHaveBeenCalledWith(`otp:${phone}`)
    })
  })

  describe('getOtp', () => {
    it('should get OTP data', async () => {
      const otpData = {
        code: '123456',
        attempts: 1,
        createdAt: new Date(),
      }
      jest.spyOn(redisService, 'get').mockResolvedValue(otpData)

      const result = await service.getOtp('+79001234567')

      expect(result).toEqual(otpData)
    })

    it('should return null if OTP not found', async () => {
      jest.spyOn(redisService, 'get').mockResolvedValue(null)

      const result = await service.getOtp('+79001234567')

      expect(result).toBeNull()
    })
  })

  describe('deleteOtp', () => {
    it('should delete OTP', async () => {
      const phone = '+79001234567'

      await service.deleteOtp(phone)

      expect(redisService.del).toHaveBeenCalledWith(`otp:${phone}`)
    })
  })

  describe('getRemainingAttempts', () => {
    it('should return remaining attempts', async () => {
      jest.spyOn(service, 'getOtp').mockResolvedValue({
        code: '123456',
        attempts: 1,
        createdAt: new Date(),
      })

      const result = await service.getRemainingAttempts('+79001234567')

      expect(result).toBe(2)
    })

    it('should return max attempts if OTP not found', async () => {
      jest.spyOn(service, 'getOtp').mockResolvedValue(null)

      const result = await service.getRemainingAttempts('+79001234567')

      expect(result).toBe(3)
    })

    it('should return 0 if all attempts used', async () => {
      jest.spyOn(service, 'getOtp').mockResolvedValue({
        code: '123456',
        attempts: 3,
        createdAt: new Date(),
      })

      const result = await service.getRemainingAttempts('+79001234567')

      expect(result).toBe(0)
    })
  })

  describe('getTimeToExpire', () => {
    it('should return time to expire', async () => {
      jest.spyOn(redisService, 'ttl').mockResolvedValue(120)

      const result = await service.getTimeToExpire('+79001234567')

      expect(result).toBe(120)
    })

    it('should return 0 if expired', async () => {
      jest.spyOn(redisService, 'ttl').mockResolvedValue(-1)

      const result = await service.getTimeToExpire('+79001234567')

      expect(result).toBe(0)
    })
  })
})
