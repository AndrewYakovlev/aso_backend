// src/modules/vehicles/dto/vehicle-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type, Exclude, plainToInstance } from 'class-transformer'
import {
  VehicleMakeWithRelations,
  VehicleModelWithRelations,
  VehicleGenerationWithRelations,
  VehicleModificationWithRelations,
} from '../interfaces/vehicle.interface'

export class VehicleMakeResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  name!: string

  @ApiProperty()
  slug!: string

  @ApiPropertyOptional()
  country?: string | null

  @ApiPropertyOptional()
  logoUrl?: string | null

  @ApiPropertyOptional({
    description: 'Количество моделей',
  })
  modelCount?: number

  @ApiPropertyOptional({ type: [VehicleModelResponseDto] })
  @Type(() => VehicleModelResponseDto)
  models?: VehicleModelResponseDto[]

  static fromEntity(make: VehicleMakeWithRelations): VehicleMakeResponseDto {
    const plain = {
      ...make,
      modelCount: make._count?.models || make.models?.length || 0,
      models: make.models?.map((model) => VehicleModelResponseDto.fromEntity(model)),
    }

    return plainToInstance(VehicleMakeResponseDto, plain)
  }
}

export class VehicleGenerationResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  modelId!: string

  @ApiProperty()
  name!: string

  @ApiProperty()
  slug!: string

  @ApiProperty()
  startYear!: number

  @ApiPropertyOptional()
  endYear?: number | null

  @ApiPropertyOptional()
  bodyType?: string | null

  @ApiPropertyOptional({ type: VehicleModelResponseDto })
  @Type(() => VehicleModelResponseDto)
  model?: VehicleModelResponseDto

  @ApiPropertyOptional({
    description: 'Количество модификаций',
  })
  modificationCount?: number

  @ApiPropertyOptional({ type: [VehicleModificationResponseDto] })
  @Type(() => VehicleModificationResponseDto)
  modifications?: VehicleModificationResponseDto[]

  static fromEntity(generation: VehicleGenerationWithRelations): VehicleGenerationResponseDto {
    const plain = {
      ...generation,
      model: generation.model ? VehicleModelResponseDto.fromEntity(generation.model) : undefined,
      modificationCount: generation._count?.modifications || generation.modifications?.length || 0,
      modifications: generation.modifications?.map((mod) =>
        VehicleModificationResponseDto.fromEntity(mod),
      ),
    }

    return plainToInstance(VehicleGenerationResponseDto, plain)
  }
}

export class VehicleModificationResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  generationId!: string

  @ApiProperty()
  name!: string

  @ApiPropertyOptional()
  engineCode?: string | null

  @ApiPropertyOptional()
  fuelType?: string | null

  @ApiPropertyOptional()
  powerHp?: number | null

  @ApiPropertyOptional()
  transmission?: string | null

  @ApiPropertyOptional({ type: VehicleGenerationResponseDto })
  @Type(() => VehicleGenerationResponseDto)
  generation?: VehicleGenerationResponseDto

  @ApiPropertyOptional({
    description: 'Количество применимых запчастей',
  })
  applicationCount?: number

  static fromEntity(
    modification: VehicleModificationWithRelations,
  ): VehicleModificationResponseDto {
    const plain = {
      ...modification,
      generation: modification.generation
        ? VehicleGenerationResponseDto.fromEntity(modification.generation)
        : undefined,
      applicationCount: modification._count?.applications || 0,
    }

    return plainToInstance(VehicleModificationResponseDto, plain)
  }
}

export class VehicleModelResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  makeId!: string

  @ApiProperty()
  name!: string

  @ApiProperty()
  slug!: string

  @ApiPropertyOptional()
  modelCode?: string | null

  @ApiProperty()
  startYear!: number

  @ApiPropertyOptional()
  endYear?: number | null

  @ApiPropertyOptional({ type: VehicleMakeResponseDto })
  @Type(() => VehicleMakeResponseDto)
  make?: VehicleMakeResponseDto

  @ApiPropertyOptional({
    description: 'Количество поколений',
  })
  generationCount?: number

  @ApiPropertyOptional({ type: [VehicleGenerationResponseDto] })
  @Type(() => VehicleGenerationResponseDto)
  generations?: VehicleGenerationResponseDto[]

  static fromEntity(model: VehicleModelWithRelations): VehicleModelResponseDto {
    const plain = {
      ...model,
      make: model.make ? VehicleMakeResponseDto.fromEntity(model.make) : undefined,
      generationCount: model._count?.generations || model.generations?.length || 0,
      generations: model.generations?.map((gen) => VehicleGenerationResponseDto.fromEntity(gen)),
    }

    return plainToInstance(VehicleModelResponseDto, plain)
  }
}

export class VehicleSearchResultDto {
  @ApiProperty({ type: VehicleMakeResponseDto })
  @Type(() => VehicleMakeResponseDto)
  make!: VehicleMakeResponseDto

  @ApiProperty({ type: VehicleModelResponseDto })
  @Type(() => VehicleModelResponseDto)
  model!: VehicleModelResponseDto

  @ApiPropertyOptional({ type: VehicleGenerationResponseDto })
  @Type(() => VehicleGenerationResponseDto)
  generation?: VehicleGenerationResponseDto

  @ApiPropertyOptional({ type: VehicleModificationResponseDto })
  @Type(() => VehicleModificationResponseDto)
  modification?: VehicleModificationResponseDto

  @ApiProperty({
    description: 'Полное название автомобиля',
  })
  fullName!: string
}
