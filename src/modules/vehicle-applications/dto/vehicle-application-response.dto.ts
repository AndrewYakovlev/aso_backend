// src/modules/vehicle-applications/dto/vehicle-application-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type, plainToInstance } from 'class-transformer'
import { ProductListItemDto } from '../../products/dto/product-response.dto'
import {
  VehicleMakeResponseDto,
  VehicleModelResponseDto,
  VehicleGenerationResponseDto,
  VehicleModificationResponseDto,
} from '../../vehicles/dto/vehicle-response.dto'

export class VehicleApplicationResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  productId!: string

  @ApiProperty()
  modificationId!: string

  @ApiPropertyOptional()
  kTypeId?: string | null

  @ApiPropertyOptional()
  notes?: string | null

  @ApiProperty()
  isVerified!: boolean

  @ApiPropertyOptional({ type: ProductListItemDto })
  @Type(() => ProductListItemDto)
  product?: ProductListItemDto

  @ApiPropertyOptional({ type: VehicleModificationResponseDto })
  @Type(() => VehicleModificationResponseDto)
  modification?: VehicleModificationResponseDto

  static fromEntity(entity: any): VehicleApplicationResponseDto {
    return plainToInstance(VehicleApplicationResponseDto, entity)
  }
}

export class ProductWithVehiclesDto {
  @ApiProperty({ type: ProductListItemDto })
  @Type(() => ProductListItemDto)
  product!: ProductListItemDto

  @ApiProperty({
    description: 'Применимые автомобили',
    type: [VehicleApplicationResponseDto],
  })
  @Type(() => VehicleApplicationResponseDto)
  applications!: VehicleApplicationResponseDto[]

  @ApiProperty({
    description: 'Уникальные марки',
    type: [VehicleMakeResponseDto],
  })
  @Type(() => VehicleMakeResponseDto)
  makes!: VehicleMakeResponseDto[]

  @ApiProperty({
    description: 'Общее количество применений',
  })
  totalApplications!: number
}

export class VehicleWithProductsDto {
  @ApiProperty({ type: VehicleMakeResponseDto })
  @Type(() => VehicleMakeResponseDto)
  make!: VehicleMakeResponseDto

  @ApiProperty({ type: VehicleModelResponseDto })
  @Type(() => VehicleModelResponseDto)
  model!: VehicleModelResponseDto

  @ApiProperty({ type: VehicleGenerationResponseDto })
  @Type(() => VehicleGenerationResponseDto)
  generation!: VehicleGenerationResponseDto

  @ApiProperty({ type: VehicleModificationResponseDto })
  @Type(() => VehicleModificationResponseDto)
  modification!: VehicleModificationResponseDto

  @ApiProperty({
    description: 'Применимые товары',
    type: [ProductListItemDto],
  })
  @Type(() => ProductListItemDto)
  products!: ProductListItemDto[]

  @ApiProperty({
    description: 'Общее количество товаров',
  })
  totalProducts!: number
}
