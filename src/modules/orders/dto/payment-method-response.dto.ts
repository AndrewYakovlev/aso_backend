// src/modules/orders/dto/payment-method-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class PaymentMethodResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  name!: string

  @ApiProperty()
  code!: string

  @ApiPropertyOptional()
  description?: string | null

  @ApiPropertyOptional()
  icon?: string | null

  @ApiProperty()
  isOnline!: boolean

  @ApiProperty()
  isActive!: boolean

  @ApiProperty()
  sortOrder!: number

  @ApiPropertyOptional()
  settings?: any

  @ApiProperty({
    description: 'Комиссия в процентах',
  })
  commission!: number

  @ApiProperty()
  createdAt!: Date

  @ApiPropertyOptional({
    description: 'Доступен ли метод для суммы заказа',
  })
  isAvailable?: boolean

  @ApiPropertyOptional({
    description: 'Причина недоступности',
  })
  unavailableReason?: string

  static fromEntity(entity: any, orderAmount?: number): PaymentMethodResponseDto {
    const dto = new PaymentMethodResponseDto()
    Object.assign(dto, {
      ...entity,
      commission: Number(entity.commission),
      isAvailable: true,
    })

    // Проверяем доступность метода для суммы заказа
    if (orderAmount !== undefined && entity.settings) {
      const settings = entity.settings as any

      // Проверка минимальной суммы
      if (settings.minAmount && orderAmount < settings.minAmount) {
        dto.isAvailable = false
        dto.unavailableReason = `Минимальная сумма заказа: ${settings.minAmount} ₽`
      }

      // Проверка максимальной суммы
      if (settings.maxAmount && orderAmount > settings.maxAmount) {
        dto.isAvailable = false
        dto.unavailableReason = `Максимальная сумма заказа: ${settings.maxAmount} ₽`
      }
    }

    return dto
  }
}
