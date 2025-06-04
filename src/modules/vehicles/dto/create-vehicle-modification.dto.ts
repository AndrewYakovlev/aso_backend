// src/modules/vehicles/dto/create-vehicle-modification.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsString, IsOptional, IsInt, MinLength, MaxLength, Min, IsEnum } from 'class-validator'
import { Type } from 'class-transformer'

export enum FuelType {
  PETROL = 'PETROL',
  DIESEL = 'DIESEL',
  HYBRID = 'HYBRID',
  ELECTRIC = 'ELECTRIC',
  LPG = 'LPG',
  CNG = 'CNG',
}

export enum TransmissionType {
  MANUAL = 'MANUAL',
  AUTOMATIC = 'AUTOMATIC',
  CVT = 'CVT',
  ROBOT = 'ROBOT',
  DCT = 'DCT',
}

export class CreateVehicleModificationDto {
  @ApiProperty({
    description: 'ID поколения автомобиля',
  })
  @IsString()
  generationId!: string

  @ApiProperty({
    description: 'Название модификации',
    example: '2.5 AT Executive',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string

  @ApiPropertyOptional({
    description: 'Код двигателя',
    example: '2AR-FE',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  engineCode?: string

  @ApiPropertyOptional({
    description: 'Тип топлива',
    enum: FuelType,
    example: FuelType.PETROL,
  })
  @IsOptional()
  @IsEnum(FuelType)
  fuelType?: FuelType

  @ApiPropertyOptional({
    description: 'Мощность в л.с.',
    example: 181,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  powerHp?: number

  @ApiPropertyOptional({
    description: 'Тип трансмиссии',
    enum: TransmissionType,
    example: TransmissionType.AUTOMATIC,
  })
  @IsOptional()
  @IsEnum(TransmissionType)
  transmission?: TransmissionType
}
