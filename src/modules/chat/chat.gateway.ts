// src/modules/chat/chat.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
  WsException,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { UseGuards, Injectable } from '@nestjs/common'
import { ChatService } from './chat.service'
import { SendMessageDto } from './dto/send-message.dto'
import { MessageResponseDto } from './dto/message-response.dto'
import { LoggerService } from '../../logger/logger.service'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { SenderType, MessageType, UserRole } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
@WebSocketGateway({
  namespace: 'chat',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server

  private userSockets = new Map<string, Set<string>>() // userId/sessionId -> Set<socketId>
  private socketToUser = new Map<string, string>() // socketId -> userId/sessionId
  private managerSockets = new Map<string, Set<string>>() // managerId -> Set<socketId>

  constructor(
    private chatService: ChatService,
    private logger: LoggerService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = client.handshake.auth.token || client.handshake.headers.authorization
      const anonymousToken = client.handshake.headers['x-anonymous-token']

      let user: any

      if (token) {
        // Авторизованный пользователь
        try {
          const payload = this.jwtService.verify(token.replace('Bearer ', ''), {
            secret: this.configService.get('jwt.access.secret'),
          })
          user = {
            userId: payload.userId,
            role: payload.role,
            type: 'authenticated',
          }
        } catch {
          client.disconnect()
          return
        }
      } else if (anonymousToken) {
        // Анонимный пользователь
        try {
          const anonymousTokenValue = Array.isArray(anonymousToken)
            ? anonymousToken[0]
            : anonymousToken
          const payload = this.jwtService.verify(anonymousTokenValue, {
            secret: this.configService.get('jwt.anonymous.secret'),
          })
          user = {
            sessionId: payload.sessionId,
            type: 'anonymous',
          }
        } catch {
          client.disconnect()
          return
        }
      } else {
        client.disconnect()
        return
      }

      // Сохраняем связь socket-user
      const userKey = user.userId || user.sessionId
      this.socketToUser.set(client.id, userKey)

      if (!this.userSockets.has(userKey)) {
        this.userSockets.set(userKey, new Set())
      }
      this.userSockets.get(userKey)!.add(client.id)

      // Если это менеджер, добавляем в отдельную коллекцию
      if (user.role === UserRole.MANAGER || user.role === UserRole.ADMIN) {
        if (!this.managerSockets.has(user.userId)) {
          this.managerSockets.set(user.userId, new Set())
        }
        this.managerSockets.get(user.userId)!.add(client.id)

        // Присоединяем к комнате менеджеров
        client.join('managers')
      }

      // Получаем активные чаты пользователя
      const chats = await this.chatService.getUserActiveChats(user.userId, user.sessionId)

      // Присоединяем к комнатам чатов
      for (const chat of chats) {
        client.join(`chat:${chat.id}`)

        // Отправляем последние сообщения
        const history = await this.chatService.getChatHistory(chat.id, 1, 50)
        client.emit('chatHistory', {
          chatId: chat.id,
          messages: history.data,
          status: chat.status,
        })
      }

      // Если это обычный пользователь с новым чатом, уведомляем менеджеров
      const chat = await this.chatService.getChat(chats[0]?.id)
      if (chat && chat.status.code === 'new' && !user.role) {
        this.server.to('managers').emit('newChat', {
          chatId: chat.id,
          user: user.userId ? { id: user.userId } : { sessionId: user.sessionId },
        })
      }

      this.logger.log(`Client connected: ${client.id}`, 'ChatGateway')
    } catch (error) {
      this.logger.error(
        'Connection error:',
        error instanceof Error ? error.message : String(error),
        'ChatGateway',
      )
      client.disconnect()
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    try {
      const userKey = this.socketToUser.get(client.id)

      if (userKey) {
        // Удаляем socket из коллекций
        const userSocketSet = this.userSockets.get(userKey)
        if (userSocketSet) {
          userSocketSet.delete(client.id)
          if (userSocketSet.size === 0) {
            this.userSockets.delete(userKey)
          }
        }

        // Если это был менеджер
        const managerSocketSet = this.managerSockets.get(userKey)
        if (managerSocketSet) {
          managerSocketSet.delete(client.id)
          if (managerSocketSet.size === 0) {
            this.managerSockets.delete(userKey)
          }
        }

        this.socketToUser.delete(client.id)
      }

      this.logger.log(`Client disconnected: ${client.id}`, 'ChatGateway')
    } catch (error) {
      this.logger.error(
        'Disconnect error:',
        error instanceof Error ? error.message : String(error),
        'ChatGateway',
      )
    }
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody() dto: SendMessageDto & { chatId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    try {
      const userKey = this.socketToUser.get(client.id)
      if (!userKey) {
        throw new WsException('Unauthorized')
      }

      // Определяем тип отправителя
      const user = await this.getUserFromSocket(client)
      const senderType = user.role ? SenderType.MANAGER : SenderType.CUSTOMER

      // Сохраняем сообщение
      const message = await this.chatService.saveMessage(dto.chatId, user.userId, senderType, dto)

      // Проверяем и обновляем статус чата
      const chat = await this.chatService.getChat(dto.chatId)
      if (chat?.status.code === 'new' && senderType === SenderType.CUSTOMER) {
        // Уведомляем менеджеров о новом сообщении в новом чате
        this.server.to('managers').emit('newMessage', {
          chatId: dto.chatId,
          message: this.formatMessage(message),
        })
      }

      // Отправляем сообщение всем участникам чата
      const formattedMessage = this.formatMessage(message)

      // Добавляем информацию об отправителе
      if (senderType === SenderType.CUSTOMER) {
        const chat = await this.chatService.getChat(dto.chatId)
        if (chat?.user) {
          formattedMessage.sender = {
            id: chat.user.id,
            name: chat.user.firstName || chat.user.phone,
            role: 'customer',
          }
        }
      } else if (senderType === SenderType.MANAGER) {
        const manager = await this.prisma.user.findUnique({
          where: { id: user.userId },
        })
        if (manager) {
          formattedMessage.sender = {
            id: manager.id,
            name: manager.firstName
              ? `${manager.firstName} ${manager.lastName || ''}`.trim()
              : 'Менеджер',
            role: 'manager',
          }
        }
      }

      this.server.to(`chat:${dto.chatId}`).emit('message', formattedMessage)
    } catch (error) {
      this.logger.error(
        'Send message error:',
        error instanceof Error ? error.message : String(error),
        'ChatGateway',
      )
      throw new WsException('Failed to send message')
    }
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @MessageBody() data: { chatId: string; isTyping: boolean },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    try {
      const userKey = this.socketToUser.get(client.id)
      if (!userKey) return

      const user = await this.getUserFromSocket(client)

      // Устанавливаем или убираем индикатор набора
      await this.chatService.setTyping(data.chatId, user.userId || userKey, data.isTyping)

      // Отправляем всем в чате, кроме отправителя
      client.to(`chat:${data.chatId}`).emit('typing', {
        chatId: data.chatId,
        userId: user.userId || userKey,
        isTyping: data.isTyping,
      })
    } catch (error) {
      this.logger.error(
        'Typing error:',
        error instanceof Error ? error.message : String(error),
        'ChatGateway',
      )
    }
  }

  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(
    @MessageBody() data: { chatId: string; messageId?: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    try {
      const userKey = this.socketToUser.get(client.id)
      if (!userKey) return

      // TODO: Implement mark as read logic

      // Уведомляем отправителя о прочтении
      client.to(`chat:${data.chatId}`).emit('messagesRead', {
        chatId: data.chatId,
        messageId: data.messageId,
        readBy: userKey,
      })
    } catch (error) {
      this.logger.error(
        'Mark as read error:',
        error instanceof Error ? error.message : String(error),
        'ChatGateway',
      )
    }
  }

  // Helper методы

  /**
   * Создать системное сообщение
   */
  async createSystemMessage(chatId: string, content: string): Promise<void> {
    const message = await this.chatService.saveMessage(chatId, undefined, SenderType.SYSTEM, {
      content,
      messageType: MessageType.SYSTEM,
    })

    this.server.to(`chat:${chatId}`).emit('message', this.formatMessage(message))
  }

  /**
   * Назначить менеджера на чат
   */
  async assignManagerToChat(chatId: string, managerId: string): Promise<void> {
    await this.chatService.assignManager(chatId, managerId)

    // Присоединяем менеджера к комнате чата
    const managerSockets = this.managerSockets.get(managerId)
    if (managerSockets) {
      managerSockets.forEach((socketId) => {
        const socket = this.server.sockets.sockets.get(socketId)
        if (socket) {
          socket.join(`chat:${chatId}`)
        }
      })
    }

    // Уведомляем всех в чате
    this.server.to(`chat:${chatId}`).emit('managerAssigned', {
      chatId,
      managerId,
    })
  }

  /**
   * Закрыть чат
   */
  async closeChat(chatId: string): Promise<void> {
    await this.chatService.updateChatStatus(chatId, 'closed')

    // Уведомляем всех в чате
    this.server.to(`chat:${chatId}`).emit('chatClosed', { chatId })

    // Удаляем всех из комнаты
    const room = this.server.sockets.adapter.rooms.get(`chat:${chatId}`)
    if (room) {
      room.forEach((socketId) => {
        const socket = this.server.sockets.sockets.get(socketId)
        if (socket) {
          socket.leave(`chat:${chatId}`)
        }
      })
    }
  }

  /**
   * Получить информацию о пользователе из socket
   */
  private async getUserFromSocket(client: Socket): Promise<any> {
    const token = client.handshake.auth.token || client.handshake.headers.authorization
    const anonymousToken = client.handshake.headers['x-anonymous-token']

    if (token) {
      try {
        const payload = this.jwtService.verify(token.replace('Bearer ', ''), {
          secret: this.configService.get('jwt.access.secret'),
        })
        return {
          userId: payload.userId,
          role: payload.role,
          type: 'authenticated',
        }
      } catch {
        throw new WsException('Invalid token')
      }
    } else if (anonymousToken) {
      try {
        const anonymousTokenValue = Array.isArray(anonymousToken)
          ? anonymousToken[0]
          : anonymousToken
        const payload = this.jwtService.verify(anonymousTokenValue, {
          secret: this.configService.get('jwt.anonymous.secret'),
        })
        return {
          sessionId: payload.sessionId,
          type: 'anonymous',
        }
      } catch {
        throw new WsException('Invalid anonymous token')
      }
    }

    throw new WsException('No authentication provided')
  }

  /**
   * Форматировать сообщение для отправки
   */
  private formatMessage(message: any): MessageResponseDto {
    const formatted: MessageResponseDto = {
      id: message.id,
      chatId: message.chatId,
      senderId: message.senderId,
      senderType: message.senderType,
      messageType: message.messageType,
      content: message.content,
      metadata: message.metadata,
      createdAt: message.createdAt,
    }

    // Добавляем информацию о карточке товара если есть
    if (message.messageType === MessageType.PRODUCT_CARD && message.chatProducts?.[0]) {
      formatted.chatProducts = [
        {
          id: message.chatProducts[0].id,
          name: message.chatProducts[0].name,
          brand: message.chatProducts[0].brand,
          sku: message.chatProducts[0].sku,
          price: Number(message.chatProducts[0].price),
          comparePrice: message.chatProducts[0].comparePrice
            ? Number(message.chatProducts[0].comparePrice)
            : undefined,
          isOriginal: message.chatProducts[0].isOriginal,
          deliveryDays: message.chatProducts[0].deliveryDays,
          description: message.chatProducts[0].description,
          images: message.chatProducts[0].images || [],
          createdAt: message.chatProducts[0].createdAt,
        },
      ]
    }

    return formatted
  }

  /**
   * Отправить карточку товара
   */
  async sendProductCard(
    chatId: string,
    managerId: string,
    content: string,
    productData: any,
  ): Promise<void> {
    try {
      const message = await this.chatService.createProductCardMessage(
        chatId,
        managerId,
        SenderType.MANAGER,
        content,
        productData,
      )

      const formattedMessage = this.formatMessage(message)

      // Добавляем информацию об отправителе
      const manager = await this.prisma.user.findUnique({
        where: { id: managerId },
      })
      if (manager) {
        formattedMessage.sender = {
          id: manager.id,
          name: manager.firstName
            ? `${manager.firstName} ${manager.lastName || ''}`.trim()
            : 'Менеджер',
          role: 'manager',
        }
      }

      this.server.to(`chat:${chatId}`).emit('message', formattedMessage)
    } catch (error) {
      this.logger.error(
        'Send product card error:',
        error instanceof Error ? error.message : String(error),
        'ChatGateway',
      )
      throw new WsException('Failed to send product card')
    }
  }
}
