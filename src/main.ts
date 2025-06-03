// src/main.ts
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import * as helmet from 'helmet'
import * as compression from 'compression'
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'
import { ResponseInterceptor } from './common/interceptors/response.interceptor'

async function bootstrap() {
  const logger = new Logger('Bootstrap')

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'debug', 'log', 'verbose'],
  })

  const configService = app.get(ConfigService)
  const port = configService.get<number>('app.port')
  const apiPrefix = configService.get<string>('app.apiPrefix')
  const apiVersion = configService.get<string>('app.apiVersion')

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
    )
  }

  await app.listen(port)
  logger.log(`Application is running on: http://localhost:${port}/${apiPrefix}/${apiVersion}`)
}

bootstrap()
