// src/modules/notifications/services/notification-settings.service.ts
import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { UpdateNotificationSettingsDto } from '../dto/update-notification-settings.dto'

@Injectable()
export class NotificationSettingsService {
  constructor(private prisma: PrismaService) {}

  async getSettings(userId: string) {
    const settings = await this.prisma.notificationSettings.findUnique({
      where: { userId },
    })

    if (!settings) {
      // Создаем настройки по умолчанию
      return this.prisma.notificationSettings.create({
        data: { userId },
      })
    }

    return settings
  }

  async updateSettings(userId: string, dto: UpdateNotificationSettingsDto) {
    return this.prisma.notificationSettings.upsert({
      where: { userId },
      create: {
        userId,
        ...dto,
      },
      update: dto,
    })
  }

  async getActiveSubscriptions(userId: string) {
    return this.prisma.pushSubscription.findMany({
      where: {
        userId,
        isActive: true,
      },
      select: {
        id: true,
        endpoint: true,
        deviceName: true,
        userAgent: true,
        createdAt: true,
        lastUsedAt: true,
      },
    })
  }

  async removeSubscription(userId: string, subscriptionId: string) {
    const subscription = await this.prisma.pushSubscription.findFirst({
      where: {
        id: subscriptionId,
        userId,
      },
    })

    if (!subscription) {
      throw new NotFoundException('Subscription not found')
    }

    await this.prisma.pushSubscription.delete({
      where: { id: subscriptionId },
    })
  }
}
