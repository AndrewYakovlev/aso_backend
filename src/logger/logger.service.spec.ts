// src/logger/logger.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { LoggerService } from './logger.service'
import * as winston from 'winston'

jest.mock('winston', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  }),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    printf: jest.fn(),
    colorize: jest.fn(),
    json: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
  },
}))

jest.mock('winston-daily-rotate-file', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
  }))
})

describe('LoggerService', () => {
  let service: LoggerService
  let mockLogger: any

  beforeEach(async () => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    }
    ;(winston.createLogger as jest.Mock).mockReturnValue(mockLogger)

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoggerService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue: any) => {
              const config = {
                'app.nodeEnv': 'test',
                'app.logging.level': 'debug',
                'app.logging.filePath': './logs',
              }
              return config[key] || defaultValue
            }),
          },
        },
      ],
    }).compile()

    service = module.get<LoggerService>(LoggerService)
  })

  describe('basic logging methods', () => {
    it('should log info messages', () => {
      service.log('Test message', 'TestContext')
      expect(mockLogger.info).toHaveBeenCalledWith('Test message', { context: 'TestContext' })
    })

    it('should log error messages with trace', () => {
      const error = new Error('Test error')
      service.error('Error message', error.stack, 'TestContext')
      expect(mockLogger.error).toHaveBeenCalledWith('Error message', {
        context: 'TestContext',
        stack: error.stack,
      })
    })

    it('should log error messages without trace', () => {
      service.error('Error message', undefined, 'TestContext')
      expect(mockLogger.error).toHaveBeenCalledWith('Error message', { context: 'TestContext' })
    })

    it('should log warning messages', () => {
      service.warn('Warning message', 'TestContext')
      expect(mockLogger.warn).toHaveBeenCalledWith('Warning message', { context: 'TestContext' })
    })

    it('should log debug messages', () => {
      service.debug('Debug message', 'TestContext')
      expect(mockLogger.debug).toHaveBeenCalledWith('Debug message', { context: 'TestContext' })
    })

    it('should log verbose messages', () => {
      service.verbose('Verbose message', 'TestContext')
      expect(mockLogger.verbose).toHaveBeenCalledWith('Verbose message', { context: 'TestContext' })
    })
  })

  describe('extended logging methods', () => {
    it('should log with metadata', () => {
      const meta = { userId: '123', action: 'test' }
      service.logWithMeta('Test message', meta, 'TestContext')
      expect(mockLogger.info).toHaveBeenCalledWith('Test message', {
        context: 'TestContext',
        ...meta,
      })
    })

    it('should log error with metadata', () => {
      const error = new Error('Test error')
      const meta = { userId: '123' }
      service.errorWithMeta('Error message', error, meta, 'TestContext')
      expect(mockLogger.error).toHaveBeenCalledWith('Error message', {
        context: 'TestContext',
        stack: error.stack,
        errorName: error.name,
        errorMessage: error.message,
        ...meta,
      })
    })

    it('should log HTTP requests', () => {
      service.logHttpRequest('GET', '/api/test', 200, 150, 'Mozilla/5.0', '127.0.0.1')
      expect(mockLogger.info).toHaveBeenCalledWith('HTTP Request', {
        context: 'HTTP',
        method: 'GET',
        url: '/api/test',
        statusCode: 200,
        duration: 150,
        userAgent: 'Mozilla/5.0',
        ip: '127.0.0.1',
      })
    })

    it('should log database queries in development', () => {
      ;(service as any).isDevelopment = true
      service.logDatabaseQuery('SELECT * FROM users', 25, [])
      expect(mockLogger.debug).toHaveBeenCalledWith('Database Query', {
        context: 'Database',
        query: 'SELECT * FROM users',
        duration: 25,
        params: [],
      })
    })

    it('should not log database queries in production', () => {
      ;(service as any).isDevelopment = false
      service.logDatabaseQuery('SELECT * FROM users', 25, [])
      expect(mockLogger.debug).not.toHaveBeenCalled()
    })

    it('should log business events', () => {
      service.logBusinessEvent('order_created', '123', { orderId: '456', total: 100 })
      expect(mockLogger.info).toHaveBeenCalledWith('Business Event', {
        context: 'Business',
        event: 'order_created',
        userId: '123',
        orderId: '456',
        total: 100,
      })
    })

    it('should log security events', () => {
      service.logSecurityEvent('failed_login', '123', { ip: '127.0.0.1', attempts: 3 })
      expect(mockLogger.warn).toHaveBeenCalledWith('Security Event', {
        context: 'Security',
        event: 'failed_login',
        userId: '123',
        ip: '127.0.0.1',
        attempts: 3,
      })
    })
  })
})
