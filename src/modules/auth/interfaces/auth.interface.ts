import { Request } from 'express';
import { AccessLevel } from '../../../database/entities/user.entity';

export interface JwtPayload {
  sub: string; // user id
  email: string;
  accessLevel?: AccessLevel | null;
  departmentId?: string | null;
  departmentIds?: string[];
  iat?: number;
  exp?: number;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    avatar?: string;
    accessLevel?: AccessLevel | null;
    departmentId?: string | null;
    departmentIds?: string[];
  };
}

export interface RequestWithUser extends Request {
  user: JwtPayload;
  params: Record<string, string>;
  query: Record<string, string>;
  body: Record<string, unknown> | undefined;
}

export interface UserAccess {
  accessLevel: AccessLevel | null;
  departmentId?: string | null;
  departmentIds?: string[];
}
