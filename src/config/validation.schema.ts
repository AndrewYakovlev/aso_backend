// src/config/validation.schema.ts
import * as Joi from 'joi'

export const validationSchema = Joi.object({
  // App configuration
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(4000),
  API_PREFIX: Joi.string().default('api'),
  API_VERSION: Joi.string().default('v1'),

  // Database
  DATABASE_URL: Joi.string().required().description('PostgreSQL connection string'),

  // Redis
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  REDIS_TTL: Joi.number().positive().default(3600),

  // JWT
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TOKEN_EXPIRATION: Joi.string().default('15m'),
  JWT_REFRESH_TOKEN_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_TOKEN_EXPIRATION: Joi.string().default('90d'),

  // OTP
  OTP_SECRET: Joi.string().min(16).required(),
  OTP_EXPIRATION: Joi.number().positive().default(300),
  OTP_LENGTH: Joi.number().min(4).max(6).default(4),

  // SMS Provider
  SMS_API_KEY: Joi.string().required(),
  SMS_FROM: Joi.string().default('AutoPartsASO'),

  // CORS
  CORS_ORIGIN: Joi.string().default('http://localhost:3000'),

  // Rate Limiting
  RATE_LIMIT_TTL: Joi.number().positive().default(60),
  RATE_LIMIT_MAX: Joi.number().positive().default(100),
  RATE_LIMIT_AUTH_TTL: Joi.number().positive().default(60),
  RATE_LIMIT_AUTH_MAX: Joi.number().positive().default(5),
  RATE_LIMIT_OTP_TTL: Joi.number().positive().default(60),
  RATE_LIMIT_OTP_MAX: Joi.number().positive().default(3),

  // File Upload
  MAX_FILE_SIZE: Joi.number().positive().default(10485760),
  UPLOAD_DEST: Joi.string().default('./uploads'),

  // Socket.io
  SOCKET_CORS_ORIGIN: Joi.string().default('http://localhost:3000'),

  // Swagger
  SWAGGER_TITLE: Joi.string().default('ASO Auto Parts API'),
  SWAGGER_DESCRIPTION: Joi.string().default('API documentation for Auto Parts e-commerce platform'),
  SWAGGER_VERSION: Joi.string().default('1.0'),
  SWAGGER_PATH: Joi.string().default('docs'),

  // Logging
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug', 'verbose').default('debug'),
  LOG_FILE_PATH: Joi.string().default('./logs'),
})
