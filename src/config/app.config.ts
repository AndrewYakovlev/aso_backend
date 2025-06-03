// src/config/app.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  apiPrefix: process.env.API_PREFIX || 'api',
  apiVersion: process.env.API_VERSION || 'v1',
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
  },
  rateLimit: {
    ttl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    auth: {
      ttl: parseInt(process.env.RATE_LIMIT_AUTH_TTL || '60', 10),
      max: parseInt(process.env.RATE_LIMIT_AUTH_MAX || '5', 10),
    },
    otp: {
      ttl: parseInt(process.env.RATE_LIMIT_OTP_TTL || '60', 10),
      max: parseInt(process.env.RATE_LIMIT_OTP_MAX || '3', 10),
    },
  },
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10),
    dest: process.env.UPLOAD_DEST || './uploads',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'debug',
    filePath: process.env.LOG_FILE_PATH || './logs',
  },
}));
