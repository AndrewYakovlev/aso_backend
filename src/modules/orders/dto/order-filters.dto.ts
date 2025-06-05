// src/modules/orders/dto/order-filters.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, IsInt, Min, Max, IsDateString, IsArray } from 'class-validator'
import { Type, Transform } from 'class-transformer'

export class OrderFiltersDto {
  @ApiPropertyOptional({
    description: 'Номер страницы',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1

  @ApiPropertyOptional({
    description: 'Количество элементов на странице',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20

  @ApiPropertyOptional({
    description: 'Поиск по номеру заказа',
  })
  @IsOptional()
  @IsString()
  search?: string

  @ApiPropertyOptional({
    description: 'Фильтр по статусу',
  })
  @IsOptional()
  @IsString()
  statusId?: string

  @ApiPropertyOptional({
    description: 'Фильтр по нескольким статусам',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @Transform(({ value }) => (typeof value === 'string' ? [value] : value))
  statusIds?: string[]

  @ApiPropertyOptional({
    description: 'Фильтр по пользователю',
  })
  @IsOptional()
  @IsString()
  userId?: string

  @ApiPropertyOptional({
    description: 'Дата создания от',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string

  @ApiPropertyOptional({
    description: 'Дата создания до',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string
}
