// src/modules/cart/cart.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { Prisma } from '@prisma/client'
import { AddToCartDto } from './dto/add-to-cart.dto'
import { UpdateCartItemDto } from './dto/update-cart-item.dto'
import { CartResponseDto } from './dto/cart-response.dto'
import { PrismaErrorHelper } from '@common/helpers/prisma-error.helper'
import { Cacheable, CacheEvict } from '@common/decorators/cacheable.decorator'
import { CacheKeys, CacheTTL } from '../../redis/redis.constants'
import { RedisService } from '../../redis/redis.service'
import { ProductsService } from '../products/products.service'
import { Cron, CronExpression } from '@nestjs/schedule'
import { LoggerService } from '../../logger/logger.service'

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly productsService: ProductsService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Получить или создать корзину для пользователя
   */
  private async getOrCreateCart(userId?: string, anonymousId?: string): Promise<any> {
    if (!userId && !anonymousId) {
      throw new BadRequestException('Требуется идентификатор пользователя')
    }

    // Сначала пытаемся найти существующую корзину
    let cart = await this.prisma.cart.findFirst({
      where: userId ? { userId } : { anonymousId },
      include: this.getCartInclude(),
    })

    // Если корзины нет, создаем новую
    if (!cart) {
      cart = await this.prisma.cart.create({
        data: userId ? { userId } : { anonymousId: anonymousId! },
        include: this.getCartInclude(),
      })
    }

    return cart
  }

  /**
   * Получить корзину пользователя
   */
  @Cacheable({
    key: (userId?: string, anonymousId?: string) => `${CacheKeys.CART}${userId || anonymousId}`,
    ttl: CacheTTL.CART,
  })
  async getCart(userId?: string, anonymousId?: string): Promise<CartResponseDto> {
    const cart = await this.getOrCreateCart(userId, anonymousId)
    return CartResponseDto.fromEntity(cart)
  }

  /**
   * Добавить товар в корзину
   */
  @CacheEvict({
    key: (dto: AddToCartDto, userId?: string, anonymousId?: string) =>
      `${CacheKeys.CART}${userId || anonymousId}`,
  })
  async addToCart(
    dto: AddToCartDto,
    userId?: string,
    anonymousId?: string,
  ): Promise<CartResponseDto> {
    try {
      // Валидация: должен быть указан либо productId, либо chatProductId
      if (!dto.productId && !dto.chatProductId) {
        throw new BadRequestException('Необходимо указать productId или chatProductId')
      }

      if (dto.productId && dto.chatProductId) {
        throw new BadRequestException('Нельзя указывать одновременно productId и chatProductId')
      }

      const cart = await this.getOrCreateCart(userId, anonymousId)

      // Если добавляем обычный товар
      if (dto.productId) {
        // Проверяем существование и доступность товара
        const product = await this.productsService.findById(dto.productId)
        if (!product) {
          throw new NotFoundException('Товар не найден')
        }

        if (!product.isActive) {
          throw new BadRequestException('Товар недоступен')
        }

        if (product.stock < dto.quantity) {
          throw new BadRequestException(`Недостаточно товара на складе. Доступно: ${product.stock}`)
        }

        // Проверяем, есть ли уже этот товар в корзине
        const existingItem = await this.prisma.cartItem.findFirst({
          where: {
            cartId: cart.id,
            productId: dto.productId,
            chatProductId: null,
          },
        })

        if (existingItem) {
          // Обновляем количество
          const newQuantity = existingItem.quantity + dto.quantity

          if (product.stock < newQuantity) {
            throw new BadRequestException(
              `Недостаточно товара на складе. Доступно: ${product.stock}`,
            )
          }

          await this.prisma.cartItem.update({
            where: { id: existingItem.id },
            data: {
              quantity: newQuantity,
              price: product.price,
            },
          })
        } else {
          // Создаем новый элемент корзины
          await this.prisma.cartItem.create({
            data: {
              cartId: cart.id,
              productId: dto.productId,
              quantity: dto.quantity,
              price: product.price,
            },
          })
        }
      }

      // Если добавляем товар из чата
      if (dto.chatProductId) {
        // Проверяем существование товара из чата
        const chatProduct = await this.prisma.chatProduct.findUnique({
          where: { id: dto.chatProductId },
        })

        if (!chatProduct) {
          throw new NotFoundException('Товар из чата не найден')
        }

        // Проверяем, есть ли уже этот товар в корзине
        const existingItem = await this.prisma.cartItem.findFirst({
          where: {
            cartId: cart.id,
            productId: null,
            chatProductId: dto.chatProductId,
          },
        })

        if (existingItem) {
          // Обновляем количество
          await this.prisma.cartItem.update({
            where: { id: existingItem.id },
            data: {
              quantity: existingItem.quantity + dto.quantity,
              price: chatProduct.price,
            },
          })
        } else {
          // Создаем новый элемент корзины
          await this.prisma.cartItem.create({
            data: {
              cartId: cart.id,
              chatProductId: dto.chatProductId,
              quantity: dto.quantity,
              price: chatProduct.price,
            },
          })
        }
      }

      // Обновляем время изменения корзины
      await this.prisma.cart.update({
        where: { id: cart.id },
        data: { updatedAt: new Date() },
      })

      // Получаем обновленную корзину
      const updatedCart = await this.prisma.cart.findUnique({
        where: { id: cart.id },
        include: this.getCartInclude(),
      })

      return CartResponseDto.fromEntity(updatedCart)
    } catch (error) {
      PrismaErrorHelper.handleError(error)
    }
  }

  /**
   * Обновить количество товара в корзине
   */
  @CacheEvict({
    key: (itemId: string, dto: UpdateCartItemDto, userId?: string, anonymousId?: string) =>
      `${CacheKeys.CART}${userId || anonymousId}`,
  })
  async updateCartItem(
    itemId: string,
    dto: UpdateCartItemDto,
    userId?: string,
    anonymousId?: string,
  ): Promise<CartResponseDto> {
    try {
      // Получаем элемент корзины
      const cartItem = await this.prisma.cartItem.findUnique({
        where: { id: itemId },
        include: {
          cart: true,
          product: true,
        },
      })

      if (!cartItem) {
        throw new NotFoundException('Элемент корзины не найден')
      }

      // Проверяем, что корзина принадлежит пользователю
      if (userId && cartItem.cart.userId !== userId) {
        throw new NotFoundException('Элемент корзины не найден')
      }

      if (anonymousId && cartItem.cart.anonymousId !== anonymousId) {
        throw new NotFoundException('Элемент корзины не найден')
      }

      // Если это обычный товар, проверяем наличие
      if (cartItem.product) {
        if (!cartItem.product.isActive) {
          throw new BadRequestException('Товар недоступен')
        }

        if (cartItem.product.stock < dto.quantity) {
          throw new BadRequestException(
            `Недостаточно товара на складе. Доступно: ${cartItem.product.stock}`,
          )
        }

        // Обновляем с актуальной ценой
        await this.prisma.cartItem.update({
          where: { id: itemId },
          data: {
            quantity: dto.quantity,
            price: cartItem.product.price,
          },
        })
      } else {
        // Для товара из чата просто обновляем количество
        await this.prisma.cartItem.update({
          where: { id: itemId },
          data: {
            quantity: dto.quantity,
          },
        })
      }

      // Обновляем время изменения корзины
      await this.prisma.cart.update({
        where: { id: cartItem.cartId },
        data: { updatedAt: new Date() },
      })

      // Получаем обновленную корзину
      const updatedCart = await this.prisma.cart.findUnique({
        where: { id: cartItem.cartId },
        include: this.getCartInclude(),
      })

      return CartResponseDto.fromEntity(updatedCart)
    } catch (error) {
      PrismaErrorHelper.handleError(error)
    }
  }

  /**
   * Удалить товар из корзины
   */
  @CacheEvict({
    key: (itemId: string, userId?: string, anonymousId?: string) =>
      `${CacheKeys.CART}${userId || anonymousId}`,
  })
  async removeFromCart(
    itemId: string,
    userId?: string,
    anonymousId?: string,
  ): Promise<CartResponseDto> {
    // Получаем элемент корзины
    const cartItem = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: {
        cart: true,
      },
    })

    if (!cartItem) {
      throw new NotFoundException('Элемент корзины не найден')
    }

    // Проверяем, что корзина принадлежит пользователю
    if (userId && cartItem.cart.userId !== userId) {
      throw new NotFoundException('Элемент корзины не найден')
    }

    if (anonymousId && cartItem.cart.anonymousId !== anonymousId) {
      throw new NotFoundException('Элемент корзины не найден')
    }

    // Удаляем элемент
    await this.prisma.cartItem.delete({
      where: { id: itemId },
    })

    // Обновляем время изменения корзины
    await this.prisma.cart.update({
      where: { id: cartItem.cartId },
      data: { updatedAt: new Date() },
    })

    // Получаем обновленную корзину
    const updatedCart = await this.prisma.cart.findUnique({
      where: { id: cartItem.cartId },
      include: this.getCartInclude(),
    })

    return CartResponseDto.fromEntity(updatedCart)
  }

  /**
   * Очистить корзину
   */
  @CacheEvict({
    key: (userId?: string, anonymousId?: string) => `${CacheKeys.CART}${userId || anonymousId}`,
  })
  async clearCart(userId?: string, anonymousId?: string): Promise<CartResponseDto> {
    const cart = await this.getOrCreateCart(userId, anonymousId)

    // Удаляем все элементы корзины
    await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    })

    // Обновляем время изменения корзины
    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { updatedAt: new Date() },
    })

    // Получаем обновленную корзину
    const updatedCart = await this.prisma.cart.findUnique({
      where: { id: cart.id },
      include: this.getCartInclude(),
    })

    return CartResponseDto.fromEntity(updatedCart)
  }

  /**
   * Слияние корзин при авторизации
   */
  async mergeCarts(anonymousId: string, userId: string): Promise<void> {
    try {
      // Получаем анонимную корзину
      const anonymousCart = await this.prisma.cart.findFirst({
        where: { anonymousId },
        include: {
          items: true,
        },
      })

      if (!anonymousCart || anonymousCart.items.length === 0) {
        // Нечего сливать
        return
      }

      // Получаем или создаем корзину пользователя
      let userCart = await this.prisma.cart.findFirst({
        where: { userId },
      })

      if (!userCart) {
        // Просто переназначаем анонимную корзину пользователю
        await this.prisma.cart.update({
          where: { id: anonymousCart.id },
          data: {
            userId,
            anonymousId: null,
          },
        })

        // Инвалидируем кеш
        await this.redisService.del(`${CacheKeys.CART}${anonymousId}`)
        await this.redisService.del(`${CacheKeys.CART}${userId}`)

        return
      }

      // Сливаем элементы корзин
      for (const anonymousItem of anonymousCart.items) {
        // Проверяем, есть ли такой товар в корзине пользователя
        const existingItem = await this.prisma.cartItem.findFirst({
          where: {
            cartId: userCart.id,
            productId: anonymousItem.productId,
            chatProductId: anonymousItem.chatProductId,
          },
        })

        if (existingItem) {
          // Увеличиваем количество
          await this.prisma.cartItem.update({
            where: { id: existingItem.id },
            data: {
              quantity: existingItem.quantity + anonymousItem.quantity,
              price: anonymousItem.price, // Обновляем цену на более свежую
            },
          })
        } else {
          // Переносим элемент в корзину пользователя
          await this.prisma.cartItem.update({
            where: { id: anonymousItem.id },
            data: {
              cartId: userCart.id,
            },
          })
        }
      }

      // Удаляем анонимную корзину
      await this.prisma.cart.delete({
        where: { id: anonymousCart.id },
      })

      // Инвалидируем кеш
      await this.redisService.del(`${CacheKeys.CART}${anonymousId}`)
      await this.redisService.del(`${CacheKeys.CART}${userId}`)
    } catch (error) {
      this.logger.error(
        'Ошибка при слиянии корзин',
        error instanceof Error ? error.message : String(error),
      )
      // Не прерываем процесс авторизации из-за ошибки слияния
    }
  }

  /**
   * Автоочистка старых корзин (запускается по крону)
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupOldCarts(): Promise<void> {
    try {
      this.logger.log('Начало очистки старых корзин')

      const ninetyDaysAgo = new Date()
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

      // Удаляем старые анонимные корзины
      const deletedCarts = await this.prisma.cart.deleteMany({
        where: {
          anonymousId: { not: null },
          updatedAt: { lt: ninetyDaysAgo },
        },
      })

      // Удаляем старые пустые корзины пользователей
      const emptyUserCarts = await this.prisma.cart.findMany({
        where: {
          userId: { not: null },
          updatedAt: { lt: ninetyDaysAgo },
          items: { none: {} },
        },
        select: { id: true },
      })

      if (emptyUserCarts.length > 0) {
        await this.prisma.cart.deleteMany({
          where: {
            id: { in: emptyUserCarts.map((c) => c.id) },
          },
        })
      }

      this.logger.log(
        `Очистка корзин завершена. Удалено: ${deletedCarts.count} анонимных, ${emptyUserCarts.length} пустых пользовательских`,
      )
    } catch (error) {
      this.logger.error(
        'Ошибка при очистке старых корзин',
        error instanceof Error ? error.message : String(error),
      )
    }
  }

  /**
   * Вспомогательный метод для include в запросах
   */
  private getCartInclude() {
    return {
      items: {
        include: {
          product: {
            include: {
              brand: true,
              images: {
                where: { sortOrder: 0 },
                take: 1,
              },
            },
          },
          chatProduct: true,
        },
        orderBy: {
          createdAt: 'desc' as const,
        },
      },
    }
  }
}
