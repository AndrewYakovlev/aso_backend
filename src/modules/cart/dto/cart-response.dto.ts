// src/modules/cart/dto/cart-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type, plainToInstance } from 'class-transformer'
import { ProductListItemDto } from '../../products/dto/product-response.dto'

export class ChatProductResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  name!: string

  @ApiProperty()
  brand!: string

  @ApiProperty()
  sku!: string

  @ApiProperty()
  price!: number

  @ApiPropertyOptional()
  comparePrice?: number | null

  @ApiProperty()
  isOriginal!: boolean

  @ApiPropertyOptional()
  deliveryDays?: number | null

  @ApiPropertyOptional()
  description?: string | null

  @ApiProperty({
    description: 'Массив URL изображений',
    type: [String],
  })
  images!: string[]
}

export class CartItemResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  cartId!: string

  @ApiPropertyOptional()
  productId?: string | null

  @ApiPropertyOptional({ type: ProductListItemDto })
  @Type(() => ProductListItemDto)
  product?: ProductListItemDto | null

  @ApiPropertyOptional()
  chatProductId?: string | null

  @ApiPropertyOptional({ type: ChatProductResponseDto })
  @Type(() => ChatProductResponseDto)
  chatProduct?: ChatProductResponseDto | null

  @ApiProperty()
  quantity!: number

  @ApiProperty({
    description: 'Цена за единицу на момент добавления',
  })
  price!: number

  @ApiProperty({
    description: 'Общая стоимость позиции',
  })
  total!: number

  @ApiProperty()
  createdAt!: Date

  @ApiProperty({
    description: 'Доступно ли для заказа',
  })
  isAvailable!: boolean

  @ApiPropertyOptional({
    description: 'Причина недоступности',
  })
  unavailableReason?: string

  static fromEntity(entity: any): CartItemResponseDto {
    const plain: any = {
      ...entity,
      price: Number(entity.price),
      total: Number(entity.price) * entity.quantity,
      isAvailable: true,
    }

    // Проверяем доступность обычного товара
    if (entity.product) {
      if (!entity.product.isActive || entity.product.deletedAt) {
        plain.isAvailable = false
        plain.unavailableReason = 'Товар недоступен'
      } else if (entity.product.stock < entity.quantity) {
        plain.isAvailable = false
        plain.unavailableReason = `Недостаточно товара на складе (доступно: ${entity.product.stock})`
      }

      // Преобразуем images в нужный формат
      if (entity.product.images && entity.product.images.length > 0) {
        plain.product = {
          ...entity.product,
          primaryImage: entity.product.images[0],
        }
      }
    }

    // Преобразуем images из JSON для chatProduct
    if (entity.chatProduct && entity.chatProduct.images) {
      plain.chatProduct = {
        ...entity.chatProduct,
        images: Array.isArray(entity.chatProduct.images)
          ? entity.chatProduct.images
          : JSON.parse(entity.chatProduct.images),
        price: Number(entity.chatProduct.price),
        comparePrice: entity.chatProduct.comparePrice
          ? Number(entity.chatProduct.comparePrice)
          : null,
      }
    }

    return plainToInstance(CartItemResponseDto, plain)
  }
}

export class CartResponseDto {
  @ApiProperty()
  id!: string

  @ApiPropertyOptional()
  userId?: string | null

  @ApiPropertyOptional()
  anonymousId?: string | null

  @ApiProperty({
    description: 'Элементы корзины',
    type: [CartItemResponseDto],
  })
  @Type(() => CartItemResponseDto)
  items!: CartItemResponseDto[]

  @ApiProperty({
    description: 'Общее количество товаров',
  })
  totalItems!: number

  @ApiProperty({
    description: 'Общая стоимость',
  })
  subtotal!: number

  @ApiProperty({
    description: 'Количество недоступных товаров',
  })
  unavailableItems!: number

  @ApiProperty()
  createdAt!: Date

  @ApiProperty()
  updatedAt!: Date

  static fromEntity(entity: any): CartResponseDto {
    const items = entity.items?.map((item: any) => CartItemResponseDto.fromEntity(item)) || []

    const subtotal = items
      .filter((item: CartItemResponseDto) => item.isAvailable)
      .reduce((sum: number, item: CartItemResponseDto) => sum + item.total, 0)

    const totalItems = items.reduce(
      (sum: number, item: CartItemResponseDto) => sum + item.quantity,
      0,
    )

    const unavailableItems = items.filter((item: CartItemResponseDto) => !item.isAvailable).length

    return plainToInstance(CartResponseDto, {
      ...entity,
      items,
      totalItems,
      subtotal,
      unavailableItems,
    })
  }
}
