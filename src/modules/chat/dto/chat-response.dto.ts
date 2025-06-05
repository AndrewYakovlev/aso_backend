// src/modules/chat/dto/chat-response.dto.ts
import { MessageResponseDto } from './message-response.dto'

export class ChatResponseDto {
  id!: string
  userId?: string
  anonymousId?: string
  managerId?: string
  status!: {
    id: string
    name: string
    code: string
    color?: string
  }
  manager?: {
    id: string
    firstName?: string
    lastName?: string
  }
  user?: {
    id: string
    phone: string
    firstName?: string
    lastName?: string
  }
  anonymousUser?: {
    id: string
    sessionId: string
  }
  createdAt!: Date
  updatedAt!: Date
  lastMessage?: MessageResponseDto
  unreadCount?: number
  totalMessages?: number
  metrics?: {
    totalMessages?: number
    firstResponseTime?: number
    averageResponseTime?: number
    lastMessageAt?: Date
  }
}
