// src/modules/auth/decorators/require-auth.decorator.ts
import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common'
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger'
import { JwtAuthGuard } from '../guards/jwt-auth.guard'

export const REQUIRE_AUTH_KEY = 'requireAuth'

/**
 * Требует авторизованного пользователя
 */
export function RequireAuth() {
  return applyDecorators(
    SetMetadata(REQUIRE_AUTH_KEY, true),
    UseGuards(JwtAuthGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Unauthorized' }),
  )
}
