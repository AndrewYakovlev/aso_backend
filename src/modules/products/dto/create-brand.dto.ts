// src/modules/products/dto/create-brand.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsString, IsOptional, IsBoolean, IsUrl, MinLength, MaxLength } from 'class-validator'

export class CreateBrandDto {
  @ApiProperty({
    description: 'Название бренда',
    example: 'Castrol',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string

  @ApiProperty({
    description: 'URL-friendly идентификатор',
    example: 'castrol',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  slug!: string

  @ApiPropertyOptional({
    description: 'URL логотипа',
    example: 'https://example.com/logos/castrol.png',
  })
  @IsOptional()
  @IsUrl()
  logo?: string

  @ApiPropertyOptional({
    description: 'Описание бренда',
    example: 'Британский производитель смазочных материалов',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string

  @ApiPropertyOptional({
    description: 'Страна происхождения',
    example: 'Великобритания',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string

  @ApiPropertyOptional({
    description: 'Активность бренда',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}
