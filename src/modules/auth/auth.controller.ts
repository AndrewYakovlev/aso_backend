// src/modules/auth/auth.controller.ts
import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Get,
  Headers,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger'
import { AuthService } from './auth.service'
import { SendOtpDto } from './dto/send-otp.dto'
import { VerifyOtpDto } from './dto/verify-otp.dto'
import { RefreshTokenDto } from './dto/refresh-token.dto'
import { TokenResponseDto } from './dto/token-response.dto'
import { AnonymousTokenDto } from './dto/anonymous-token.dto'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { JwtRefreshGuard } from './guards/jwt-refresh.guard'
import { AnonymousAuthGuard } from './guards/anonymous-auth.guard'
import { CurrentUser } from './decorators/current-user.decorator'
import { RateLimit } from '@common/decorators/rate-limit.decorator'
import { UserResponseDto } from '../users/dto/user-response.dto'

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('anonymous')
  @ApiOperation({ summary: 'Получение анонимного токена' })
  @ApiResponse({
    status: 201,
    description: 'Анонимный токен успешно создан',
    type: AnonymousTokenDto,
  })
  async getAnonymousToken(
    @Headers('user-agent') userAgent: string,
    @Req() req: any,
  ): Promise<AnonymousTokenDto> {
    const ip = req.ip || req.connection.remoteAddress
    return this.authService.createAnonymousSession(userAgent, ip)
  }

  @Get('verify-anonymous')
  @UseGuards(AnonymousAuthGuard)
  @ApiOperation({ summary: 'Проверка анонимного токена' })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'Токен валиден',
  })
  async verifyAnonymous(@CurrentUser() user: any) {
    return {
      valid: true,
      sessionId: user.sessionId,
      isAnonymous: true,
    }
  }

  @Post('send-otp')
  @RateLimit({ ttl: 60, limit: 3 })
  @ApiOperation({ summary: 'Отправка OTP кода' })
  @ApiResponse({
    status: 200,
    description: 'OTP код успешно отправлен',
  })
  @ApiResponse({
    status: 429,
    description: 'Слишком много попыток',
  })
  @HttpCode(HttpStatus.OK)
  async sendOtp(@Body() sendOtpDto: SendOtpDto) {
    return this.authService.sendOtp(sendOtpDto.phone)
  }

  @Post('verify-otp')
  @RateLimit({ ttl: 60, limit: 5 })
  @ApiOperation({ summary: 'Верификация OTP кода и получение токенов' })
  @ApiResponse({
    status: 200,
    description: 'Успешная авторизация',
    type: TokenResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Неверный или истекший OTP код',
  })
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto): Promise<TokenResponseDto> {
    return this.authService.verifyOtp(verifyOtpDto.phone, verifyOtpDto.code)
  }

  @Post('refresh')
  @UseGuards(JwtRefreshGuard)
  @ApiOperation({ summary: 'Обновление access токена' })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'Токен успешно обновлен',
    type: TokenResponseDto,
  })
  @HttpCode(HttpStatus.OK)
  async refresh(
    @CurrentUser() user: any,
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<TokenResponseDto> {
    return this.authService.refreshTokens(user.userId, refreshTokenDto.refreshToken)
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Выход из системы' })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'Успешный выход',
  })
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: any) {
    await this.authService.logout(user.userId)
    return { message: 'Logged out successfully' }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Получение данных текущего пользователя' })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'Данные пользователя',
    type: UserResponseDto,
  })
  async getMe(@CurrentUser() user: any): Promise<UserResponseDto> {
    return this.authService.getCurrentUser(user.userId)
  }
}
