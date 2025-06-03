// src/config/sms.config.ts
import { registerAs } from '@nestjs/config'

export default registerAs('sms', () => ({
  apiKey: process.env.SMS_API_KEY,
  from: process.env.SMS_FROM || 'AutoPartsASO',
  provider: 'sms.ru',
  templates: {
    otp: 'Ваш код подтверждения: {code}. Код действителен {minutes} минут.',
    orderCreated: 'Заказ #{orderNumber} создан. Ожидайте звонка менеджера.',
    orderStatusChanged: 'Статус заказа #{orderNumber} изменен на: {status}',
  },
}))
