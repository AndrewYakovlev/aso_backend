// src/modules/notifications/notifications.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  Query,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { NotificationsService } from './notifications.service'
import { NotificationSettingsService } from './services/notification-settings.service'
import { PushService } from './services/push.service'
import { RequireAuth } from '../auth/decorators/require-auth.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { CreatePushSubscriptionDto } from './dto/create-push-subscription.dto'
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto'
import { TestNotificationDto } from './dto/test-notification.dto'

@ApiTags('Notifications')
@Controller('notifications')
@RequireAuth()
export class NotificationsController {
  constructor(
    private notificationsService: NotificationsService,
    private settingsService: NotificationSettingsService,
    private pushService: PushService,
  ) {}

  @Get('vapid-public-key')
  @ApiOperation({ summary: 'Получить публичный VAPID ключ' })
  @ApiResponse({
    status: 200,
    description: 'Публичный ключ для подписки на push',
  })
  getVapidPublicKey() {
    return {
      publicKey: this.pushService.getVapidPublicKey(),
    }
  }

  @Post('subscribe')
  @ApiOperation({ summary: 'Подписаться на push уведомления' })
  @ApiResponse({
    status: 201,
    description: 'Подписка сохранена',
  })
  async subscribe(@CurrentUser('userId') userId: string, @Body() dto: CreatePushSubscriptionDto) {
    await this.pushService.savePushSubscription(userId, dto)
    return { success: true }
  }

  @Delete('subscribe/:endpoint')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Отписаться от push уведомлений' })
  async unsubscribe(@CurrentUser('userId') userId: string, @Param('endpoint') endpoint: string) {
    await this.pushService.removePushSubscription(userId, endpoint)
  }

  @Get('settings')
  @ApiOperation({ summary: 'Получить настройки уведомлений' })
  async getSettings(@CurrentUser('userId') userId: string) {
    return this.settingsService.getSettings(userId)
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Обновить настройки уведомлений' })
  async updateSettings(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateNotificationSettingsDto,
  ) {
    return this.settingsService.updateSettings(userId, dto)
  }

  @Get('subscriptions')
  @ApiOperation({ summary: 'Получить активные подписки' })
  async getSubscriptions(@CurrentUser('userId') userId: string) {
    return this.settingsService.getActiveSubscriptions(userId)
  }

  @Delete('subscriptions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить подписку' })
  async removeSubscription(
    @CurrentUser('userId') userId: string,
    @Param('id') subscriptionId: string,
  ) {
    await this.settingsService.removeSubscription(userId, subscriptionId)
  }

  @Get('history')
  @ApiOperation({ summary: 'История уведомлений' })
  async getHistory(
    @CurrentUser('userId') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.notificationsService.getNotificationHistory(userId, page, limit)
  }

  @Post('test')
  @ApiOperation({ summary: 'Отправить тестовое уведомление' })
  async sendTest(@CurrentUser('userId') userId: string, @Body() dto: TestNotificationDto) {
    await this.pushService.sendNotification(
      userId,
      {
        title: dto.title,
        body: dto.body,
        icon: '/icons/test.png',
        data: { test: true },
      },
      'test',
    )
    return { success: true }
  }

  @Post('clicked/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Отметить уведомление как прочитанное' })
  async markClicked(@CurrentUser('userId') userId: string, @Param('id') notificationId: string) {
    await this.notificationsService.markNotificationClicked(userId, notificationId)
  }
}
