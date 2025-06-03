// src/modules/auth/strategies/anonymous.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ConfigService } from '@nestjs/config'
import { AuthService } from '../auth.service'
import { AnonymousJwtPayload } from '../services/token.service'

@Injectable()
export class AnonymousStrategy extends PassportStrategy(Strategy, 'anonymous') {
  constructor(
    configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('jwt.access.secret'),
    })
  }

  async validate(payload: AnonymousJwtPayload) {
    if (payload.type !== 'anonymous' || !payload.isAnonymous) {
      throw new UnauthorizedException('Invalid anonymous token')
    }

    const anonymousUser = await this.authService.validateAnonymousSession(payload.sessionId)
    if (!anonymousUser) {
      throw new UnauthorizedException('Invalid anonymous session')
    }

    return {
      sessionId: anonymousUser.sessionId,
      isAnonymous: true,
      ipAddress: anonymousUser.ipAddress,
      userAgent: anonymousUser.userAgent,
    }
  }
}
