import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      return (await super.canActivate(context)) as boolean;
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'name' in error &&
        typeof (error as { name?: unknown }).name === 'string' &&
        (error as { name: string }).name === 'TokenExpiredError'
      ) {
        throw new UnauthorizedException({
          message: 'Access token expired',
          code: 'ACCESS_TOKEN_EXPIRED',
        });
      } else if (
        error &&
        typeof error === 'object' &&
        'name' in error &&
        typeof (error as { name?: unknown }).name === 'string' &&
        (error as { name: string }).name === 'JsonWebTokenError'
      ) {
        throw new UnauthorizedException({
          message: 'Invalid access token',
          code: 'INVALID_ACCESS_TOKEN',
        });
      } else if (
        error &&
        typeof error === 'object' &&
        'message' in error &&
        typeof (error as { message?: unknown }).message === 'string' &&
        (error as { message: string }).message.includes('jwt expired')
      ) {
        throw new UnauthorizedException({
          message: 'Invalid access token',
          code: 'INVALID_ACCESS_TOKEN',
        });
      }
      throw error;
    }
  }
}
