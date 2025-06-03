import { ApiProperty } from '@nestjs/swagger'

export class AnonymousTokenDto {
  @ApiProperty({
    description: 'Anonymous access token',
  })
  token!: string

  @ApiProperty({
    description: 'Anonymous session ID',
  })
  sessionId!: string

  @ApiProperty({
    description: 'Token expiration time in seconds',
    example: 900,
    required: false,
  })
  expiresIn?: number
}
