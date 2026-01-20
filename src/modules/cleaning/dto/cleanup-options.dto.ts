import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class CleanupOptionsDto {
  @IsBoolean()
  @IsOptional()
  timetables?: boolean;

  @IsBoolean()
  @IsOptional()
  departments?: boolean;

  @IsBoolean()
  @IsOptional()
  adminAccounts?: boolean;

  @IsBoolean()
  @IsOptional()
  pendingAccounts?: boolean;

  @IsBoolean()
  @IsOptional()
  onboardedUsers?: boolean;

  @IsBoolean()
  @IsOptional()
  announcements?: boolean;

  @IsBoolean()
  @IsOptional()
  fcmTokens?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  departmentIds?: string[];
}
