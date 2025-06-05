// src/modules/notifications/dto/test-notification.dto.ts
import { ApiProperty } from '@nestjs/swagger'
import { IsString } from 'class-validator'

export class TestNotificationDto {
  @ApiProperty()
  @IsString()
  title!: string

  @ApiProperty()
  @IsString()
  body!: string
}
