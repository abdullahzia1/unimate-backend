import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsArray,
} from 'class-validator';
import {
  AccessLevel,
  UserStatus,
} from '../../../database/entities/user.entity';

export class UpdateAccountDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEnum(AccessLevel)
  @IsOptional()
  accessLevel?: AccessLevel;

  @IsString()
  @IsOptional()
  departmentId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  departmentIds?: string[];

  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;
}
