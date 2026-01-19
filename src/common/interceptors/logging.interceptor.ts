import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url } = request;
    const userAgent = request.get('user-agent') ?? '';

    const now = Date.now();

    this.logger.log(`[Request] ${method} ${url} - User-Agent: ${userAgent}`);

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse<Response>();
          const { statusCode } = response;
          const delay = Date.now() - now;

          this.logger.log(
            `[Response] ${method} ${url} ${statusCode} - ${delay}ms`,
          );
        },
        error: (error: Error) => {
          const delay = Date.now() - now;
          this.logger.error(
            `[Error] ${method} ${url} - ${error.message} - ${delay}ms`,
          );
        },
      }),
    );
  }
}
