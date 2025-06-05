// src/modules/orders/dto/order-status-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

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

  static fromEntity(entity: any): OrderStatusResponseDto {
    return {
      id: entity.id,
      name: entity.name,
      code: entity.code,
      color: entity.color,
      description: entity.description,
    }
  }
}
