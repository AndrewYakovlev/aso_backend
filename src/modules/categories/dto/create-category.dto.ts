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
}
