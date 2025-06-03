// src/redis/redis.module.ts
import { Global, Module } from '@nestjs/common'
import { RedisService } from './redis.service'
import { REDIS_CLIENT } from './redis.constants'
import { ConfigModule, ConfigService } from '@nestjs/config'
import Redis from 'ioredis'

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (configService: ConfigService) => {
        const redis = new Redis({
          host: configService.get<string>('redis.host'),
          port: configService.get<number>('redis.port'),
          password: configService.get<string>('redis.password'),
          keyPrefix: configService.get<string>('redis.keyPrefix'),
          retryStrategy: (times: number) => {
            return Math.min(times * 50, 2000)
          },
        })

        redis.on('connect', () => {
          console.log('Redis connected')
        })

        redis.on('error', (err) => {
          console.error('Redis error:', err)
        })

        return redis
      },
      inject: [ConfigService],
    },
    RedisService,
  ],
  exports: [RedisService],
})
export class RedisModule {}
