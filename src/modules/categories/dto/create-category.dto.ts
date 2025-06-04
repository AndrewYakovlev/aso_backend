// src/modules/categories/dto/create-category.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsString, IsOptional, IsBoolean, IsInt, MinLength, MaxLength, Min } from 'class-validator'
import { Type } from 'class-transformer'

export class CreateCategoryDto {
  @ApiProperty({
    description: 'Название категории',
    example: 'Масла и технические жидкости',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string

  @ApiProperty({
    description: 'URL-friendly идентификатор',
    example: 'masla-i-tehnicheskie-zhidkosti',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  slug!: string

  @ApiPropertyOptional({
    description: 'Описание категории',
    example: 'Моторные масла, трансмиссионные жидкости, антифризы',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string

  @ApiPropertyOptional({
    description: 'ID родительской категории',
  })
  @IsOptional()
  @IsString()
  parentId?: string

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

  @ApiPropertyOptional({
    description: 'Активность категории',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  // SEO поля
  @ApiPropertyOptional({
    description: 'SEO заголовок страницы (автогенерируется из названия если не указан)',
    example: 'Масла и технические жидкости - купить в интернет-магазине Автозапчасти АСО',
    maxLength: 160,
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  metaTitle?: string

  @ApiPropertyOptional({
    description: 'SEO описание страницы (автогенерируется из описания если не указано)',
    example:
      'Большой выбор моторных масел, трансмиссионных жидкостей и антифризов. Доставка по Бежецку. Гарантия качества.',
    maxLength: 300,
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  metaDescription?: string

  @ApiPropertyOptional({
    description: 'SEO ключевые слова (автогенерируются из названия если не указаны)',
    example: 'моторное масло, трансмиссионная жидкость, антифриз, купить масло бежецк',
    maxLength: 300,
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  metaKeywords?: string
}
