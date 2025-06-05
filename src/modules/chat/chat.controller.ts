// src/modules/chat/chat.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Patch,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger'
import { ChatService, ChatMetrics, ChatStats } from './chat.service'
import { PrismaService } from '../../prisma/prisma.service'
import { RequireUser } from '../auth/decorators/require-user.decorator'
import { RequireRoles } from '../auth/decorators/require-roles.decorator'
import { RequireAuth } from '../auth/decorators/require-auth.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { MessageType, SenderType, UserRole } from '@prisma/client'
import { MessageResponseDto } from './dto/message-response.dto'
import { ChatResponseDto } from './dto/chat-response.dto'
import { PaginatedResult } from '@common/interfaces/paginated-result.interface'
import { CreateChatDto } from './dto/create-chat.dto'
import { SendProductCardDto, ChatProductResponseDto } from './dto/chat-product.dto'

@ApiTags('Chat')
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('my-chats')
  @RequireUser()
  @ApiOperation({ summary: 'Получить активные чаты пользователя' })
  @ApiResponse({
    status: 200,
    description: 'Список активных чатов',
    type: [ChatResponseDto],
  })
  async getMyChats(@CurrentUser() user: any): Promise<ChatResponseDto[]> {
    return this.chatService.getUserActiveChats(
      user.isAnonymous ? undefined : user.userId,
      user.isAnonymous ? user.sessionId : undefined,
    )
  }

  @Get('manager-chats')
  @RequireRoles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Получить чаты для менеджера' })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Фильтр по статусам чатов',
    type: [String],
  })
  @ApiResponse({
    status: 200,
    description: 'Список чатов',
    type: [ChatResponseDto],
  })
  async getManagerChats(
    @CurrentUser('userId') managerId: string,
    @Query('status') status?: string | string[],
  ): Promise<ChatResponseDto[]> {
    const statusCodes = Array.isArray(status) ? status : status ? [status] : undefined
    return this.chatService.getManagerChats(managerId, statusCodes)
  }

  @Get('stats')
  @RequireRoles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Получить статистику по чатам' })
  @ApiQuery({ name: 'startDate', required: false, type: Date })
  @ApiQuery({ name: 'endDate', required: false, type: Date })
  @ApiQuery({ name: 'managerId', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Статистика чатов',
  })
  async getChatStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('managerId') managerId?: string,
  ): Promise<ChatStats> {
    return this.chatService.getChatStats({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      managerId,
    })
  }

  @Get(':id')
  @RequireUser()
  @ApiOperation({ summary: 'Получить информацию о чате' })
  @ApiParam({ name: 'id', description: 'ID чата' })
  @ApiResponse({
    status: 200,
    description: 'Информация о чате',
  })
  async getChat(@Param('id') chatId: string, @CurrentUser() user: any) {
    const chat = await this.chatService.getChatWithAccess(
      chatId,
      user.isAnonymous ? undefined : user.userId,
      user.isAnonymous ? user.sessionId : undefined,
      user.role,
    )

    const metrics = await this.chatService.getChatMetrics(chatId)

    return {
      ...chat,
      metrics,
    }
  }

  @Get(':id/history')
  @RequireUser()
  @ApiOperation({ summary: 'Получить историю сообщений чата' })
  @ApiParam({ name: 'id', description: 'ID чата' })
  @ApiQuery({ name: 'page', required: false, type: Number, default: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, default: 50 })
  @ApiResponse({
    status: 200,
    description: 'История сообщений',
    type: [MessageResponseDto],
  })
  async getChatHistory(
    @Param('id') chatId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @CurrentUser() user: any,
  ): Promise<PaginatedResult<MessageResponseDto>> {
    // Проверяем доступ к чату
    await this.chatService.getChatWithAccess(
      chatId,
      user.isAnonymous ? undefined : user.userId,
      user.isAnonymous ? user.sessionId : undefined,
      user.role,
    )

    return this.chatService.getChatHistory(chatId, page, limit)
  }

  @Get(':id/metrics')
  @RequireRoles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Получить метрики чата' })
  @ApiParam({ name: 'id', description: 'ID чата' })
  @ApiResponse({
    status: 200,
    description: 'Метрики чата',
  })
  async getChatMetrics(@Param('id') chatId: string): Promise<ChatMetrics> {
    return this.chatService.getChatMetrics(chatId)
  }

  @Post(':id/assign-manager')
  @RequireRoles(UserRole.MANAGER, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Назначить менеджера на чат' })
  @ApiParam({ name: 'id', description: 'ID чата' })
  @ApiResponse({
    status: 204,
    description: 'Менеджер назначен',
  })
  async assignManager(
    @Param('id') chatId: string,
    @CurrentUser('userId') managerId: string,
  ): Promise<void> {
    await this.chatService.assignManager(chatId, managerId)
  }

  @Patch(':id/status')
  @RequireRoles(UserRole.MANAGER, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Изменить статус чата' })
  @ApiParam({ name: 'id', description: 'ID чата' })
  @ApiResponse({
    status: 204,
    description: 'Статус изменен',
  })
  async updateStatus(@Param('id') chatId: string, @Body('status') status: string): Promise<void> {
    await this.chatService.updateChatStatus(chatId, status)
  }

  @Get('statuses/list')
  @ApiOperation({ summary: 'Получить список статусов чатов' })
  @ApiResponse({
    status: 200,
    description: 'Список статусов',
  })
  async getChatStatuses() {
    return this.prisma.chatStatus.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    })
  }

  @Post('create')
  @RequireUser()
  @ApiOperation({ summary: 'Создать новый чат' })
  @ApiResponse({
    status: 201,
    description: 'Чат создан',
  })
  async createChat(@CurrentUser() user: any, @Body() dto: CreateChatDto) {
    const chat = await this.chatService.createOrGetChat(
      user.isAnonymous ? undefined : user.userId,
      user.isAnonymous ? user.sessionId : undefined,
    )

    // Если есть начальное сообщение, отправляем его
    if (dto.initialMessage) {
      await this.chatService.saveMessage(
        chat.id,
        user.isAnonymous ? undefined : user.userId,
        SenderType.CUSTOMER,
        {
          content: dto.initialMessage,
          messageType: MessageType.TEXT,
        },
      )
    }

    return {
      chatId: chat.id,
      status: chat.status,
      managerId: chat.managerId,
    }
  }

  @Post(':id/send-product-card')
  @RequireRoles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Отправить карточку товара в чат' })
  @ApiParam({ name: 'id', description: 'ID чата' })
  @ApiResponse({
    status: 201,
    description: 'Карточка товара отправлена',
    type: MessageResponseDto,
  })
  async sendProductCard(
    @Param('id') chatId: string,
    @Body() dto: SendProductCardDto,
    @CurrentUser('userId') managerId: string,
  ): Promise<MessageResponseDto> {
    // Проверяем, что менеджер имеет доступ к чату
    const chat = await this.chatService.getChatWithAccess(
      chatId,
      managerId,
      undefined,
      UserRole.MANAGER,
    )

    const message = await this.chatService.createProductCardMessage(
      chatId,
      managerId,
      SenderType.MANAGER,
      dto.content,
      dto.product,
    )

    return this.chatService['formatMessage'](message)
  }

  @Get(':chatId/products')
  @RequireUser()
  @ApiOperation({ summary: 'Получить карточки товаров из чата' })
  @ApiParam({ name: 'chatId', description: 'ID чата' })
  @ApiResponse({
    status: 200,
    description: 'Список карточек товаров',
    type: [ChatProductResponseDto],
  })
  async getChatProducts(
    @Param('chatId') chatId: string,
    @CurrentUser() user: any,
  ): Promise<ChatProductResponseDto[]> {
    // Проверяем доступ к чату
    await this.chatService.getChatWithAccess(
      chatId,
      user.isAnonymous ? undefined : user.userId,
      user.isAnonymous ? user.sessionId : undefined,
      user.role,
    )

    return this.chatService.getChatProducts(chatId)
  }

  @Post('products/:productId/add-to-cart')
  @RequireUser()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Добавить товар из чата в корзину' })
  @ApiParam({ name: 'productId', description: 'ID карточки товара из чата' })
  @ApiResponse({
    status: 204,
    description: 'Товар добавлен в корзину',
  })
  async addProductToCart(
    @Param('productId') productId: string,
    @Body('quantity', new DefaultValuePipe(1), ParseIntPipe) quantity: number,
    @CurrentUser() user: any,
  ): Promise<void> {
    await this.chatService.addChatProductToCart(
      productId,
      user.isAnonymous ? undefined : user.userId,
      user.isAnonymous ? user.sessionId : undefined,
      quantity,
    )
  }
}
