// src/modules/vehicles/dto/create-vehicle-make.dto.ts (обновить существующий)
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

  @ApiPropertyOptional({
    description: 'Описание марки',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string

  @ApiPropertyOptional({
    description: 'SEO заголовок (генерируется автоматически)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  metaTitle?: string

  @ApiPropertyOptional({
    description: 'SEO описание (генерируется автоматически)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  metaDescription?: string

  @ApiPropertyOptional({
    description: 'SEO ключевые слова (генерируются автоматически)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  metaKeywords?: string
}
