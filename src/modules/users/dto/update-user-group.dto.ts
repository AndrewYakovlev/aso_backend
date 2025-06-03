// src/modules/users/dto/update-user-group.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsString, IsOptional } from 'class-validator'

export class UpdateUserGroupDto {
  @ApiPropertyOptional({
    description: 'ID группы клиентов (null для удаления из группы)',
  })
  @IsOptional()
  @IsString()
  customerGroupId?: string | null
}
