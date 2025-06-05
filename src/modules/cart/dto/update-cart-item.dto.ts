// src/modules/cart/dto/update-cart-item.dto.ts
import { ApiProperty } from '@nestjs/swagger'
import { IsInt, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'

export class UpdateCartItemDto {
  @ApiProperty({
    description: 'Новое количество',
    minimum: 1,
    maximum: 999,
  })
  @IsInt()
  @Min(1)
  @Max(999)
  @Type(() => Number)
  quantity!: number
}
