// src/modules/characteristics/dto/create-characteristic.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsInt,
  MinLength,
  MaxLength,
  Min,
  IsArray,
  ValidateNested,
  ValidateIf,
  ArrayMinSize,
} from 'class-validator'
import { Type } from 'class-transformer'
import {
  CharacteristicType,
  CharacteristicFilterType,
} from '../interfaces/characteristic.interface'

export class CreateCharacteristicValueDto {
  @ApiProperty({
    description: 'Значение',
    example: 'Красный',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  value!: string

  @ApiPropertyOptional({
    description: 'Порядок сортировки',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sortOrder?: number
}

export class CreateCharacteristicDto {
  @ApiProperty({
    description: 'Название характеристики',
    example: 'Цвет',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string

  @ApiProperty({
    description: 'Код характеристики',
    example: 'color',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  code!: string

  @ApiProperty({
    description: 'Тип характеристики',
    enum: CharacteristicType,
    example: CharacteristicType.SELECT,
  })
  @IsEnum(CharacteristicType)
  type!: CharacteristicType

  @ApiPropertyOptional({
    description: 'Единица измерения',
    example: 'мм',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string

  @ApiPropertyOptional({
    description: 'Обязательная характеристика',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean

  @ApiPropertyOptional({
    description: 'Используется в фильтрах',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isFilterable?: boolean

  @ApiPropertyOptional({
    description: 'Тип фильтра',
    enum: CharacteristicFilterType,
    example: CharacteristicFilterType.SELECT,
  })
  @ValidateIf((o) => o.isFilterable === true)
  @IsEnum(CharacteristicFilterType)
  filterType?: CharacteristicFilterType

  @ApiPropertyOptional({
    description: 'Порядок сортировки',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sortOrder?: number

  @ApiPropertyOptional({
    description: 'ID категорий для привязки',
    type: [String],
    example: ['cat-1', 'cat-2'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[]

  @ApiPropertyOptional({
    description: 'Значения для типа select',
    type: [CreateCharacteristicValueDto],
  })
  @ValidateIf((o) => o.type === CharacteristicType.SELECT)
  @IsArray()
  @ArrayMinSize(1, { message: 'Для типа select необходимо указать хотя бы одно значение' })
  @ValidateNested({ each: true })
  @Type(() => CreateCharacteristicValueDto)
  values?: CreateCharacteristicValueDto[]
}
