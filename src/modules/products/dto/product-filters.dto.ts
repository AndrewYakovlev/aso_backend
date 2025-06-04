// src/modules/products/dto/product-filters.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type, Transform } from 'class-transformer'
import {
  IsOptional,
  IsArray,
  IsString,
  IsBoolean,
  IsNumber,
  ValidateNested,
  Min,
  IsEnum,
} from 'class-validator'
import { CharacteristicType } from '../../characteristics/interfaces/characteristic.interface'

export class PriceRangeDto {
  @ApiPropertyOptional({
    description: 'Минимальная цена',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  min?: number

  @ApiPropertyOptional({
    description: 'Максимальная цена',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  max?: number
}

export class CharacteristicRangeDto {
  @ApiPropertyOptional({
    description: 'Минимальное значение',
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  min?: number

  @ApiPropertyOptional({
    description: 'Максимальное значение',
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  max?: number
}

export class CharacteristicFilterDto {
  @ApiPropertyOptional({
    description: 'ID характеристики',
  })
  @IsString()
  characteristicId!: string

  @ApiPropertyOptional({
    description: 'Тип характеристики',
    enum: CharacteristicType,
  })
  @IsEnum(CharacteristicType)
  type!: CharacteristicType

  @ApiPropertyOptional({
    description: 'Значения для фильтрации (для select, checkbox)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  values?: string[]

  @ApiPropertyOptional({
    description: 'Диапазон значений (для number с filterType range)',
    type: CharacteristicRangeDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CharacteristicRangeDto)
  range?: CharacteristicRangeDto

  @ApiPropertyOptional({
    description: 'Логическое значение (для boolean)',
  })
  @IsOptional()
  @IsBoolean()
  booleanValue?: boolean
}

export class ExtendedProductFiltersDto {
  @ApiPropertyOptional({
    description: 'Полнотекстовый поиск',
  })
  @IsOptional()
  @IsString()
  search?: string

  @ApiPropertyOptional({
    description: 'ID категорий',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : undefined))
  categoryIds?: string[]

  @ApiPropertyOptional({
    description: 'ID брендов',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : undefined))
  brandIds?: string[]

  @ApiPropertyOptional({
    description: 'Диапазон цен',
    type: PriceRangeDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PriceRangeDto)
  priceRange?: PriceRangeDto

  @ApiPropertyOptional({
    description: 'Только товары в наличии',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  inStock?: boolean

  @ApiPropertyOptional({
    description: 'Только оригинальные запчасти',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isOriginal?: boolean

  @ApiPropertyOptional({
    description: 'Фильтры по характеристикам',
    type: [CharacteristicFilterDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CharacteristicFilterDto)
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value)
      } catch {
        return []
      }
    }
    return value
  })
  characteristics?: CharacteristicFilterDto[]

  @ApiPropertyOptional({
    description: 'Включить неактивные товары',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  includeInactive?: boolean
}

export class GetFiltersDto {
  @ApiPropertyOptional({
    description: 'ID категории для получения релевантных фильтров',
  })
  @IsOptional()
  @IsString()
  categoryId?: string

  @ApiPropertyOptional({
    description: 'Текущие примененные фильтры для умной фильтрации',
    type: ExtendedProductFiltersDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExtendedProductFiltersDto)
  appliedFilters?: ExtendedProductFiltersDto
}
