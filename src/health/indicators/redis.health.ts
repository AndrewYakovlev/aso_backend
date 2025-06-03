// src/health/indicators/redis.health.ts
import { Injectable } from '@nestjs/common'
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus'
import { RedisService } from '../../redis/redis.service'

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly redis: RedisService) {
    super()
  }

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

      return this.getStatus(key, true, {
        status: 'up',
        version,
        uptime: await client.info('uptime_in_seconds'),
      })
    } catch (error) {
      throw new HealthCheckError(
        'Redis health check failed',
        this.getStatus(key, false, {
          status: 'down',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
      )
    }
  }
}
