// src/modules/products/dto/products-filter.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, IsBoolean, IsNumber, IsArray, IsEnum } from 'class-validator'
import { Type, Transform } from 'class-transformer'

export enum ProductSortBy {
  NAME = 'name',
  PRICE = 'price',
  CREATED = 'createdAt',
  STOCK = 'stock',
  SKU = 'sku',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class ProductsFilterDto {
  @ApiPropertyOptional({
    description: 'Поиск по названию, артикулу или описанию',
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
    description: 'Фильтр по нескольким категориям',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : undefined))
  categoryIds?: string[]

  @ApiPropertyOptional({
    description: 'Фильтр по бренду',
  })
  @IsOptional()
  @IsString()
  brandId?: string

  @ApiPropertyOptional({
    description: 'Фильтр по нескольким брендам',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : undefined))
  brandIds?: string[]

  @ApiPropertyOptional({
    description: 'Минимальная цена',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  minPrice?: number

  @ApiPropertyOptional({
    description: 'Максимальная цена',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxPrice?: number

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
    description: 'Включить неактивные товары',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  includeInactive?: boolean

  @ApiPropertyOptional({
    description: 'Поле для сортировки',
    enum: ProductSortBy,
    default: ProductSortBy.NAME,
  })
  @IsOptional()
  @IsEnum(ProductSortBy)
  sortBy?: ProductSortBy = ProductSortBy.NAME

  @ApiPropertyOptional({
    description: 'Направление сортировки',
    enum: SortOrder,
    default: SortOrder.ASC,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.ASC
}
