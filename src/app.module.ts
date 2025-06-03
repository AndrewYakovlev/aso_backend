// src/app.module.ts
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core'
import { PrismaModule } from './prisma/prisma.module'
import { RedisModule } from './redis/redis.module'
import { LoggerModule } from './logger/logger.module'
import { HealthModule } from './health/health.module'
import { AuthModule } from './modules/auth/auth.module'
import { UsersModule } from './modules/users/users.module'
import configuration from './config/configuration'
import { validationSchema } from './config/validation.schema'
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'
import { ResponseInterceptor } from './common/interceptors/response.interceptor'
import { LoggerMiddleware } from './common/middleware/logger.middleware'
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: configuration,
      envFilePath: ['.env', `.env.${process.env.NODE_ENV}`],
      validationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
    PrismaModule,
    RedisModule,
    LoggerModule,
    HealthModule,
    AuthModule,
    UsersModule,
    // Здесь будут подключаться остальные модули:
    // ProductsModule,
    // CategoriesModule,
    // OrdersModule,
    // CartModule,
    // ChatModule,
    // VehiclesModule,
    // AdminModule,
    // ImportModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*')
  }
}
