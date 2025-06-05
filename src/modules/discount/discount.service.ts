// src/modules/discount/discount.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { Prisma, DiscountType, UserRole } from '@prisma/client'
import { CalculateCartDto } from './dto/calculate-cart.dto'
import {
  CartCalculationResponseDto,
  ItemCalculationDto,
  AppliedDiscountDto,
} from './dto/cart-calculation-response.dto'
import { CartItemResponseDto } from '../cart/dto/cart-response.dto'
import { LoggerService } from '../../logger/logger.service'
import { Cacheable } from '@common/decorators/cacheable.decorator'
import { CacheKeys, CacheTTL } from '../../redis/redis.constants'

interface DiscountInfo {
  type: 'PERSONAL' | 'GROUP' | 'PROMO'
  name: string
  description?: string
  percent: number
  fixedAmount?: number
  discountRuleId?: string
  promoCode?: string
  conditions?: {
    minAmount?: number
    maxDiscount?: number
    categories?: string[]
    brands?: string[]
  }
}

@Injectable()
export class DiscountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Рассчитать корзину с учетом скидок
   */
  async calculateCart(dto: CalculateCartDto): Promise<CartCalculationResponseDto> {
    // Фильтруем только доступные товары
    const availableItems = dto.items.filter((item) => item.isAvailable)

    if (availableItems.length === 0) {
      return {
        items: [],
        subtotal: 0,
        totalDiscount: 0,
        total: 0,
        warnings: ['Все товары в корзине недоступны'],
      }
    }

    // Считаем общую сумму без скидок
    const subtotal = availableItems.reduce((sum, item) => sum + item.total, 0)

    // Получаем информацию о пользователе и его скидках
    let userDiscounts: DiscountInfo[] = []
    if (dto.userId) {
      userDiscounts = await this.getUserDiscounts(dto.userId)
    }

    // Проверяем промокод
    let promoDiscount: DiscountInfo | null = null
    if (dto.promoCode) {
      try {
        promoDiscount = await this.validatePromoCode(dto.promoCode, dto.userId, subtotal)
      } catch (error: any) {
        // Добавляем предупреждение, но продолжаем расчет
        userDiscounts.push({
          type: 'PROMO',
          name: 'Промокод',
          percent: 0,
          description: error.message,
        })
      }
    }

    // Определяем применимую скидку по приоритету
    const applicableDiscount = this.selectBestDiscount(
      userDiscounts,
      promoDiscount,
      availableItems,
      subtotal,
    )

    // Рассчитываем скидки для каждого товара
    const { items, totalDiscountAmount } = this.calculateItemsWithDiscount(
      availableItems,
      applicableDiscount,
    )

    // Формируем информацию о примененной скидке
    let appliedDiscount: AppliedDiscountDto | undefined
    if (applicableDiscount && totalDiscountAmount > 0) {
      appliedDiscount = {
        type: applicableDiscount.type,
        name: applicableDiscount.name,
        description: applicableDiscount.description,
        percent: applicableDiscount.percent,
        fixedAmount: applicableDiscount.fixedAmount,
        totalAmount: totalDiscountAmount,
        discountRuleId: applicableDiscount.discountRuleId,
        promoCode: applicableDiscount.promoCode,
      }
    }

    // Собираем информацию о доступных, но не примененных скидках
    const availableDiscounts = this.getAvailableDiscounts(
      userDiscounts,
      promoDiscount,
      applicableDiscount,
    )

    // Формируем предупреждения
    const warnings = this.generateWarnings(dto, availableItems, applicableDiscount)

    return {
      items,
      subtotal,
      appliedDiscount,
      totalDiscount: totalDiscountAmount,
      total: subtotal - totalDiscountAmount,
      availableDiscounts,
      warnings,
    }
  }

  /**
   * Получить скидки пользователя
   */
  private async getUserDiscounts(userId: string): Promise<DiscountInfo[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        customerGroup: {
          include: {
            discountRules: {
              where: {
                isActive: true,
                OR: [{ startDate: null }, { startDate: { lte: new Date() } }],
                AND: [{ OR: [{ endDate: null }, { endDate: { gte: new Date() } }] }],
              },
            },
          },
        },
      },
    })

    if (!user) {
      return []
    }

    const discounts: DiscountInfo[] = []

    // Персональная скидка
    if (user.personalDiscount && Number(user.personalDiscount) > 0) {
      discounts.push({
        type: 'PERSONAL',
        name: 'Персональная скидка',
        percent: Number(user.personalDiscount),
      })
    }

    // Скидка группы
    if (user.customerGroup && Number(user.customerGroup.discountPercent) > 0) {
      discounts.push({
        type: 'GROUP',
        name: `Скидка группы "${user.customerGroup.name}"`,
        percent: Number(user.customerGroup.discountPercent),
      })

      // Дополнительные правила группы
      for (const rule of user.customerGroup.discountRules) {
        const conditions: any = {}

        if (rule.minAmount) conditions.minAmount = Number(rule.minAmount)
        if (rule.maxDiscount) conditions.maxDiscount = Number(rule.maxDiscount)
        if (rule.categories) conditions.categories = rule.categories as string[]
        if (rule.brands) conditions.brands = rule.brands as string[]

        discounts.push({
          type: 'GROUP',
          name: rule.name,
          percent: rule.type === DiscountType.PERCENTAGE ? Number(rule.value) : 0,
          fixedAmount: rule.type === DiscountType.FIXED ? Number(rule.value) : undefined,
          discountRuleId: rule.id,
          conditions,
        })
      }
    }

    return discounts
  }

  /**
   * Валидация промокода
   */
  @Cacheable({
    key: (code: string) => `${CacheKeys.PROMO}validate:${code}`,
    ttl: 60, // 1 минута
  })
  private async validatePromoCode(
    code: string,
    userId?: string,
    cartAmount?: number,
  ): Promise<DiscountInfo> {
    const promoCode = await this.prisma.promoCode.findFirst({
      where: {
        code: code.toUpperCase(),
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
      },
      include: {
        discountRule: true,
        usage: userId
          ? {
              where: { userId },
            }
          : false,
      },
    })

    if (!promoCode) {
      throw new BadRequestException('Промокод недействителен')
    }

    // Проверка лимита использования
    if (promoCode.usageLimit && promoCode.usageCount >= promoCode.usageLimit) {
      throw new BadRequestException('Промокод больше не действителен')
    }

    // Проверка персонального промокода
    if (promoCode.personalUserId && promoCode.personalUserId !== userId) {
      throw new BadRequestException('Этот промокод вам не принадлежит')
    }

    // Проверка повторного использования
    if (userId && promoCode.usage && promoCode.usage.length > 0) {
      throw new BadRequestException('Вы уже использовали этот промокод')
    }

    // Проверка минимальной суммы
    if (
      cartAmount &&
      promoCode.discountRule.minAmount &&
      cartAmount < Number(promoCode.discountRule.minAmount)
    ) {
      throw new BadRequestException(
        `Минимальная сумма заказа для этого промокода: ${promoCode.discountRule.minAmount} ₽`,
      )
    }

    const conditions: any = {}
    if (promoCode.discountRule.minAmount) {
      conditions.minAmount = Number(promoCode.discountRule.minAmount)
    }
    if (promoCode.discountRule.maxDiscount) {
      conditions.maxDiscount = Number(promoCode.discountRule.maxDiscount)
    }
    if (promoCode.discountRule.categories) {
      conditions.categories = promoCode.discountRule.categories as string[]
    }
    if (promoCode.discountRule.brands) {
      conditions.brands = promoCode.discountRule.brands as string[]
    }

    return {
      type: 'PROMO',
      name: `Промокод ${code.toUpperCase()}`,
      description: promoCode.discountRule.name,
      percent:
        promoCode.discountRule.type === DiscountType.PERCENTAGE
          ? Number(promoCode.discountRule.value)
          : 0,
      fixedAmount:
        promoCode.discountRule.type === DiscountType.FIXED
          ? Number(promoCode.discountRule.value)
          : undefined,
      discountRuleId: promoCode.discountRule.id,
      promoCode: promoCode.code,
      conditions,
    }
  }

  /**
   * Выбрать лучшую скидку по приоритету
   */
  private selectBestDiscount(
    userDiscounts: DiscountInfo[],
    promoDiscount: DiscountInfo | null,
    items: CartItemResponseDto[],
    subtotal: number,
  ): DiscountInfo | null {
    const allDiscounts = [...userDiscounts]
    if (promoDiscount) {
      allDiscounts.push(promoDiscount)
    }

    // Фильтруем применимые скидки
    const applicableDiscounts = allDiscounts.filter((discount) => {
      // Проверяем минимальную сумму
      if (discount.conditions?.minAmount && subtotal < discount.conditions.minAmount) {
        return false
      }

      // Проверяем категории/бренды
      if (discount.conditions?.categories || discount.conditions?.brands) {
        const hasApplicableItems = items.some((item) => {
          if (!item.product) return false

          // Проверка категорий
          if (discount.conditions?.categories) {
            const itemCategories: string[] = []
            const hasCategory = discount.conditions.categories.some((catId) =>
              itemCategories.includes(catId),
            )
            if (!hasCategory) return false
          }

          // Проверка брендов
          if (discount.conditions?.brands) {
            const hasBrand = discount.conditions.brands.includes(item.product.brand.id)
            if (!hasBrand) return false
          }

          return true
        })

        if (!hasApplicableItems) return false
      }

      return true
    })

    if (applicableDiscounts.length === 0) {
      return null
    }

    // Сортируем по приоритету: PERSONAL > GROUP > PROMO
    const priorityOrder = { PERSONAL: 0, GROUP: 1, PROMO: 2 }
    applicableDiscounts.sort((a, b) => {
      const priorityDiff = priorityOrder[a.type] - priorityOrder[b.type]
      if (priorityDiff !== 0) return priorityDiff

      // При одинаковом типе выбираем большую скидку
      const aValue = this.calculateDiscountValue(a, subtotal)
      const bValue = this.calculateDiscountValue(b, subtotal)
      return bValue - aValue
    })

    return applicableDiscounts[0]
  }

  /**
   * Рассчитать значение скидки
   */
  private calculateDiscountValue(discount: DiscountInfo, amount: number): number {
    if (discount.fixedAmount) {
      return Math.min(discount.fixedAmount, amount)
    }

    let discountAmount = (amount * discount.percent) / 100

    // Применяем максимальную скидку если есть
    if (discount.conditions?.maxDiscount) {
      discountAmount = Math.min(discountAmount, discount.conditions.maxDiscount)
    }

    return discountAmount
  }

  /**
   * Рассчитать товары со скидкой
   */
  private calculateItemsWithDiscount(
    items: CartItemResponseDto[],
    discount: DiscountInfo | null,
  ): { items: ItemCalculationDto[]; totalDiscountAmount: number } {
    let totalDiscountAmount = 0

    const calculatedItems = items.map((item) => {
      const subtotal = item.total
      let hasDiscount = false
      let discountPercent = 0
      let discountAmount = 0
      let discountNotAppliedReason: string | undefined

      if (discount && item.product) {
        // Проверяем применимость скидки к товару
        let canApplyDiscount = true

        // Проверка категорий
        if (discount.conditions?.categories) {
          const itemCategories: string[] = []
          const hasCategory = discount.conditions.categories.some((catId) =>
            itemCategories.includes(catId),
          )
          if (!hasCategory) {
            canApplyDiscount = false
            discountNotAppliedReason = 'Товар не из категории со скидкой'
          }
        }

        // Проверка брендов
        if (canApplyDiscount && discount.conditions?.brands) {
          const hasBrand = discount.conditions.brands.includes(item.product.brand.id)
          if (!hasBrand) {
            canApplyDiscount = false
            discountNotAppliedReason = 'Бренд товара не участвует в акции'
          }
        }

        if (canApplyDiscount) {
          hasDiscount = true
          discountPercent = discount.percent

          if (discount.fixedAmount) {
            // Для фиксированной скидки распределяем пропорционально
            const itemRatio = subtotal / items.reduce((sum, i) => sum + i.total, 0)
            discountAmount = Math.floor(discount.fixedAmount * itemRatio)
          } else {
            discountAmount = Math.floor((subtotal * discountPercent) / 100)
          }

          totalDiscountAmount += discountAmount
        }
      } else if (discount && !item.product) {
        // Товары из чата могут не участвовать в скидках
        discountNotAppliedReason = 'Скидки не применяются к товарам из чата'
      }

      const productName = item.product?.name || item.chatProduct?.name || 'Неизвестный товар'
      const sku = item.product?.sku || item.chatProduct?.sku || 'N/A'

      return {
        cartItemId: item.id,
        productName,
        sku,
        quantity: item.quantity,
        price: item.price,
        subtotal,
        hasDiscount,
        discountPercent,
        discountAmount,
        total: subtotal - discountAmount,
        discountNotAppliedReason,
      }
    })

    // Применяем ограничение максимальной скидки
    if (
      discount?.conditions?.maxDiscount &&
      totalDiscountAmount > discount.conditions.maxDiscount
    ) {
      const ratio = discount.conditions.maxDiscount / totalDiscountAmount

      calculatedItems.forEach((item) => {
        if (item.hasDiscount) {
          item.discountAmount = Math.floor(item.discountAmount * ratio)
          item.total = item.subtotal - item.discountAmount
        }
      })

      totalDiscountAmount = discount.conditions.maxDiscount
    }

    return { items: calculatedItems, totalDiscountAmount }
  }

  /**
   * Получить список доступных скидок
   */
  private getAvailableDiscounts(
    userDiscounts: DiscountInfo[],
    promoDiscount: DiscountInfo | null,
    appliedDiscount: DiscountInfo | null,
  ): Array<{ type: string; name: string; percent: number; reason: string }> {
    const available: Array<{ type: string; name: string; percent: number; reason: string }> = []

    const allDiscounts = [...userDiscounts]
    if (promoDiscount) {
      allDiscounts.push(promoDiscount)
    }

    for (const discount of allDiscounts) {
      if (discount === appliedDiscount) continue

      let reason = ''

      if (appliedDiscount && appliedDiscount.type === 'PERSONAL') {
        reason = 'Применена персональная скидка с высшим приоритетом'
      } else if (appliedDiscount && appliedDiscount.type === 'GROUP' && discount.type === 'PROMO') {
        reason = 'Применена скидка группы с более высоким приоритетом'
      } else if (discount.conditions?.minAmount) {
        reason = `Требуется минимальная сумма заказа: ${discount.conditions.minAmount} ₽`
      } else if (discount.percent === 0 && !discount.fixedAmount) {
        reason = discount.description || 'Скидка недоступна'
      } else {
        reason = 'Применена другая скидка'
      }

      available.push({
        type: discount.type,
        name: discount.name,
        percent: discount.percent,
        reason,
      })
    }

    return available
  }

  /**
   * Генерация предупреждений
   */
  private generateWarnings(
    dto: CalculateCartDto,
    availableItems: CartItemResponseDto[],
    appliedDiscount: DiscountInfo | null,
  ): string[] {
    const warnings: string[] = []

    // Предупреждение о недоступных товарах
    const unavailableCount = dto.items.length - availableItems.length
    if (unavailableCount > 0) {
      warnings.push(`${unavailableCount} товар(ов) недоступны и исключены из расчета`)
    }

    // Предупреждение о максимальной скидке
    if (appliedDiscount?.conditions?.maxDiscount) {
      warnings.push(
        `Применено ограничение максимальной скидки: ${appliedDiscount.conditions.maxDiscount} ₽`,
      )
    }

    // Предупреждение о товарах без скидки
    if (appliedDiscount?.conditions?.categories || appliedDiscount?.conditions?.brands) {
      warnings.push('Скидка применена только к товарам из определенных категорий/брендов')
    }

    return warnings
  }
}
