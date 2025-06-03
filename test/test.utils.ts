// test/utils/test.utils.ts
import { Test, TestingModule } from '@nestjs/testing'
import { PrismaService } from '../src/prisma/prisma.service'
import { ConfigService } from '@nestjs/config'
import { RedisService } from '../src/redis/redis.service'
import { LoggerService } from '../src/logger/logger.service'

export class TestUtils {
  /**
   * Create a mock PrismaService
   */
  static createMockPrismaService() {
    return {
      user: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      product: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      order: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn(),
      $connect: jest.fn(),
      $disconnect: jest.fn(),
      $queryRaw: jest.fn(),
    }
  }

  /**
   * Create a mock RedisService
   */
  static createMockRedisService() {
    return {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      delByPattern: jest.fn(),
      exists: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
      increment: jest.fn(),
      decrement: jest.fn(),
      hget: jest.fn(),
      hset: jest.fn(),
      hgetall: jest.fn(),
      hdel: jest.fn(),
      lpush: jest.fn(),
      rpush: jest.fn(),
      lrange: jest.fn(),
      llen: jest.fn(),
      sadd: jest.fn(),
      srem: jest.fn(),
      smembers: jest.fn(),
      sismember: jest.fn(),
      flushAll: jest.fn(),
      getClient: jest.fn(),
    }
  }

  /**
   * Create a mock ConfigService
   */
  static createMockConfigService(config: Record<string, any> = {}) {
    return {
      get: jest.fn((key: string, defaultValue?: any) => {
        return config[key] ?? defaultValue
      }),
      getOrThrow: jest.fn((key: string) => {
        if (!(key in config)) {
          throw new Error(`Configuration key "${key}" does not exist`)
        }
        return config[key]
      }),
    }
  }

  /**
   * Create a mock LoggerService
   */
  static createMockLoggerService() {
    return {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
      logWithMeta: jest.fn(),
      errorWithMeta: jest.fn(),
      logHttpRequest: jest.fn(),
      logDatabaseQuery: jest.fn(),
      logBusinessEvent: jest.fn(),
      logSecurityEvent: jest.fn(),
    }
  }

  /**
   * Create test data
   */
  static createTestUser(overrides = {}) {
    return {
      id: 'test-user-id',
      phone: '+79001234567',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'CUSTOMER',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }
  }

  static createTestProduct(overrides = {}) {
    return {
      id: 'test-product-id',
      name: 'Test Product',
      slug: 'test-product',
      sku: 'TEST-SKU-001',
      price: 1000,
      stock: 10,
      brandId: 'test-brand-id',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }
  }

  static createTestOrder(overrides = {}) {
    return {
      id: 'test-order-id',
      orderNumber: 'ORD-001',
      userId: 'test-user-id',
      statusId: 'pending',
      subtotal: 1000,
      totalAmount: 1000,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }
  }

  /**
   * Clean up database for tests
   */
  static async cleanDatabase(prisma: PrismaService) {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Database cleanup is only allowed in test environment')
    }

    await prisma.cleanDatabase()
  }

  /**
   * Create a testing module with common providers
   */
  static async createTestingModule(metadata: {
    providers?: any[]
    imports?: any[]
    controllers?: any[]
  }): Promise<TestingModule> {
    return Test.createTestingModule({
      ...metadata,
      providers: [
        ...(metadata.providers || []),
        {
          provide: PrismaService,
          useValue: TestUtils.createMockPrismaService(),
        },
        {
          provide: RedisService,
          useValue: TestUtils.createMockRedisService(),
        },
        {
          provide: ConfigService,
          useValue: TestUtils.createMockConfigService(),
        },
        {
          provide: LoggerService,
          useValue: TestUtils.createMockLoggerService(),
        },
      ],
    }).compile()
  }
}
