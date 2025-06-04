// src/modules/vehicles/dto/update-vehicle-generation.dto.ts
import { PartialType, OmitType } from '@nestjs/swagger'
import { CreateVehicleGenerationDto } from './create-vehicle-generation.dto'

export class UpdateVehicleGenerationDto extends PartialType(
  OmitType(CreateVehicleGenerationDto, ['modelId', 'slug'] as const),
) {}
