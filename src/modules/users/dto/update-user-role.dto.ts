import { ApiProperty } from '@nestjs/swagger'
import { IsEnum } from 'class-validator'
import { UserRole } from '@prisma/client'

export class UpdateUserRoleDto {
  @ApiProperty({
    description: 'Новая роль пользователя',
    enum: UserRole,
  })
  @IsEnum(UserRole)
  role!: UserRole
}
