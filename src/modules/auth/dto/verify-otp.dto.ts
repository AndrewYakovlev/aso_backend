// src/modules/auth/dto/verify-otp.dto.ts
import { ApiProperty } from '@nestjs/swagger'
import { IsString, Matches, Length } from 'class-validator'

export class VerifyOtpDto {
  @ApiProperty({
    description: 'Номер телефона в формате +7XXXXXXXXXX',
    example: '+79001234567',
  })
  @IsString()
  @Matches(/^\+7\d{10}$/, {
    message: 'Номер телефона должен быть в формате +7XXXXXXXXXX',
  })
  phone: string

  @ApiProperty({
    description: 'OTP код',
    example: '123456',
  })
  @IsString()
  @Length(4, 6)
  code: string
}
