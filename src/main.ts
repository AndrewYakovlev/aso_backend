// src/main.ts
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ValidationPipe, VersioningType } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import helmet from 'helmet'
import compression from 'compression'
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'
import { ResponseInterceptor } from './common/interceptors/response.interceptor'
import { LoggerService } from './logger/logger.service'
import { PrismaService } from './prisma/prisma.service'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  })

  // Get services
  const configService = app.get(ConfigService)
  const logger = app.get(LoggerService)

  // Use custom logger
  app.useLogger(logger)

  const port = configService.get<number>('app.port', 4000)
  const apiPrefix = configService.get<string>('app.apiPrefix', 'api')
  const apiVersion = configService.get<string>('app.apiVersion', 'v1')

  // Security
  app.use(helmet())
  app.use(compression())

  // CORS
  app.enableCors(configService.get('app.cors'))

  // Versioning
  app.setGlobalPrefix(apiPrefix)
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: apiVersion,
  })

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  )

  // Global filters
  app.useGlobalFilters(new AllExceptionsFilter())

  // Global interceptors
  app.useGlobalInterceptors(new ResponseInterceptor())

  // Swagger documentation
  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle(configService.get<string>('SWAGGER_TITLE', 'Auto Parts API'))
      .setDescription(configService.get<string>('SWAGGER_DESCRIPTION', 'API documentation'))
      .setVersion(configService.get<string>('SWAGGER_VERSION', '1.0'))
      .addBearerAuth()
      .build()

    const document = SwaggerModule.createDocument(app, swaggerConfig)
    const swaggerPath = configService.get<string>('SWAGGER_PATH', 'docs')
    SwaggerModule.setup(`${apiPrefix}/${swaggerPath}`, app, document)

    logger.log(
      `Swagger documentation available at: http://localhost:${port}/${apiPrefix}/${swaggerPath}`,
      'Bootstrap',
    )
  }

  // Enable shutdown hooks
  const prismaService = app.get(PrismaService)
  if (prismaService && prismaService.enableShutdownHooks) {
    await prismaService.enableShutdownHooks(app)
  }

  await app.listen(port)
  logger.log(
    `Application is running on: http://localhost:${port}/${apiPrefix}/${apiVersion}`,
    'Bootstrap',
  )
}

bootstrap()
