// src/modules/notifications/dto/create-push-subscription.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsString, IsObject, IsOptional } from 'class-validator'

export class PushKeysDto {
  @ApiProperty()
  @IsString()
  p256dh!: string

  @ApiProperty()
  @IsString()
  auth!: string
}

export class CreatePushSubscriptionDto {
  @ApiProperty()
  @IsString()
  endpoint!: string

  @ApiProperty()
  @IsObject()
  keys!: PushKeysDto

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userAgent?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceName?: string
}
