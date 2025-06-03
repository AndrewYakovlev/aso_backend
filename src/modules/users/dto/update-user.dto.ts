// src/modules/users/dto/update-user.dto.ts
import { PartialType, OmitType } from '@nestjs/swagger'
import { CreateUserDto } from './create-user.dto'

export class UpdateUserDto extends PartialType(OmitType(CreateUserDto, ['phone'] as const)) {}

// src/modules/users/dto/update-user-role.dto.ts
import { ApiProperty } from '@nestjs/swagger'
import { IsEnum } from 'class-validator'
import { UserRole } from '@prisma/client'

export class UpdateUserRoleDto {
  @ApiProperty({
    description: 'Новая роль пользователя',
    enum: UserRole,
  })
  @IsEnum(UserRole)
  role: UserRole
}
