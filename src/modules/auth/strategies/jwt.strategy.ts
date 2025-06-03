// src/modules/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ConfigService } from '@nestjs/config'
import { AuthService } from '../auth.service'
import { JwtPayload } from '../services/token.service'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.access.secret'),
    })
  }

  async validate(payload: JwtPayload) {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type')
    }

    const user = await this.authService.validateUser(payload.userId)
    if (!user) {
      throw new UnauthorizedException('User not found')
    }

    return {
      userId: user.id,
      phone: user.phone,
      role: user.role,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    }
  }
}
