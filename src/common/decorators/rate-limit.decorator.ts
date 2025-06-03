// src/common/decorators/rate-limit.decorator.ts
import { SetMetadata } from '@nestjs/common'

export interface RateLimitOptions {
  ttl: number // seconds
  limit: number
}

export const RATE_LIMIT_KEY = 'rateLimit'
export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options)
