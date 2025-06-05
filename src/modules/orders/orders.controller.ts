// src/modules/orders/orders.controller.ts
import { Controller, Get, Post, Body, Param, Query, Patch } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger'
import { OrdersService } from './orders.service'
import { CreateOrderDto } from './dto/create-order.dto'
import { OrderFiltersDto } from './dto/order-filters.dto'
import { OrderResponseDto, CreateOrderResponseDto } from './dto/order-response.dto'
import { RequireAuth } from '../auth/decorators/require-auth.decorator'
import { RequireRoles } from '../auth/decorators/require-roles.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { UserRole } from '@prisma/client'
import { UpdateOrderStatusDto } from './dto/update-order-status.dto'
import { OrderStatusLogResponseDto } from './dto/order-status-log-response.dto'
import { DeliveryMethodResponseDto } from './dto/delivery-method-response.dto'
import { PaymentMethodResponseDto } from './dto/payment-method-response.dto'
import { CalculateShippingDto, ShippingCalculationResponseDto } from './dto/calculate-shipping.dto'

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @RequireAuth()
  @ApiOperation({ summary: 'Создать заказ из корзины' })
  @ApiResponse({
    status: 201,
    description: 'Заказ создан',
    type: CreateOrderResponseDto,
  })
  async create(
    @Body() dto: CreateOrderDto,
    @CurrentUser('userId') userId: string,
  ): Promise<CreateOrderResponseDto> {
    return this.ordersService.create(dto, userId)
  }

  @Get()
  @RequireAuth()
  @ApiOperation({ summary: 'Получить список заказов' })
  @ApiResponse({
    status: 200,
    description: 'Список заказов',
  })
  async findAll(@Query() filters: OrderFiltersDto, @CurrentUser() user: any) {
    // Админы и менеджеры могут видеть все заказы
    const currentUserId =
      user.role === UserRole.ADMIN || user.role === UserRole.MANAGER ? undefined : user.userId

    return this.ordersService.findAll(filters, currentUserId)
  }

  @Get(':id')
  @RequireAuth()
  @ApiOperation({ summary: 'Получить заказ по ID' })
  @ApiParam({ name: 'id', description: 'ID заказа' })
  @ApiResponse({
    status: 200,
    description: 'Данные заказа',
    type: OrderResponseDto,
  })
  async findOne(@Param('id') id: string, @CurrentUser() user: any): Promise<OrderResponseDto> {
    // Админы и менеджеры могут видеть любой заказ
    const currentUserId =
      user.role === UserRole.ADMIN || user.role === UserRole.MANAGER ? undefined : user.userId

    return this.ordersService.findOne(id, currentUserId)
  }

  @Get('my/last')
  @RequireAuth()
  @ApiOperation({ summary: 'Получить последний заказ текущего пользователя' })
  @ApiResponse({
    status: 200,
    description: 'Последний заказ',
    type: OrderResponseDto,
  })
  async getMyLastOrder(@CurrentUser('userId') userId: string): Promise<OrderResponseDto | null> {
    const result = await this.ordersService.findAll({ page: 1, limit: 1 }, userId)

    return result.data[0] || null
  }

  @Get('delivery-methods')
  @ApiOperation({ summary: 'Получить доступные методы доставки' })
  @ApiQuery({
    name: 'cartAmount',
    required: false,
    type: Number,
    description: 'Сумма корзины для расчета стоимости доставки',
  })
  @ApiResponse({
    status: 200,
    description: 'Список методов доставки',
    type: [DeliveryMethodResponseDto],
  })
  async getDeliveryMethods(
    @Query('cartAmount') cartAmount?: string,
  ): Promise<DeliveryMethodResponseDto[]> {
    const amount = cartAmount ? parseFloat(cartAmount) : undefined
    return this.ordersService.getDeliveryMethods(amount)
  }

  @Get('payment-methods')
  @ApiOperation({ summary: 'Получить доступные методы оплаты' })
  @ApiQuery({
    name: 'orderAmount',
    required: false,
    type: Number,
    description: 'Сумма заказа для проверки доступности методов',
  })
  @ApiResponse({
    status: 200,
    description: 'Список методов оплаты',
    type: [PaymentMethodResponseDto],
  })
  async getPaymentMethods(
    @Query('orderAmount') orderAmount?: string,
  ): Promise<PaymentMethodResponseDto[]> {
    const amount = orderAmount ? parseFloat(orderAmount) : undefined
    return this.ordersService.getPaymentMethods(amount)
  }

  @Patch(':id/status')
  @RequireRoles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Изменить статус заказа' })
  @ApiParam({ name: 'id', description: 'ID заказа' })
  @ApiResponse({
    status: 200,
    description: 'Статус изменен',
    type: OrderResponseDto,
  })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: any,
  ): Promise<OrderResponseDto> {
    return this.ordersService.updateStatus(id, dto, user.userId, user.role)
  }

  @Get(':id/status-history')
  @RequireAuth()
  @ApiOperation({ summary: 'Получить историю изменения статусов' })
  @ApiParam({ name: 'id', description: 'ID заказа' })
  @ApiResponse({
    status: 200,
    description: 'История статусов',
    type: [OrderStatusLogResponseDto],
  })
  async getStatusHistory(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<OrderStatusLogResponseDto[]> {
    return this.ordersService.getStatusHistory(id, user.userId, user.role)
  }

  @Post(':id/cancel')
  @RequireAuth()
  @ApiOperation({ summary: 'Отменить заказ' })
  @ApiParam({ name: 'id', description: 'ID заказа' })
  @ApiResponse({
    status: 200,
    description: 'Заказ отменен',
    type: OrderResponseDto,
  })
  async cancelOrder(
    @Param('id') id: string,
    @Body() dto: { reason?: string },
    @CurrentUser('userId') userId: string,
  ): Promise<OrderResponseDto> {
    return this.ordersService.cancelOrder(id, userId, dto.reason)
  }

  @Get(':id/available-statuses')
  @RequireRoles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Получить доступные статусы для перехода' })
  @ApiParam({ name: 'id', description: 'ID заказа' })
  @ApiResponse({
    status: 200,
    description: 'Доступные статусы',
  })
  async getAvailableStatuses(@Param('id') id: string, @CurrentUser('role') userRole: UserRole) {
    return this.ordersService.getAvailableStatuses(id, userRole)
  }

  @Get('statuses')
  @ApiOperation({ summary: 'Получить все статусы заказов' })
  @ApiResponse({
    status: 200,
    description: 'Список статусов',
  })
  async getAllStatuses() {
    return this.ordersService.getAllStatuses()
  }

  @Post('calculate-shipping')
  @ApiOperation({ summary: 'Рассчитать стоимость доставки' })
  @ApiResponse({
    status: 200,
    description: 'Расчет стоимости доставки',
    type: ShippingCalculationResponseDto,
  })
  async calculateShipping(
    // Имя метода в контроллере можно оставить прежним
    @Body() dto: CalculateShippingDto,
  ): Promise<ShippingCalculationResponseDto> {
    return this.ordersService.calculateShippingCost(dto) // Вызываем новый публичный метод
  }
}
