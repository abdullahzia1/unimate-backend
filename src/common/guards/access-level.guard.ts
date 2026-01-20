import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessLevel } from '../../database/entities/user.entity';
import {
  JwtPayload,
  RequestWithUser,
} from '../../modules/auth/interfaces/auth.interface';
import { ACCESS_LEVEL_KEY } from '../decorators/access-level.decorator';

@Injectable()
export class AccessLevelGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredLevels = this.reflector.getAllAndOverride<AccessLevel[]>(
      ACCESS_LEVEL_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredLevels || requiredLevels.length === 0) {
      return true; // No access level requirement
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user: JwtPayload = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    if (!user.accessLevel) {
      throw new ForbiddenException('User does not have an access level');
    }

    // Check if user's access level is in the required levels
    if (!requiredLevels.includes(user.accessLevel)) {
      throw new ForbiddenException(
        `Access denied. Required access level: ${requiredLevels.join(' or ')}`,
      );
    }

    return true;
  }
}
