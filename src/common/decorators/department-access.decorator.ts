import { SetMetadata } from '@nestjs/common';

export const DEPARTMENT_ACCESS_KEY = 'departmentAccess';

/**
 * Decorator to require department access validation
 * The guard will check if the user has access to the department specified in the request
 * @param paramName - Name of the parameter/query/body field containing departmentId (default: 'departmentId')
 */
export const RequireDepartmentAccess = (paramName: string = 'departmentId') =>
  SetMetadata(DEPARTMENT_ACCESS_KEY, paramName);
