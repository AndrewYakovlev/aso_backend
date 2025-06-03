// src/modules/users/dto/user-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { UserRole } from '@prisma/client'
import { Exclude, Expose, Type } from 'class-transformer'

export class CustomerGroupDto {
  @ApiProperty()
  id: string

  @ApiProperty()
  name: string

  @ApiProperty()
  discountPercent: number
}

export class UserResponseDto {
  @ApiProperty()
  id: string

  @ApiProperty()
  phone: string

  @ApiPropertyOptional()
  email?: string

  @ApiPropertyOptional()
  firstName?: string

  @ApiPropertyOptional()
  lastName?: string

  @ApiProperty({ enum: UserRole })
  role: UserRole

  @ApiPropertyOptional({ type: CustomerGroupDto })
  @Type(() => CustomerGroupDto)
  customerGroup?: CustomerGroupDto

  @ApiPropertyOptional()
  personalDiscount?: number

  @ApiProperty()
  createdAt: Date

  @ApiProperty()
  updatedAt: Date

  @Exclude()
  deletedAt?: Date

  static fromEntity(user: any): UserResponseDto {
    const dto = new UserResponseDto()
    Object.assign(dto, user)
    return dto
  }

  @ApiPropertyOptional()
  get fullName(): string | null {
    if (this.firstName && this.lastName) {
      return `${this.firstName} ${this.lastName}`
    }
    return this.firstName || this.lastName || null
  }

  @ApiProperty()
  get displayName(): string {
    return this.fullName || this.email || this.phone
  }
}
