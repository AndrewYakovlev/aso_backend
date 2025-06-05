// src/modules/orders/dto/order-item-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { ProductListItemDto } from '../../products/dto/product-response.dto' // Предполагается, что этот DTO существует
import { ChatProductResponseDto } from '../../chat/dto/chat-product.dto' // Предполагается, что этот DTO существует

export class OrderItemResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  orderId!: string

  @ApiPropertyOptional()
  productId?: string | null

  @ApiPropertyOptional({ type: () => ProductListItemDto }) // Используем ()=> для предотвращения циклических зависимостей при импорте
  product?: ProductListItemDto | null

  @ApiPropertyOptional()
  chatProductId?: string | null

  @ApiPropertyOptional({ type: () => ChatProductResponseDto }) // Используем ()=> для предотвращения циклических зависимостей при импорте
  chatProduct?: ChatProductResponseDto | null

  @ApiProperty()
  quantity!: number

  @ApiProperty({ description: 'Цена за единицу' })
  price!: number

  @ApiProperty({ description: 'Общая стоимость позиции' })
  total!: number

  static fromEntity(entity: any): OrderItemResponseDto {
    return {
      id: entity.id,
      orderId: entity.orderId,
      productId: entity.productId,
      product: entity.product ? ProductListItemDto.fromEntity(entity.product) : null,
      chatProductId: entity.chatProductId,
      chatProduct: entity.chatProduct /* TODO: map to ChatProductResponseDto if necessary */,
      quantity: entity.quantity,
      price: Number(entity.price),
      total: Number(entity.total),
    }
  }
}
