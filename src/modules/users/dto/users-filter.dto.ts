// src/modules/users/dto/users-filter.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsEnum, IsString } from 'class-validator'
import { UserRole } from '@prisma/client'

export class UsersFilterDto {
  @ApiPropertyOptional({
    description: 'Фильтр по роли',
    enum: UserRole,
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole

  @ApiPropertyOptional({
    description: 'Фильтр по группе клиентов',
  })
  @IsOptional()
  @IsString()
  customerGroupId?: string

  @ApiPropertyOptional({
    description: 'Поиск по телефону, email, имени или фамилии',
  })
  @IsOptional()
  @IsString()
  search?: string
}
