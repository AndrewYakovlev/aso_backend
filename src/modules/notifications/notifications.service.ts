// src/modules/notifications/notifications.service.ts
import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { PushService } from './services/push.service'
import { NotificationSettingsService } from './services/notification-settings.service'
import { LoggerService } from '../../logger/logger.service'
import { Chat, Message, Order } from '@prisma/client'

export interface NotificationData {
  chatId?: string
  messageId?: string
  orderId?: string
  url?: string
  [key: string]: any
}

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private pushService: PushService,
    private settingsService: NotificationSettingsService,
    private logger: LoggerService,
  ) {}

  /**
   * Уведомление о новом чате
   */
  async notifyNewChat(chat: Chat & { user?: any; anonymousUser?: any }): Promise<void> {
    try {
      const customerName = chat.user ? chat.user.firstName || chat.user.phone : 'Гость'

      const notification = {
        title: '🆕 Новый чат',
        body: `${customerName} начал чат`,
        icon: '/icons/chat-new.png',
        badge: '/icons/badge.png',
        tag: `new-chat-${chat.id}`,
        data: {
          chatId: chat.id,
          url: `/admin/chats/${chat.id}`,
        },
        requireInteraction: true,
        actions: [
          {
            action: 'open',
            title: 'Открыть чат',
          },
          {
            action: 'dismiss',
            title: 'Позже',
          },
        ],
      }

      await this.pushService.sendNotificationToManagers(notification, 'new_chat')
    } catch (error) {
      this.logger.error('Failed to send new chat notification', error, 'NotificationsService')
    }
  }

  /**
   * Уведомление о новом сообщении
   */
  async notifyNewMessage(message: Message & { chat?: any }, senderName: string): Promise<void> {
    try {
      // Определяем получателей
      const recipients: string[] = []

      if (message.senderType === 'CUSTOMER') {
        // Уведомляем менеджера чата
        if (message.chat?.managerId) {
          recipients.push(message.chat.managerId)
        } else {
          // Если менеджер не назначен, уведомляем всех
          await this.pushService.sendNotificationToManagers(
            {
              title: '💬 Новое сообщение',
              body: `${senderName}: ${this.truncateMessage(message.content)}`,
              icon: '/icons/message.png',
              badge: '/icons/badge.png',
              tag: `chat-${message.chatId}`,
              data: {
                chatId: message.chatId,
                messageId: message.id,
                url: `/admin/chats/${message.chatId}`,
              },
            },
            'new_message',
          )
          return
        }
      } else if (message.senderType === 'MANAGER' && message.chat?.userId) {
        // Уведомляем клиента
        recipients.push(message.chat.userId)
      }

      // Отправляем уведомления
      for (const recipientId of recipients) {
        await this.pushService.sendNotification(
          recipientId,
          {
            title: '💬 Новое сообщение',
            body: `${senderName}: ${this.truncateMessage(message.content)}`,
            icon: '/icons/message.png',
            badge: '/icons/badge.png',
            tag: `chat-${message.chatId}`,
            data: {
              chatId: message.chatId,
              messageId: message.id,
              url:
                message.senderType === 'MANAGER'
                  ? `/chat/${message.chatId}`
                  : `/admin/chats/${message.chatId}`,
            },
            actions: [
              {
                action: 'reply',
                title: 'Ответить',
              },
              {
                action: 'open',
                title: 'Открыть',
              },
            ],
          },
          'new_message',
        )
      }
    } catch (error) {
      this.logger.error('Failed to send new message notification', error, 'NotificationsService')
    }
  }

  /**
   * Уведомление о назначении менеджера
   */
  async notifyChatAssigned(chatId: string, managerId: string, managerName: string): Promise<void> {
    try {
      const chat = await this.prisma.chat.findUnique({
        where: { id: chatId },
        include: { user: true },
      })

      if (!chat || !chat.userId) return

      await this.pushService.sendNotification(
        chat.userId,
        {
          title: '👤 Менеджер подключился',
          body: `${managerName} готов вам помочь`,
          icon: '/icons/manager.png',
          data: {
            chatId,
            url: `/chat/${chatId}`,
          },
        },
        'chat_assigned',
      )
    } catch (error) {
      this.logger.error('Failed to send chat assigned notification', error, 'NotificationsService')
    }
  }

  /**
   * Уведомление об изменении статуса чата
   */
  async notifyChatStatusChanged(
    chatId: string,
    newStatus: string,
    statusName: string,
  ): Promise<void> {
    try {
      const chat = await this.prisma.chat.findUnique({
        where: { id: chatId },
        include: { user: true, manager: true },
      })

      if (!chat) return

      // Уведомляем клиента если чат закрыт
      if (newStatus === 'closed' && chat.userId) {
        await this.pushService.sendNotification(
          chat.userId,
          {
            title: '✅ Чат завершен',
            body: 'Спасибо за обращение! Мы всегда рады помочь.',
            icon: '/icons/chat-closed.png',
            data: {
              chatId,
              url: `/chat/history`,
            },
          },
          'chat_status_changed',
        )
      }

      // Уведомляем менеджера об изменениях
      if (chat.managerId && newStatus !== 'closed') {
        await this.pushService.sendNotification(
          chat.managerId,
          {
            title: '📝 Статус чата изменен',
            body: `Новый статус: ${statusName}`,
            icon: '/icons/status.png',
            data: {
              chatId,
              url: `/admin/chats/${chatId}`,
            },
          },
          'chat_status_changed',
        )
      }
    } catch (error) {
      this.logger.error('Failed to send status changed notification', error, 'NotificationsService')
    }
  }

  /**
   * Уведомление об изменении статуса заказа
   */
  async notifyOrderStatusChanged(
    order: Order & { status?: any },
    oldStatus: string,
  ): Promise<void> {
    try {
      if (!order.userId) return

      const statusEmoji: Record<string, string> = {
        processing: '⏳',
        confirmed: '✅',
        shipped: '🚚',
        delivered: '📦',
        cancelled: '❌',
      }

      await this.pushService.sendNotification(
        order.userId,
        {
          title: `${statusEmoji[order.status?.code] || '📋'} Заказ №${order.orderNumber}`,
          body: `Статус изменен: ${order.status?.name}`,
          icon: '/icons/order.png',
          data: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            url: `/orders/${order.id}`,
          },
        },
        'order_status_changed',
      )
    } catch (error) {
      this.logger.error('Failed to send order status notification', error, 'NotificationsService')
    }
  }

  /**
   * Обрезать сообщение для уведомления
   */
  private truncateMessage(message: string, maxLength: number = 50): string {
    if (message.length <= maxLength) return message
    return message.substring(0, maxLength - 3) + '...'
  }

  /**
   * Отметить уведомление как прочитанное
   */
  async markNotificationClicked(userId: string, notificationId: string): Promise<void> {
    await this.prisma.notificationLog.updateMany({
      where: {
        id: notificationId,
        userId,
      },
      data: {
        status: 'clicked',
        clickedAt: new Date(),
      },
    })
  }

  /**
   * Получить историю уведомлений
   */
  async getNotificationHistory(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit

    const [notifications, total] = await Promise.all([
      this.prisma.notificationLog.findMany({
        where: { userId },
        orderBy: { sentAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.notificationLog.count({
        where: { userId },
      }),
    ])

    return {
      data: notifications,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }
}
