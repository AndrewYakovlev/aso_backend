// src/modules/products/dto/update-brand.dto.ts
import { OmitType, PartialType } from '@nestjs/swagger'
import { CreateBrandDto } from './create-brand.dto'

export class UpdateBrandDto extends PartialType(OmitType(CreateBrandDto, ['slug'] as const)) {}
