// src/modules/vehicles/dto/create-vehicle-model.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsString,
  IsOptional,
  IsInt,
  MinLength,
  MaxLength,
  Min,
  Max,
  Matches,
} from 'class-validator'
import { Type } from 'class-transformer'

export class CreateVehicleModelDto {
  @ApiProperty({
    description: 'ID марки автомобиля',
  })
  @IsString()
  makeId!: string

  @ApiProperty({
    description: 'Название модели',
    example: 'Camry',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string

  @ApiPropertyOptional({
    description: 'URL-friendly идентификатор (генерируется автоматически)',
    example: 'camry',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug должен содержать только строчные буквы, цифры и дефисы',
  })
  slug?: string

  @ApiPropertyOptional({
    description: 'Код модели',
    example: 'XV70',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  modelCode?: string

  @ApiProperty({
    description: 'Год начала производства',
    example: 2017,
    minimum: 1900,
    maximum: 2100,
  })
  @IsInt()
  @Min(1900)
  @Max(2100)
  @Type(() => Number)
  startYear!: number

  @ApiPropertyOptional({
    description: 'Год окончания производства',
    example: 2024,
    minimum: 1900,
    maximum: 2100,
  })
  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  @Type(() => Number)
  endYear?: number

  @ApiPropertyOptional({
    description: 'Описание модели',
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
