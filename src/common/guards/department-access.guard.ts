import {
  BadRequestException,
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
import { DEPARTMENT_ACCESS_KEY } from '../decorators/department-access.decorator';
import { getDepartmentIds } from '../utils/access-control.util';

@Injectable()
export class DepartmentAccessGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const paramName = this.reflector.getAllAndOverride<string>(
      DEPARTMENT_ACCESS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!paramName) {
      return true; // No department access requirement
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user: JwtPayload = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Super users have access to all departments
    if (user.accessLevel === AccessLevel.SUPER) {
      return true;
    }

    // Get department ID from request (query, params, or body)
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    const body = request.body as Record<string, string> | undefined;
    const departmentId =
      params[paramName] || query[paramName] || body?.[paramName];

    if (!departmentId) {
      throw new BadRequestException(
        `Department ID is required (parameter: ${paramName})`,
      );
    }

    // Get user's accessible department IDs
    const userDepartmentIds = getDepartmentIds({
      accessLevel: user.accessLevel,
      departmentId: user.departmentId,
      departmentIds: user.departmentIds,
    });

    // Check if user has access to the requested department
    if (!userDepartmentIds.includes(departmentId)) {
      throw new ForbiddenException(
        `Access denied. You do not have access to department: ${departmentId}`,
      );
    }

    return true;
  }
}
