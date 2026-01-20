import {
  IsArray,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class SendTimetableNotificationDto {
  @IsString()
  @IsNotEmpty()
  departmentId: string;

  @IsString()
  @IsOptional()
  timetableId?: string;
}

export class SendCustomNotificationDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  body: string;

  @IsString()
  @IsOptional()
  target?: 'global' | 'department';

  @IsString()
  @IsOptional()
  departmentId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  departmentIds?: string[];

  @IsObject()
  @IsOptional()
  data?: Record<string, string>;
}

export class SendAnnouncementNotificationDto {
  @IsString()
  @IsNotEmpty()
  announcementText: string;

  @IsString()
  @IsOptional()
  announcementId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  departmentIds?: string[];

  @IsString()
  @IsOptional()
  target?: 'global' | 'department';
}
