// src/modules/users/anonymous-users.service.ts
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@prisma/prisma.service'
import { AnonymousUser } from '@prisma/client'
import { CryptoUtil } from '@common/utils/crypto.util'

export interface CreateAnonymousUserDto {
  userAgent?: string
  ipAddress?: string
}

@Injectable()
export class AnonymousUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateAnonymousUserDto): Promise<AnonymousUser> {
    const sessionId = CryptoUtil.generateSessionId()

    return this.prisma.anonymousUser.create({
      data: {
        sessionId,
        userAgent: data.userAgent,
        ipAddress: data.ipAddress,
      },
    })
  }

  async findBySessionId(sessionId: string): Promise<AnonymousUser | null> {
    return this.prisma.anonymousUser.findUnique({
      where: { sessionId },
    })
  }

  async updateActivity(sessionId: string): Promise<void> {
    await this.prisma.anonymousUser.update({
      where: { sessionId },
      data: { lastActivity: new Date() },
    })
  }

  async deleteOldSessions(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    const result = await this.prisma.anonymousUser.deleteMany({
      where: {
        lastActivity: {
          lt: cutoffDate,
        },
      },
    })

    return result.count
  }

  async getActiveSessionsCount(minutes: number = 30): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setMinutes(cutoffDate.getMinutes() - minutes)

    return this.prisma.anonymousUser.count({
      where: {
        lastActivity: {
          gte: cutoffDate,
        },
      },
    })
  }

  async convertToUser(sessionId: string, userId: string): Promise<void> {
    // Переносим корзину анонимного пользователя к зарегистрированному
    await this.prisma.cart.updateMany({
      where: {
        anonymousId: sessionId,
        userId: null,
      },
      data: {
        userId,
        anonymousId: null,
      },
    })

    // Переносим чаты
    await this.prisma.chat.updateMany({
      where: {
        anonymousId: sessionId,
        userId: null,
      },
      data: {
        userId,
        anonymousId: null,
      },
    })

    // Переносим историю просмотров
    await this.prisma.viewHistory.updateMany({
      where: {
        anonymousId: sessionId,
        userId: null,
      },
      data: {
        userId,
        anonymousId: null,
      },
    })
  }
}
