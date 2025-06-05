// src/modules/notifications/dto/update-notification-settings.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsString, IsArray, IsOptional } from 'class-validator'

export class UpdateNotificationSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  newChat?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  newMessage?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  chatAssigned?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  chatStatusChanged?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  orderStatusChanged?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enableSchedule?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scheduleStart?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scheduleEnd?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scheduleTimezone?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  scheduleDays?: number[]

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  soundEnabled?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  vibrationEnabled?: boolean
}
