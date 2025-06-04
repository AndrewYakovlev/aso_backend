// src/modules/characteristics/dto/update-characteristic.dto.ts
import { PartialType, OmitType } from '@nestjs/swagger'
import { CreateCharacteristicDto } from './create-characteristic.dto'

export class UpdateCharacteristicDto extends PartialType(
  OmitType(CreateCharacteristicDto, ['code'] as const),
) {}
