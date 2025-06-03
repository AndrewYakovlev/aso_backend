// src/modules/auth/dto/send-otp.dto.ts
import { ApiProperty } from '@nestjs/swagger'
import { IsString, Matches } from 'class-validator'

export class SendOtpDto {
  @ApiProperty({
    description: 'Номер телефона в формате +7XXXXXXXXXX',
    example: '+79001234567',
  })
  @IsString()
  @Matches(/^\+7\d{10}$/, {
    message: 'Номер телефона должен быть в формате +7XXXXXXXXXX',
  })
  phone!: string
}
