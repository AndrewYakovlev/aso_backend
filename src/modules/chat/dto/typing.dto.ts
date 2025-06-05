// src/modules/chat/dto/typing.dto.ts
import { IsBoolean } from 'class-validator'

export class TypingDto {
  @IsBoolean()
  isTyping!: boolean
}
