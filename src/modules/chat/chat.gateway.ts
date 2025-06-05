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
import { UseGuards, UsePipes, ValidationPipe } from '@nestjs/common'
import { ChatService } from './chat.service'
import { LoggerService } from '../../logger/logger.service'
import { WsAuthGuard } from './guards/ws-auth.guard'
import { SendMessageDto } from './dto/send-message.dto'
import { TypingDto } from './dto/typing.dto'
import { SenderType, UserRole } from '@prisma/client'
import { SendProductCardDto } from './dto/chat-product.dto'
import { NotificationsService } from '@modules/notifications/notifications.service'

interface SocketUser {
  userId?: string
  sessionId?: string
  isAnonymous: boolean
  role?: UserRole
}

@WebSocketGateway({
  namespace: 'chat',
  cors: {
    origin: process.env.SOCKET_CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
  },
})
@UseGuards(WsAuthGuard)
@UsePipes(new ValidationPipe({ transform: true }))
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server

  private userSockets = new Map<string, Set<string>>() // userId/sessionId -> socketIds
  private socketChats = new Map<string, string>() // socketId -> chatId

  constructor(
    private chatService: ChatService,
    private logger: LoggerService,
    private notificationsService: NotificationsService, // Добавляем
  ) {}

  async handleConnection(client: Socket) {
    try {
      const user: SocketUser = client.data.user
      const userKey = user.isAnonymous ? user.sessionId! : user.userId!

      // Добавляем сокет в мапу пользователя
      if (!this.userSockets.has(userKey)) {
        this.userSockets.set(userKey, new Set())
      }
      this.userSockets.get(userKey)!.add(client.id)

      // Создаем или получаем чат
      const chat = await this.chatService.createOrGetChat(
        user.isAnonymous ? undefined : user.userId,
        user.isAnonymous ? user.sessionId : undefined,
      )

      // Присоединяем к комнате чата
      await client.join(`chat:${chat.id}`)
      this.socketChats.set(client.id, chat.id)

      // Если это менеджер, присоединяем к комнате менеджеров
      if (user.role === UserRole.MANAGER || user.role === UserRole.ADMIN) {
        await client.join('managers')

        // Если чат не назначен, назначаем этого менеджера
        if (!chat.managerId && user.userId) {
          await this.chatService.assignManager(chat.id, user.userId)
          this.server.to(`chat:${chat.id}`).emit('managerAssigned', {
            managerId: user.userId,
            chatId: chat.id,
          })
        }
      }

      // Отправляем историю чата
      const messages = await this.chatService.getChatHistory(chat.id)
      client.emit('chatHistory', {
        chatId: chat.id,
        messages,
        chat: {
          id: chat.id,
          status: chat.status,
          managerId: chat.managerId,
        },
      })

      // Уведомляем менеджеров о новом чате
      if (chat.status.code === 'new' && !user.role) {
        this.server.to('managers').emit('newChat', {
          chatId: chat.id,
          userId: chat.userId,
          isAnonymous: !chat.userId,
        })

        // Отправляем push уведомление
        await this.notificationsService.notifyNewChat(chat)
      }

      this.logger.log(`User ${userKey} connected to chat ${chat.id}`, 'ChatGateway')
    } catch (error) {
      this.logger.error('Connection error:', error, 'ChatGateway')
      client.disconnect()
    }
  }

  async handleDisconnect(client: Socket) {
    try {
      const user: SocketUser = client.data.user
      if (!user) return

      const userKey = user.isAnonymous ? user.sessionId! : user.userId!
      const chatId = this.socketChats.get(client.id)

      // Удаляем сокет из мапы
      const userSocketSet = this.userSockets.get(userKey)
      if (userSocketSet) {
        userSocketSet.delete(client.id)
        if (userSocketSet.size === 0) {
          this.userSockets.delete(userKey)

          // Очищаем typing статус
          if (chatId) {
            await this.chatService.setTyping(chatId, userKey, false)
            this.server.to(`chat:${chatId}`).emit('typing', {
              userId: userKey,
              isTyping: false,
            })
          }
        }
      }

      this.socketChats.delete(client.id)
      this.logger.log(`User ${userKey} disconnected`, 'ChatGateway')
    } catch (error) {
      this.logger.error('Disconnect error:', error, 'ChatGateway')
    }
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(@MessageBody() dto: SendMessageDto, @ConnectedSocket() client: Socket) {
    try {
      const user: SocketUser = client.data.user
      const chatId = this.socketChats.get(client.id)

      if (!chatId) {
        throw new WsException('Chat not found')
      }

      // Определяем тип отправителя
      const senderType = user.role ? SenderType.MANAGER : SenderType.CUSTOMER
      const senderId = user.isAnonymous ? undefined : user.userId

      // Сохраняем сообщение
      const message = await this.chatService.saveMessage(chatId, senderId, senderType, dto)
      const formattedMessage = this.formatMessageResponse(message, user)

      // Отправляем сообщение всем в комнате чата
      this.server.to(`chat:${chatId}`).emit('message', formattedMessage)

      // Обновляем статус чата если нужно
      const chat = await this.chatService.getChat(chatId)
      if (chat?.status.code === 'new' && senderType === SenderType.CUSTOMER) {
        await this.chatService.updateChatStatus(chatId, 'in_progress')
        this.server.to(`chat:${chatId}`).emit('statusChanged', {
          chatId,
          status: 'in_progress',
        })
      }

      // Определяем имя отправителя
      let senderName = 'Неизвестный'
      if (senderType === SenderType.CUSTOMER) {
        const chat = await this.chatService.getChat(chatId)
        if (chat?.user) {
          senderName = chat.user.firstName || chat.user.phone
        } else {
          senderName = 'Гость'
        }
      } else if (senderType === SenderType.MANAGER) {
        const manager = await this.prisma.user.findUnique({
          where: { id: senderId },
        })
        senderName = manager?.firstName || 'Менеджер'
      }

      // Отправляем push уведомление
      await this.notificationsService.notifyNewMessage(message, senderName)

      // Очищаем typing статус
      const userKey = user.isAnonymous ? user.sessionId! : user.userId!
      await this.chatService.setTyping(chatId, userKey, false)

      this.logger.logBusinessEvent('message_sent', senderId, {
        chatId,
        messageType: dto.messageType,
        senderType,
      })
    } catch (error) {
      this.logger.error('Send message error:', error, 'ChatGateway')
      throw new WsException('Failed to send message')
    }
  }

  @SubscribeMessage('typing')
  async handleTyping(@MessageBody() dto: TypingDto, @ConnectedSocket() client: Socket) {
    try {
      const user: SocketUser = client.data.user
      const chatId = this.socketChats.get(client.id)

      if (!chatId) {
        throw new WsException('Chat not found')
      }

      const userKey = user.isAnonymous ? user.sessionId! : user.userId!
      await this.chatService.setTyping(chatId, userKey, dto.isTyping)

      // Отправляем всем кроме отправителя
      client.to(`chat:${chatId}`).emit('typing', {
        userId: userKey,
        isTyping: dto.isTyping,
        isManager: !!user.role,
      })
    } catch (error) {
      this.logger.error('Typing error:', error, 'ChatGateway')
    }
  }

  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(
    @MessageBody() data: { messageIds: string[] },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const chatId = this.socketChats.get(client.id)
      if (!chatId) {
        throw new WsException('Chat not found')
      }

      // TODO: Implement read receipts if needed
      client.to(`chat:${chatId}`).emit('messagesRead', {
        messageIds: data.messageIds,
        userId: client.data.user.userId || client.data.user.sessionId,
      })
    } catch (error) {
      this.logger.error('Mark as read error:', error, 'ChatGateway')
    }
  }

  // Вспомогательный метод для отправки сообщения в конкретный чат
  async sendMessageToChat(chatId: string, message: any) {
    this.server.to(`chat:${chatId}`).emit('message', message)
  }

  // Метод для отправки системных уведомлений
  async sendSystemMessage(chatId: string, content: string) {
    const message = await this.chatService.saveMessage(chatId, undefined, SenderType.SYSTEM, {
      content,
      messageType: MessageType.SYSTEM,
    })

    this.server.to(`chat:${chatId}`).emit('message', {
      ...message,
      sender: { name: 'Система', role: 'system' },
    })
  }

  // Обновляем метод formatMessageResponse для поддержки карточек товаров
  private formatMessageResponse(message: any, user: SocketUser) {
    let senderName = 'Неизвестный'

    if (message.senderType === SenderType.CUSTOMER) {
      if (message.chat?.user) {
        const u = message.chat.user
        senderName = u.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : u.phone
      } else {
        senderName = 'Гость'
      }
    } else if (message.senderType === SenderType.MANAGER && message.chat?.manager) {
      const m = message.chat.manager
      senderName = m.firstName ? `${m.firstName} ${m.lastName || ''}`.trim() : 'Менеджер'
    } else if (message.senderType === SenderType.SYSTEM) {
      senderName = 'Система'
    }

    const response: any = {
      id: message.id,
      chatId: message.chatId,
      senderId: message.senderId,
      senderType: message.senderType,
      messageType: message.messageType,
      content: message.content,
      metadata: message.metadata,
      createdAt: message.createdAt,
      sender: {
        id: message.senderId || 'system',
        name: senderName,
        role: message.senderType.toLowerCase(),
      },
    }

    // Добавляем карточки товаров если есть
    if (message.chatProducts && message.chatProducts.length > 0) {
      response.chatProducts = message.chatProducts.map((cp: any) => ({
        id: cp.id,
        name: cp.name,
        brand: cp.brand,
        sku: cp.sku,
        price: Number(cp.price),
        comparePrice: cp.comparePrice ? Number(cp.comparePrice) : undefined,
        isOriginal: cp.isOriginal,
        deliveryDays: cp.deliveryDays,
        description: cp.description,
        images: cp.images || [],
        createdAt: cp.createdAt,
      }))
    }

    return response
  }

  // Добавляем новый обработчик события

  @SubscribeMessage('sendProductCard')
  @UseGuards(WsAuthGuard)
  async handleSendProductCard(
    @MessageBody() dto: SendProductCardDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const user: SocketUser = client.data.user
      const chatId = this.socketChats.get(client.id)

      if (!chatId) {
        throw new WsException('Chat not found')
      }

      // Только менеджеры могут отправлять карточки товаров
      if (!user.role || user.role === UserRole.CUSTOMER) {
        throw new WsException('Only managers can send product cards')
      }

      const senderId = user.userId

      // Создаем сообщение с карточкой товара
      const message = await this.chatService.createProductCardMessage(
        chatId,
        senderId,
        SenderType.MANAGER,
        dto.content,
        dto.product,
      )

      const formattedMessage = this.formatMessageResponse(message, user)

      // Отправляем сообщение всем в комнате чата
      this.server.to(`chat:${chatId}`).emit('productCard', formattedMessage)

      // Уведомляем клиента о новом товарном предложении
      const customerSocketIds = this.getCustomerSocketsInChat(chatId)
      customerSocketIds.forEach((socketId) => {
        this.server.to(socketId).emit('newProductOffer', {
          chatId,
          product: message.chatProducts[0],
          message: formattedMessage,
        })
      })

      this.logger.logBusinessEvent('product_card_sent_ws', senderId, {
        chatId,
        productSku: dto.product.sku,
      })
    } catch (error) {
      this.logger.error('Send product card error:', error, 'ChatGateway')
      throw new WsException('Failed to send product card')
    }
  }

  // Добавляем вспомогательный метод
  private getCustomerSocketsInChat(chatId: string): string[] {
    const sockets: string[] = []

    for (const [socketId, chatIdInMap] of this.socketChats) {
      if (chatIdInMap === chatId) {
        const socket = this.server.sockets.sockets.get(socketId)
        if (socket && !socket.data.user.role) {
          sockets.push(socketId)
        }
      }
    }

    return sockets
  }
}
