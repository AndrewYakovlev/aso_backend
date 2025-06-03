// src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common'
import { PrismaClient, Prisma } from '@prisma/client'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class PrismaService
  extends PrismaClient<Prisma.PrismaClientOptions, 'query' | 'error' | 'info' | 'warn'>
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name)

  constructor(private configService: ConfigService) {
    const logging = configService.get<boolean>('database.logging', false)

    super({
      log: logging
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'info' },
            { emit: 'event', level: 'warn' },
          ]
        : ['error'],
      errorFormat: 'minimal',
    })

    if (logging) {
      this.$on('query', (e: Prisma.QueryEvent) => {
        this.logger.debug(`Query: ${e.query} - Params: ${e.params} - Duration: ${e.duration}ms`)
      })
    }
  }

  async onModuleInit() {
    try {
      await this.$connect()
      this.logger.log('Prisma connected to database')
    } catch (error) {
      this.logger.error('Failed to connect to database', error)
      throw error
    }
  }

  async onModuleDestroy() {
    await this.$disconnect()
    this.logger.log('Prisma disconnected from database')
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('cleanDatabase is not allowed in production')
    }

    // Используем транзакцию для удаления всех данных
    // Порядок важен из-за foreign key constraints
    await this.$transaction([
      // Сначала удаляем зависимые таблицы
      this.promoCodeUsage.deleteMany(),
      this.payment.deleteMany(),
      this.orderStatusLog.deleteMany(),
      this.orderItem.deleteMany(),
      this.order.deleteMany(),
      this.cartItem.deleteMany(),
      this.cart.deleteMany(),
      this.chatProduct.deleteMany(),
      this.message.deleteMany(),
      this.chat.deleteMany(),
      this.viewHistory.deleteMany(),
      this.favorite.deleteMany(),
      this.crossReference.deleteMany(),
      this.vehicleApplication.deleteMany(),
      this.vehicleModification.deleteMany(),
      this.vehicleGeneration.deleteMany(),
      this.vehicleModel.deleteMany(),
      this.vehicleMake.deleteMany(),
      this.productCharacteristic.deleteMany(),
      this.characteristicValue.deleteMany(),
      this.characteristic.deleteMany(),
      this.productImage.deleteMany(),
      this.productCategory.deleteMany(),
      this.product.deleteMany(),
      this.brand.deleteMany(),
      this.category.deleteMany(),
      this.promoCode.deleteMany(),
      this.discountRule.deleteMany(),
      this.customerGroup.deleteMany(),
      this.paymentMethod.deleteMany(),
      this.deliveryMethod.deleteMany(),
      this.orderStatus.deleteMany(),
      this.chatStatus.deleteMany(),
      this.anonymousUser.deleteMany(),
      this.user.deleteMany(),
    ])
  }
}
