// src/modules/chat/dto/message-response.dto.ts
import { MessageType, SenderType } from '@prisma/client'

export class MessageResponseDto {
  id!: string
  chatId!: string
  senderId?: string
  senderType!: SenderType
  messageType!: MessageType
  content!: string
  metadata?: any
  createdAt!: Date
  sender?: {
    id: string
    name: string
    role?: string
  }
  chatProducts?: any[]
}
