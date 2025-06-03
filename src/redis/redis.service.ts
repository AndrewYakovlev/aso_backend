// src/redis/redis.service.ts
import { Injectable, Inject, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'
import { REDIS_CLIENT } from './redis.constants'

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name)
  private readonly defaultTTL: number

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {
    this.defaultTTL = this.configService.get<number>('redis.ttl', 3600)
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key)
      return value ? JSON.parse(value) : null
    } catch (error) {
      this.logger.error(`Error getting key ${key}:`, error)
      return null
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value)
      if (ttl || ttl === 0) {
        if (ttl > 0) {
          await this.redis.set(key, serialized, 'EX', ttl)
        } else {
          await this.redis.set(key, serialized)
        }
      } else {
        await this.redis.set(key, serialized, 'EX', this.defaultTTL)
      }
    } catch (error) {
      this.logger.error(`Error setting key ${key}:`, error)
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key)
    } catch (error) {
      this.logger.error(`Error deleting key ${key}:`, error)
    }
  }

  async delByPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern)
      if (keys.length > 0) {
        await this.redis.del(...keys)
      }
    } catch (error) {
      this.logger.error(`Error deleting keys by pattern ${pattern}:`, error)
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      return (await this.redis.exists(key)) === 1
    } catch (error) {
      this.logger.error(`Error checking existence of key ${key}:`, error)
      return false
    }
  }

  async expire(key: string, ttl: number): Promise<void> {
    try {
      await this.redis.expire(key, ttl)
    } catch (error) {
      this.logger.error(`Error setting expiration for key ${key}:`, error)
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      return await this.redis.ttl(key)
    } catch (error) {
      this.logger.error(`Error getting TTL for key ${key}:`, error)
      return -1
    }
  }

  async increment(key: string, by: number = 1): Promise<number> {
    try {
      return await this.redis.incrby(key, by)
    } catch (error) {
      this.logger.error(`Error incrementing key ${key}:`, error)
      return 0
    }
  }

  async decrement(key: string, by: number = 1): Promise<number> {
    try {
      return await this.redis.decrby(key, by)
    } catch (error) {
      this.logger.error(`Error decrementing key ${key}:`, error)
      return 0
    }
  }

  // Hash operations
  async hget<T>(key: string, field: string): Promise<T | null> {
    try {
      const value = await this.redis.hget(key, field)
      return value ? JSON.parse(value) : null
    } catch (error) {
      this.logger.error(`Error getting hash field ${key}.${field}:`, error)
      return null
    }
  }

  async hset<T>(key: string, field: string, value: T): Promise<void> {
    try {
      await this.redis.hset(key, field, JSON.stringify(value))
    } catch (error) {
      this.logger.error(`Error setting hash field ${key}.${field}:`, error)
    }
  }

  async hgetall<T>(key: string): Promise<Record<string, T>> {
    try {
      const data = await this.redis.hgetall(key)
      const result: Record<string, T> = {}
      for (const [field, value] of Object.entries(data)) {
        result[field] = JSON.parse(value)
      }
      return result
    } catch (error) {
      this.logger.error(`Error getting all hash fields for ${key}:`, error)
      return {}
    }
  }

  async hdel(key: string, ...fields: string[]): Promise<void> {
    try {
      await this.redis.hdel(key, ...fields)
    } catch (error) {
      this.logger.error(`Error deleting hash fields ${key}.${fields.join(', ')}:`, error)
    }
  }

  // List operations
  async lpush<T>(key: string, ...values: T[]): Promise<void> {
    try {
      const serialized = values.map((v) => JSON.stringify(v))
      await this.redis.lpush(key, ...serialized)
    } catch (error) {
      this.logger.error(`Error pushing to list ${key}:`, error)
    }
  }

  async rpush<T>(key: string, ...values: T[]): Promise<void> {
    try {
      const serialized = values.map((v) => JSON.stringify(v))
      await this.redis.rpush(key, ...serialized)
    } catch (error) {
      this.logger.error(`Error pushing to list ${key}:`, error)
    }
  }

  async lrange<T>(key: string, start: number, stop: number): Promise<T[]> {
    try {
      const values = await this.redis.lrange(key, start, stop)
      return values.map((v) => JSON.parse(v))
    } catch (error) {
      this.logger.error(`Error getting list range ${key}[${start}:${stop}]:`, error)
      return []
    }
  }

  async llen(key: string): Promise<number> {
    try {
      return await this.redis.llen(key)
    } catch (error) {
      this.logger.error(`Error getting list length ${key}:`, error)
      return 0
    }
  }

  // Set operations
  async sadd(key: string, ...members: string[]): Promise<void> {
    try {
      await this.redis.sadd(key, ...members)
    } catch (error) {
      this.logger.error(`Error adding to set ${key}:`, error)
    }
  }

  async srem(key: string, ...members: string[]): Promise<void> {
    try {
      await this.redis.srem(key, ...members)
    } catch (error) {
      this.logger.error(`Error removing from set ${key}:`, error)
    }
  }

  async smembers(key: string): Promise<string[]> {
    try {
      return await this.redis.smembers(key)
    } catch (error) {
      this.logger.error(`Error getting set members ${key}:`, error)
      return []
    }
  }

  async sismember(key: string, member: string): Promise<boolean> {
    try {
      return (await this.redis.sismember(key, member)) === 1
    } catch (error) {
      this.logger.error(`Error checking set membership ${key}.${member}:`, error)
      return false
    }
  }

  // Utility methods
  async flushAll(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('flushAll is not allowed in production')
    }
    await this.redis.flushall()
  }

  getClient(): Redis {
    return this.redis
  }
}
