// src/modules/vehicles/dto/create-vehicle-make.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsString, IsOptional, IsUrl, MinLength, MaxLength, Matches } from 'class-validator'

export class CreateVehicleMakeDto {
  @ApiProperty({
    description: 'Название марки автомобиля',
    example: 'Toyota',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string

  @ApiPropertyOptional({
    description: 'URL-friendly идентификатор (генерируется автоматически из названия)',
    example: 'toyota',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug должен содержать только строчные буквы, цифры и дефисы',
  })
  slug?: string

  @ApiPropertyOptional({
    description: 'Страна производителя',
    example: 'Япония',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string

  @ApiPropertyOptional({
    description: 'URL логотипа марки',
    example: 'https://example.com/logos/toyota.png',
  })
  @IsOptional()
  @IsUrl()
  logoUrl?: string
}
