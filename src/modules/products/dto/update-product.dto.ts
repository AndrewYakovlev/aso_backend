// src/modules/products/dto/update-product.dto.ts
import { PartialType, OmitType } from '@nestjs/swagger'
import { CreateProductDto } from './create-product.dto'

export class UpdateProductDto extends PartialType(
  OmitType(CreateProductDto, ['slug', 'sku'] as const),
) {}
