// src/modules/vehicle-applications/dto/vehicle-application-filters.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, IsBoolean, IsInt, Min, Max } from 'class-validator'
import { Transform, Type } from 'class-transformer'

export class VehicleApplicationFiltersDto {
  @ApiPropertyOptional({
    description: 'Фильтр по ID товара',
  })
  @IsOptional()
  @IsString()
  productId?: string

  @ApiPropertyOptional({
    description: 'Фильтр по ID модификации',
  })
  @IsOptional()
  @IsString()
  modificationId?: string

  @ApiPropertyOptional({
    description: 'Фильтр по ID марки',
  })
  @IsOptional()
  @IsString()
  makeId?: string

  @ApiPropertyOptional({
    description: 'Фильтр по ID модели',
  })
  @IsOptional()
  @IsString()
  modelId?: string

  @ApiPropertyOptional({
    description: 'Фильтр по ID поколения',
  })
  @IsOptional()
  @IsString()
  generationId?: string

  @ApiPropertyOptional({
    description: 'Только проверенные экспертом',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isVerified?: boolean

  @ApiPropertyOptional({
    description: 'Номер страницы',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1

  @ApiPropertyOptional({
    description: 'Количество элементов на странице',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20
}
