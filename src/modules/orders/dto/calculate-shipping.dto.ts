// src/modules/orders/dto/calculate-shipping.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsString, IsNumber, IsOptional, Min } from 'class-validator'
import { Type } from 'class-transformer'

export class CalculateShippingDto {
  @ApiProperty({
    description: 'ID метода доставки',
  })
  @IsString()
  deliveryMethodId!: string

  @ApiProperty({
    description: 'Сумма заказа',
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  orderAmount!: number

  @ApiPropertyOptional({
    description: 'Адрес доставки для расчета (для будущих расширений)',
  })
  @IsOptional()
  shippingAddress?: any
}

export class ShippingCalculationResponseDto {
  @ApiProperty({
    description: 'ID метода доставки',
  })
  deliveryMethodId!: string

  @ApiProperty({
    description: 'Название метода доставки',
  })
  deliveryMethodName!: string

  @ApiProperty({
    description: 'Базовая стоимость доставки',
  })
  basePrice!: number

  @ApiProperty({
    description: 'Расчетная стоимость доставки',
  })
  calculatedPrice!: number

  @ApiProperty({
    description: 'Применена бесплатная доставка',
  })
  isFreeShipping!: boolean

  @ApiPropertyOptional({
    description: 'Минимальная сумма для бесплатной доставки',
  })
  freeShippingThreshold?: number

  @ApiPropertyOptional({
    description: 'Сколько не хватает до бесплатной доставки',
  })
  amountToFreeShipping?: number
}
