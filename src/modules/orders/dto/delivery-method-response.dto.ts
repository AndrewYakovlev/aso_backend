// src/modules/orders/dto/delivery-method-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'

export class DeliveryMethodResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  name!: string

  @ApiProperty()
  code!: string

  @ApiPropertyOptional()
  description?: string | null

  @ApiProperty({
    description: 'Стоимость доставки',
  })
  price!: number

  @ApiPropertyOptional({
    description: 'Минимальная сумма для бесплатной доставки',
  })
  minAmount?: number | null

  @ApiProperty()
  isActive!: boolean

  @ApiProperty()
  sortOrder!: number

  @ApiPropertyOptional({
    description: 'Дополнительные настройки',
  })
  settings?: any

  @ApiProperty()
  createdAt!: Date

  @ApiPropertyOptional({
    description: 'Расчетная стоимость доставки для текущей корзины',
  })
  calculatedPrice?: number

  @ApiPropertyOptional({
    description: 'Бесплатная доставка доступна',
  })
  isFreeAvailable?: boolean

  static fromEntity(entity: any, cartAmount?: number): DeliveryMethodResponseDto {
    const dto = new DeliveryMethodResponseDto()
    Object.assign(dto, {
      ...entity,
      price: Number(entity.price),
      minAmount: entity.minAmount ? Number(entity.minAmount) : null,
    })

    // Если передана сумма корзины, рассчитываем стоимость
    if (cartAmount !== undefined) {
      dto.calculatedPrice = dto.minAmount && cartAmount >= dto.minAmount ? 0 : dto.price
      dto.isFreeAvailable = dto.minAmount !== null && cartAmount >= dto.minAmount
    }

    return dto
  }
}
