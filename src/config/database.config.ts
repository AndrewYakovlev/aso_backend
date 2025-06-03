// src/config/database.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  url: process.env.DATABASE_URL,
  logging: process.env.NODE_ENV === 'development',
  retryAttempts: 5,
  retryDelay: 3000,
  pool: {
    min: 2,
    max: 30,
  },
}));
