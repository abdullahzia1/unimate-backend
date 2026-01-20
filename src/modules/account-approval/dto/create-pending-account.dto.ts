import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { AccessLevel } from '../../../database/entities/user.entity';

export class CreatePendingAccountDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEnum(AccessLevel)
  @IsNotEmpty()
  requestedAccessLevel: AccessLevel;

  @IsString()
  @IsOptional()
  requestedDepartmentId?: string;
}
