// src/modules/vehicle-applications/vehicle-applications.module.ts
import { Module } from '@nestjs/common'
import { VehicleApplicationsController } from './vehicle-applications.controller'
import { VehicleApplicationsService } from './vehicle-applications.service'

@Module({
  controllers: [VehicleApplicationsController],
  providers: [VehicleApplicationsService],
  exports: [VehicleApplicationsService],
})
export class VehicleApplicationsModule {}
