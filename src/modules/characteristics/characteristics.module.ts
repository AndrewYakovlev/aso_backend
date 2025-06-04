// src/modules/characteristics/characteristics.module.ts
import { Module } from '@nestjs/common'
import { CharacteristicsController } from './characteristics.controller'
import { CharacteristicsService } from './characteristics.service'

@Module({
  controllers: [CharacteristicsController],
  providers: [CharacteristicsService],
  exports: [CharacteristicsService],
})
export class CharacteristicsModule {}
