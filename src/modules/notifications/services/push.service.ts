// src/modules/notifications/services/push.service.ts
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as webpush from 'web-push'
import { PrismaService } from '../../../prisma/prisma.service'
import { LoggerService } from '../../../logger/logger.service'
import { CreatePushSubscriptionDto } from '../dto/create-push-subscription.dto'

@Injectable()
export class PushService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private logger: LoggerService,
  ) {
    // Инициализируем web-push с VAPID ключами
    const vapidPublicKey = this.config.get('VAPID_PUBLIC_KEY')
    const vapidPrivateKey = this.config.get('VAPID_PRIVATE_KEY')
    const vapidEmail = this.config.get('VAPID_EMAIL', 'mailto:admin@example.com')

    if (!vapidPublicKey || !vapidPrivateKey) {
      this.logger.error('VAPID keys not configured', 'PushService')
    } else {
      webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey)
    }
  }

  /**
   * Получить публичный VAPID ключ для клиента
   */
  getVapidPublicKey(): string {
    const key = this.config.get('VAPID_PUBLIC_KEY')
    if (!key) {
      throw new Error('VAPID public key not configured')
    }
    return key
  }

  /**
   * Сохранить push подписку
   */
  async savePushSubscription(userId: string, dto: CreatePushSubscriptionDto): Promise<void> {
    try {
      // Проверяем, существует ли уже такая подписка
      const existing = await this.prisma.pushSubscription.findUnique({
        where: { endpoint: dto.endpoint },
      })

      if (existing) {
        // Обновляем существующую подписку
        await this.prisma.pushSubscription.update({
          where: { id: existing.id },
          data: {
            userId,
            p256dh: dto.keys.p256dh,
            auth: dto.keys.auth,
            userAgent: dto.userAgent,
            deviceName: dto.deviceName,
            isActive: true,
            lastUsedAt: new Date(),
          },
        })
      } else {
        // Создаем новую подписку
        await this.prisma.pushSubscription.create({
          data: {
            userId,
            endpoint: dto.endpoint,
            p256dh: dto.keys.p256dh,
            auth: dto.keys.auth,
            userAgent: dto.userAgent,
            deviceName: dto.deviceName,
          },
        })
      }

      // Создаем настройки уведомлений если их нет
      await this.prisma.notificationSettings.upsert({
        where: { userId },
        create: { userId },
        update: {},
      })

      this.logger.log(`Push subscription saved for user ${userId}`, 'PushService')
    } catch (error) {
      this.logger.error('Failed to save push subscription', error, 'PushService')
      throw error
    }
  }

  /**
   * Удалить push подписку
   */
  async removePushSubscription(userId: string, endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({
      where: {
        userId,
        endpoint,
      },
    })
  }

  /**
   * Отправить push уведомление
   */
  async sendNotification(
    userId: string,
    notification: {
      title: string
      body: string
      icon?: string
      badge?: string
      image?: string
      tag?: string
      data?: any
      actions?: Array<{
        action: string
        title: string
        icon?: string
      }>
      requireInteraction?: boolean
      silent?: boolean
    },
    type: string,
  ): Promise<void> {
    try {
      // Получаем активные подписки пользователя
      const subscriptions = await this.prisma.pushSubscription.findMany({
        where: {
          userId,
          isActive: true,
        },
      })

      if (subscriptions.length === 0) {
        this.logger.log(`No active subscriptions for user ${userId}`, 'PushService')
        return
      }

      // Проверяем настройки уведомлений
      const settings = await this.prisma.notificationSettings.findUnique({
        where: { userId },
      })

      if (!this.shouldSendNotification(type, settings)) {
        this.logger.log(`Notification type ${type} disabled for user ${userId}`, 'PushService')
        return
      }

      // Проверяем расписание для менеджеров
      if (settings?.enableSchedule && !this.isWithinSchedule(settings)) {
        this.logger.log(`Outside schedule for user ${userId}`, 'PushService')
        return
      }

      // Подготавливаем payload
      const payload = JSON.stringify({
        title: notification.title,
        body: notification.body,
        icon: notification.icon || '/icon-192x192.png',
        badge: notification.badge || '/badge-72x72.png',
        image: notification.image,
        tag: notification.tag || type,
        data: {
          ...notification.data,
          type,
          timestamp: Date.now(),
        },
        actions: notification.actions,
        requireInteraction: notification.requireInteraction ?? false,
        silent: notification.silent ?? !settings?.soundEnabled,
        vibrate: settings?.vibrationEnabled ? [200, 100, 200] : undefined,
      })

      // Отправляем на все устройства
      const results = await Promise.allSettled(
        subscriptions.map(async (subscription) => {
          try {
            await webpush.sendNotification(
              {
                endpoint: subscription.endpoint,
                keys: {
                  p256dh: subscription.p256dh,
                  auth: subscription.auth,
                },
              },
              payload,
            )

            // Обновляем время последнего использования
            await this.prisma.pushSubscription.update({
              where: { id: subscription.id },
              data: { lastUsedAt: new Date() },
            })

            return { subscriptionId: subscription.id, success: true }
          } catch (error: any) {
            // Если подписка невалидна, деактивируем её
            if (error.statusCode === 410 || error.statusCode === 404) {
              await this.prisma.pushSubscription.update({
                where: { id: subscription.id },
                data: { isActive: false },
              })
            }

            return {
              subscriptionId: subscription.id,
              success: false,
              error: error.message,
            }
          }
        }),
      )

      // Логируем результаты
      const successCount = results.filter((r) => r.status === 'fulfilled' && r.value.success).length

      // Сохраняем в журнал
      await this.prisma.notificationLog.create({
        data: {
          userId,
          type,
          title: notification.title,
          body: notification.body,
          data: notification.data,
          status: successCount > 0 ? 'sent' : 'failed',
          errorMessage: successCount === 0 ? 'All subscriptions failed' : undefined,
        },
      })

      this.logger.log(
        `Notification sent to ${successCount}/${subscriptions.length} devices for user ${userId}`,
        'PushService',
      )
    } catch (error) {
      this.logger.error('Failed to send notification', error, 'PushService')
      throw error
    }
  }

  /**
   * Отправить уведомление всем менеджерам
   */
  async sendNotificationToManagers(
    notification: Parameters<typeof this.sendNotification>[1],
    type: string,
    excludeUserId?: string,
  ): Promise<void> {
    // Получаем всех активных менеджеров с подписками
    const managers = await this.prisma.user.findMany({
      where: {
        role: { in: ['MANAGER', 'ADMIN'] },
        id: { not: excludeUserId },
        deletedAt: null,
        pushSubscriptions: {
          some: { isActive: true },
        },
      },
      select: { id: true },
    })

    // Отправляем уведомления параллельно
    await Promise.allSettled(
      managers.map((manager) => this.sendNotification(manager.id, notification, type)),
    )
  }

  /**
   * Проверить, нужно ли отправлять уведомление данного типа
   */
  private shouldSendNotification(type: string, settings: any): boolean {
    if (!settings) return true

    const typeMap: Record<string, keyof typeof settings> = {
      new_chat: 'newChat',
      new_message: 'newMessage',
      chat_assigned: 'chatAssigned',
      chat_status_changed: 'chatStatusChanged',
      order_status_changed: 'orderStatusChanged',
    }

    const settingKey = typeMap[type]
    return settingKey ? settings[settingKey] !== false : true
  }

  /**
   * Проверить, находимся ли в рамках расписания
   */
  private isWithinSchedule(settings: any): boolean {
    if (!settings.scheduleStart || !settings.scheduleEnd) return true

    const now = new Date()
    const timezone = settings.scheduleTimezone || 'Europe/Moscow'

    // Получаем текущее время в нужной временной зоне
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const currentTime = formatter.format(now)

    // Проверяем день недели
    if (settings.scheduleDays && Array.isArray(settings.scheduleDays)) {
      const currentDay = new Date().toLocaleDateString('en-US', {
        timeZone: timezone,
        weekday: 'numeric',
      })
      if (!settings.scheduleDays.includes(parseInt(currentDay))) {
        return false
      }
    }

    // Проверяем время
    return currentTime >= settings.scheduleStart && currentTime <= settings.scheduleEnd
  }

  /**
   * Очистить неактивные подписки
   */
  async cleanupInactiveSubscriptions(): Promise<void> {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const result = await this.prisma.pushSubscription.deleteMany({
      where: {
        OR: [{ isActive: false }, { lastUsedAt: { lt: thirtyDaysAgo } }],
      },
    })

    this.logger.log(`Cleaned up ${result.count} inactive subscriptions`, 'PushService')
  }
}
