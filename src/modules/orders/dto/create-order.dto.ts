// src/modules/orders/dto/create-order.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsString,
  IsOptional,
  IsObject,
  ValidateNested,
  IsPhoneNumber,
  IsEmail,
  MaxLength,
} from 'class-validator'
import { Type } from 'class-transformer'

export class ShippingAddressDto {
  @ApiProperty({
    description: 'ФИО получателя',
  })
  @IsString()
  @MaxLength(200)
  fullName!: string

  @ApiProperty({
    description: 'Телефон получателя',
  })
  @IsPhoneNumber('RU')
  phone!: string

  @ApiPropertyOptional({
    description: 'Email для уведомлений',
  })
  @IsOptional()
  @IsEmail()
  email?: string

  @ApiProperty({
    description: 'Город',
  })
  @IsString()
  @MaxLength(100)
  city!: string

  @ApiProperty({
    description: 'Улица',
  })
  @IsString()
  @MaxLength(200)
  street!: string

  @ApiProperty({
    description: 'Дом',
  })
  @IsString()
  @MaxLength(20)
  building!: string

  @ApiPropertyOptional({
    description: 'Квартира/офис',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  apartment?: string

  @ApiPropertyOptional({
    description: 'Почтовый индекс',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  postalCode?: string

  @ApiPropertyOptional({
    description: 'Комментарий к адресу',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string
}

export class CreateOrderDto {
  @ApiProperty({
    description: 'ID метода доставки',
  })
  @IsString()
  deliveryMethodId!: string

  @ApiProperty({
    description: 'ID метода оплаты',
  })
  @IsString()
  paymentMethodId!: string

  @ApiProperty({
    description: 'Адрес доставки',
    type: ShippingAddressDto,
  })
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress!: ShippingAddressDto

  @ApiPropertyOptional({
    description: 'Комментарий к заказу',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string

  @ApiPropertyOptional({
    description: 'Промокод',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  promoCode?: string
}
