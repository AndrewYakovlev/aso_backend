// src/modules/vehicles/dto/update-vehicle-make.dto.ts
import { PartialType, OmitType } from '@nestjs/swagger'
import { CreateVehicleMakeDto } from './create-vehicle-make.dto'

export class UpdateVehicleMakeDto extends PartialType(
  OmitType(CreateVehicleMakeDto, ['slug'] as const),
) {}
