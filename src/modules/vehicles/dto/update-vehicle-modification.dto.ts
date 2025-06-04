// src/modules/vehicles/dto/update-vehicle-modification.dto.ts
import { PartialType, OmitType } from '@nestjs/swagger'
import { CreateVehicleModificationDto } from './create-vehicle-modification.dto'

export class UpdateVehicleModificationDto extends PartialType(
  OmitType(CreateVehicleModificationDto, ['generationId'] as const),
) {}
