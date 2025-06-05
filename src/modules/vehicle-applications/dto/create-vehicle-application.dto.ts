// src/modules/vehicle-applications/dto/create-vehicle-application.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsString, IsOptional, IsBoolean, MaxLength, IsArray, ArrayMinSize } from 'class-validator'

export class CreateVehicleApplicationDto {
  @ApiProperty({
    description: 'ID товара',
  })
  @IsString()
  productId!: string

  @ApiProperty({
    description: 'Массив ID модификаций',
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  modificationIds!: string[]

  @ApiPropertyOptional({
    description: 'ID типа из каталога TecDoc',
  })
  @IsOptional()
  @IsString()
  kTypeId?: string

  @ApiPropertyOptional({
    description: 'Примечания по применимости',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string

  @ApiPropertyOptional({
    description: 'Проверено экспертом',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean
}

export class CreateBulkApplicationDto {
  @ApiProperty({
    description: 'Массив ID товаров',
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  productIds!: string[]

  @ApiProperty({
    description: 'ID модификации',
  })
  @IsString()
  modificationId!: string

  @ApiPropertyOptional({
    description: 'ID типа из каталога TecDoc',
  })
  @IsOptional()
  @IsString()
  kTypeId?: string

  @ApiPropertyOptional({
    description: 'Примечания по применимости',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string

  @ApiPropertyOptional({
    description: 'Проверено экспертом',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean
}
