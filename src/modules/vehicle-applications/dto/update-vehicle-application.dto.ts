// src/modules/vehicle-applications/dto/update-vehicle-application.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator'

export class UpdateVehicleApplicationDto {
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
  })
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean
}
