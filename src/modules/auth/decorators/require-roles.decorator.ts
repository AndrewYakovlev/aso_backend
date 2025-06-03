// src/modules/auth/decorators/require-roles.decorator.ts
import { UseGuards, applyDecorators } from '@nestjs/common'
import { ApiBearerAuth, ApiUnauthorizedResponse, ApiForbiddenResponse } from '@nestjs/swagger'
import { UserRole } from '@prisma/client'
import { JwtAuthGuard } from '../guards/jwt-auth.guard'
import { RolesGuard } from '../guards/roles.guard'
import { Roles } from './roles.decorator'

/**
 * Требует авторизованного пользователя с определенными ролями
 */
export function RequireRoles(...roles: UserRole[]) {
  return applyDecorators(
    Roles(...roles),
    UseGuards(JwtAuthGuard, RolesGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Unauthorized' }),
    ApiForbiddenResponse({ description: 'Недостаточно прав' }),
  )
}
