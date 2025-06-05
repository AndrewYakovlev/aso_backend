// src/modules/orders/orders.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { DeliveryMethod, Order, OrderStatus, Prisma, UserRole } from '@prisma/client'
import { CreateOrderDto } from './dto/create-order.dto'
import { OrderFiltersDto } from './dto/order-filters.dto'
import { OrderResponseDto, CreateOrderResponseDto } from './dto/order-response.dto'
import { CartService } from '../cart/cart.service'
import { DiscountService } from '../discount/discount.service'
import { ProductsService } from '../products/products.service'
import { PrismaErrorHelper } from '@common/helpers/prisma-error.helper'
import { LoggerService } from '../../logger/logger.service'
import { PaginationUtil } from '@common/utils/pagination.util'
import { PaginatedResult } from '@common/interfaces/paginated-result.interface'
import { ConfigService } from '@nestjs/config'
import { DeliveryMethodResponseDto } from './dto/delivery-method-response.dto'
import { PaymentMethodResponseDto } from './dto/payment-method-response.dto'
import { CalculateShippingDto, ShippingCalculationResponseDto } from './dto/calculate-shipping.dto'
import { OrderStatusLogResponseDto } from './dto/order-status-log-response.dto'
import { UpdateOrderStatusDto } from './dto/update-order-status.dto'

@Injectable()
export class OrdersService {
  private readonly minOrderAmount: number

  constructor(
    private readonly prisma: PrismaService,
    private readonly cartService: CartService,
    private readonly discountService: DiscountService,
    private readonly productsService: ProductsService,
    private readonly logger: LoggerService,
    private readonly configService: ConfigService,
  ) {
    this.minOrderAmount = this.configService.get<number>('MIN_ORDER_AMOUNT', 500)
  }

  /**
   * Создать заказ из корзины
   */
  async create(dto: CreateOrderDto, userId: string): Promise<CreateOrderResponseDto> {
    try {
      // Получаем корзину пользователя
      const cart = await this.cartService.getCart(userId)

      if (cart.items.length === 0) {
        throw new BadRequestException('Корзина пуста')
      }

      // Фильтруем только доступные товары
      const availableItems = cart.items.filter((item) => item.isAvailable)

      if (availableItems.length === 0) {
        throw new BadRequestException('Все товары в корзине недоступны')
      }

      // Рассчитываем корзину со скидками
      const calculation = await this.discountService.calculateCart({
        items: cart.items,
        promoCode: dto.promoCode,
        userId,
      })

      // Проверяем минимальную сумму заказа
      if (calculation.total < this.minOrderAmount) {
        throw new BadRequestException(
          `Минимальная сумма заказа: ${this.minOrderAmount} ₽. Текущая сумма: ${calculation.total} ₽`,
        )
      }

      // Проверяем методы доставки и оплаты
      const [deliveryMethod, paymentMethod] = await Promise.all([
        this.validateDeliveryMethod(dto.deliveryMethodId, calculation.total),
        this.validatePaymentMethod(dto.paymentMethodId, calculation.total),
      ])

      // Рассчитываем стоимость доставки
      const shippingAmount = await this.calculateShipping(deliveryMethod, calculation.total)

      // Получаем начальный статус заказа
      const initialStatus = await this.prisma.orderStatus.findFirst({
        where: { isInitial: true, isActive: true },
      })

      if (!initialStatus) {
        throw new Error('Начальный статус заказа не настроен')
      }

      // Получаем промокод если указан
      let promoCodeId: string | undefined
      if (dto.promoCode && calculation.appliedDiscount?.promoCode) {
        const promoCode = await this.prisma.promoCode.findFirst({
          where: { code: dto.promoCode.toUpperCase() },
        })
        promoCodeId = promoCode?.id
      }

      // Начинаем транзакцию
      const order = await this.prisma.$transaction(async (tx) => {
        // Генерируем номер заказа
        const orderNumber = await this.generateOrderNumber(tx)

        // Создаем заказ
        const newOrder = await tx.order.create({
          data: {
            orderNumber,
            userId,
            statusId: initialStatus.id,
            subtotal: calculation.subtotal,
            discountAmount: calculation.totalDiscount,
            shippingAmount: Number(shippingAmount),
            totalAmount: calculation.total + Number(shippingAmount),
            deliveryMethodId: dto.deliveryMethodId,
            paymentMethodId: dto.paymentMethodId,
            shippingAddress: dto.shippingAddress
              ? JSON.parse(JSON.stringify(dto.shippingAddress))
              : null,
            comment: dto.comment,
            promoCodeId,
          },
        })

        // Создаем элементы заказа
        for (const item of availableItems) {
          const calculatedItem = calculation.items.find((ci) => ci.cartItemId === item.id)

          if (!calculatedItem) continue

          await tx.orderItem.create({
            data: {
              orderId: newOrder.id,
              productId: item.productId,
              chatProductId: item.chatProductId,
              quantity: item.quantity,
              price: calculatedItem.price,
              total: calculatedItem.total,
            },
          })

          // Уменьшаем остатки для обычных товаров
          if (item.productId) {
            const updated = await tx.product.update({
              where: { id: item.productId },
              data: {
                stock: {
                  decrement: item.quantity,
                },
              },
            })

            if (updated.stock < 0) {
              throw new BadRequestException(`Недостаточно товара "${item.product?.name}" на складе`)
            }
          }
        }

        // Создаем запись в истории статусов
        await tx.orderStatusLog.create({
          data: {
            orderId: newOrder.id,
            statusId: initialStatus.id,
            createdById: userId,
            comment: 'Заказ создан',
          },
        })

        // Увеличиваем счетчик использования промокода
        if (promoCodeId) {
          await tx.promoCode.update({
            where: { id: promoCodeId },
            data: {
              usageCount: { increment: 1 },
            },
          })

          // Создаем запись об использовании
          await tx.promoCodeUsage.create({
            data: {
              promoCodeId,
              userId,
              orderId: newOrder.id,
            },
          })
        }

        // Очищаем корзину
        await tx.cartItem.deleteMany({
          where: {
            cart: {
              userId,
            },
          },
        })

        return newOrder
      })

      const fullOrder = await this.prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        include: this.getOrderInclude(),
      })

      // Используем fromEntity из CreateOrderResponseDto для правильной типизации
      const response = CreateOrderResponseDto.fromEntity(fullOrder)

      // Если онлайн оплата, генерируем URL
      if (paymentMethod.isOnline) {
        response.paymentUrl = await this.generatePaymentUrl(fullOrder)
      }

      this.sendOrderNotifications(fullOrder).catch((error) => {
        this.logger.error('Ошибка отправки уведомлений о заказе', error)
      })

      return response
    } catch (error) {
      PrismaErrorHelper.handleError(error as Error)
    }
  }

  /**
   * Получить список заказов
   */
  async findAll(
    filters: OrderFiltersDto,
    currentUserId?: string,
  ): Promise<PaginatedResult<OrderResponseDto>> {
    const where: Prisma.OrderWhereInput = {}

    if (currentUserId && filters.userId !== currentUserId) {
      where.userId = currentUserId
    } else if (filters.userId) {
      where.userId = filters.userId
    }

    if (filters.search) {
      where.orderNumber = {
        contains: filters.search,
        mode: 'insensitive',
      }
    }

    if (filters.statusId) {
      where.statusId = filters.statusId
    }

    if (filters.statusIds && filters.statusIds.length > 0) {
      where.statusId = { in: filters.statusIds }
    }

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {}
      if (filters.dateFrom) {
        where.createdAt.gte = new Date(filters.dateFrom)
      }
      if (filters.dateTo) {
        where.createdAt.lte = new Date(filters.dateTo)
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: this.getOrderInclude(),
        skip:
          filters.page && filters.limit ? PaginationUtil.getSkip(filters.page, filters.limit) : 0,
        take: filters.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ])

    const data = items.map((item) => OrderResponseDto.fromEntity(item))

    return PaginationUtil.createPaginatedResult(data, total, filters.page || 1, filters.limit || 20)
  }

  /**
   * Получить заказ по ID
   */
  async findOne(id: string, currentUserId?: string): Promise<OrderResponseDto> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: this.getOrderInclude(),
    })

    if (!order) {
      throw new NotFoundException('Заказ не найден')
    }

    if (currentUserId && order.userId !== currentUserId) {
      throw new NotFoundException('Заказ не найден')
    }

    return OrderResponseDto.fromEntity(order)
  }

  /**
   * Генерация номера заказа
   */
  private async generateOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
    const today = new Date()
    const datePrefix = today.toISOString().slice(2, 10).replace(/-/g, '') // YYMMDD

    const lastOrder = await tx.order.findFirst({
      where: {
        orderNumber: {
          startsWith: datePrefix,
        },
      },
      orderBy: {
        orderNumber: 'desc',
      },
    })

    let sequence = 1
    if (lastOrder) {
      const lastSequence = parseInt(lastOrder.orderNumber.slice(-3))
      sequence = lastSequence + 1
    }

    return `${datePrefix}-${sequence.toString().padStart(3, '0')}`
  }

  /**
   * Генерация URL для оплаты
   */
  private async generatePaymentUrl(order: any): Promise<string> {
    // TODO: Интеграция с платежной системой
    return `/payment/${order.id}`
  }

  /**
   * Отправка уведомлений о заказе
   */
  private async sendOrderNotifications(order: any): Promise<void> {
    // TODO: Отправка SMS/Email клиенту
    // TODO: Уведомление менеджеров в Telegram
    this.logger.log(`Отправка уведомлений для заказа ${order.orderNumber}`)
  }

  /**
   * Include для запросов заказов
   */
  private getOrderInclude() {
    return {
      status: true,
      deliveryMethod: true,
      paymentMethod: true,
      promoCode: true,
      items: {
        include: {
          product: {
            include: {
              brand: true,
              images: {
                take: 1,
                orderBy: { sortOrder: 'asc' as const },
              },
            },
          },
          chatProduct: {
            include: {
              images: {
                orderBy: { sortOrder: 'asc' as const },
              },
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          phone: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    }
  }

  /**
   * Получить доступные методы доставки с расчетом стоимости
   */
  async getDeliveryMethods(cartAmount?: number): Promise<DeliveryMethodResponseDto[]> {
    const methods = await this.prisma.deliveryMethod.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    })

    return methods.map((method) => DeliveryMethodResponseDto.fromEntity(method, cartAmount))
  }

  /**
   * Получить доступные методы оплаты с проверкой условий
   */
  async getPaymentMethods(orderAmount?: number): Promise<PaymentMethodResponseDto[]> {
    const methods = await this.prisma.paymentMethod.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    })

    return methods.map((method) => PaymentMethodResponseDto.fromEntity(method, orderAmount))
  }

  /**
   * Рассчитать стоимость доставки (приватный метод)
   */
  private async calculateShipping(
    deliveryMethod: DeliveryMethod,
    orderAmount: number,
  ): Promise<number> {
    if (deliveryMethod.minAmount === null || deliveryMethod.minAmount === undefined) {
      return Number(deliveryMethod.price)
    }

    if (orderAmount >= Number(deliveryMethod.minAmount)) {
      return 0
    }

    return Number(deliveryMethod.price)
  }

  /**
   * Рассчитать стоимость доставки (публичный метод для контроллера)
   */
  async calculateShippingCost(dto: CalculateShippingDto): Promise<ShippingCalculationResponseDto> {
    const deliveryMethodEntity = await this.prisma.deliveryMethod.findUnique({
      where: { id: dto.deliveryMethodId },
    })

    if (!deliveryMethodEntity) {
      throw new NotFoundException('Метод доставки не найден')
    }

    const calculatedPrice = await this.calculateShipping(deliveryMethodEntity, dto.orderAmount)

    const isFreeShipping =
      deliveryMethodEntity.minAmount !== null &&
      dto.orderAmount >= Number(deliveryMethodEntity.minAmount)
    let amountToFreeShipping: number | undefined = undefined

    if (deliveryMethodEntity.minAmount !== null && !isFreeShipping) {
      amountToFreeShipping = Math.max(0, Number(deliveryMethodEntity.minAmount) - dto.orderAmount)
    }

    return {
      deliveryMethodId: deliveryMethodEntity.id,
      deliveryMethodName: deliveryMethodEntity.name,
      basePrice: Number(deliveryMethodEntity.price),
      calculatedPrice: calculatedPrice,
      isFreeShipping: isFreeShipping,
      freeShippingThreshold: deliveryMethodEntity.minAmount
        ? Number(deliveryMethodEntity.minAmount)
        : undefined,
      amountToFreeShipping: amountToFreeShipping,
    }
  }

  /**
   * Валидация метода доставки с учетом условий
   */
  private async validateDeliveryMethod(id: string, orderAmount?: number) {
    const method = await this.prisma.deliveryMethod.findUnique({
      where: { id },
    })

    if (!method || !method.isActive) {
      throw new BadRequestException('Недопустимый метод доставки')
    }

    // Дополнительные проверки на основе settings
    if (method.settings) {
      const settings = method.settings as any

      if (settings.availableFrom && settings.availableTo) {
        const now = new Date()
        const currentHour = now.getHours()
        if (currentHour < settings.availableFrom || currentHour > settings.availableTo) {
          throw new BadRequestException(
            `Метод доставки "${method.name}" доступен только с ${settings.availableFrom}:00 до ${settings.availableTo}:00`,
          )
        }
      }

      if (settings.availableDays && Array.isArray(settings.availableDays)) {
        const currentDay = new Date().getDay()
        if (!settings.availableDays.includes(currentDay)) {
          throw new BadRequestException(
            `Метод доставки "${method.name}" недоступен в выбранный день`,
          )
        }
      }
    }

    return method
  }

  /**
   * Валидация метода оплаты с учетом условий
   */
  private async validatePaymentMethod(id: string, orderAmount?: number) {
    const method = await this.prisma.paymentMethod.findUnique({
      where: { id },
    })

    if (!method || !method.isActive) {
      throw new BadRequestException('Недопустимый метод оплаты')
    }

    if (method.settings && orderAmount !== undefined) {
      const settings = method.settings as any

      if (settings.minAmount && orderAmount < settings.minAmount) {
        throw new BadRequestException(
          `Минимальная сумма для метода оплаты "${method.name}": ${settings.minAmount} ₽`,
        )
      }

      if (settings.maxAmount && orderAmount > settings.maxAmount) {
        throw new BadRequestException(
          `Максимальная сумма для метода оплаты "${method.name}": ${settings.maxAmount} ₽`,
        )
      }
    }

    return method
  }

  /**
   * Создать начальные методы доставки и оплаты (для seed)
   */
  static async createInitialDeliveryAndPaymentMethods(prisma: PrismaService) {
    const deliveryMethods = [
      {
        name: 'Самовывоз',
        code: 'PICKUP',
        description: 'Самовывоз со склада в Бежецке',
        price: 0,
        minAmount: null,
        settings: {
          address: 'г. Бежецк, ул. Заводская, д. 1',
          workingHours: 'Пн-Пт: 9:00-18:00, Сб: 10:00-16:00',
        },
        sortOrder: 0,
      },
      {
        name: 'Доставка по городу',
        code: 'CITY_DELIVERY',
        description: 'Доставка курьером по Бежецку',
        price: 300,
        minAmount: 3000,
        settings: { availableFrom: 9, availableTo: 21, deliveryTime: '2-4 часа' },
        sortOrder: 1,
      },
      {
        name: 'Доставка по области',
        code: 'REGION_DELIVERY',
        description: 'Доставка по Тверской области',
        price: 500,
        minAmount: 5000,
        settings: { deliveryTime: '1-3 дня', pricePerKm: 10 },
        sortOrder: 2,
      },
      {
        name: 'Транспортная компания',
        code: 'TRANSPORT_COMPANY',
        description: 'Отправка транспортной компанией по России',
        price: 800,
        minAmount: 10000,
        settings: { companies: ['СДЭК', 'ПЭК', 'Деловые линии'], deliveryTime: '3-10 дней' },
        sortOrder: 3,
      },
    ]
    for (const method of deliveryMethods)
      await prisma.deliveryMethod.upsert({
        where: { code: method.code },
        update: method,
        create: method,
      })

    const paymentMethods = [
      {
        name: 'Наличными при получении',
        code: 'CASH',
        description: 'Оплата наличными курьеру или в пункте выдачи',
        icon: '💵',
        isOnline: false,
        commission: 0,
        settings: { maxAmount: 50000 },
        sortOrder: 0,
      },
      {
        name: 'Банковская карта онлайн',
        code: 'CARD_ONLINE',
        description: 'Оплата банковской картой на сайте',
        icon: '💳',
        isOnline: true,
        commission: 2.5,
        settings: { minAmount: 100, provider: 'Сбербанк' },
        sortOrder: 1,
      },
      {
        name: 'Банковский перевод',
        code: 'BANK_TRANSFER',
        description: 'Оплата по счету для юридических лиц',
        icon: '🏦',
        isOnline: false,
        commission: 0,
        settings: { minAmount: 1000, requiresInvoice: true },
        sortOrder: 2,
      },
      {
        name: 'СБП (Система быстрых платежей)',
        code: 'SBP',
        description: 'Оплата через СБП по QR-коду',
        icon: '📱',
        isOnline: true,
        commission: 1,
        settings: { maxAmount: 100000 },
        sortOrder: 3,
      },
    ]
    for (const method of paymentMethods)
      await prisma.paymentMethod.upsert({
        where: { code: method.code },
        update: method,
        create: method,
      })
  }

  /**
   * Изменить статус заказа
   */
  async updateStatus(
    orderId: string,
    dto: UpdateOrderStatusDto,
    userId: string,
    userRole: UserRole,
  ): Promise<OrderResponseDto> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { status: true },
      })
      if (!order) throw new NotFoundException('Заказ не найден')

      const newStatus = await this.prisma.orderStatus.findUnique({ where: { id: dto.statusId } })
      if (!newStatus || !newStatus.isActive) throw new BadRequestException('Недопустимый статус')

      if (order.statusId === dto.statusId)
        throw new BadRequestException('Заказ уже имеет этот статус')

      if (userRole !== UserRole.ADMIN) {
        if (order.status.isFinalSuccess || order.status.isFinalFailure) {
          throw new BadRequestException(
            'Недостаточно прав для изменения заказа в финальном статусе',
          )
        }
        if (newStatus.isFinalFailure) {
          throw new BadRequestException('Недостаточно прав для установки этого статуса')
        }
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: orderId },
          data: { statusId: dto.statusId, updatedAt: new Date() },
        })
        await tx.orderStatusLog.create({
          data: { orderId, statusId: dto.statusId, comment: dto.comment, createdById: userId },
        })
        if (newStatus.isFinalFailure && newStatus.code === 'CANCELLED') {
          const orderItems = await tx.orderItem.findMany({
            where: { orderId },
            include: { product: true },
          })
          for (const item of orderItems) {
            if (item.productId && item.product) {
              await tx.product.update({
                where: { id: item.productId },
                data: { stock: { increment: item.quantity } },
              })
            }
          }
        }
      })

      const fullOrder = await this.prisma.order.findUniqueOrThrow({
        where: { id: orderId },
        include: this.getOrderInclude(),
      })
      this.sendStatusChangeNotification(fullOrder, order.status, newStatus).catch((error) => {
        this.logger.error('Ошибка отправки уведомления о смене статуса', error)
      })

      return OrderResponseDto.fromEntity(fullOrder)
    } catch (error) {
      PrismaErrorHelper.handleError(error as Error)
    }
  }

  /**
   * Получить историю изменения статусов заказа
   */
  async getStatusHistory(
    orderId: string,
    currentUserId?: string,
    userRole?: UserRole,
  ): Promise<OrderStatusLogResponseDto[]> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { userId: true },
    })
    if (!order) throw new NotFoundException('Заказ не найден')

    const isAdminOrManager = userRole === UserRole.ADMIN || userRole === UserRole.MANAGER
    if (!isAdminOrManager && order.userId !== currentUserId) {
      throw new NotFoundException('Заказ не найден')
    }

    const history = await this.prisma.orderStatusLog.findMany({
      where: { orderId },
      include: {
        status: true,
        createdBy: {
          select: { id: true, phone: true, firstName: true, lastName: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return history as OrderStatusLogResponseDto[]
  }

  /**
   * Отменить заказ (для пользователей)
   */
  async cancelOrder(orderId: string, userId: string, reason?: string): Promise<OrderResponseDto> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { status: true },
    })
    if (!order) throw new NotFoundException('Заказ не найден')
    if (order.userId !== userId) throw new NotFoundException('Заказ не найден')
    if (!order.status.canCancelOrder)
      throw new BadRequestException('Заказ не может быть отменен в текущем статусе')

    const cancelledStatus = await this.prisma.orderStatus.findFirst({
      where: { code: 'CANCELLED', isActive: true },
    })
    if (!cancelledStatus) throw new Error('Статус отмены не настроен в системе')

    return this.updateStatus(
      orderId,
      { statusId: cancelledStatus.id, comment: reason || 'Отменен клиентом' },
      userId,
      UserRole.CUSTOMER,
    )
  }

  /**
   * Получить доступные статусы для перехода
   */
  async getAvailableStatuses(orderId: string, userRole: UserRole): Promise<OrderStatus[]> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { statusId: true, status: true },
    })
    if (!order) throw new NotFoundException('Заказ не найден')

    const where: Prisma.OrderStatusWhereInput = { isActive: true, id: { not: order.statusId } }

    if (userRole === UserRole.MANAGER) {
      where.isFinalFailure = false
      if (order.status.isFinalSuccess || order.status.isFinalFailure) return []
    }

    return this.prisma.orderStatus.findMany({ where, orderBy: { sortOrder: 'asc' } })
  }

  /**
   * Отправка уведомления о смене статуса (заглушка)
   */
  private async sendStatusChangeNotification(
    order: any,
    oldStatus: any,
    newStatus: any,
  ): Promise<void> {
    this.logger.log(
      `Смена статуса заказа ${order.orderNumber}: ${oldStatus.name} -> ${newStatus.name}`,
    )
  }

  async getAllStatuses(): Promise<OrderStatus[]> {
    return this.prisma.orderStatus.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    })
  }

  /**
   * Создать начальные статусы заказов (для seed)
   */
  static async createInitialStatuses(prisma: PrismaService) {
    const statuses = [
      {
        name: 'Новый',
        code: 'NEW',
        color: '#2196F3',
        description: 'Заказ создан и ожидает обработки',
        isInitial: true,
        sortOrder: 0,
      },
      {
        name: 'В обработке',
        code: 'PROCESSING',
        color: '#FF9800',
        description: 'Заказ принят в работу',
        sortOrder: 1,
      },
      {
        name: 'Подтвержден',
        code: 'CONFIRMED',
        color: '#4CAF50',
        description: 'Заказ подтвержден, ожидает оплаты',
        sortOrder: 2,
      },
      {
        name: 'Оплачен',
        code: 'PAID',
        color: '#00BCD4',
        description: 'Оплата получена',
        sortOrder: 3,
      },
      {
        name: 'Комплектуется',
        code: 'PACKING',
        color: '#9C27B0',
        description: 'Заказ собирается на складе',
        sortOrder: 4,
      },
      {
        name: 'Передан в доставку',
        code: 'SHIPPING',
        color: '#3F51B5',
        description: 'Заказ передан в службу доставки',
        sortOrder: 5,
      },
      {
        name: 'Доставляется',
        code: 'DELIVERING',
        color: '#009688',
        description: 'Заказ в пути',
        sortOrder: 6,
      },
      {
        name: 'Выполнен',
        code: 'COMPLETED',
        color: '#4CAF50',
        description: 'Заказ доставлен и получен клиентом',
        isFinalSuccess: true,
        canCancelOrder: false,
        sortOrder: 7,
      },
      {
        name: 'Отменен',
        code: 'CANCELLED',
        color: '#F44336',
        description: 'Заказ отменен',
        isFinalFailure: true,
        canCancelOrder: false,
        sortOrder: 8,
      },
      {
        name: 'Возврат',
        code: 'REFUNDED',
        color: '#795548',
        description: 'Заказ возвращен',
        isFinalFailure: true,
        canCancelOrder: false,
        sortOrder: 9,
      },
    ]
    for (const status of statuses) {
      await prisma.orderStatus.upsert({
        where: { code: status.code },
        update: status,
        create: status,
      })
    }
  }
}
