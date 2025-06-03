// src/modules/auth/decorators/require-user.decorator.ts
import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common'
import { ApiBearerAuth, ApiUnauthorizedResponse, ApiHeader } from '@nestjs/swagger'
import { OptionalAuthGuard } from '../guards/optional-auth.guard'

export const REQUIRE_USER_KEY = 'requireUser'

/**
 * Требует либо авторизованного пользователя (через Bearer token),
 * либо анонимного пользователя (через x-anonymous-token header)
 */
export function RequireUser() {
  return applyDecorators(
    SetMetadata(REQUIRE_USER_KEY, true),
    UseGuards(OptionalAuthGuard),
    ApiBearerAuth(),
    ApiHeader({
      name: 'x-anonymous-token',
      description: 'Anonymous session token (альтернатива Bearer token)',
      required: false,
    }),
    ApiUnauthorizedResponse({
      description: 'Требуется авторизация или анонимный токен',
    }),
  )
}
