// src/modules/categories/dto/category-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Exclude, Type, plainToInstance } from 'class-transformer'
import { CategoryWithRelations } from '../interfaces/category.interface'

export class CategoryResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  name!: string

  @ApiProperty()
  slug!: string

  @ApiPropertyOptional()
  description?: string | null

  @ApiPropertyOptional()
  parentId?: string | null

  @ApiProperty()
  sortOrder!: number

  @ApiProperty()
  isActive!: boolean

  @ApiProperty()
  createdAt!: Date

  @Exclude()
  deletedAt?: Date | null

  // SEO поля
  @ApiPropertyOptional()
  metaTitle?: string | null

  @ApiPropertyOptional()
  metaDescription?: string | null

  @ApiPropertyOptional()
  metaKeywords?: string | null

  @ApiPropertyOptional({ type: CategoryResponseDto })
  @Type(() => CategoryResponseDto)
  parent?: CategoryResponseDto | null

  @ApiPropertyOptional({ type: [CategoryResponseDto] })
  @Type(() => CategoryResponseDto)
  children?: CategoryResponseDto[]

  @ApiPropertyOptional({
    description: 'Количество товаров в категории',
  })
  productCount?: number

  @ApiPropertyOptional({
    description: 'Количество товаров включая подкатегории',
  })
  totalProductCount?: number

  @ApiPropertyOptional({
    description: 'Canonical URL категории',
  })
  canonicalUrl?: string

  static fromEntity(category: CategoryWithRelations): CategoryResponseDto {
    const plain = {
      ...category,
      parent:
        category.parent && category.parent !== null
          ? CategoryResponseDto.fromEntity(category.parent)
          : undefined,
      children: category.children?.map((child) => CategoryResponseDto.fromEntity(child)),
      productCount: category._count?.products || category.productCount || 0,
      totalProductCount: category.totalProductCount,
      // Генерируем canonical URL
      canonicalUrl: `/catalog/${category.slug}`,
    }

    return plainToInstance(CategoryResponseDto, plain)
  }
}

export class CategoryTreeResponseDto extends CategoryResponseDto {
  @ApiProperty({ type: [CategoryTreeResponseDto] })
  @Type(() => CategoryTreeResponseDto)
  declare children: CategoryTreeResponseDto[]

  static fromEntity(category: CategoryWithRelations): CategoryTreeResponseDto {
    const plain = {
      ...category,
      children: category.children?.map((child) => CategoryTreeResponseDto.fromEntity(child)) || [],
      productCount: category._count?.products || category.productCount || 0,
      totalProductCount: category.totalProductCount,
      canonicalUrl: `/catalog/${category.slug}`,
    }

    return plainToInstance(CategoryTreeResponseDto, plain)
  }
}

export class CategoryBreadcrumbDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  name!: string

  @ApiProperty()
  slug!: string
}
