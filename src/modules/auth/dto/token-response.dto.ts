// src/modules/auth/dto/token-response.dto.ts
import { ApiProperty } from '@nestjs/swagger'
import { UserResponseDto } from '../../users/dto/user-response.dto'

export class TokenResponseDto {
  @ApiProperty({
    description: 'Access token',
  })
  accessToken: string

  @ApiProperty({
    description: 'Refresh token',
  })
  refreshToken: string

  @ApiProperty({
    description: 'Token type',
    example: 'Bearer',
  })
  tokenType: string

  @ApiProperty({
    description: 'Token expiration time in seconds',
    example: 900,
  })
  expiresIn: number

  @ApiProperty({
    description: 'User data',
    type: UserResponseDto,
    required: false,
  })
  user?: UserResponseDto
}
