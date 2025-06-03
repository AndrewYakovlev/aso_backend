// src/health/indicators/prisma.health.ts
import { Injectable } from '@nestjs/common'
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  constructor(private readonly prisma: PrismaService) {
    super()
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`
      return this.getStatus(key, true, { status: 'up' })
    } catch (error) {
      throw new HealthCheckError(
        'Prisma health check failed',
        this.getStatus(key, false, {
          status: 'down',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
      )
    }
  }
}
