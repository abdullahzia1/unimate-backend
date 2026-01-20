import { SetMetadata } from '@nestjs/common';
import { AccessLevel } from '../../database/entities/user.entity';

export const ACCESS_LEVEL_KEY = 'accessLevel';

/**
 * Decorator to require specific access levels
 * @param levels - Array of access levels that can access this endpoint
 * @example @RequireAccessLevel([AccessLevel.SUPER, AccessLevel.SUPREME])
 */
export const RequireAccessLevel = (...levels: AccessLevel[]) =>
  SetMetadata(ACCESS_LEVEL_KEY, levels);
