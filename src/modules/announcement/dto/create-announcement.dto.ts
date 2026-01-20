import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateAnnouncementDto {
  @IsString()
  @IsNotEmpty()
  publisherName: string;

  @IsString()
  @IsNotEmpty()
  publisherIcon: string;

  @IsString()
  @IsOptional()
  publisherIconUrl?: string;

  @IsString()
  @IsNotEmpty()
  text: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  imageUrls?: string[];

  @IsBoolean()
  @IsOptional()
  verified?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  targetDepartmentIds: string[] | 'all';
}
