// src/modules/chat/dto/send-message.dto.ts
import { IsString, IsEnum, IsOptional, MaxLength, IsObject } from 'class-validator'
import { MessageType } from '@prisma/client'

export class SendMessageDto {
  @IsString()
  @MaxLength(5000)
  content!: string

  @IsEnum(MessageType)
  @IsOptional()
  messageType?: MessageType = MessageType.TEXT

  @IsObject()
  @IsOptional()
  metadata?: any
}
