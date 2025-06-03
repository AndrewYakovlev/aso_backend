// src/modules/users/dto/create-user.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsString, IsEmail, IsOptional, IsEnum, Matches, IsNumber } from 'class-validator'
import { UserRole } from '@prisma/client'
import { Type } from 'class-transformer'

export class CreateUserDto {
  @ApiProperty({
    description: 'Номер телефона',
    example: '+79001234567',
  })
  @IsString()
  @Matches(/^\+7\d{10}$/, {
    message: 'Номер телефона должен быть в формате +7XXXXXXXXXX',
  })
  phone!: string

  @ApiPropertyOptional({
    description: 'Email',
    example: 'user@example.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string

  @ApiPropertyOptional({
    description: 'Имя',
    example: 'Иван',
  })
  @IsOptional()
  @IsString()
  firstName?: string

  @ApiPropertyOptional({
    description: 'Фамилия',
    example: 'Иванов',
  })
  @IsOptional()
  @IsString()
  lastName?: string

  @ApiPropertyOptional({
    description: 'Роль пользователя',
    enum: UserRole,
    default: UserRole.CUSTOMER,
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole

  @ApiPropertyOptional({
    description: 'ID группы клиентов',
  })
  @IsOptional()
  @IsString()
  customerGroupId?: string

  @ApiPropertyOptional({
    description: 'Персональная скидка в процентах',
    example: 10,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  personalDiscount?: number
}
