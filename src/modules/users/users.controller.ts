// src/modules/users/users.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { UsersService } from './users.service'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { UpdateUserRoleDto } from './dto/update-user-role.dto'
import { UpdateUserGroupDto } from './dto/update-user-group.dto'
import { UserResponseDto } from './dto/user-response.dto'
import { UsersFilterDto } from './dto/users-filter.dto'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { RequireAuth } from '../auth/decorators/require-auth.decorator'
import { RequireRoles } from '../auth/decorators/require-roles.decorator'
import { UserRole } from '@prisma/client'
import { PaginationDto } from '@common/dto/pagination.dto'

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequireRoles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Получить список пользователей' })
  @ApiResponse({
    status: 200,
    description: 'Список пользователей',
  })
  async findAll(@Query() paginationDto: PaginationDto, @Query() filterDto: UsersFilterDto) {
    const result = await this.usersService.findAll(paginationDto, filterDto)

    return {
      ...result,
      data: result.data.map((user) => UserResponseDto.fromEntity(user)),
    }
  }

  @Get('managers')
  @RequireRoles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Получить список менеджеров' })
  @ApiResponse({
    status: 200,
    description: 'Список менеджеров',
    type: [UserResponseDto],
  })
  async getManagers() {
    const managers = await this.usersService.getManagers()
    return managers.map((manager) => UserResponseDto.fromEntity(manager))
  }

  @Get('profile')
  @RequireAuth()
  @ApiOperation({ summary: 'Получить профиль текущего пользователя' })
  @ApiResponse({
    status: 200,
    description: 'Профиль пользователя',
    type: UserResponseDto,
  })
  async getProfile(@CurrentUser('userId') userId: string) {
    const user = await this.usersService.findById(userId)
    return UserResponseDto.fromEntity(user)
  }

  @Get('profile/stats')
  @RequireAuth()
  @ApiOperation({ summary: 'Получить статистику текущего пользователя' })
  @ApiResponse({
    status: 200,
    description: 'Статистика пользователя',
  })
  async getProfileStats(@CurrentUser('userId') userId: string) {
    return this.usersService.getUserStats(userId)
  }

  @Get(':id')
  @RequireRoles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Получить пользователя по ID' })
  @ApiResponse({
    status: 200,
    description: 'Данные пользователя',
    type: UserResponseDto,
  })
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findById(id)
    return UserResponseDto.fromEntity(user)
  }

  @Get(':id/stats')
  @RequireRoles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Получить статистику пользователя' })
  @ApiResponse({
    status: 200,
    description: 'Статистика пользователя',
  })
  async getUserStats(@Param('id') id: string) {
    return this.usersService.getUserStats(id)
  }

  @Post()
  @RequireRoles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Создать пользователя' })
  @ApiResponse({
    status: 201,
    description: 'Пользователь создан',
    type: UserResponseDto,
  })
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.usersService.create(createUserDto)
    return UserResponseDto.fromEntity(user)
  }

  @Patch('profile')
  @RequireAuth()
  @ApiOperation({ summary: 'Обновить профиль текущего пользователя' })
  @ApiResponse({
    status: 200,
    description: 'Профиль обновлен',
    type: UserResponseDto,
  })
  async updateProfile(@CurrentUser('userId') userId: string, @Body() updateUserDto: UpdateUserDto) {
    // Удаляем поля, которые пользователь не может менять сам
    delete updateUserDto.role
    delete updateUserDto.customerGroupId
    delete updateUserDto.personalDiscount

    const user = await this.usersService.update(userId, updateUserDto)
    return UserResponseDto.fromEntity(user)
  }

  @Patch(':id')
  @RequireRoles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Обновить пользователя' })
  @ApiResponse({
    status: 200,
    description: 'Пользователь обновлен',
    type: UserResponseDto,
  })
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    const user = await this.usersService.update(id, updateUserDto)
    return UserResponseDto.fromEntity(user)
  }

  @Patch(':id/role')
  @RequireRoles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Изменить роль пользователя' })
  @ApiResponse({
    status: 200,
    description: 'Роль изменена',
    type: UserResponseDto,
  })
  async updateRole(@Param('id') id: string, @Body() updateRoleDto: UpdateUserRoleDto) {
    const user = await this.usersService.updateRole(id, updateRoleDto.role)
    return UserResponseDto.fromEntity(user)
  }

  @Patch(':id/customer-group')
  @RequireRoles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Изменить группу клиента' })
  @ApiResponse({
    status: 200,
    description: 'Группа изменена',
    type: UserResponseDto,
  })
  async updateCustomerGroup(@Param('id') id: string, @Body() updateGroupDto: UpdateUserGroupDto) {
    // Преобразуем undefined в null
    const customerGroupId = updateGroupDto.customerGroupId ?? null
    const user = await this.usersService.updateCustomerGroup(id, customerGroupId)
    return UserResponseDto.fromEntity(user)
  }

  @Delete(':id')
  @RequireRoles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить пользователя' })
  @ApiResponse({
    status: 204,
    description: 'Пользователь удален',
  })
  async remove(@Param('id') id: string) {
    await this.usersService.softDelete(id)
  }
}
