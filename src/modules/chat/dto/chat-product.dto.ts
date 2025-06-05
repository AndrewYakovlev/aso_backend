// src/modules/chat/dto/chat-product.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsArray,
  ValidateNested,
  Min,
  MaxLength,
  IsUrl,
  IsInt,
} from 'class-validator'
import { Type } from 'class-transformer'

export class ChatProductImageDto {
  @ApiProperty({
    description: 'URL изображения',
    example: 'https://example.com/image.jpg',
  })
  @IsUrl()
  url!: string

  @ApiPropertyOptional({
    description: 'Alt текст для изображения',
    example: 'Моторное масло Castrol 5W-40',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  alt?: string

  @ApiPropertyOptional({
    description: 'Порядок сортировки',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number
}

export class CreateChatProductDto {
  @ApiProperty({
    description: 'Название товара',
    example: 'Моторное масло Castrol EDGE 5W-40',
  })
  @IsString()
  @MaxLength(255)
  name!: string

  @ApiProperty({
    description: 'Бренд',
    example: 'Castrol',
  })
  @IsString()
  @MaxLength(100)
  brand!: string

  @ApiProperty({
    description: 'Артикул',
    example: 'CAST-EDGE-5W40-4L',
  })
  @IsString()
  @MaxLength(100)
  sku!: string

  @ApiProperty({
    description: 'Цена',
    example: 3500,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price!: number

  @ApiPropertyOptional({
    description: 'Цена до скидки',
    example: 4000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  comparePrice?: number

  @ApiPropertyOptional({
    description: 'Оригинальная запчасть',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isOriginal?: boolean

  @ApiPropertyOptional({
    description: 'Срок доставки в днях',
    example: 3,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  deliveryDays?: number

  @ApiPropertyOptional({
    description: 'Описание товара',
    example: 'Синтетическое моторное масло для современных двигателей',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string

  @ApiPropertyOptional({
    description: 'Изображения товара',
    type: [ChatProductImageDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatProductImageDto)
  images?: ChatProductImageDto[]
}

export class SendProductCardDto {
  @ApiProperty({
    description: 'Текст сообщения',
    example: 'Рекомендую этот товар',
  })
  @IsString()
  @MaxLength(1000)
  content!: string

  @ApiProperty({
    description: 'Данные товара',
    type: CreateChatProductDto,
  })
  @ValidateNested()
  @Type(() => CreateChatProductDto)
  product!: CreateChatProductDto
}

export class ChatProductResponseDto {
  id!: string
  name!: string
  brand!: string
  sku!: string
  price!: number
  comparePrice?: number
  isOriginal!: boolean
  deliveryDays?: number
  description?: string
  images!: {
    id: string
    url: string
    alt?: string
    sortOrder: number
  }[]
  createdAt!: Date

  get discountPercent(): number | null {
    if (!this.comparePrice || this.comparePrice <= this.price) {
      return null
    }
    return Math.round(((this.comparePrice - this.price) / this.comparePrice) * 100)
  }
}
