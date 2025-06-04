// src/modules/products/dto/product-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Exclude, Type, plainToInstance } from 'class-transformer'
import { CategoryResponseDto } from '../../categories/dto/category-response.dto'
import { ProductWithRelations } from '../interfaces/product.interface'

export class BrandResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  name!: string

  @ApiProperty()
  slug!: string

  @ApiPropertyOptional()
  logo?: string | null

  @ApiPropertyOptional()
  description?: string | null

  @ApiPropertyOptional()
  country?: string | null
}

export class ProductImageResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  url!: string

  @ApiPropertyOptional()
  alt?: string | null

  @ApiProperty()
  sortOrder!: number
}

export class ProductCategoryResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  isPrimary!: boolean

  @ApiProperty({ type: CategoryResponseDto })
  @Type(() => CategoryResponseDto)
  category!: CategoryResponseDto
}

export class ProductResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  name!: string

  @ApiProperty()
  slug!: string

  @ApiPropertyOptional()
  description?: string | null

  @ApiPropertyOptional()
  shortDescription?: string | null

  @ApiProperty()
  sku!: string

  @ApiProperty({
    description: 'Цена товара',
    type: Number,
  })
  price!: number

  @ApiPropertyOptional({
    description: 'Цена до скидки',
    type: Number,
  })
  comparePrice?: number | null

  @ApiProperty()
  stock!: number

  @ApiPropertyOptional()
  deliveryDays?: number | null

  @ApiProperty()
  brandId!: string

  @ApiProperty({ type: BrandResponseDto })
  @Type(() => BrandResponseDto)
  brand!: BrandResponseDto

  @ApiProperty()
  isOriginal!: boolean

  @ApiProperty()
  isActive!: boolean

  @ApiProperty()
  createdAt!: Date

  @ApiProperty()
  updatedAt!: Date

  @Exclude()
  deletedAt?: Date | null

  @ApiProperty({ type: [ProductCategoryResponseDto] })
  @Type(() => ProductCategoryResponseDto)
  categories!: ProductCategoryResponseDto[]

  @ApiProperty({ type: [ProductImageResponseDto] })
  @Type(() => ProductImageResponseDto)
  images!: ProductImageResponseDto[]

  @ApiPropertyOptional({
    description: 'Количество применимых автомобилей',
  })
  vehicleApplicationCount?: number

  @ApiPropertyOptional({
    description: 'Количество кросс-номеров',
  })
  crossReferenceCount?: number

  @ApiPropertyOptional({
    description: 'Процент скидки',
  })
  discountPercent?: number

  static fromEntity(product: ProductWithRelations): ProductResponseDto {
    const plain: any = {
      ...product,
      price: Number(product.price),
      comparePrice: product.comparePrice ? Number(product.comparePrice) : undefined,
      categories:
        product.categories?.map((pc) => ({
          id: pc.id,
          isPrimary: pc.isPrimary,
          category: CategoryResponseDto.fromEntity(pc.category),
        })) || [],
      images: product.images || [],
      vehicleApplicationCount: product._count?.vehicleApplications || 0,
      crossReferenceCount: product._count?.crossReferences || 0,
    }

    // Вычисляем процент скидки
    if (plain.comparePrice && plain.price < plain.comparePrice) {
      plain.discountPercent = Math.round(
        ((plain.comparePrice - plain.price) / plain.comparePrice) * 100,
      )
    }

    return plainToInstance(ProductResponseDto, plain)
  }
}

export class ProductListItemDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  name!: string

  @ApiProperty()
  slug!: string

  @ApiProperty()
  sku!: string

  @ApiProperty()
  price!: number

  @ApiPropertyOptional()
  comparePrice?: number | null

  @ApiProperty()
  stock!: number

  @ApiPropertyOptional()
  deliveryDays?: number | null

  @ApiProperty({ type: BrandResponseDto })
  @Type(() => BrandResponseDto)
  brand!: BrandResponseDto

  @ApiProperty()
  isOriginal!: boolean

  @ApiPropertyOptional()
  primaryImage?: ProductImageResponseDto

  @ApiPropertyOptional()
  discountPercent?: number

  static fromEntity(
    product: Partial<ProductWithRelations> & {
      id: string
      name: string
      slug: string
      sku: string
      price: any
      stock: number
      isOriginal: boolean
    },
  ): ProductListItemDto {
    const plain: any = {
      id: product.id,
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      price: Number(product.price),
      comparePrice: product.comparePrice ? Number(product.comparePrice) : undefined,
      stock: product.stock,
      deliveryDays: product.deliveryDays,
      brand: product.brand,
      isOriginal: product.isOriginal,
      primaryImage: product.images?.[0],
    }

    // Процент скидки
    if (plain.comparePrice && plain.price < plain.comparePrice) {
      plain.discountPercent = Math.round(
        ((plain.comparePrice - plain.price) / plain.comparePrice) * 100,
      )
    }

    return plainToInstance(ProductListItemDto, plain)
  }
}
