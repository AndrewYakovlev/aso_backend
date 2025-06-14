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
  private readonly retryAttempts: number
  private readonly retryDelay: number

  constructor(private configService: ConfigService) {
    const logging = configService.get<boolean>('database.logging', false)
    const retryAttempts = configService.get<number>('database.retryAttempts', 5)
    const retryDelay = configService.get<number>('database.retryDelay', 3000)

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

    this.retryAttempts = retryAttempts
    this.retryDelay = retryDelay

    if (logging) {
      this.$on('query', (e: Prisma.QueryEvent) => {
        this.logger.debug(`Query: ${e.query} - Params: ${e.params} - Duration: ${e.duration}ms`)
      })
    }

    this.$on('error', (e: Prisma.LogEvent) => {
      this.logger.error(`Prisma error: ${e.message}`)
    })

    this.$on('info', (e: Prisma.LogEvent) => {
      this.logger.log(`Prisma info: ${e.message}`)
    })

    this.$on('warn', (e: Prisma.LogEvent) => {
      this.logger.warn(`Prisma warning: ${e.message}`)
    })
  }

  async onModuleInit() {
    let attempt = 0
    while (attempt < this.retryAttempts) {
      try {
        await this.$connect()
        this.logger.log('Prisma connected to database')
        return
      } catch (error) {
        attempt++
        this.logger.error(
          `Failed to connect to database (attempt ${attempt}/${this.retryAttempts})`,
          error,
        )
        if (attempt === this.retryAttempts) {
          throw error
        }
        await new Promise((resolve) => setTimeout(resolve, this.retryDelay))
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect()
    this.logger.log('Prisma disconnected from database')
  }

  async enableShutdownHooks(app: any) {
    process.on('beforeExit', async () => {
      await app.close()
    })
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

  // Утилиты для обработки ошибок Prisma
  isPrismaError(error: any): error is Prisma.PrismaClientKnownRequestError {
    return error instanceof Prisma.PrismaClientKnownRequestError
  }

  handlePrismaError(error: any): never {
    if (this.isPrismaError(error)) {
      switch (error.code) {
        case 'P2002':
          throw new Error(`Unique constraint violation on ${error.meta?.target}`)
        case 'P2003':
          throw new Error(`Foreign key constraint violation on ${error.meta?.field_name}`)
        case 'P2025':
          throw new Error('Record not found')
        default:
          throw new Error(`Database error: ${error.message}`)
      }
    }
    throw error
  }
}
