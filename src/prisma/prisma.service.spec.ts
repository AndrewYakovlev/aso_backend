// src/prisma/prisma.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from './prisma.service'

describe('PrismaService', () => {
  let service: PrismaService
  let configService: ConfigService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                'database.logging': false,
                'database.retryAttempts': 3,
                'database.retryDelay': 1000,
              }
              return config[key]
            }),
          },
        },
      ],
    }).compile()

    service = module.get<PrismaService>(PrismaService)
    configService = module.get<ConfigService>(ConfigService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('onModuleInit', () => {
    it('should connect to database', async () => {
      const connectSpy = jest.spyOn(service, '$connect').mockResolvedValue()
      await service.onModuleInit()
      expect(connectSpy).toHaveBeenCalled()
    })

    it('should retry connection on failure', async () => {
      const connectSpy = jest
        .spyOn(service, '$connect')
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockResolvedValueOnce()

      await service.onModuleInit()
      expect(connectSpy).toHaveBeenCalledTimes(2)
    })

    it('should throw error after max retries', async () => {
      const connectSpy = jest
        .spyOn(service, '$connect')
        .mockRejectedValue(new Error('Connection failed'))

      await expect(service.onModuleInit()).rejects.toThrow('Connection failed')
      expect(connectSpy).toHaveBeenCalledTimes(3)
    })
  })

  describe('onModuleDestroy', () => {
    it('should disconnect from database', async () => {
      const disconnectSpy = jest.spyOn(service, '$disconnect').mockResolvedValue()
      await service.onModuleDestroy()
      expect(disconnectSpy).toHaveBeenCalled()
    })
  })

  describe('isPrismaError', () => {
    it('should return true for Prisma errors', () => {
      const error = { code: 'P2002', clientVersion: '2.0.0' }
      expect(service.isPrismaError(error)).toBe(true)
    })

    it('should return false for non-Prisma errors', () => {
      const error = new Error('Regular error')
      expect(service.isPrismaError(error)).toBe(false)
    })
  })

  describe('handlePrismaError', () => {
    it('should handle unique constraint violation', () => {
      const error = {
        code: 'P2002',
        clientVersion: '2.0.0',
        meta: { target: ['email'] },
      }
      expect(() => service.handlePrismaError(error)).toThrow('Unique constraint violation on email')
    })

    it('should handle record not found', () => {
      const error = {
        code: 'P2025',
        clientVersion: '2.0.0',
      }
      expect(() => service.handlePrismaError(error)).toThrow('Record not found')
    })

    it('should rethrow non-Prisma errors', () => {
      const error = new Error('Regular error')
      expect(() => service.handlePrismaError(error)).toThrow('Regular error')
    })
  })

  describe('cleanDatabase', () => {
    it('should throw error in production', async () => {
      process.env.NODE_ENV = 'production'
      await expect(service.cleanDatabase()).rejects.toThrow(
        'cleanDatabase is not allowed in production',
      )
      process.env.NODE_ENV = 'test'
    })
  })
})
