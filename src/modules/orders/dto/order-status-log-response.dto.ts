// src/modules/orders/dto/order-status-log-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'

export class StatusLogUserDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  phone!: string

  @ApiPropertyOptional()
  firstName?: string | null

  @ApiPropertyOptional()
  lastName?: string | null

  @ApiProperty()
  role!: string
}

export class OrderStatusLogResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  orderId!: string

  @ApiProperty()
  statusId!: string

  @ApiProperty({
    description: 'Информация о статусе',
  })
  status!: {
    id: string
    name: string
    code: string
    color?: string | null
  }

  @ApiPropertyOptional()
  comment?: string | null

  @ApiProperty()
  createdById!: string

  @ApiProperty({
    type: StatusLogUserDto,
    description: 'Кто изменил статус',
  })
  @Type(() => StatusLogUserDto)
  createdBy!: StatusLogUserDto

  @ApiProperty()
  createdAt!: Date
}
