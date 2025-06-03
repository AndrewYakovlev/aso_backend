// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import configuration from './config/configuration';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: configuration,
      envFilePath: ['.env', `.env.${process.env.NODE_ENV}`],
    }),
    PrismaModule,
    // Здесь будут подключаться остальные модули:
    // AuthModule,
    // UsersModule,
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
  ],
})
export class AppModule {}
