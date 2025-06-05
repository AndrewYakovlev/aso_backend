// src/modules/vehicles/dto/create-vehicle-generation.dto.ts
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

export class CreateVehicleGenerationDto {
  @ApiProperty({
    description: 'ID модели автомобиля',
  })
  @IsString()
  modelId!: string

  @ApiProperty({
    description: 'Название поколения',
    example: 'XV70 (8-е поколение)',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string

  @ApiPropertyOptional({
    description: 'URL-friendly идентификатор (генерируется автоматически)',
    example: 'xv70-8-generation',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug должен содержать только строчные буквы, цифры и дефисы',
  })
  slug?: string

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
    description: 'Тип кузова',
    example: 'Седан',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  bodyType?: string

  @ApiPropertyOptional({
    description: 'Описание поколения',
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
