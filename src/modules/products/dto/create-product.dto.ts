// src/modules/products/dto/create-product.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  IsInt,
  MinLength,
  MaxLength,
  Min,
  ArrayMinSize,
  ValidateNested,
  IsUrl,
} from 'class-validator'
import { Type } from 'class-transformer'

export class CreateProductImageDto {
  @ApiProperty({
    description: 'URL изображения',
    example: 'https://example.com/image.jpg',
  })
  @IsUrl()
  url!: string

  @ApiPropertyOptional({
    description: 'Alt текст для изображения',
    example: 'Моторное масло Castrol 5W-40',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  alt?: string

  @ApiPropertyOptional({
    description: 'Порядок сортировки',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sortOrder?: number
}

export class CreateProductDto {
  @ApiProperty({
    description: 'Название товара',
    example: 'Моторное масло Castrol EDGE 5W-40',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name!: string

  @ApiProperty({
    description: 'URL-friendly идентификатор',
    example: 'motornoe-maslo-castrol-edge-5w-40',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  slug!: string

  @ApiPropertyOptional({
    description: 'Полное описание товара',
    example: 'Синтетическое моторное масло...',
  })
  @IsOptional()
  @IsString()
  description?: string

  @ApiPropertyOptional({
    description: 'Краткое описание товара',
    example: 'Синтетическое масло для современных двигателей',
    maxLength: 300,
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  shortDescription?: string

  @ApiProperty({
    description: 'Артикул товара',
    example: 'CAST-EDGE-5W40-4L',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  sku!: string

  @ApiProperty({
    description: 'Цена товара',
    example: 3500,
    minimum: 0,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  price!: number

  @ApiPropertyOptional({
    description: 'Цена до скидки',
    example: 4000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  comparePrice?: number

  @ApiPropertyOptional({
    description: 'Количество на складе',
    example: 10,
    default: 0,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  stock?: number

  @ApiPropertyOptional({
    description: 'Срок поставки в днях',
    example: 3,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  deliveryDays?: number

  @ApiProperty({
    description: 'ID бренда',
  })
  @IsString()
  brandId!: string

  @ApiPropertyOptional({
    description: 'Оригинальная запчасть',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isOriginal?: boolean

  @ApiPropertyOptional({
    description: 'Активность товара',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @ApiProperty({
    description: 'ID категорий товара',
    example: ['cat-1', 'cat-2'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  categoryIds!: string[]

  @ApiPropertyOptional({
    description: 'Изображения товара',
    type: [CreateProductImageDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductImageDto)
  images?: CreateProductImageDto[]
}
