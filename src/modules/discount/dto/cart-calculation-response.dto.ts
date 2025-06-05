// src/modules/discount/dto/cart-calculation-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'

export class ItemCalculationDto {
  @ApiProperty({
    description: 'ID элемента корзины',
  })
  cartItemId!: string

  @ApiProperty({
    description: 'Название товара',
  })
  productName!: string

  @ApiProperty({
    description: 'Артикул',
  })
  sku!: string

  @ApiProperty({
    description: 'Количество',
  })
  quantity!: number

  @ApiProperty({
    description: 'Цена за единицу',
  })
  price!: number

  @ApiProperty({
    description: 'Сумма без скидки',
  })
  subtotal!: number

  @ApiProperty({
    description: 'Применена ли скидка к этому товару',
  })
  hasDiscount!: boolean

  @ApiPropertyOptional({
    description: 'Процент скидки',
  })
  discountPercent?: number

  @ApiPropertyOptional({
    description: 'Сумма скидки',
  })
  discountAmount?: number

  @ApiProperty({
    description: 'Итоговая сумма',
  })
  total!: number

  @ApiPropertyOptional({
    description: 'Причина неприменения скидки',
  })
  discountNotAppliedReason?: string
}

export class AppliedDiscountDto {
  @ApiProperty({
    description: 'Тип скидки',
    enum: ['PERSONAL', 'GROUP', 'PROMO'],
  })
  type!: 'PERSONAL' | 'GROUP' | 'PROMO'

  @ApiProperty({
    description: 'Название скидки',
  })
  name!: string

  @ApiPropertyOptional({
    description: 'Описание',
  })
  description?: string

  @ApiProperty({
    description: 'Процент скидки',
  })
  percent!: number

  @ApiPropertyOptional({
    description: 'Фиксированная сумма скидки',
  })
  fixedAmount?: number

  @ApiProperty({
    description: 'Итоговая сумма скидки',
  })
  totalAmount!: number

  @ApiPropertyOptional({
    description: 'ID правила скидки',
  })
  discountRuleId?: string

  @ApiPropertyOptional({
    description: 'Промокод',
  })
  promoCode?: string
}

export class CartCalculationResponseDto {
  @ApiProperty({
    description: 'Детальный расчет по каждому товару',
    type: [ItemCalculationDto],
  })
  @Type(() => ItemCalculationDto)
  items!: ItemCalculationDto[]

  @ApiProperty({
    description: 'Сумма всех товаров без скидок',
  })
  subtotal!: number

  @ApiPropertyOptional({
    description: 'Примененная скидка',
    type: AppliedDiscountDto,
  })
  @Type(() => AppliedDiscountDto)
  appliedDiscount?: AppliedDiscountDto

  @ApiProperty({
    description: 'Общая сумма скидки',
  })
  totalDiscount!: number

  @ApiProperty({
    description: 'Итоговая сумма к оплате',
  })
  total!: number

  @ApiPropertyOptional({
    description: 'Доступные скидки, которые не были применены',
    type: [Object],
  })
  availableDiscounts?: Array<{
    type: string
    name: string
    percent: number
    reason: string
  }>

  @ApiPropertyOptional({
    description: 'Предупреждения',
    type: [String],
  })
  warnings?: string[]
}
