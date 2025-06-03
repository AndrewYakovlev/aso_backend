import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

export interface Response<T> {
  success: boolean
  data: T
  timestamp: string
  path: string
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    const request = context.switchToHttp().getRequest()

    return next.handle().pipe(
      map((data) => {
        // Проверяем, не обернут ли уже ответ
        if (this.isAlreadyWrapped(data)) {
          return data
        }

        return {
          success: true,
          data,
          timestamp: new Date().toISOString(),
          path: request.url,
        }
      }),
    )
  }

  private isAlreadyWrapped(data: any): boolean {
    return (
      data &&
      typeof data === 'object' &&
      'success' in data &&
      'data' in data &&
      'timestamp' in data &&
      'path' in data
    )
  }
}
