// src/modules/characteristics/dto/characteristic-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type, plainToInstance } from 'class-transformer'
import {
  CharacteristicType,
  CharacteristicFilterType,
  CharacteristicWithRelations,
} from '../interfaces/characteristic.interface'

export class CharacteristicValueResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  value!: string

  @ApiProperty()
  sortOrder!: number
}

export class CharacteristicCategoryDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  name!: string

  @ApiProperty()
  slug!: string
}

export class CharacteristicResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  name!: string

  @ApiProperty()
  code!: string

  @ApiProperty({
    enum: CharacteristicType,
  })
  type!: CharacteristicType

  @ApiPropertyOptional()
  unit?: string | null

  @ApiProperty()
  isRequired!: boolean

  @ApiProperty()
  isFilterable!: boolean

  @ApiPropertyOptional({
    enum: CharacteristicFilterType,
  })
  filterType?: CharacteristicFilterType | null

  @ApiProperty()
  sortOrder!: number

  @ApiProperty()
  createdAt!: Date

  @ApiPropertyOptional({
    type: [CharacteristicValueResponseDto],
    description: 'Значения для типа select',
  })
  @Type(() => CharacteristicValueResponseDto)
  values?: CharacteristicValueResponseDto[]

  @ApiPropertyOptional({
    type: [CharacteristicCategoryDto],
    description: 'Категории, к которым привязана характеристика',
  })
  @Type(() => CharacteristicCategoryDto)
  categories?: CharacteristicCategoryDto[]

  @ApiPropertyOptional({
    description: 'Количество товаров с этой характеристикой',
  })
  productCount?: number

  static fromEntity(characteristic: CharacteristicWithRelations): CharacteristicResponseDto {
    const plain = {
      ...characteristic,
      values: characteristic.values?.sort((a, b) => a.sortOrder - b.sortOrder),
      categories: characteristic.categories?.map((cc) => cc.category),
      productCount: characteristic._count?.productValues || 0,
    }

    return plainToInstance(CharacteristicResponseDto, plain)
  }
}
