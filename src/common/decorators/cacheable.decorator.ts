// src/common/decorators/cacheable.decorator.ts
import { Inject } from '@nestjs/common'
import { RedisService } from '../../redis/redis.service'

export interface CacheOptions {
  key?: string | ((...args: any[]) => string)
  ttl?: number
  condition?: (...args: any[]) => boolean
}

interface CacheableTarget {
  redisService?: RedisService
}

export function Cacheable(options: CacheOptions = {}) {
  const injectRedis = Inject(RedisService)

  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    // Инжектим RedisService в класс
    injectRedis(target, 'redisService')

    const originalMethod = descriptor.value

    descriptor.value = async function (this: CacheableTarget, ...args: any[]) {
      const redisService = this.redisService

      if (!redisService) {
        console.warn('RedisService not found, executing method without cache')
        return originalMethod.apply(this, args)
      }

      // Check condition
      if (options.condition && !options.condition(...args)) {
        return originalMethod.apply(this, args)
      }

      // Generate cache key
      let cacheKey: string
      if (typeof options.key === 'function') {
        cacheKey = options.key(...args)
      } else if (options.key) {
        cacheKey = options.key
      } else {
        cacheKey = `${target.constructor.name}:${propertyKey}:${JSON.stringify(args)}`
      }

      try {
        // Try to get from cache
        const cached = await redisService.get(cacheKey)
        if (cached !== null) {
          return cached
        }

        // Execute original method
        const result = await originalMethod.apply(this, args)

        // Store in cache
        if (result !== null && result !== undefined) {
          await redisService.set(cacheKey, result, options.ttl)
        }

        return result
      } catch (error) {
        console.error('Cache error:', error)
        // Fallback to original method
        return originalMethod.apply(this, args)
      }
    }

    return descriptor
  }
}

// Декоратор для инвалидации кеша
export function CacheEvict(options: {
  key: string | ((...args: any[]) => string)
  pattern?: boolean
}) {
  const injectRedis = Inject(RedisService)

  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    // Инжектим RedisService в класс
    injectRedis(target, 'redisService')

    const originalMethod = descriptor.value

    descriptor.value = async function (this: CacheableTarget, ...args: any[]) {
      const redisService = this.redisService

      if (!redisService) {
        console.warn('RedisService not found, executing method without cache eviction')
        return originalMethod.apply(this, args)
      }

      const result = await originalMethod.apply(this, args)

      try {
        // Generate cache key
        let cacheKey: string
        if (typeof options.key === 'function') {
          cacheKey = options.key(...args)
        } else {
          cacheKey = options.key
        }

        // Delete from cache
        if (options.pattern) {
          await redisService.delByPattern(cacheKey)
        } else {
          await redisService.del(cacheKey)
        }
      } catch (error) {
        console.error('Cache evict error:', error)
      }

      return result
    }

    return descriptor
  }
}
