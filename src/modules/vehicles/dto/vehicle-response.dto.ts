// src/modules/vehicles/dto/vehicle-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type, Exclude, plainToInstance } from 'class-transformer'
import {
  VehicleMakeWithRelations,
  VehicleModelWithRelations,
  VehicleGenerationWithRelations,
  VehicleModificationWithRelations,
} from '../interfaces/vehicle.interface'

// Сначала объявляем классы без циклических зависимостей

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

  @ApiPropertyOptional()
  description?: string | null

  @ApiPropertyOptional()
  metaTitle?: string | null

  @ApiPropertyOptional()
  metaDescription?: string | null

  @ApiPropertyOptional()
  metaKeywords?: string | null

  @ApiPropertyOptional({
    description: 'Количество моделей',
  })
  modelCount?: number

  @ApiPropertyOptional({ type: () => [VehicleModelResponseDto] })
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

  @ApiPropertyOptional()
  description?: string | null

  @ApiPropertyOptional()
  metaTitle?: string | null

  @ApiPropertyOptional()
  metaDescription?: string | null

  @ApiPropertyOptional()
  metaKeywords?: string | null

  @ApiPropertyOptional({ type: () => VehicleMakeResponseDto })
  @Type(() => VehicleMakeResponseDto)
  make?: VehicleMakeResponseDto

  @ApiPropertyOptional({
    description: 'Количество поколений',
  })
  generationCount?: number

  @ApiPropertyOptional({ type: () => [VehicleGenerationResponseDto] })
  @Type(() => VehicleGenerationResponseDto)
  generations?: VehicleGenerationResponseDto[]

  static fromEntity(model: VehicleModelWithRelations): VehicleModelResponseDto {
    const plain: any = {
      ...model,
      generationCount: model._count?.generations || model.generations?.length || 0,
    }

    // Обрабатываем связи отдельно, чтобы избежать циклических ссылок
    if (model.make) {
      plain.make = {
        id: model.make.id,
        name: model.make.name,
        slug: model.make.slug,
        country: model.make.country,
        logoUrl: model.make.logoUrl,
        description: model.make.description,
        metaTitle: model.make.metaTitle,
        metaDescription: model.make.metaDescription,
        metaKeywords: model.make.metaKeywords,
      }
    }

    if (model.generations) {
      plain.generations = model.generations.map((gen) =>
        VehicleGenerationResponseDto.fromEntity(gen),
      )
    }

    return plainToInstance(VehicleModelResponseDto, plain)
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

  @ApiPropertyOptional()
  description?: string | null

  @ApiPropertyOptional()
  metaTitle?: string | null

  @ApiPropertyOptional()
  metaDescription?: string | null

  @ApiPropertyOptional()
  metaKeywords?: string | null

  @ApiPropertyOptional({ type: () => VehicleModelResponseDto })
  @Type(() => VehicleModelResponseDto)
  model?: VehicleModelResponseDto

  @ApiPropertyOptional({
    description: 'Количество модификаций',
  })
  modificationCount?: number

  @ApiPropertyOptional({ type: () => [VehicleModificationResponseDto] })
  @Type(() => VehicleModificationResponseDto)
  modifications?: VehicleModificationResponseDto[]

  static fromEntity(generation: VehicleGenerationWithRelations): VehicleGenerationResponseDto {
    const plain: any = {
      ...generation,
      modificationCount: generation._count?.modifications || generation.modifications?.length || 0,
    }

    // Обрабатываем связи отдельно
    if (generation.model) {
      const model = generation.model
      plain.model = {
        id: model.id,
        makeId: model.makeId,
        name: model.name,
        slug: model.slug,
        modelCode: model.modelCode,
        startYear: model.startYear,
        endYear: model.endYear,
        description: model.description,
        metaTitle: model.metaTitle,
        metaDescription: model.metaDescription,
        metaKeywords: model.metaKeywords,
      }

      // Добавляем make если есть
      if (model.make) {
        plain.model.make = {
          id: model.make.id,
          name: model.make.name,
          slug: model.make.slug,
          country: model.make.country,
          logoUrl: model.make.logoUrl,
          description: model.make.description,
          metaTitle: model.make.metaTitle,
          metaDescription: model.make.metaDescription,
          metaKeywords: model.make.metaKeywords,
        }
      }
    }

    if (generation.modifications) {
      plain.modifications = generation.modifications.map((mod) =>
        VehicleModificationResponseDto.fromEntity(mod),
      )
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

  @ApiPropertyOptional({ type: () => VehicleGenerationResponseDto })
  @Type(() => VehicleGenerationResponseDto)
  generation?: VehicleGenerationResponseDto

  @ApiPropertyOptional({
    description: 'Количество применимых запчастей',
  })
  applicationCount?: number

  static fromEntity(
    modification: VehicleModificationWithRelations,
  ): VehicleModificationResponseDto {
    const plain: any = {
      ...modification,
      applicationCount: modification._count?.applications || 0,
    }

    // Обрабатываем связи отдельно, чтобы избежать глубокой вложенности
    if (modification.generation) {
      const gen = modification.generation
      plain.generation = {
        id: gen.id,
        modelId: gen.modelId,
        name: gen.name,
        slug: gen.slug,
        startYear: gen.startYear,
        endYear: gen.endYear,
        bodyType: gen.bodyType,
      }

      // Добавляем model если есть, но без глубокой вложенности
      if (gen.model) {
        plain.generation.model = {
          id: gen.model.id,
          makeId: gen.model.makeId,
          name: gen.model.name,
          slug: gen.model.slug,
          modelCode: gen.model.modelCode,
          startYear: gen.model.startYear,
          endYear: gen.model.endYear,
        }

        // Добавляем make
        if (gen.model.make) {
          plain.generation.model.make = {
            id: gen.model.make.id,
            name: gen.model.make.name,
            slug: gen.model.make.slug,
            country: gen.model.make.country,
            logoUrl: gen.model.make.logoUrl,
          }
        }
      }
    }

    return plainToInstance(VehicleModificationResponseDto, plain)
  }
}

export class VehicleSearchResultDto {
  @ApiProperty({ type: () => VehicleMakeResponseDto })
  @Type(() => VehicleMakeResponseDto)
  make!: VehicleMakeResponseDto

  @ApiProperty({ type: () => VehicleModelResponseDto })
  @Type(() => VehicleModelResponseDto)
  model!: VehicleModelResponseDto

  @ApiPropertyOptional({ type: () => VehicleGenerationResponseDto })
  @Type(() => VehicleGenerationResponseDto)
  generation?: VehicleGenerationResponseDto

  @ApiPropertyOptional({ type: () => VehicleModificationResponseDto })
  @Type(() => VehicleModificationResponseDto)
  modification?: VehicleModificationResponseDto

  @ApiProperty({
    description: 'Полное название автомобиля',
  })
  fullName!: string
}
