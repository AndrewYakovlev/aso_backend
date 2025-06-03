// src/health/indicators/prisma.health.ts
import { Injectable } from '@nestjs/common'
import { HealthIndicatorResult } from '@nestjs/terminus'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class PrismaHealthIndicator {
  constructor(private readonly prisma: PrismaService) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`

      return {
        [key]: {
          status: 'up',
          message: 'Database is healthy',
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
