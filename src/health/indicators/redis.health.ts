// src/health/indicators/redis.health.ts
import { Injectable } from '@nestjs/common'
import { HealthIndicatorResult } from '@nestjs/terminus'
import { RedisService } from '../../redis/redis.service'

@Injectable()
export class RedisHealthIndicator {
  constructor(private readonly redis: RedisService) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const client = this.redis.getClient()
      const result = await client.ping()

      if (result !== 'PONG') {
        throw new Error('Redis ping failed')
      }

      // Get additional info
      const info = await client.info('server')
      const version = info.match(/redis_version:(.+)/)?.[1]
      const uptimeMatch = info.match(/uptime_in_seconds:(\d+)/)
      const uptime = uptimeMatch ? parseInt(uptimeMatch[1], 10) : undefined

      return {
        [key]: {
          status: 'up',
          message: 'Redis is healthy',
          version,
          uptime,
        },
      }
    } catch (error) {
      return {
        [key]: {
          status: 'down',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      }
    }
  }
}
