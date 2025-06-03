import { Controller, Get } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus'
import { PrismaHealthIndicator } from './indicators/prisma.health'
import { RedisHealthIndicator } from './indicators/redis.health'
import { Public } from '../modules/auth/decorators/public.decorator'
import * as os from 'os'

@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly diskPath: string

  constructor(
    private health: HealthCheckService,
    private prisma: PrismaHealthIndicator,
    private redis: RedisHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
  ) {
    // Определяем путь в зависимости от ОС
    this.diskPath = os.platform() === 'win32' ? 'C:\\' : '/'
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Health check' })
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.prisma.isHealthy('database'),
      () => this.redis.isHealthy('redis'),
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024), // 150MB
      () => this.memory.checkRSS('memory_rss', 300 * 1024 * 1024), // 300MB
      () =>
        this.disk.checkStorage('storage', {
          path: this.diskPath,
          thresholdPercent: 0.9,
        }),
    ])
  }

  @Get('liveness')
  @Public()
  @ApiOperation({ summary: 'Liveness probe for Kubernetes' })
  liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() }
  }

  @Get('readiness')
  @Public()
  @ApiOperation({ summary: 'Readiness probe for Kubernetes' })
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.prisma.isHealthy('database'),
      () => this.redis.isHealthy('redis'),
    ])
  }
}
