// src/modules/chat/dto/chat-response.dto.ts
import { MessageResponseDto } from './message-response.dto'

export class ChatResponseDto {
  id!: string
  userId?: string | null
  anonymousId?: string | null
  managerId?: string | null
  status!: {
    id: string
    name: string
    code: string
    color?: string | null
  }
  manager?: {
    id: string
    firstName?: string | null
    lastName?: string | null
  }
  user?: {
    id: string
    phone: string
    firstName?: string | null
    lastName?: string | null
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
