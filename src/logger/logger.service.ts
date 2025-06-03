// src/logger/logger.service.ts
import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as winston from 'winston'
import * as DailyRotateFile from 'winston-daily-rotate-file'
import * as path from 'path'

@Injectable()
export class LoggerService implements NestLoggerService {
  private logger: winston.Logger
  private readonly isDevelopment: boolean

  constructor(private configService: ConfigService) {
    this.isDevelopment = configService.get<string>('app.nodeEnv') === 'development'
    this.logger = this.createLogger()
  }

  private createLogger(): winston.Logger {
    const logLevel = this.configService.get<string>('app.logging.level', 'info')
    const logPath = this.configService.get<string>('app.logging.filePath', './logs')

    // Создаем формат для консоли
    const consoleFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ timestamp, level, message, context, stack, ...meta }) => {
        const ctx = context ? `[${context}] ` : ''
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
        const stackStr = stack ? `\n${stack}` : ''
        return `${timestamp} ${level.toUpperCase()} ${ctx}${message}${metaStr}${stackStr}`
      }),
    )

    // Создаем формат для файлов
    const fileFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
    )

    // Транспорты
    const transports: winston.transport[] = []

    // Консольный транспорт
    if (this.isDevelopment) {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(winston.format.colorize(), consoleFormat),
        }),
      )
    } else {
      transports.push(
        new winston.transports.Console({
          format: consoleFormat,
        }),
      )
    }

    // Файловые транспорты с ротацией
    // Общий лог
    transports.push(
      new DailyRotateFile({
        dirname: path.join(logPath, 'app'),
        filename: 'app-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        format: fileFormat,
      }),
    )

    // Лог ошибок
    transports.push(
      new DailyRotateFile({
        dirname: path.join(logPath, 'error'),
        filename: 'error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '30d',
        level: 'error',
        format: fileFormat,
      }),
    )

    return winston.createLogger({
      level: logLevel,
      transports,
      exitOnError: false,
    })
  }

  log(message: any, context?: string) {
    this.logger.info(message, { context })
  }

  error(message: any, trace?: string, context?: string) {
    if (trace) {
      this.logger.error(message, { context, stack: trace })
    } else {
      this.logger.error(message, { context })
    }
  }

  warn(message: any, context?: string) {
    this.logger.warn(message, { context })
  }

  debug(message: any, context?: string) {
    this.logger.debug(message, { context })
  }

  verbose(message: any, context?: string) {
    this.logger.verbose(message, { context })
  }

  // Дополнительные методы для расширенного логирования
  logWithMeta(message: string, meta: Record<string, any>, context?: string) {
    this.logger.info(message, { context, ...meta })
  }

  errorWithMeta(message: string, error: Error, meta: Record<string, any>, context?: string) {
    this.logger.error(message, {
      context,
      stack: error.stack,
      errorName: error.name,
      errorMessage: error.message,
      ...meta,
    })
  }

  // Метод для логирования HTTP запросов
  logHttpRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    userAgent?: string,
    ip?: string,
  ) {
    this.logger.info('HTTP Request', {
      context: 'HTTP',
      method,
      url,
      statusCode,
      duration,
      userAgent,
      ip,
    })
  }

  // Метод для логирования операций с базой данных
  logDatabaseQuery(query: string, duration: number, params?: any[]) {
    if (this.isDevelopment) {
      this.logger.debug('Database Query', {
        context: 'Database',
        query,
        duration,
        params,
      })
    }
  }

  // Метод для логирования бизнес-событий
  logBusinessEvent(event: string, userId?: string, data?: Record<string, any>) {
    this.logger.info('Business Event', {
      context: 'Business',
      event,
      userId,
      ...data,
    })
  }

  // Метод для логирования ошибок безопасности
  logSecurityEvent(event: string, userId?: string, details?: Record<string, any>) {
    this.logger.warn('Security Event', {
      context: 'Security',
      event,
      userId,
      ...details,
    })
  }
}
