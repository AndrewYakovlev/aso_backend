// src/modules/characteristics/dto/characteristic-value.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsString, IsNumber, IsBoolean, IsOptional, ValidateIf } from 'class-validator'
import { Type } from 'class-transformer'
import { CharacteristicType } from '../interfaces/characteristic.interface'

export class CharacteristicValueDto {
  @ApiPropertyOptional({
    description: 'Текстовое значение',
    example: 'Красный',
  })
  @ValidateIf((o, value) => value !== undefined)
  @IsString()
  textValue?: string

  @ApiPropertyOptional({
    description: 'Числовое значение',
    example: 100,
  })
  @ValidateIf((o, value) => value !== undefined)
  @IsNumber()
  @Type(() => Number)
  numberValue?: number

  @ApiPropertyOptional({
    description: 'Логическое значение',
    example: true,
  })
  @ValidateIf((o, value) => value !== undefined)
  @IsBoolean()
  booleanValue?: boolean

  @ApiPropertyOptional({
    description: 'ID значения из справочника (для типа select)',
  })
  @ValidateIf((o, value) => value !== undefined)
  @IsString()
  selectValueId?: string
}

export class SetProductCharacteristicDto {
  @ApiProperty({
    description: 'ID характеристики',
  })
  @IsString()
  characteristicId!: string

  @ApiPropertyOptional({
    description: 'Значение характеристики (для типов text, number, boolean)',
  })
  @IsOptional()
  @IsString()
  value?: string

  @ApiPropertyOptional({
    description: 'ID значения из справочника (для типа select)',
  })
  @IsOptional()
  @IsString()
  characteristicValueId?: string
}
