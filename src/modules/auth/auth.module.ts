// src/modules/auth/auth.module.ts
import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { HttpModule } from '@nestjs/axios'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { OtpService } from './services/otp.service'
import { TokenService } from './services/token.service'
import { SmsService } from './services/sms.service'
import { JwtStrategy } from './strategies/jwt.strategy'
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy'
import { AnonymousStrategy } from './strategies/anonymous.strategy'
import { UsersModule } from '../users/users.module'

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.access.secret'),
        signOptions: {
          expiresIn: configService.get<string>('jwt.access.expiresIn'),
        },
      }),
      inject: [ConfigService],
    }),
    HttpModule,
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpService,
    TokenService,
    SmsService,
    JwtStrategy,
    JwtRefreshStrategy,
    AnonymousStrategy,
  ],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
