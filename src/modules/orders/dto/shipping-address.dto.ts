// src/modules/orders/dto/shipping-address.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsString, IsOptional, IsPhoneNumber, IsEmail, MaxLength } from 'class-validator'

export class ShippingAddressDto {
  @ApiProperty({ description: 'ФИО получателя' })
  @IsString()
  @MaxLength(200)
  fullName!: string

  @ApiProperty({ description: 'Телефон получателя' })
  @IsPhoneNumber('RU')
  phone!: string

  @ApiPropertyOptional({ description: 'Email для уведомлений' })
  @IsOptional()
  @IsEmail()
  email?: string

  @ApiProperty({ description: 'Город' })
  @IsString()
  @MaxLength(100)
  city!: string

  @ApiProperty({ description: 'Улица' })
  @IsString()
  @MaxLength(200)
  street!: string

  @ApiProperty({ description: 'Дом' })
  @IsString()
  @MaxLength(20)
  building!: string

  @ApiPropertyOptional({ description: 'Квартира/офис' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  apartment?: string

  @ApiPropertyOptional({ description: 'Почтовый индекс' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  postalCode?: string

  @ApiPropertyOptional({ description: 'Комментарий к адресу' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string
}
