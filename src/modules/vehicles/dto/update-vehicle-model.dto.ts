// src/modules/vehicles/dto/update-vehicle-model.dto.ts
import { PartialType, OmitType } from '@nestjs/swagger'
import { CreateVehicleModelDto } from './create-vehicle-model.dto'

export class UpdateVehicleModelDto extends PartialType(
  OmitType(CreateVehicleModelDto, ['makeId', 'slug'] as const),
) {}
