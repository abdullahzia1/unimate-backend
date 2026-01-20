import { AccessLevel } from '../../database/entities/user.entity';
import { UserAccess } from '../../modules/auth/interfaces/auth.interface';

/**
 * Get department IDs that a user has access to
 * @param access - User access information
 * @returns Array of department IDs
 */
export function getDepartmentIds(access: UserAccess): string[] {
  if (access.departmentIds && access.departmentIds.length > 0) {
    return access.departmentIds;
  }
  if (access.departmentId) {
    return [access.departmentId];
  }
  return [];
}

/**
 * Check if a user can approve accounts with a specific access level
 * @param approverLevel - Access level of the approver
 * @param targetLevel - Access level of the account to be approved
 * @returns true if approver can approve target level
 */
export function canApprove(
  approverLevel: AccessLevel | null,
  targetLevel: AccessLevel,
): boolean {
  if (!approverLevel) {
    return false;
  }

  // Define hierarchy: super > supreme > head > custodian
  const hierarchy: Record<AccessLevel, number> = {
    [AccessLevel.SUPER]: 4,
    [AccessLevel.SUPREME]: 3,
    [AccessLevel.HEAD]: 2,
    [AccessLevel.CUSTODIAN]: 1,
    [AccessLevel.MULTI]: 0, // Multi accounts cannot approve
  };

  const approverRank = hierarchy[approverLevel] || 0;
  const targetRank = hierarchy[targetLevel] || 0;

  return approverRank > targetRank;
}

/**
 * Check if a user can manage accounts with a specific access level
 * @param managerLevel - Access level of the manager
 * @param targetLevel - Access level of the account to be managed
 * @returns true if manager can manage target level
 */
export function canManageAccount(
  managerLevel: AccessLevel | null,
  targetLevel: AccessLevel,
): boolean {
  if (!managerLevel) {
    return false;
  }

  // Super can manage everyone
  if (managerLevel === AccessLevel.SUPER) {
    return true;
  }

  // Supreme can manage everyone except super
  if (managerLevel === AccessLevel.SUPREME) {
    return targetLevel !== AccessLevel.SUPER;
  }

  // Head can manage custodian in their department
  if (managerLevel === AccessLevel.HEAD) {
    return targetLevel === AccessLevel.CUSTODIAN;
  }

  // Custodian cannot manage anyone
  return false;
}

/**
 * Validate department access
 * @param access - User access information
 * @param departmentId - Department ID to check access for
 * @throws ForbiddenException if user doesn't have access
 */
export function validateDepartmentAccess(
  access: UserAccess,
  departmentId: string,
): void {
  // Super users have access to all departments
  if (access.accessLevel === AccessLevel.SUPER) {
    return;
  }

  const userDepartmentIds = getDepartmentIds(access);

  if (!userDepartmentIds.includes(departmentId)) {
    throw new Error(
      `Access denied. You do not have access to department: ${departmentId}`,
    );
  }
}
