// src/modules/auth/services/sms.service.ts
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { HttpService } from '@nestjs/axios'
import { firstValueFrom } from 'rxjs'
import { LoggerService } from '../../../logger/logger.service'

export interface SmsResponse {
  status: string
  status_code: number
  sms: {
    [phone: string]: {
      status: string
      status_code: number
      sms_id?: string
      status_text?: string
    }
  }
  balance: number
}

@Injectable()
export class SmsService {
  private readonly apiKey: string
  private readonly from: string
  private readonly apiUrl = 'https://sms.ru/sms/send'
  private readonly isDevelopment: boolean

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly logger: LoggerService,
  ) {
    // Получаем конфигурацию с проверкой
    const apiKey = this.configService.get<string>('sms.apiKey')
    const from = this.configService.get<string>('sms.from')

    if (!apiKey) {
      throw new Error('SMS API key is not configured (SMS_API_KEY)')
    }
    if (!from) {
      throw new Error('SMS sender name is not configured (SMS_FROM)')
    }

    this.apiKey = apiKey
    this.from = from
    this.isDevelopment = this.configService.get<string>('app.nodeEnv') === 'development'
  }

  async sendOtp(phone: string, code: string): Promise<void> {
    const message = `Ваш код подтверждения: ${code}. Код действителен 5 минут.`

    if (this.isDevelopment) {
      // В режиме разработки не отправляем реальные SMS
      this.logger.log(`[DEV MODE] SMS to ${phone}: ${message}`, 'SmsService')
      return
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post<SmsResponse>(this.apiUrl, null, {
          params: {
            api_id: this.apiKey,
            to: phone,
            msg: message,
            from: this.from,
            json: 1,
          },
        }),
      )

      const smsResult = response.data.sms[phone]

      if (smsResult.status_code !== 100) {
        throw new Error(`SMS sending failed: ${smsResult.status_text || smsResult.status}`)
      }

      this.logger.logBusinessEvent('sms_sent', undefined, {
        phone,
        type: 'otp',
        smsId: smsResult.sms_id,
        balance: response.data.balance,
      })
    } catch (error) {
      // Правильная обработка типа error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const errorDetails = error instanceof Error ? error : { error: String(error) }

      this.logger.errorWithMeta(
        'Failed to send SMS',
        errorDetails as Error,
        { phone, type: 'otp' },
        'SmsService',
      )
      throw new Error(`Failed to send SMS: ${errorMessage}`)
    }
  }

  async sendOrderNotification(phone: string, orderNumber: string, status: string): Promise<void> {
    const message =
      status === 'created'
        ? `Заказ #${orderNumber} создан. Ожидайте звонка менеджера.`
        : `Статус заказа #${orderNumber} изменен на: ${status}`

    if (this.isDevelopment) {
      this.logger.log(`[DEV MODE] SMS to ${phone}: ${message}`, 'SmsService')
      return
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post<SmsResponse>(this.apiUrl, null, {
          params: {
            api_id: this.apiKey,
            to: phone,
            msg: message,
            from: this.from,
            json: 1,
          },
        }),
      )

      const smsResult = response.data.sms[phone]

      if (smsResult.status_code !== 100) {
        throw new Error(`SMS sending failed: ${smsResult.status_text || smsResult.status}`)
      }

      this.logger.logBusinessEvent('sms_sent', undefined, {
        phone,
        type: 'order_notification',
        orderNumber,
        status,
        smsId: smsResult.sms_id,
      })
    } catch (error) {
      // Правильная обработка типа error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const errorDetails = error instanceof Error ? error : new Error(String(error))

      this.logger.errorWithMeta(
        'Failed to send order notification SMS',
        errorDetails,
        { phone, orderNumber, status },
        'SmsService',
      )
      // Не выбрасываем ошибку для уведомлений - они не критичны
    }
  }

  async checkBalance(): Promise<number> {
    if (this.isDevelopment) {
      return 999999 // Фиктивный баланс для разработки
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get('https://sms.ru/my/balance', {
          params: {
            api_id: this.apiKey,
            json: 1,
          },
        }),
      )

      return response.data.balance
    } catch (error) {
      // Правильная обработка типа error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const errorStack = error instanceof Error ? error.stack : undefined

      this.logger.error(`Failed to check SMS balance: ${errorMessage}`, errorStack, 'SmsService')
      return 0
    }
  }
}
