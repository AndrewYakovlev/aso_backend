// src/modules/vehicles/dto/vehicle-filters.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, IsInt, Min, Max, IsBoolean } from 'class-validator'
import { Type, Transform } from 'class-transformer'

export class VehicleFilterDto {
  @ApiPropertyOptional({
    description: 'Поиск по названию',
  })
  @IsOptional()
  @IsString()
  search?: string

  @ApiPropertyOptional({
    description: 'Фильтр по стране',
  })
  @IsOptional()
  @IsString()
  country?: string

  @ApiPropertyOptional({
    description: 'Фильтр по году начала производства (от)',
    minimum: 1900,
    maximum: 2100,
  })
  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  @Type(() => Number)
  yearFrom?: number

  @ApiPropertyOptional({
    description: 'Фильтр по году окончания производства (до)',
    minimum: 1900,
    maximum: 2100,
  })
  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  @Type(() => Number)
  yearTo?: number
}

export class VehicleSearchDto {
  @ApiPropertyOptional({
    description: 'Поисковый запрос',
  })
  @IsOptional()
  @IsString()
  q?: string

  @ApiPropertyOptional({
    description: 'ID марки для уточнения поиска',
  })
  @IsOptional()
  @IsString()
  makeId?: string

  @ApiPropertyOptional({
    description: 'ID модели для уточнения поиска',
  })
  @IsOptional()
  @IsString()
  modelId?: string

  @ApiPropertyOptional({
    description: 'Включить модификации в результаты',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  includeModifications?: boolean
}
