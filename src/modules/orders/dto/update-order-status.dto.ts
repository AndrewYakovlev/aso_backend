// src/modules/orders/dto/update-order-status.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsString, IsOptional, MaxLength } from 'class-validator'

export class UpdateOrderStatusDto {
  @ApiProperty({
    description: 'ID нового статуса',
  })
  @IsString()
  statusId!: string

  @ApiPropertyOptional({
    description: 'Комментарий к изменению статуса',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string
}
