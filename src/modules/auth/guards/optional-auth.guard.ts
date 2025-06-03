// src/modules/auth/guards/optional-auth.guard.ts
import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

/**
 * Guard который пытается аутентифицировать пользователя через JWT токен,
 * если не получается - пытается через анонимный токен,
 * если и это не получается - выбрасывает ошибку
 */
@Injectable()
export class OptionalAuthGuard extends AuthGuard(['jwt', 'anonymous']) {
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    // Если получили пользователя любым способом - возвращаем его
    if (user) {
      return user
    }

    // Проверяем, был ли предоставлен хотя бы один из токенов
    const request = context.switchToHttp().getRequest()
    const authHeader = request.headers.authorization
    const anonymousHeader = request.headers['x-anonymous-token']

    if (!authHeader && !anonymousHeader) {
      throw new UnauthorizedException('Требуется авторизация или анонимный токен')
    }

    // Если токен был предоставлен, но он невалидный
    throw new UnauthorizedException('Неверный токен')
  }
}
