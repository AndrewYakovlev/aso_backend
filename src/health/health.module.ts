// src/health/health.module.ts
import { Module } from '@nestjs/common'
import { TerminusModule } from '@nestjs/terminus'
import { HttpModule } from '@nestjs/axios'
import { HealthController } from './health.controller'
import { PrismaHealthIndicator } from './indicators/prisma.health'
import { RedisHealthIndicator } from './indicators/redis.health'

@Module({
  imports: [TerminusModule, HttpModule],
  controllers: [HealthController],
  providers: [PrismaHealthIndicator, RedisHealthIndicator],
})
export class HealthModule {}
