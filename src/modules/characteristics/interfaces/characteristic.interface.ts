// src/modules/characteristics/interfaces/characteristic.interface.ts
import { Characteristic, CharacteristicValue, Category } from '@prisma/client'

export enum CharacteristicType {
  TEXT = 'text',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  SELECT = 'select',
}

export enum CharacteristicFilterType {
  RANGE = 'range',
  CHECKBOX = 'checkbox',
  SELECT = 'select',
}

export interface CharacteristicCategory {
  id: string
  name: string
  slug: string
}

export interface CharacteristicWithRelations extends Characteristic {
  values?: CharacteristicValue[]
  categories?: Array<{
    category: CharacteristicCategory
  }>
  _count?: {
    productValues: number
  }
}

export interface CharacteristicValueValidation {
  isValid: boolean
  message?: string
}
