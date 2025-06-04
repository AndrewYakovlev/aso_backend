// src/modules/characteristics/dto/characteristics-filter.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, IsBoolean, IsArray } from 'class-validator'
import { Transform } from 'class-transformer'

export class CharacteristicsFilterDto {
  @ApiPropertyOptional({
    description: 'Поиск по названию или коду',
  })
  @IsOptional()
  @IsString()
  search?: string

  @ApiPropertyOptional({
    description: 'Фильтр по категории',
  })
  @IsOptional()
  @IsString()
  categoryId?: string

  @ApiPropertyOptional({
    description: 'Только обязательные',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isRequired?: boolean

  @ApiPropertyOptional({
    description: 'Только используемые в фильтрах',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isFilterable?: boolean

  @ApiPropertyOptional({
    description: 'Фильтр по типам',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : undefined))
  types?: string[]
}
