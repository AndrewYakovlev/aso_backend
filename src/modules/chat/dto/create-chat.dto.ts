// src/modules/chat/dto/create-chat.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsString, IsOptional } from 'class-validator'

export class CreateChatDto {
  @ApiPropertyOptional({
    description: 'Первое сообщение в чате',
  })
  @IsOptional()
  @IsString()
  initialMessage?: string
}
