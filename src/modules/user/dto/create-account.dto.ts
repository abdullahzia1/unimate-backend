import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
  ValidateIf,
} from 'class-validator';
import { AccessLevel } from '../../../database/entities/user.entity';

export class CreateAccountDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEnum(AccessLevel)
  @IsNotEmpty()
  accessLevel: AccessLevel;

  @IsString()
  @IsOptional()
  @ValidateIf(
    (o: CreateAccountDto) =>
      o.accessLevel === AccessLevel.HEAD ||
      o.accessLevel === AccessLevel.CUSTODIAN,
  )
  departmentId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @ValidateIf((o: CreateAccountDto) => o.accessLevel === AccessLevel.MULTI)
  departmentIds?: string[];

  @IsString()
  @IsOptional()
  password?: string; // Optional, will be generated if not provided
}
