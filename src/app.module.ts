// src/app.module.ts
import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core'
import { PrismaModule } from './prisma/prisma.module'
import { RedisModule } from './redis/redis.module'
import { LoggerModule } from './logger/logger.module'
import { HealthModule } from './health/health.module'
import { AuthModule } from './modules/auth/auth.module'
import { UsersModule } from './modules/users/users.module'
import { CategoriesModule } from './modules/categories/categories.module'
import { ProductsModule } from './modules/products/products.module'
import { CharacteristicsModule } from './modules/characteristics/characteristics.module'
import { VehiclesModule } from './modules/vehicles/vehicles.module'
import { SeoModule } from './modules/seo/seo.module'
import configuration from './config/configuration'
import { validationSchema } from './config/validation.schema'
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'
import { ResponseInterceptor } from './common/interceptors/response.interceptor'
import { LoggerMiddleware } from './common/middleware/logger.middleware'
import { VehicleApplicationsModule } from '@modules/vehicle-applications/vehicle-applications.module'
import { CartModule } from '@modules/cart/cart.module'
import { ScheduleModule } from '@nestjs/schedule'
import { DiscountModule } from '@modules/discount/discount.module'
import { OrdersModule } from '@modules/orders/orders.module'
import { ChatModule } from '@modules/chat/chat.module'

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
    ScheduleModule.forRoot(), // Для cron задач
    CartModule,
    PrismaModule,
    RedisModule,
    LoggerModule,
    HealthModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    ProductsModule,
    CharacteristicsModule,
    VehiclesModule,
    SeoModule,
    VehicleApplicationsModule,
    DiscountModule,
    OrdersModule,
    ChatModule,
    // Здесь будут подключаться остальные модули:
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
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('')
  }
}
