import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateAnnouncementDto {
  @IsString()
  @IsOptional()
  publisherName?: string;

  @IsString()
  @IsOptional()
  publisherIcon?: string;

  @IsString()
  @IsOptional()
  publisherIconUrl?: string;

  @IsString()
  @IsOptional()
  text?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  imageUrls?: string[];

  @IsBoolean()
  @IsOptional()
  isPinned?: boolean;

  @IsBoolean()
  @IsOptional()
  verified?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  targetDepartmentIds?: string[];
}
