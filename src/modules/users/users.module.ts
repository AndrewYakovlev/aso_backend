// src/modules/users/users.module.ts
import { Module } from '@nestjs/common'
import { UsersController } from './users.controller'
import { UsersService } from './users.service'
import { AnonymousUsersService } from './anonymous-users.service'

@Module({
  controllers: [UsersController],
  providers: [UsersService, AnonymousUsersService],
  exports: [UsersService, AnonymousUsersService],
})
export class UsersModule {}
