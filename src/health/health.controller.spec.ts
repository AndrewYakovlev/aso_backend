// src/health/health.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing'
import { HealthCheckService, MemoryHealthIndicator, DiskHealthIndicator } from '@nestjs/terminus'
import { HealthController } from './health.controller'
import { PrismaHealthIndicator } from './indicators/prisma.health'
import { RedisHealthIndicator } from './indicators/redis.health'

describe('HealthController', () => {
  let controller: HealthController
  let healthCheckService: HealthCheckService
  let prismaHealthIndicator: PrismaHealthIndicator
  let redisHealthIndicator: RedisHealthIndicator
  let memoryHealthIndicator: MemoryHealthIndicator
  let diskHealthIndicator: DiskHealthIndicator

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: {
            check: jest.fn(),
          },
        },
        {
          provide: PrismaHealthIndicator,
          useValue: {
            isHealthy: jest.fn(),
          },
        },
        {
          provide: RedisHealthIndicator,
          useValue: {
            isHealthy: jest.fn(),
          },
        },
        {
          provide: MemoryHealthIndicator,
          useValue: {
            checkHeap: jest.fn(),
            checkRSS: jest.fn(),
          },
        },
        {
          provide: DiskHealthIndicator,
          useValue: {
            checkStorage: jest.fn(),
          },
        },
      ],
    }).compile()

    controller = module.get<HealthController>(HealthController)
    healthCheckService = module.get<HealthCheckService>(HealthCheckService)
    prismaHealthIndicator = module.get<PrismaHealthIndicator>(PrismaHealthIndicator)
    redisHealthIndicator = module.get<RedisHealthIndicator>(RedisHealthIndicator)
    memoryHealthIndicator = module.get<MemoryHealthIndicator>(MemoryHealthIndicator)
    diskHealthIndicator = module.get<DiskHealthIndicator>(DiskHealthIndicator)
  })

  describe('check', () => {
    it('should return health check results', async () => {
      const mockHealthResult = {
        status: 'ok',
        info: {
          database: { status: 'up' },
          redis: { status: 'up' },
          memory_heap: { status: 'up' },
          memory_rss: { status: 'up' },
          storage: { status: 'up' },
        },
        error: {},
        details: {},
      }

      jest.spyOn(healthCheckService, 'check').mockResolvedValue(mockHealthResult as any)

      const result = await controller.check()

      expect(result).toEqual(mockHealthResult)
      expect(healthCheckService.check).toHaveBeenCalled()
    })
  })

  describe('liveness', () => {
    it('should return liveness status', () => {
      const result = controller.liveness()

      expect(result).toEqual({
        status: 'ok',
        timestamp: expect.any(String),
      })
    })
  })

  describe('readiness', () => {
    it('should check database and redis health', async () => {
      const mockReadinessResult = {
        status: 'ok',
        info: {
          database: { status: 'up' },
          redis: { status: 'up' },
        },
        error: {},
        details: {},
      }

      jest.spyOn(healthCheckService, 'check').mockResolvedValue(mockReadinessResult as any)

      const result = await controller.readiness()

      expect(result).toEqual(mockReadinessResult)
      expect(healthCheckService.check).toHaveBeenCalled()
    })
  })
})
