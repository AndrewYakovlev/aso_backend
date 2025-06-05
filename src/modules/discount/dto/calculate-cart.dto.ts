// src/modules/discount/dto/calculate-cart.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsString, IsOptional, IsArray } from 'class-validator'
import { CartItemResponseDto } from '../../cart/dto/cart-response.dto'

export class CalculateCartDto {
  @ApiProperty({
    description: 'Элементы корзины',
    type: [CartItemResponseDto],
  })
  @IsArray()
  items!: CartItemResponseDto[]

  @ApiPropertyOptional({
    description: 'Код промокода',
  })
  @IsOptional()
  @IsString()
  promoCode?: string

  @ApiPropertyOptional({
    description: 'ID пользователя для расчета персональных скидок',
  })
  @IsOptional()
  @IsString()
  userId?: string
}
