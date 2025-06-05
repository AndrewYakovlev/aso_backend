// src/modules/orders/dto/delivery-method-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { DeliveryMethod } from '@prisma/client'

export class DeliveryMethodResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  name!: string

  @ApiProperty()
  code!: string

  @ApiPropertyOptional()
  description?: string | null

  @ApiProperty()
  price!: number

  @ApiPropertyOptional()
  minAmount?: number | null

  @ApiProperty()
  isActive!: boolean

  @ApiProperty()
  sortOrder!: number

  @ApiPropertyOptional()
  settings?: any

  @ApiProperty()
  createdAt!: Date

  @ApiPropertyOptional({
    description: 'Доступна ли бесплатная доставка при текущей сумме корзины',
  })
  isFreeAvailable?: boolean

  @ApiPropertyOptional({
    description: 'Стоимость доставки с учетом суммы корзины',
  })
  calculatedPrice?: number

  static fromEntity(dto: DeliveryMethod, cartAmount?: number): DeliveryMethodResponseDto {
    const result: DeliveryMethodResponseDto = {
      id: dto.id,
      name: dto.name,
      code: dto.code,
      description: dto.description,
      price: Number(dto.price),
      minAmount: dto.minAmount ? Number(dto.minAmount) : null,
      isActive: dto.isActive,
      sortOrder: dto.sortOrder,
      settings: dto.settings,
      createdAt: dto.createdAt,
    }

    // Рассчитываем доступность бесплатной доставки
    if (cartAmount !== undefined && dto.minAmount !== null && dto.minAmount !== undefined) {
      result.isFreeAvailable = cartAmount >= Number(dto.minAmount)
      result.calculatedPrice = result.isFreeAvailable ? 0 : Number(dto.price)
    } else {
      result.isFreeAvailable = false
      result.calculatedPrice = Number(dto.price)
    }

    return result
  }
}
