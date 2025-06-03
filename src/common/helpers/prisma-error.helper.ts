// src/common/helpers/prisma-error.helper.ts
import { HttpException, HttpStatus } from '@nestjs/common'
import { Prisma } from '@prisma/client'

export class PrismaErrorHelper {
  static handleError(error: any): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case 'P2002': {
          // Unique constraint violation
          const field = error.meta?.target as string[]
          const fieldName = field?.[0] || 'field'
          throw new HttpException(
            {
              statusCode: HttpStatus.CONFLICT,
              message: `${fieldName} already exists`,
              error: 'Conflict',
            },
            HttpStatus.CONFLICT,
          )
        }

        case 'P2003': {
          // Foreign key constraint violation
          const field = error.meta?.field_name as string
          throw new HttpException(
            {
              statusCode: HttpStatus.BAD_REQUEST,
              message: `Invalid reference in field ${field}`,
              error: 'Bad Request',
            },
            HttpStatus.BAD_REQUEST,
          )
        }

        case 'P2025': {
          // Record not found
          throw new HttpException(
            {
              statusCode: HttpStatus.NOT_FOUND,
              message: 'Record not found',
              error: 'Not Found',
            },
            HttpStatus.NOT_FOUND,
          )
        }

        case 'P2014': {
          // Invalid ID
          throw new HttpException(
            {
              statusCode: HttpStatus.BAD_REQUEST,
              message: 'Invalid ID provided',
              error: 'Bad Request',
            },
            HttpStatus.BAD_REQUEST,
          )
        }

        case 'P2021': {
          // Table not found
          throw new HttpException(
            {
              statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
              message: 'Database table not found',
              error: 'Internal Server Error',
            },
            HttpStatus.INTERNAL_SERVER_ERROR,
          )
        }

        case 'P2022': {
          // Column not found
          throw new HttpException(
            {
              statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
              message: 'Database column not found',
              error: 'Internal Server Error',
            },
            HttpStatus.INTERNAL_SERVER_ERROR,
          )
        }

        default: {
          // Unknown Prisma error
          throw new HttpException(
            {
              statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
              message: 'Database operation failed',
              error: 'Internal Server Error',
            },
            HttpStatus.INTERNAL_SERVER_ERROR,
          )
        }
      }
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Invalid data provided',
          error: 'Bad Request',
        },
        HttpStatus.BAD_REQUEST,
      )
    }

    if (error instanceof Prisma.PrismaClientInitializationError) {
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Database connection failed',
          error: 'Internal Server Error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }

    // Re-throw if it's already an HttpException
    if (error instanceof HttpException) {
      throw error
    }

    // Unknown error
    throw new HttpException(
      {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'An unexpected error occurred',
        error: 'Internal Server Error',
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    )
  }

  static isUniqueConstraintError(error: any): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
  }

  static isNotFoundError(error: any): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025'
  }

  static isForeignKeyError(error: any): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003'
  }

  static getFieldFromUniqueError(error: any): string | undefined {
    if (this.isUniqueConstraintError(error)) {
      const field = error.meta?.target as string[]
      return field?.[0]
    }
    return undefined
  }
}
