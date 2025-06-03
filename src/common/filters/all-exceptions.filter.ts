// src/common/filters/all-exceptions.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common'
import { Request, Response } from 'express'
import { Prisma } from '@prisma/client'

interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: any
  }
  timestamp: string
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let errorResponse: ErrorResponse

    if (exception instanceof HttpException) {
      status = exception.getStatus()
      const exceptionResponse = exception.getResponse()

      if (exception instanceof BadRequestException && typeof exceptionResponse === 'object') {
        // Handle validation errors
        const validationErrors = (exceptionResponse as any).message
        errorResponse = {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: Array.isArray(validationErrors) ? validationErrors : [validationErrors],
          },
          timestamp: new Date().toISOString(),
        }
      } else {
        errorResponse = this.createErrorResponse(
          this.getErrorCode(status),
          typeof exceptionResponse === 'string'
            ? exceptionResponse
            : (exceptionResponse as any).message || 'An error occurred',
        )
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Handle Prisma errors
      const { status: prismaStatus, response: prismaResponse } = this.handlePrismaError(exception)
      status = prismaStatus
      errorResponse = prismaResponse
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST
      errorResponse = this.createErrorResponse('VALIDATION_ERROR', 'Invalid data provided', {
        details: exception.message,
      })
    } else if (exception instanceof Error) {
      errorResponse = this.createErrorResponse(
        'INTERNAL_ERROR',
        process.env.NODE_ENV === 'production' ? 'Internal server error' : exception.message,
        process.env.NODE_ENV === 'development' ? { stack: exception.stack } : undefined,
      )
    } else {
      errorResponse = this.createErrorResponse('UNKNOWN_ERROR', 'An unknown error occurred')
    }

    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${errorResponse.error.message}`,
      exception instanceof Error ? exception.stack : undefined,
    )

    response.status(status).json(errorResponse)
  }

  private createErrorResponse(code: string, message: string, details?: any): ErrorResponse {
    return {
      error: {
        code,
        message,
        ...(details && { details }),
      },
      timestamp: new Date().toISOString(),
    }
  }

  private getErrorCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST'
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED'
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN'
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND'
      case HttpStatus.CONFLICT:
        return 'CONFLICT'
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'TOO_MANY_REQUESTS'
      default:
        return 'INTERNAL_ERROR'
    }
  }

  private handlePrismaError(error: Prisma.PrismaClientKnownRequestError): {
    status: number
    response: ErrorResponse
  } {
    switch (error.code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          response: this.createErrorResponse(
            'UNIQUE_CONSTRAINT_VIOLATION',
            `Unique constraint violation on ${error.meta?.target}`,
            { field: error.meta?.target },
          ),
        }
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          response: this.createErrorResponse(
            'FOREIGN_KEY_CONSTRAINT_VIOLATION',
            `Foreign key constraint violation on ${error.meta?.field_name}`,
            { field: error.meta?.field_name },
          ),
        }
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          response: this.createErrorResponse('RECORD_NOT_FOUND', 'Record not found'),
        }
      case 'P2014':
        return {
          status: HttpStatus.BAD_REQUEST,
          response: this.createErrorResponse(
            'INVALID_RELATION',
            `Invalid relation: ${error.meta?.relation_name}`,
            { relation: error.meta?.relation_name },
          ),
        }
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          response: this.createErrorResponse(
            'DATABASE_ERROR',
            process.env.NODE_ENV === 'production' ? 'Database error' : error.message,
            process.env.NODE_ENV === 'development'
              ? { code: error.code, meta: error.meta }
              : undefined,
          ),
        }
    }
  }
}
