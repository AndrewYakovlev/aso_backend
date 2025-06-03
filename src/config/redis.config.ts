// src/config/redis.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  ttl: parseInt(process.env.REDIS_TTL || '3600', 10),
  keyPrefix: 'auto-parts:',
  cacheKeys: {
    products: 'products:',
    categories: 'categories:',
    user: 'user:',
    session: 'session:',
    otp: 'otp:',
    cart: 'cart:',
  },
}));
