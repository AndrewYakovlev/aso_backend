// src/modules/notifications/notifications.service.ts
import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { LoggerService } from '../../logger/logger.service'
import { PushService } from './services/push.service'
import { NotificationSettingsService } from './services/notification-settings.service'
import { NotificationType } from './enums/notification-type.enum'
import { Chat, Message, User, Order } from '@prisma/client'

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private logger: LoggerService,
    private pushService: PushService,
    private settingsService: NotificationSettingsService,
  ) {}

  /**
   * Отправить уведомление о новом чате
   */
  async sendNewChatNotification(chat: Chat & { user?: User | null }): Promise<void> {
    try {
      const userName = chat.user ? chat.user.firstName || chat.user.phone : 'Гость'

      await this.pushService.sendNotificationToManagers(
        {
          title: 'Новый чат',
          body: `${userName} начал чат`,
          icon: '/icon-192x192.png',
          badge: '/badge-72x72.png',
          tag: `new-chat-${chat.id}`,
          data: {
            chatId: chat.id,
            action: 'open-chat',
          },
          requireInteraction: true,
        },
        NotificationType.NEW_CHAT,
      )
    } catch (error) {
      this.logger.error(
        'Failed to send new chat notification',
        error instanceof Error ? error.message : String(error),
        'NotificationsService',
      )
    }
  }

  /**
   * Отправить уведомление о новом сообщении
   */
  async sendNewMessageNotification(
    message: Message & {
      chat: Chat & {
        user?: User | null
        manager?: User | null
      }
    },
    recipientId: string,
  ): Promise<void> {
    try {
      // Проверяем настройки пользователя
      const settings = await this.settingsService.getSettings(recipientId)
      if (!settings.newMessage) {
        return
      }

      const senderName = message.chat.user
        ? message.chat.user.firstName || message.chat.user.phone
        : 'Гость'

      // Обрезаем длинное сообщение
      const bodyText =
        message.content.length > 100 ? message.content.substring(0, 97) + '...' : message.content

      await this.pushService.sendNotification(
        recipientId,
        {
          title: `Новое сообщение от ${senderName}`,
          body: bodyText,
          icon: '/icon-192x192.png',
          badge: '/badge-72x72.png',
          tag: `chat-${message.chatId}`,
          data: {
            chatId: message.chatId,
            messageId: message.id,
            action: 'open-chat',
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
        NotificationType.NEW_MESSAGE,
      )
    } catch (error) {
      this.logger.error(
        'Failed to send new message notification',
        error instanceof Error ? error.message : String(error),
        'NotificationsService',
      )
    }
  }

  /**
   * Отправить уведомление о назначении менеджера
   */
  async sendChatAssignedNotification(chat: Chat, managerId: string): Promise<void> {
    try {
      const settings = await this.settingsService.getSettings(managerId)
      if (!settings.chatAssigned) {
        return
      }

      await this.pushService.sendNotification(
        managerId,
        {
          title: 'Новый чат назначен вам',
          body: 'У вас есть новый клиент в чате',
          icon: '/icon-192x192.png',
          badge: '/badge-72x72.png',
          tag: `assigned-${chat.id}`,
          data: {
            chatId: chat.id,
            action: 'open-chat',
          },
          requireInteraction: true,
        },
        NotificationType.CHAT_ASSIGNED,
      )
    } catch (error) {
      this.logger.error(
        'Failed to send chat assigned notification',
        error instanceof Error ? error.message : String(error),
        'NotificationsService',
      )
    }
  }

  /**
   * Отправить уведомление об изменении статуса чата
   */
  async sendChatStatusChangedNotification(
    chat: Chat & {
      user?: User | null
      status: { name: string }
    },
    userId: string,
  ): Promise<void> {
    try {
      const settings = await this.settingsService.getSettings(userId)
      if (!settings.chatStatusChanged) {
        return
      }

      await this.pushService.sendNotification(
        userId,
        {
          title: 'Статус чата изменен',
          body: `Статус вашего чата изменен на "${chat.status.name}"`,
          icon: '/icon-192x192.png',
          badge: '/badge-72x72.png',
          tag: `status-${chat.id}`,
          data: {
            chatId: chat.id,
            action: 'open-chat',
          },
        },
        NotificationType.CHAT_STATUS_CHANGED,
      )
    } catch (error) {
      this.logger.error(
        'Failed to send status changed notification',
        error instanceof Error ? error.message : String(error),
        'NotificationsService',
      )
    }
  }

  /**
   * Отправить уведомление об изменении статуса заказа
   */
  async sendOrderStatusNotification(
    order: Order & {
      status: { name: string }
      user: User
    },
  ): Promise<void> {
    try {
      const settings = await this.settingsService.getSettings(order.userId)
      if (!settings.orderStatusChanged) {
        return
      }

      await this.pushService.sendNotification(
        order.userId,
        {
          title: 'Статус заказа изменен',
          body: `Заказ №${order.orderNumber} - "${order.status.name}"`,
          icon: '/icon-192x192.png',
          badge: '/badge-72x72.png',
          tag: `order-${order.id}`,
          data: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            action: 'open-order',
          },
        },
        NotificationType.ORDER_STATUS_CHANGED,
      )
    } catch (error) {
      this.logger.error(
        'Failed to send order status notification',
        error instanceof Error ? error.message : String(error),
        'NotificationsService',
      )
    }
  }

  async getNotificationHistory(userId: string, page: number, limit: number): Promise<any> {
    this.logger.log(
      `Fetching notification history for user ${userId}, page ${page}, limit ${limit}`,
      'NotificationsService',
    )
    // TODO: Реализовать логику получения истории уведомлений из NotificationLog с пагинацией
    // Пример:
    // const [logs, total] = await this.prisma.$transaction([
    //   this.prisma.notificationLog.findMany({
    //     where: { userId },
    //     skip: (page - 1) * limit,
    //     take: limit,
    //     orderBy: { sentAt: 'desc' },
    //   }),
    //   this.prisma.notificationLog.count({ where: { userId } }),
    // ]);
    // return { data: logs, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
    return { data: [], pagination: { total: 0, page, limit, totalPages: 0 } } // Заглушка
  }

  async markNotificationClicked(userId: string, notificationId: string): Promise<void> {
    this.logger.log(
      `Marking notification ${notificationId} as clicked for user ${userId}`,
      'NotificationsService',
    )
    // TODO: Реализовать логику обновления статуса уведомления в NotificationLog
    // Пример:
    // await this.prisma.notificationLog.updateMany({
    //   where: { id: notificationId, userId, clickedAt: null },
    //   data: { clickedAt: new Date() },
    // });
  }
}
