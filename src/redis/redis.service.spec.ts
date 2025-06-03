import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { RedisService } from './redis.service'
import { REDIS_CLIENT } from './redis.constants'
import Redis from 'ioredis'

// Mock ioredis
jest.mock('ioredis')

describe('RedisService', () => {
  let service: RedisService
  let mockRedisClient: jest.Mocked<Redis>

  beforeEach(async () => {
    mockRedisClient = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
      exists: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
      incrby: jest.fn(),
      decrby: jest.fn(),
      hget: jest.fn(),
      hset: jest.fn(),
      hgetall: jest.fn(),
      hdel: jest.fn(),
      lpush: jest.fn(),
      rpush: jest.fn(),
      lrange: jest.fn(),
      llen: jest.fn(),
      ltrim: jest.fn(),
      sadd: jest.fn(),
      srem: jest.fn(),
      smembers: jest.fn(),
      sismember: jest.fn(),
      flushall: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: REDIS_CLIENT,
          useValue: mockRedisClient,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue: any) => {
              // Исправление: используем Record для динамического доступа по ключу
              const config: Record<string, any> = {
                'redis.ttl': 3600,
              }
              return config[key] || defaultValue
            }),
          },
        },
      ],
    }).compile()

    service = module.get<RedisService>(RedisService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('get/set operations', () => {
    it('should get value from cache', async () => {
      const testData = { id: 1, name: 'Test' }
      mockRedisClient.get.mockResolvedValue(JSON.stringify(testData))

      const result = await service.get('test-key')
      expect(result).toEqual(testData)
      expect(mockRedisClient.get).toHaveBeenCalledWith('test-key')
    })

    it('should return null for non-existent key', async () => {
      mockRedisClient.get.mockResolvedValue(null)

      const result = await service.get('non-existent')
      expect(result).toBeNull()
    })

    it('should set value with default TTL', async () => {
      const testData = { id: 1, name: 'Test' }
      mockRedisClient.set.mockResolvedValue('OK')

      await service.set('test-key', testData)
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify(testData),
        'EX',
        3600,
      )
    })

    it('should set value with custom TTL', async () => {
      const testData = { id: 1, name: 'Test' }
      mockRedisClient.set.mockResolvedValue('OK')

      await service.set('test-key', testData, 300)
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify(testData),
        'EX',
        300,
      )
    })

    it('should set value without TTL when ttl is 0', async () => {
      const testData = { id: 1, name: 'Test' }
      mockRedisClient.set.mockResolvedValue('OK')

      await service.set('test-key', testData, 0)
      expect(mockRedisClient.set).toHaveBeenCalledWith('test-key', JSON.stringify(testData))
    })
  })

  describe('delete operations', () => {
    it('should delete a key', async () => {
      mockRedisClient.del.mockResolvedValue(1)

      await service.del('test-key')
      expect(mockRedisClient.del).toHaveBeenCalledWith('test-key')
    })

    it('should delete keys by pattern', async () => {
      mockRedisClient.keys.mockResolvedValue(['key1', 'key2', 'key3'])
      mockRedisClient.del.mockResolvedValue(3)

      await service.delByPattern('key*')
      expect(mockRedisClient.keys).toHaveBeenCalledWith('key*')
      expect(mockRedisClient.del).toHaveBeenCalledWith('key1', 'key2', 'key3')
    })

    it('should handle empty keys array', async () => {
      mockRedisClient.keys.mockResolvedValue([])

      await service.delByPattern('non-existent*')
      expect(mockRedisClient.del).not.toHaveBeenCalled()
    })
  })

  describe('counter operations', () => {
    it('should increment a counter', async () => {
      mockRedisClient.incrby.mockResolvedValue(5)

      const result = await service.increment('counter', 2)
      expect(result).toBe(5)
      expect(mockRedisClient.incrby).toHaveBeenCalledWith('counter', 2)
    })

    it('should decrement a counter', async () => {
      mockRedisClient.decrby.mockResolvedValue(3)

      const result = await service.decrement('counter', 2)
      expect(result).toBe(3)
      expect(mockRedisClient.decrby).toHaveBeenCalledWith('counter', 2)
    })
  })

  describe('hash operations', () => {
    it('should get hash field value', async () => {
      const testData = { name: 'Test' }
      mockRedisClient.hget.mockResolvedValue(JSON.stringify(testData))

      const result = await service.hget('hash-key', 'field')
      expect(result).toEqual(testData)
      expect(mockRedisClient.hget).toHaveBeenCalledWith('hash-key', 'field')
    })

    it('should set hash field value', async () => {
      const testData = { name: 'Test' }
      mockRedisClient.hset.mockResolvedValue(1)

      await service.hset('hash-key', 'field', testData)
      expect(mockRedisClient.hset).toHaveBeenCalledWith(
        'hash-key',
        'field',
        JSON.stringify(testData),
      )
    })

    it('should get all hash fields', async () => {
      mockRedisClient.hgetall.mockResolvedValue({
        field1: JSON.stringify({ name: 'Test1' }),
        field2: JSON.stringify({ name: 'Test2' }),
      })

      const result = await service.hgetall('hash-key')
      expect(result).toEqual({
        field1: { name: 'Test1' },
        field2: { name: 'Test2' },
      })
    })
  })

  describe('list operations', () => {
    it('should push to list from left', async () => {
      const values = [{ id: 1 }, { id: 2 }]
      mockRedisClient.lpush.mockResolvedValue(2)

      await service.lpush('list-key', ...values)
      expect(mockRedisClient.lpush).toHaveBeenCalledWith(
        'list-key',
        JSON.stringify({ id: 1 }),
        JSON.stringify({ id: 2 }),
      )
    })

    it('should get list range', async () => {
      mockRedisClient.lrange.mockResolvedValue([
        JSON.stringify({ id: 1 }),
        JSON.stringify({ id: 2 }),
      ])

      const result = await service.lrange('list-key', 0, -1)
      expect(result).toEqual([{ id: 1 }, { id: 2 }])
    })
  })

  describe('set operations', () => {
    it('should add members to set', async () => {
      mockRedisClient.sadd.mockResolvedValue(2)

      await service.sadd('set-key', 'member1', 'member2')
      expect(mockRedisClient.sadd).toHaveBeenCalledWith('set-key', 'member1', 'member2')
    })

    it('should check set membership', async () => {
      mockRedisClient.sismember.mockResolvedValue(1)

      const result = await service.sismember('set-key', 'member1')
      expect(result).toBe(true)
    })
  })

  describe('flushAll', () => {
    it('should throw error in production', async () => {
      process.env.NODE_ENV = 'production'
      await expect(service.flushAll()).rejects.toThrow('flushAll is not allowed in production')
      process.env.NODE_ENV = 'test'
    })

    it('should flush all in non-production', async () => {
      process.env.NODE_ENV = 'development'
      mockRedisClient.flushall.mockResolvedValue('OK')

      await service.flushAll()
      expect(mockRedisClient.flushall).toHaveBeenCalled()
    })
  })
})
