// src/health/indicators/prisma.health.spec.ts
import { Test, TestingModule } from '@nestjs/testing'
import { PrismaHealthIndicator } from './prisma.health'
import { PrismaService } from '../../prisma/prisma.service'

describe('PrismaHealthIndicator', () => {
  let indicator: PrismaHealthIndicator
  let prismaService: PrismaService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaHealthIndicator,
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: jest.fn(),
          },
        },
      ],
    }).compile()

    indicator = module.get<PrismaHealthIndicator>(PrismaHealthIndicator)
    prismaService = module.get<PrismaService>(PrismaService)
  })

  describe('isHealthy', () => {
    it('should return healthy when database is accessible', async () => {
      jest.spyOn(prismaService, '$queryRaw').mockResolvedValue([{ '?column?': 1 }])

      const result = await indicator.isHealthy('database')

      expect(result).toEqual({
        database: {
          status: 'up',
          message: 'Database is healthy',
        },
      })
    })

    it('should return unhealthy when database is not accessible', async () => {
      const error = new Error('Connection failed')
      jest.spyOn(prismaService, '$queryRaw').mockRejectedValue(error)

      const result = await indicator.isHealthy('database')

      expect(result).toEqual({
        database: {
          status: 'down',
          message: 'Connection failed',
        },
      })
    })
  })
})
