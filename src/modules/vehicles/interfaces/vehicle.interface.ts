// src/modules/vehicles/interfaces/vehicle.interface.ts
import { VehicleMake, VehicleModel, VehicleGeneration, VehicleModification } from '@prisma/client'

export interface VehicleMakeWithRelations extends VehicleMake {
  models?: VehicleModelWithRelations[]
  _count?: {
    models?: number
  }
}

export interface VehicleModelWithRelations extends VehicleModel {
  make?: VehicleMake
  generations?: VehicleGenerationWithRelations[]
  _count?: {
    generations?: number
  }
}

export interface VehicleGenerationWithRelations extends VehicleGeneration {
  model?: VehicleModelWithRelations
  modifications?: VehicleModificationWithRelations[]
  _count?: {
    modifications?: number
  }
}

export interface VehicleModificationWithRelations extends VehicleModification {
  generation?: VehicleGenerationWithRelations
  _count?: {
    applications?: number
  }
}

export interface VehicleSearchResult {
  make: VehicleMake
  model: VehicleModel
  generation?: VehicleGeneration
  modification?: VehicleModification
}

export interface VehicleHierarchy {
  makeId: string
  makeName: string
  makeSlug: string
  modelId?: string
  modelName?: string
  modelSlug?: string
  generationId?: string
  generationName?: string
  generationSlug?: string
  modificationId?: string
  modificationName?: string
}
