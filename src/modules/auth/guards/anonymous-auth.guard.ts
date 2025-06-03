// src/modules/auth/guards/anonymous-auth.guard.ts
import { Injectable } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

@Injectable()
export class AnonymousAuthGuard extends AuthGuard('anonymous') {}
