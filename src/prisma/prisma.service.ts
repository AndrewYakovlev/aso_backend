// src/prisma/prisma.service.ts
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private configService: ConfigService) {
    const logging = configService.get<boolean>('database.logging', false);

    super({
      log: logging
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'info' },
            { emit: 'event', level: 'warn' },
          ]
        : ['error'],
      errorFormat: 'minimal',
    });

    if (logging) {
      // @ts-ignore
      this.$on('query', (e) => {
        this.logger.debug(
          `Query: ${e.query} - Params: ${e.params} - Duration: ${e.duration}ms`,
        );
      });
    }
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Prisma connected to database');
    } catch (error) {
      this.logger.error('Failed to connect to database', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Prisma disconnected from database');
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('cleanDatabase is not allowed in production');
    }

    const models = Object.keys(this).filter(
      (key) =>
        key[0] !== '_' &&
        key[0] === key[0].toLowerCase() &&
        key !== '$' &&
        typeof this[key] === 'object',
    );

    return Promise.all(models.map((model) => this[model].deleteMany()));
  }
}
