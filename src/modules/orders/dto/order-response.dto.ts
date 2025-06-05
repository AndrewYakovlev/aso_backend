// src/modules/orders/dto/order-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { UserResponseDto } from '../../users/dto/user-response.dto'
import { OrderItemResponseDto } from './order-item-response.dto'
import { OrderStatusResponseDto } from './order-status-response.dto'
import { DeliveryMethodResponseDto } from './delivery-method-response.dto'
import { PaymentMethodResponseDto } from './payment-method-response.dto'
import { ShippingAddressDto } from './shipping-address.dto'

export class OrderResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  orderNumber!: string

  @ApiProperty()
  userId!: string

  @ApiProperty({ type: UserResponseDto })
  user!: UserResponseDto

  @ApiProperty()
  statusId!: string

  @ApiProperty({ type: OrderStatusResponseDto })
  status!: OrderStatusResponseDto

  @ApiProperty()
  subtotal!: number

  @ApiProperty()
  discountAmount!: number

  @ApiProperty()
  shippingAmount!: number

  @ApiProperty()
  totalAmount!: number

  @ApiProperty()
  deliveryMethodId!: string

  @ApiProperty({ type: DeliveryMethodResponseDto })
  deliveryMethod!: DeliveryMethodResponseDto

  @ApiProperty()
  paymentMethodId!: string

  @ApiProperty({ type: PaymentMethodResponseDto })
  paymentMethod!: PaymentMethodResponseDto

  @ApiPropertyOptional({ type: ShippingAddressDto })
  shippingAddress?: ShippingAddressDto

  @ApiPropertyOptional()
  comment?: string

  @ApiPropertyOptional()
  promoCodeId?: string

  @ApiProperty()
  createdAt!: Date

  @ApiProperty()
  updatedAt!: Date

  @ApiProperty({ type: [OrderItemResponseDto] })
  items!: OrderItemResponseDto[]

  @ApiPropertyOptional({
    description: 'URL для оплаты заказа',
    example: 'https://payment.example.com/pay/12345',
  })
  paymentUrl?: string

  static fromEntity(order: any): OrderResponseDto {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      user: UserResponseDto.fromEntity(order.user),
      statusId: order.statusId,
      status: OrderStatusResponseDto.fromEntity(order.status),
      subtotal: Number(order.subtotal),
      discountAmount: Number(order.discountAmount),
      shippingAmount: Number(order.shippingAmount),
      totalAmount: Number(order.totalAmount),
      deliveryMethodId: order.deliveryMethodId,
      deliveryMethod: DeliveryMethodResponseDto.fromEntity(order.deliveryMethod),
      paymentMethodId: order.paymentMethodId,
      paymentMethod: PaymentMethodResponseDto.fromEntity(order.paymentMethod),
      shippingAddress: order.shippingAddress,
      comment: order.comment,
      promoCodeId: order.promoCodeId,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: order.items?.map((item: any) => OrderItemResponseDto.fromEntity(item)) || [],
    }
  }
}

export class CreateOrderResponseDto extends OrderResponseDto {
  @ApiPropertyOptional({
    description: 'URL для оплаты заказа (для онлайн методов оплаты)',
  })
  paymentUrl?: string
}
