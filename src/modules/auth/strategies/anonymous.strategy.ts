import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { Strategy } from 'passport-custom'
import { Request } from 'express'
import { AuthService } from '../auth.service'
import { TokenService } from '../services/token.service'

@Injectable()
export class AnonymousStrategy extends PassportStrategy(Strategy, 'anonymous') {
  constructor(
    private authService: AuthService,
    private tokenService: TokenService,
  ) {
    super()
  }

  async validate(req: Request): Promise<any> {
    const token = this.extractTokenFromHeader(req)

    if (!token) {
      throw new UnauthorizedException('Anonymous token not found')
    }

    try {
      const payload = await this.tokenService.verifyAnonymousToken(token)

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
    } catch (error) {
      throw new UnauthorizedException('Invalid anonymous token')
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    return request.headers['x-anonymous-token'] as string
  }
}
