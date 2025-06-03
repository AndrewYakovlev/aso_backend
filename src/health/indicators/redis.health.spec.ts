// src/health/indicators/redis.health.spec.ts
import { Test, TestingModule } from '@nestjs/testing'
import { RedisHealthIndicator } from './redis.health'
import { RedisService } from '../../redis/redis.service'

describe('RedisHealthIndicator', () => {
  let indicator: RedisHealthIndicator
  let redisService: RedisService
  let mockRedisClient: any

  beforeEach(async () => {
    mockRedisClient = {
      ping: jest.fn(),
      info: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisHealthIndicator,
        {
          provide: RedisService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockRedisClient),
          },
        },
      ],
    }).compile()

    indicator = module.get<RedisHealthIndicator>(RedisHealthIndicator)
    redisService = module.get<RedisService>(RedisService)
  })

  describe('isHealthy', () => {
    it('should return healthy when Redis is accessible', async () => {
      mockRedisClient.ping.mockResolvedValue('PONG')
      mockRedisClient.info.mockResolvedValue('redis_version:7.0.0\nuptime_in_seconds:1000\n')

      const result = await indicator.isHealthy('redis')

      expect(result).toEqual({
        redis: {
          status: 'up',
          message: 'Redis is healthy',
          version: '7.0.0',
          uptime: 1000,
        },
      })
    })

    it('should return unhealthy when Redis ping fails', async () => {
      mockRedisClient.ping.mockResolvedValue('WRONG_RESPONSE')

      const result = await indicator.isHealthy('redis')

      expect(result).toEqual({
        redis: {
          status: 'down',
          message: 'Redis ping failed',
        },
      })
    })

    it('should return unhealthy when Redis is not accessible', async () => {
      const error = new Error('Connection refused')
      mockRedisClient.ping.mockRejectedValue(error)

      const result = await indicator.isHealthy('redis')

      expect(result).toEqual({
        redis: {
          status: 'down',
          message: 'Connection refused',
        },
      })
    })
  })
})
