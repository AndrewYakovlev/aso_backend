// src/modules/chat/guards/ws-auth.guard.ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { WsException } from '@nestjs/websockets'
import { Socket } from 'socket.io'
import { AuthService } from '../../auth/auth.service'
import { TokenService } from '../../auth/services/token.service'

@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private tokenService: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient()
    const authToken = this.extractTokenFromSocket(client)
    const anonymousToken = client.handshake.headers['x-anonymous-token'] as string

    try {
      if (authToken) {
        // Проверяем JWT токен
        const payload = await this.tokenService.verifyAccessToken(authToken)
        const user = await this.authService.validateUser(payload.userId)
        if (!user) {
          throw new WsException('User not found')
        }
        client.data.user = {
          userId: user.id,
          phone: user.phone,
          role: user.role,
          isAnonymous: false,
        }
        return true
      } else if (anonymousToken) {
        // Проверяем анонимный токен
        const payload = await this.tokenService.verifyAnonymousToken(anonymousToken)
        const anonymousUser = await this.authService.validateAnonymousSession(payload.sessionId)
        if (!anonymousUser) {
          throw new WsException('Invalid anonymous session')
        }
        client.data.user = {
          sessionId: anonymousUser.sessionId,
          isAnonymous: true,
        }
        return true
      }

      throw new WsException('No authentication token provided')
    } catch (error) {
      throw new WsException('Authentication failed')
    }
  }

  private extractTokenFromSocket(client: Socket): string | undefined {
    const authHeader = client.handshake.headers.authorization
    if (!authHeader) return undefined

    const [type, token] = authHeader.split(' ')
    return type === 'Bearer' ? token : undefined
  }
}
