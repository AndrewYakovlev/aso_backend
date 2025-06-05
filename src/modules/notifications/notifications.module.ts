// src/modules/notifications/notifications.module.ts
import { Module, Global } from '@nestjs/common'
import { NotificationsService } from './notifications.service'
import { NotificationsController } from './notifications.controller'
import { PushService } from './services/push.service'
import { NotificationSettingsService } from './services/notification-settings.service'
import { ConfigModule } from '@nestjs/config'

@Global()
@Module({
  imports: [ConfigModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, PushService, NotificationSettingsService],
  exports: [NotificationsService, PushService],
})
export class NotificationsModule {}
