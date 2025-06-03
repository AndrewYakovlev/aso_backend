import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { PrismaService } from '@prisma/prisma.service'
import { User, UserRole, Prisma } from '@prisma/client'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { PaginationDto } from '@common/dto/pagination.dto'
import { PaginatedResult } from '@common/interfaces/paginated-result.interface'
import { PaginationUtil } from '@common/utils/pagination.util'
import { StringUtil } from '@common/utils/string.util'
import { PrismaErrorHelper } from '@common/helpers/prisma-error.helper'
import { Cacheable, CacheEvict } from '@common/decorators/cacheable.decorator'
import { CacheKeys, CacheTTL } from '../../redis/redis.constants'
import { RedisService } from '../../redis/redis.service'

@Injectable()
export class UsersService {
  // Добавляем RedisService в конструктор
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    try {
      const normalizedPhone = StringUtil.cleanPhone(createUserDto.phone)

      const user = await this.prisma.user.create({
        data: {
          ...createUserDto,
          phone: normalizedPhone,
        },
        include: {
          customerGroup: true,
        },
      })

      return user
    } catch (error) {
      if (PrismaErrorHelper.isUniqueConstraintError(error)) {
        throw new ConflictException('Пользователь с таким телефоном уже существует')
      }
      PrismaErrorHelper.handleError(error)
    }
  }

  @Cacheable({
    key: (id: string) => `${CacheKeys.USER}${id}`,
    ttl: CacheTTL.USER,
  })
  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        customerGroup: true,
      },
    })
  }

  async findByPhone(phone: string): Promise<User | null> {
    const normalizedPhone = StringUtil.cleanPhone(phone)

    return this.prisma.user.findUnique({
      where: { phone: normalizedPhone },
      include: {
        customerGroup: true,
      },
    })
  }

  async findByEmail(email: string): Promise<User | null> {
    // Исправление: используем findFirst вместо findUnique, так как email не является уникальным в схеме
    return this.prisma.user.findFirst({
      where: {
        email,
        deletedAt: null, // добавляем проверку на удаленных пользователей
      },
      include: {
        customerGroup: true,
      },
    })
  }

  async findAll(
    paginationDto: PaginationDto,
    filters?: {
      role?: UserRole
      customerGroupId?: string
      search?: string
    },
  ): Promise<PaginatedResult<User>> {
    const { page, limit } = PaginationUtil.validatePagination(
      paginationDto.page,
      paginationDto.limit,
    )

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
    }

    if (filters?.role) {
      where.role = filters.role
    }

    if (filters?.customerGroupId) {
      where.customerGroupId = filters.customerGroupId
    }

    if (filters?.search) {
      where.OR = [
        { phone: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          customerGroup: true,
        },
        skip: PaginationUtil.getSkip(page, limit),
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ])

    return PaginationUtil.createPaginatedResult(users, total, page, limit)
  }

  @CacheEvict({
    key: (id: string) => `${CacheKeys.USER}${id}`,
  })
  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    try {
      const user = await this.findById(id)
      if (!user) {
        throw new NotFoundException('Пользователь не найден')
      }

      // Исправление: убираем проверку phone, так как он исключен из UpdateUserDto
      const data: Prisma.UserUpdateInput = { ...updateUserDto }

      const updatedUser = await this.prisma.user.update({
        where: { id },
        data,
        include: {
          customerGroup: true,
        },
      })

      return updatedUser
    } catch (error) {
      if (PrismaErrorHelper.isUniqueConstraintError(error)) {
        const field = PrismaErrorHelper.getFieldFromUniqueError(error)
        throw new ConflictException(`Пользователь с таким ${field} уже существует`)
      }
      PrismaErrorHelper.handleError(error)
    }
  }

  @CacheEvict({
    key: (id: string) => `${CacheKeys.USER}${id}`,
  })
  async updateRole(id: string, role: UserRole): Promise<User> {
    const user = await this.findById(id)
    if (!user) {
      throw new NotFoundException('Пользователь не найден')
    }

    return this.prisma.user.update({
      where: { id },
      data: { role },
      include: {
        customerGroup: true,
      },
    })
  }

  @CacheEvict({
    key: (id: string) => `${CacheKeys.USER}${id}`,
  })
  async updateCustomerGroup(id: string, customerGroupId: string | null): Promise<User> {
    const user = await this.findById(id)
    if (!user) {
      throw new NotFoundException('Пользователь не найден')
    }

    if (customerGroupId) {
      const group = await this.prisma.customerGroup.findUnique({
        where: { id: customerGroupId },
      })
      if (!group) {
        throw new NotFoundException('Группа клиентов не найдена')
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: { customerGroupId },
      include: {
        customerGroup: true,
      },
    })
  }

  @CacheEvict({
    key: (id: string) => `${CacheKeys.USER}${id}`,
  })
  async softDelete(id: string): Promise<void> {
    const user = await this.findById(id)
    if (!user) {
      throw new NotFoundException('Пользователь не найден')
    }

    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  }

  async getManagers(): Promise<User[]> {
    return this.prisma.user.findMany({
      where: {
        role: { in: [UserRole.MANAGER, UserRole.ADMIN] },
        deletedAt: null,
      },
      orderBy: { firstName: 'asc' },
    })
  }

  async getUserStats(userId: string) {
    const [ordersCount, totalSpent, favoriteCount] = await Promise.all([
      this.prisma.order.count({
        where: { userId },
      }),
      this.prisma.order.aggregate({
        where: { userId },
        _sum: { totalAmount: true },
      }),
      this.prisma.favorite.count({
        where: { userId },
      }),
    ])

    return {
      ordersCount,
      totalSpent: totalSpent._sum.totalAmount || 0,
      favoriteCount,
    }
  }
}
