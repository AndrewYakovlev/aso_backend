// src/modules/chat/chat.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { RedisService } from '../../redis/redis.service'
import { LoggerService } from '../../logger/logger.service'
import {
  Chat,
  Message,
  ChatStatus,
  SenderType,
  MessageType,
  Prisma,
  UserRole,
  User,
  AnonymousUser,
} from '@prisma/client'
import { SendMessageDto } from './dto/send-message.dto'
import { MessageResponseDto } from './dto/message-response.dto'
import { ChatResponseDto } from './dto/chat-response.dto'
import { CacheKeys, CacheTTL } from '../../redis/redis.constants'
import { UsersService } from '../users/users.service'
import { AnonymousUsersService } from '../users/anonymous-users.service'
import { PaginatedResult } from '@common/interfaces/paginated-result.interface'
import { PaginationUtil } from '@common/utils/pagination.util'
import { CreateChatProductDto, ChatProductResponseDto } from './dto/chat-product.dto'

export interface ChatMetrics {
  averageResponseTime: number // в секундах
  totalMessages: number
  customerMessages: number
  managerMessages: number
  firstResponseTime?: number // время до первого ответа менеджера в секундах
  lastMessageAt?: Date
  resolvedAt?: Date
}

export interface ChatStats {
  totalChats: number
  activeChats: number
  closedChats: number
  averageResponseTime: number
  averageMessagesPerChat: number
  chatsByStatus: Record<string, number>
}

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private logger: LoggerService,
    private usersService: UsersService,
    private anonymousUsersService: AnonymousUsersService,
  ) {}

  /**
   * Создать или получить существующий активный чат
   */
  async createOrGetChat(
    userId?: string,
    sessionId?: string,
  ): Promise<
    Chat & {
      status: ChatStatus
      manager?: User | null
    }
  > {
    if (!userId && !sessionId) {
      throw new BadRequestException('User ID or session ID is required')
    }

    // Ищем существующий активный чат
    const existingChat = await this.prisma.chat.findFirst({
      where: {
        OR: [
          { userId, status: { code: { not: 'closed' } } },
          { anonymousUser: { sessionId }, status: { code: { not: 'closed' } } },
        ],
      },
      include: {
        status: true,
        manager: true,
      },
    })

    if (existingChat) {
      return existingChat as Chat & { status: ChatStatus; manager?: User | null }
    }

    // Получаем начальный статус
    const newStatus = await this.prisma.chatStatus.findFirst({
      where: { code: 'new' },
    })

    if (!newStatus) {
      throw new Error('Chat status "new" not found in database')
    }

    // Создаем новый чат
    const chat = await this.prisma.chat.create({
      data: {
        userId,
        anonymousId: sessionId
          ? (
              await this.prisma.anonymousUser.findUnique({
                where: { sessionId },
              })
            )?.id
          : undefined,
        statusId: newStatus.id,
      },
      include: {
        status: true,
        manager: true,
      },
    })

    // Инициализируем метрики в Redis
    await this.initializeChatMetrics(chat.id)

    this.logger.logBusinessEvent('chat_created', userId || sessionId, {
      chatId: chat.id,
      isAnonymous: !!sessionId,
    })

    return chat as Chat & { status: ChatStatus; manager?: User | null }
  }

  /**
   * Получить чат по ID с проверкой доступа
   */
  async getChatWithAccess(
    chatId: string,
    userId?: string,
    sessionId?: string,
    role?: UserRole,
  ): Promise<Chat> {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        status: true,
        manager: true,
        user: true,
        anonymousUser: true,
      },
    })

    if (!chat) {
      throw new NotFoundException('Chat not found')
    }

    // Проверка доступа
    const isManager = role === UserRole.MANAGER || role === UserRole.ADMIN
    const isOwner =
      (chat.userId && chat.userId === userId) ||
      (chat.anonymousUser && chat.anonymousUser.sessionId === sessionId)

    if (!isManager && !isOwner) {
      throw new ForbiddenException('Access denied to this chat')
    }

    return chat
  }

  /**
   * Получить историю чата с пагинацией
   */
  async getChatHistory(
    chatId: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<PaginatedResult<MessageResponseDto>> {
    const { page: validPage, limit: validLimit } = PaginationUtil.validatePagination(page, limit)
    const skip = PaginationUtil.getSkip(validPage, validLimit)

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { chatId },
        include: {
          chatProducts: true,
        },
        orderBy: { createdAt: 'desc' },
        take: validLimit,
        skip,
      }),
      this.prisma.message.count({ where: { chatId } }),
    ])

    // Получаем информацию о чате для форматирования сообщений
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        user: true,
        manager: true,
      },
    })

    const formattedMessages = messages.reverse().map((msg) => this.formatMessage({ ...msg, chat }))

    return PaginationUtil.createPaginatedResult(formattedMessages, total, validPage, validLimit)
  }

  /**
   * Сохранить сообщение и обновить метрики
   */
  async saveMessage(
    chatId: string,
    senderId: string | undefined,
    senderType: SenderType,
    dto: SendMessageDto,
  ): Promise<Message> {
    const message = await this.prisma.message.create({
      data: {
        chatId,
        senderId,
        senderType,
        messageType: dto.messageType || MessageType.TEXT,
        content: dto.content,
        metadata: dto.metadata,
      },
      include: {
        chat: {
          include: {
            user: true,
            manager: true,
          },
        },
      },
    })

    // Обновляем время последней активности чата
    await this.prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
    })

    // Кешируем последнее сообщение
    await this.redis.set(`${CacheKeys.CHAT}last-message:${chatId}`, message, CacheTTL.CHAT_MESSAGE)

    // Обновляем метрики
    await this.updateChatMetrics(chatId, senderType)

    // Если это первый ответ менеджера, фиксируем время
    if (senderType === SenderType.MANAGER) {
      await this.recordFirstManagerResponse(chatId)
    }

    return message
  }

  /**
   * Назначить менеджера на чат
   */
  async assignManager(chatId: string, managerId: string): Promise<void> {
    const chat = await this.getChat(chatId)
    if (!chat) {
      throw new NotFoundException('Chat not found')
    }

    await this.prisma.chat.update({
      where: { id: chatId },
      data: { managerId },
    })

    // Создаем системное сообщение
    await this.saveMessage(chatId, managerId, SenderType.SYSTEM, {
      content: 'Менеджер подключился к чату',
      messageType: MessageType.SYSTEM,
    })

    // Меняем статус если чат новый
    if (chat.status.code === 'new') {
      await this.updateChatStatus(chatId, 'in_progress')
    }

    this.logger.logBusinessEvent('manager_assigned', managerId, {
      chatId,
    })
  }

  /**
   * Изменить статус чата
   */
  async updateChatStatus(chatId: string, statusCode: string): Promise<void> {
    const status = await this.prisma.chatStatus.findUnique({
      where: { code: statusCode },
    })

    if (!status) {
      throw new NotFoundException('Status not found')
    }

    const updateData: Prisma.ChatUpdateInput = {
      status: { connect: { id: status.id } },
    }

    if (statusCode === 'closed') {
      updateData.closedAt = new Date()
      // Сохраняем время закрытия в метриках
      await this.redis.hset(`${CacheKeys.CHAT}metrics:${chatId}`, 'resolvedAt', new Date())
    }

    await this.prisma.chat.update({
      where: { id: chatId },
      data: updateData,
    })

    this.logger.logBusinessEvent('chat_status_changed', undefined, {
      chatId,
      newStatus: statusCode,
    })
  }

  /**
   * Получить метрики чата
   */
  async getChatMetrics(chatId: string): Promise<ChatMetrics> {
    const metricsKey = `${CacheKeys.CHAT}metrics:${chatId}`
    const cachedMetrics = await this.redis.hgetall<any>(metricsKey)

    if (Object.keys(cachedMetrics).length > 0) {
      return {
        averageResponseTime: parseFloat(cachedMetrics.averageResponseTime || '0'),
        totalMessages: parseInt(cachedMetrics.totalMessages || '0'),
        customerMessages: parseInt(cachedMetrics.customerMessages || '0'),
        managerMessages: parseInt(cachedMetrics.managerMessages || '0'),
        firstResponseTime: cachedMetrics.firstResponseTime
          ? parseFloat(cachedMetrics.firstResponseTime)
          : undefined,
        lastMessageAt: cachedMetrics.lastMessageAt
          ? new Date(cachedMetrics.lastMessageAt)
          : undefined,
        resolvedAt: cachedMetrics.resolvedAt ? new Date(cachedMetrics.resolvedAt) : undefined,
      }
    }

    // Если нет в кеше, вычисляем из БД
    const metrics = await this.calculateChatMetrics(chatId)

    // Кешируем на час
    await this.redis.expire(metricsKey, CacheTTL.CHAT_MESSAGE)

    return metrics
  }

  /**
   * Получить статистику по всем чатам
   */
  async getChatStats(filter?: {
    startDate?: Date
    endDate?: Date
    managerId?: string
  }): Promise<ChatStats> {
    const where: Prisma.ChatWhereInput = {}

    if (filter?.startDate || filter?.endDate) {
      where.createdAt = {
        ...(filter.startDate && { gte: filter.startDate }),
        ...(filter.endDate && { lte: filter.endDate }),
      }
    }

    if (filter?.managerId) {
      where.managerId = filter.managerId
    }

    const [totalChats, activeChats, closedChats, chatsByStatus, avgMessages] = await Promise.all([
      this.prisma.chat.count({ where }),
      this.prisma.chat.count({
        where: { ...where, status: { code: { not: 'closed' } } },
      }),
      this.prisma.chat.count({
        where: { ...where, status: { code: 'closed' } },
      }),
      this.prisma.chat.groupBy({
        by: ['statusId'],
        where,
        _count: true,
      }),
      this.prisma.message.groupBy({
        by: ['chatId'],
        where: { chat: where },
        _count: true,
      }),
    ])

    // Получаем названия статусов
    const statuses = await this.prisma.chatStatus.findMany()
    const statusMap = new Map(statuses.map((s) => [s.id, s.name]))

    const chatsByStatusFormatted: Record<string, number> = {}
    for (const group of chatsByStatus) {
      const statusName = statusMap.get(group.statusId) || 'Unknown'
      chatsByStatusFormatted[statusName] = group._count
    }

    // Вычисляем среднее количество сообщений
    const averageMessagesPerChat =
      avgMessages.length > 0
        ? avgMessages.reduce((sum, chat) => sum + chat._count, 0) / avgMessages.length
        : 0

    // Вычисляем среднее время ответа из метрик
    const chatsWithMetrics = await this.prisma.chat.findMany({
      where: { ...where, managerId: { not: null } },
      select: { id: true },
    })

    let totalResponseTime = 0
    let chatsWithResponse = 0

    for (const chat of chatsWithMetrics) {
      const metrics = await this.getChatMetrics(chat.id)
      if (metrics.firstResponseTime) {
        totalResponseTime += metrics.firstResponseTime
        chatsWithResponse++
      }
    }

    const averageResponseTime = chatsWithResponse > 0 ? totalResponseTime / chatsWithResponse : 0

    return {
      totalChats,
      activeChats,
      closedChats,
      averageResponseTime,
      averageMessagesPerChat,
      chatsByStatus: chatsByStatusFormatted,
    }
  }

  /**
   * Получить активные чаты пользователя
   */
  async getUserActiveChats(userId?: string, sessionId?: string): Promise<ChatResponseDto[]> {
    const where: Prisma.ChatWhereInput = {
      status: { code: { not: 'closed' } },
      OR: userId ? [{ userId }] : [{ anonymousUser: { sessionId } }],
    }

    const chats = await this.prisma.chat.findMany({
      where,
      include: {
        status: true,
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            messages: {
              where: {
                // Считаем непрочитанные сообщения от менеджера
                senderType: SenderType.MANAGER,
                createdAt: {
                  gt: new Date(Date.now() - 24 * 60 * 60 * 1000), // За последние 24 часа
                },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    return Promise.all(
      chats.map(async (chat) => {
        const metrics = await this.getChatMetrics(chat.id)

        return {
          id: chat.id,
          userId: chat.userId,
          anonymousId: chat.anonymousId,
          managerId: chat.managerId,
          status: {
            id: chat.status.id,
            name: chat.status.name,
            code: chat.status.code,
            color: chat.status.color,
          },
          manager: chat.manager
            ? {
                id: chat.manager.id,
                firstName: chat.manager.firstName,
                lastName: chat.manager.lastName,
              }
            : undefined,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
          lastMessage: chat.messages[0] ? this.formatMessage(chat.messages[0]) : undefined,
          unreadCount: chat._count.messages,
          metrics: {
            totalMessages: metrics.totalMessages,
            lastMessageAt: metrics.lastMessageAt,
          },
        }
      }),
    )
  }

  /**
   * Получить чаты для менеджера
   */
  async getManagerChats(managerId: string, statusCodes?: string[]): Promise<ChatResponseDto[]> {
    const where: Prisma.ChatWhereInput = {
      OR: [{ managerId }, { managerId: null, status: { code: 'new' } }],
    }

    if (statusCodes && statusCodes.length > 0) {
      where.status = { code: { in: statusCodes } }
    } else {
      where.status = { code: { not: 'closed' } }
    }

    const chats = await this.prisma.chat.findMany({
      where,
      include: {
        status: true,
        user: {
          select: {
            id: true,
            phone: true,
            firstName: true,
            lastName: true,
          },
        },
        anonymousUser: {
          select: {
            id: true,
            sessionId: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
      orderBy: [{ status: { sortOrder: 'asc' } }, { updatedAt: 'desc' }],
    })

    return Promise.all(
      chats.map(async (chat) => {
        const metrics = await this.getChatMetrics(chat.id)

        return {
          id: chat.id,
          userId: chat.userId,
          anonymousId: chat.anonymousId,
          managerId: chat.managerId,
          status: {
            id: chat.status.id,
            name: chat.status.name,
            code: chat.status.code,
            color: chat.status.color,
          },
          user: chat.user
            ? {
                id: chat.user.id,
                phone: chat.user.phone,
                firstName: chat.user.firstName ?? undefined,
                lastName: chat.user.lastName ?? undefined,
              }
            : undefined,
          anonymousUser: chat.anonymousUser
            ? {
                id: chat.anonymousUser.id,
                sessionId: chat.anonymousUser.sessionId,
              }
            : undefined,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
          lastMessage: chat.messages[0] ? this.formatMessage(chat.messages[0]) : undefined,
          totalMessages: chat._count.messages,
          metrics: {
            totalMessages: metrics.totalMessages,
            firstResponseTime: metrics.firstResponseTime,
            averageResponseTime: metrics.averageResponseTime,
            lastMessageAt: metrics.lastMessageAt,
          },
        }
      }),
    )
  }

  // === Приватные методы ===

  public async getChat(chatId: string): Promise<
    | (Chat & {
        status: ChatStatus
        user?: User | null
        manager?: User | null
        anonymousUser?: AnonymousUser | null
      })
    | null
  > {
    return this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        status: true,
        manager: true,
        user: true,
        anonymousUser: true,
      },
    }) as any
  }

  private async initializeChatMetrics(chatId: string): Promise<void> {
    const metricsKey = `${CacheKeys.CHAT}metrics:${chatId}`
    await this.redis.hset(metricsKey, 'totalMessages', 0)
    await this.redis.hset(metricsKey, 'customerMessages', 0)
    await this.redis.hset(metricsKey, 'managerMessages', 0)
    await this.redis.hset(metricsKey, 'averageResponseTime', 0)
    await this.redis.expire(metricsKey, CacheTTL.CHAT_MESSAGE)
  }

  private async updateChatMetrics(chatId: string, senderType: SenderType): Promise<void> {
    const metricsKey = `${CacheKeys.CHAT}metrics:${chatId}`

    // Увеличиваем счетчики
    await this.redis.hset(metricsKey, 'lastMessageAt', new Date())
    await this.redis.increment(`${metricsKey}:totalMessages`)

    if (senderType === SenderType.CUSTOMER) {
      await this.redis.increment(`${metricsKey}:customerMessages`)
    } else if (senderType === SenderType.MANAGER) {
      await this.redis.increment(`${metricsKey}:managerMessages`)
    }

    await this.redis.expire(metricsKey, CacheTTL.CHAT_MESSAGE)
  }

  private async recordFirstManagerResponse(chatId: string): Promise<void> {
    const metricsKey = `${CacheKeys.CHAT}metrics:${chatId}`
    const existingTime = await this.redis.hget<number>(metricsKey, 'firstResponseTime')

    if (!existingTime) {
      const chat = await this.prisma.chat.findUnique({
        where: { id: chatId },
        select: { createdAt: true },
      })

      if (chat) {
        const responseTime = (Date.now() - chat.createdAt.getTime()) / 1000 // в секундах
        await this.redis.hset(metricsKey, 'firstResponseTime', responseTime)
      }
    }
  }

  private async calculateChatMetrics(chatId: string): Promise<ChatMetrics> {
    const messages = await this.prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
    })

    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      select: { createdAt: true, closedAt: true },
    })

    let totalMessages = 0
    let customerMessages = 0
    let managerMessages = 0
    let firstManagerMessageTime: Date | null = null
    let lastMessageAt: Date | null = null
    let totalResponseTime = 0
    let responseCount = 0

    let lastCustomerMessageTime: Date | null = null

    for (const message of messages) {
      totalMessages++
      lastMessageAt = message.createdAt

      if (message.senderType === SenderType.CUSTOMER) {
        customerMessages++
        lastCustomerMessageTime = message.createdAt
      } else if (message.senderType === SenderType.MANAGER) {
        managerMessages++

        if (!firstManagerMessageTime) {
          firstManagerMessageTime = message.createdAt
        }

        // Вычисляем время ответа
        if (lastCustomerMessageTime) {
          const responseTime =
            (message.createdAt.getTime() - lastCustomerMessageTime.getTime()) / 1000
          totalResponseTime += responseTime
          responseCount++
          lastCustomerMessageTime = null
        }
      }
    }

    const averageResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0
    const firstResponseTime =
      firstManagerMessageTime && chat
        ? (firstManagerMessageTime.getTime() - chat.createdAt.getTime()) / 1000
        : undefined

    const metrics: ChatMetrics = {
      averageResponseTime,
      totalMessages,
      customerMessages,
      managerMessages,
      firstResponseTime,
      lastMessageAt: lastMessageAt || undefined,
      resolvedAt: chat?.closedAt || undefined,
    }

    // Сохраняем в кеш
    const metricsKey = `${CacheKeys.CHAT}metrics:${chatId}`
    await this.redis.hset(metricsKey, 'averageResponseTime', averageResponseTime.toString())
    await this.redis.hset(metricsKey, 'totalMessages', totalMessages.toString())
    await this.redis.hset(metricsKey, 'customerMessages', customerMessages.toString())
    await this.redis.hset(metricsKey, 'managerMessages', managerMessages.toString())

    if (firstResponseTime !== undefined) {
      await this.redis.hset(metricsKey, 'firstResponseTime', firstResponseTime.toString())
    }

    if (lastMessageAt) {
      await this.redis.hset(metricsKey, 'lastMessageAt', lastMessageAt.toISOString())
    }

    if (chat?.closedAt) {
      await this.redis.hset(metricsKey, 'resolvedAt', chat.closedAt.toISOString())
    }

    return metrics
  }

  // Обновляем метод formatMessage для включения chatProducts
  private formatMessage(message: any): MessageResponseDto {
    const chat = message.chat
    let sender: any

    if (message.senderType === SenderType.CUSTOMER) {
      if (chat?.user) {
        sender = {
          id: chat.user.id,
          name: chat.user.firstName
            ? `${chat.user.firstName} ${chat.user.lastName || ''}`.trim()
            : chat.user.phone,
          role: 'customer',
        }
      } else {
        sender = {
          id: 'anonymous',
          name: 'Гость',
          role: 'anonymous',
        }
      }
    } else if (message.senderType === SenderType.MANAGER && chat?.manager) {
      sender = {
        id: chat.manager.id,
        name: chat.manager.firstName
          ? `${chat.manager.firstName} ${chat.manager.lastName || ''}`.trim()
          : 'Менеджер',
        role: 'manager',
      }
    } else if (message.senderType === SenderType.SYSTEM) {
      sender = {
        id: 'system',
        name: 'Система',
        role: 'system',
      }
    }

    // Форматируем карточки товаров если есть
    const chatProducts = message.chatProducts?.map((cp: any) => this.formatChatProduct(cp))

    return {
      id: message.id,
      chatId: message.chatId,
      senderId: message.senderId,
      senderType: message.senderType,
      messageType: message.messageType,
      content: message.content,
      metadata: message.metadata,
      createdAt: message.createdAt,
      sender,
      chatProducts,
    }
  }

  // === Дополнительные методы ===

  async setTyping(chatId: string, userId: string, isTyping: boolean): Promise<void> {
    const key = `${CacheKeys.CHAT_TYPING}${chatId}:${userId}`

    if (isTyping) {
      await this.redis.set(key, true, CacheTTL.CHAT_TYPING)
    } else {
      await this.redis.del(key)
    }
  }

  async getTypingUsers(chatId: string): Promise<string[]> {
    const pattern = `${CacheKeys.CHAT_TYPING}${chatId}:*`
    const keys = await this.redis.getClient().keys(pattern)

    return keys.map((key) => key.split(':').pop()!).filter(Boolean)
  }

  /**
   * Создать сообщение с карточкой товара
   */
  async createProductCardMessage(
    chatId: string,
    senderId: string | undefined,
    senderType: SenderType,
    content: string,
    productData: CreateChatProductDto,
  ): Promise<Message> {
    // Валидируем данные товара
    this.validateProductData(productData)

    // Создаем сообщение и карточку товара в транзакции
    const result = await this.prisma.$transaction(async (tx) => {
      // Создаем сообщение
      const message = await tx.message.create({
        data: {
          chatId,
          senderId,
          senderType,
          messageType: MessageType.PRODUCT_CARD,
          content,
          metadata: {
            productName: productData.name,
            brand: productData.brand,
            sku: productData.sku,
            price: productData.price,
          },
        },
      })

      // Создаем карточку товара
      const chatProduct = await tx.chatProduct.create({
        data: {
          messageId: message.id,
          name: productData.name,
          brand: productData.brand,
          sku: productData.sku,
          price: productData.price,
          comparePrice: productData.comparePrice,
          isOriginal: productData.isOriginal ?? true,
          deliveryDays: productData.deliveryDays,
          description: productData.description,
        },
      })

      // Создаем изображения если есть
      if (productData.images && productData.images.length > 0) {
        await tx.chatProductImage.createMany({
          data: productData.images.map((img, index) => ({
            chatProductId: chatProduct.id,
            url: img.url,
            alt: img.alt,
            sortOrder: img.sortOrder ?? index,
          })),
        })
      }

      // Возвращаем сообщение с включенными данными
      return tx.message.findUnique({
        where: { id: message.id },
        include: {
          chatProducts: {
            include: {
              images: {
                orderBy: { sortOrder: 'asc' },
              },
            },
          },
          chat: {
            include: {
              user: true,
              manager: true,
            },
          },
        },
      })
    })

    if (!result) {
      throw new Error('Failed to create product card message')
    }

    // Обновляем метрики
    await this.updateChatMetrics(chatId, senderType)

    // Обновляем время последней активности чата
    await this.prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
    })

    this.logger.logBusinessEvent('product_card_sent', senderId, {
      chatId,
      productSku: productData.sku,
      productName: productData.name,
    })

    return result
  }

  /**
   * Получить карточку товара из сообщения
   */
  async getChatProduct(chatProductId: string): Promise<ChatProductResponseDto | null> {
    const chatProduct = await this.prisma.chatProduct.findUnique({
      where: { id: chatProductId },
      include: {
        images: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    if (!chatProduct) {
      return null
    }

    return this.formatChatProduct(chatProduct)
  }

  /**
   * Получить карточки товаров из чата
   */
  async getChatProducts(chatId: string): Promise<ChatProductResponseDto[]> {
    const products = await this.prisma.chatProduct.findMany({
      where: {
        message: {
          chatId,
        },
      },
      include: {
        images: {
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return products.map((product) => this.formatChatProduct(product))
  }

  /**
   * Добавить товар из чата в корзину
   */
  async addChatProductToCart(
    chatProductId: string,
    userId?: string,
    sessionId?: string,
    quantity: number = 1,
  ): Promise<void> {
    if (!userId && !sessionId) {
      throw new BadRequestException('User ID or session ID is required')
    }

    // Получаем карточку товара
    const chatProduct = await this.prisma.chatProduct.findUnique({
      where: { id: chatProductId },
    })

    if (!chatProduct) {
      throw new NotFoundException('Chat product not found')
    }

    // Находим или создаем корзину
    let cart = await this.prisma.cart.findFirst({
      where: {
        OR: [{ userId }, { anonymousUser: { sessionId } }],
      },
    })

    if (!cart) {
      const anonymousId = sessionId
        ? (
            await this.prisma.anonymousUser.findUnique({
              where: { sessionId },
            })
          )?.id
        : undefined

      cart = await this.prisma.cart.create({
        data: {
          userId,
          anonymousId,
        },
      })
    }

    // Проверяем, есть ли уже этот товар в корзине
    const existingItem = await this.prisma.cartItem.findFirst({
      // <<--- ИЗМЕНЕНИЕ: findFirst вместо findUnique
      where: {
        cartId: cart.id,
        productId: null, // Явно указываем, что productId должен быть NULL
        chatProductId: chatProductId,
      },
    })

    if (existingItem) {
      // Обновляем количество
      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: existingItem.quantity + quantity,
        },
      })
    } else {
      // Создаем новый элемент корзины
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: undefined, // Заменяем null на undefined
          chatProductId,
          quantity,
          price: chatProduct.price,
        },
      })
    }

    this.logger.logBusinessEvent('chat_product_added_to_cart', userId || sessionId, {
      chatProductId,
      productName: chatProduct.name,
      quantity,
    })
  }

  /**
   * Валидация данных товара
   */
  private validateProductData(productData: CreateChatProductDto): void {
    // Проверяем, что цена до скидки больше обычной цены
    if (productData.comparePrice && productData.comparePrice <= productData.price) {
      throw new BadRequestException('Compare price must be greater than regular price')
    }

    // Проверяем URL изображений
    if (productData.images) {
      for (const image of productData.images) {
        try {
          new URL(image.url)
        } catch {
          throw new BadRequestException(`Invalid image URL: ${image.url}`)
        }
      }
    }
  }

  /**
   * Форматирование карточки товара для ответа
   */
  private formatChatProduct(chatProduct: any): ChatProductResponseDto {
    const result = Object.create(ChatProductResponseDto.prototype)

    Object.assign(result, {
      id: chatProduct.id,
      name: chatProduct.name,
      brand: chatProduct.brand,
      sku: chatProduct.sku,
      price: Number(chatProduct.price),
      comparePrice: chatProduct.comparePrice ? Number(chatProduct.comparePrice) : undefined,
      isOriginal: chatProduct.isOriginal,
      deliveryDays: chatProduct.deliveryDays,
      description: chatProduct.description,
      images: chatProduct.images || [],
      createdAt: chatProduct.createdAt,
    })

    return result
  }
}
