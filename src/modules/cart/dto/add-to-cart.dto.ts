// src/modules/cart/dto/add-to-cart.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'

export class AddToCartDto {
  @ApiPropertyOptional({
    description: 'ID товара из каталога',
  })
  @IsOptional()
  @IsString()
  productId?: string

  @ApiPropertyOptional({
    description: 'ID товара из чата',
  })
  @IsOptional()
  @IsString()
  chatProductId?: string

  @ApiProperty({
    description: 'Количество',
    minimum: 1,
    maximum: 999,
    default: 1,
  })
  @IsInt()
  @Min(1)
  @Max(999)
  @Type(() => Number)
  quantity!: number
}
