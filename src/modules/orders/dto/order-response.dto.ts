// src/modules/orders/dto/order-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type, plainToInstance } from 'class-transformer'
import { OrderStatus, DeliveryMethod, PaymentMethod } from '@prisma/client'

export class OrderItemResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  orderId!: string

  @ApiPropertyOptional()
  productId?: string | null

  @ApiPropertyOptional()
  productName?: string

  @ApiPropertyOptional()
  productSku?: string

  @ApiPropertyOptional()
  chatProductId?: string | null

  @ApiProperty()
  quantity!: number

  @ApiProperty({
    description: 'Цена за единицу',
  })
  price!: number

  @ApiProperty({
    description: 'Общая стоимость',
  })
  total!: number
}

export class OrderStatusResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  name!: string

  @ApiProperty()
  code!: string

  @ApiPropertyOptional()
  color?: string | null

  @ApiPropertyOptional()
  description?: string | null

  @ApiProperty()
  canCancelOrder!: boolean
}

export class OrderResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  orderNumber!: string

  @ApiProperty()
  userId!: string

  @ApiProperty()
  statusId!: string

  @ApiProperty({ type: OrderStatusResponseDto })
  @Type(() => OrderStatusResponseDto)
  status!: OrderStatusResponseDto

  @ApiProperty({
    description: 'Сумма товаров',
  })
  subtotal!: number

  @ApiProperty({
    description: 'Сумма скидки',
  })
  discountAmount!: number

  @ApiProperty({
    description: 'Стоимость доставки',
  })
  shippingAmount!: number

  @ApiProperty({
    description: 'Итоговая сумма',
  })
  totalAmount!: number

  @ApiProperty()
  deliveryMethodId!: string

  @ApiProperty()
  deliveryMethod!: DeliveryMethod

  @ApiProperty()
  paymentMethodId!: string

  @ApiProperty()
  paymentMethod!: PaymentMethod

  @ApiPropertyOptional()
  shippingAddress?: any

  @ApiPropertyOptional()
  comment?: string | null

  @ApiPropertyOptional()
  promoCodeId?: string | null

  @ApiPropertyOptional()
  promoCode?: any

  @ApiProperty({
    description: 'Товары в заказе',
    type: [OrderItemResponseDto],
  })
  @Type(() => OrderItemResponseDto)
  items!: OrderItemResponseDto[]

  @ApiProperty()
  createdAt!: Date

  @ApiProperty()
  updatedAt!: Date

  @ApiProperty({
    description: 'Можно ли отменить заказ',
  })
  canCancel!: boolean

  static fromEntity(entity: any): OrderResponseDto {
    const plain = {
      ...entity,
      subtotal: Number(entity.subtotal),
      discountAmount: Number(entity.discountAmount),
      shippingAmount: Number(entity.shippingAmount),
      totalAmount: Number(entity.totalAmount),
      canCancel: entity.status?.canCancelOrder || false,
      items:
        entity.items?.map((item: any) => ({
          ...item,
          price: Number(item.price),
          total: Number(item.total),
          productName: item.product?.name || item.chatProduct?.name,
          productSku: item.product?.sku || item.chatProduct?.sku,
        })) || [],
    }

    return plainToInstance(OrderResponseDto, plain)
  }
}

export class CreateOrderResponseDto extends OrderResponseDto {
  @ApiPropertyOptional({
    description: 'URL для перехода к оплате (если метод оплаты онлайн)',
  })
  paymentUrl?: string
}
