// src/modules/cart/cart.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiExtraModels } from '@nestjs/swagger'
import { CartService } from './cart.service'
import { AddToCartDto } from './dto/add-to-cart.dto'
import { UpdateCartItemDto } from './dto/update-cart-item.dto'
import { CartResponseDto } from './dto/cart-response.dto'
import { RequireUser } from '../auth/decorators/require-user.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { DiscountService } from '../discount/discount.service'
import { CartCalculationResponseDto } from '../discount/dto/cart-calculation-response.dto'
import { ChatProductResponseDto } from '@modules/chat/dto/chat-product.dto'

@ApiTags('Cart')
@Controller('cart')
@ApiExtraModels(ChatProductResponseDto)
export class CartController {
  constructor(
    private readonly cartService: CartService,
    private readonly discountService: DiscountService,
  ) {}

  @Get()
  @RequireUser()
  @ApiOperation({ summary: 'Получить корзину' })
  @ApiResponse({
    status: 200,
    description: 'Корзина пользователя',
    type: CartResponseDto,
  })
  async getCart(@CurrentUser() user: any): Promise<CartResponseDto> {
    return this.cartService.getCart(user.userId, user.isAnonymous ? user.sessionId : undefined)
  }

  @Post('items')
  @RequireUser()
  @ApiOperation({ summary: 'Добавить товар в корзину' })
  @ApiResponse({
    status: 201,
    description: 'Товар добавлен в корзину',
    type: CartResponseDto,
  })
  async addToCart(@Body() dto: AddToCartDto, @CurrentUser() user: any): Promise<CartResponseDto> {
    return this.cartService.addToCart(
      dto,
      user.userId,
      user.isAnonymous ? user.sessionId : undefined,
    )
  }

  @Patch('items/:id')
  @RequireUser()
  @ApiOperation({ summary: 'Изменить количество товара в корзине' })
  @ApiParam({ name: 'id', description: 'ID элемента корзины' })
  @ApiResponse({
    status: 200,
    description: 'Количество обновлено',
    type: CartResponseDto,
  })
  async updateCartItem(
    @Param('id') id: string,
    @Body() dto: UpdateCartItemDto,
    @CurrentUser() user: any,
  ): Promise<CartResponseDto> {
    return this.cartService.updateCartItem(
      id,
      dto,
      user.userId,
      user.isAnonymous ? user.sessionId : undefined,
    )
  }

  @Delete('items/:id')
  @RequireUser()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Удалить товар из корзины' })
  @ApiParam({ name: 'id', description: 'ID элемента корзины' })
  @ApiResponse({
    status: 200,
    description: 'Товар удален из корзины',
    type: CartResponseDto,
  })
  async removeFromCart(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<CartResponseDto> {
    return this.cartService.removeFromCart(
      id,
      user.userId,
      user.isAnonymous ? user.sessionId : undefined,
    )
  }

  @Delete()
  @RequireUser()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Очистить корзину' })
  @ApiResponse({
    status: 200,
    description: 'Корзина очищена',
    type: CartResponseDto,
  })
  async clearCart(@CurrentUser() user: any): Promise<CartResponseDto> {
    return this.cartService.clearCart(user.userId, user.isAnonymous ? user.sessionId : undefined)
  }

  @Post('merge')
  @RequireUser()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Слить анонимную корзину с корзиной пользователя',
    description: 'Используется при авторизации анонимного пользователя',
  })
  @ApiResponse({
    status: 204,
    description: 'Корзины успешно объединены',
  })
  async mergeCarts(
    @Body() dto: { anonymousSessionId: string },
    @CurrentUser() user: any,
  ): Promise<void> {
    if (!user.userId || user.isAnonymous) {
      return // Слияние только для авторизованных
    }

    await this.cartService.mergeCarts(dto.anonymousSessionId, user.userId)
  }

  @Post('calculate')
  @RequireUser()
  @ApiOperation({ summary: 'Рассчитать корзину с учетом скидок' })
  @ApiResponse({
    status: 200,
    description: 'Расчет корзины',
    type: CartCalculationResponseDto,
  })
  async calculateCart(
    @Body() dto: { promoCode?: string },
    @CurrentUser() user: any,
  ): Promise<CartCalculationResponseDto> {
    const cart = await this.cartService.getCart(
      user.userId,
      user.isAnonymous ? user.sessionId : undefined,
    )

    return this.discountService.calculateCart({
      items: cart.items,
      promoCode: dto.promoCode,
      userId: user.userId,
    })
  }
}
