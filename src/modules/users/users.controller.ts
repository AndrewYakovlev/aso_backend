// src/modules/users/users.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger'
import { UsersService } from './users.service'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { UpdateUserRoleDto } from './dto/update-user-role.dto'
import { UpdateUserGroupDto } from './dto/update-user-group.dto'
import { UserResponseDto } from './dto/user-response.dto'
import { UsersFilterDto } from './dto/users-filter.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { UserRole } from '@prisma/client'
import { PaginationDto } from '@common/dto/pagination.dto'

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
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
  @Roles(UserRole.ADMIN)
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
  @ApiOperation({ summary: 'Получить статистику текущего пользователя' })
  @ApiResponse({
    status: 200,
    description: 'Статистика пользователя',
  })
  async getProfileStats(@CurrentUser('userId') userId: string) {
    return this.usersService.getUserStats(userId)
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
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
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Получить статистику пользователя' })
  @ApiResponse({
    status: 200,
    description: 'Статистика пользователя',
  })
  async getUserStats(@Param('id') id: string) {
    return this.usersService.getUserStats(id)
  }

  @Post()
  @Roles(UserRole.ADMIN)
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
  @Roles(UserRole.ADMIN)
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
  @Roles(UserRole.ADMIN)
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
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Изменить группу клиента' })
  @ApiResponse({
    status: 200,
    description: 'Группа изменена',
    type: UserResponseDto,
  })
  async updateCustomerGroup(@Param('id') id: string, @Body() updateGroupDto: UpdateUserGroupDto) {
    const user = await this.usersService.updateCustomerGroup(id, updateGroupDto.customerGroupId)
    return UserResponseDto.fromEntity(user)
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
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
