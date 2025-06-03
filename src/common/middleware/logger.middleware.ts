// src/common/middleware/logger.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common'
import { Request, Response, NextFunction } from 'express'
import { LoggerService } from '../../logger/logger.service'

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  constructor(private readonly logger: LoggerService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now()
    const { method, originalUrl, headers, ip } = req
    const userAgent = headers['user-agent']

    res.on('finish', () => {
      const duration = Date.now() - startTime
      const { statusCode } = res

      this.logger.logHttpRequest(method, originalUrl, statusCode, duration, userAgent, ip)
    })

    next()
  }
}
