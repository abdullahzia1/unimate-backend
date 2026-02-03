import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class SkippedClassDto {
  @IsString()
  classCode: string;

  @IsString()
  subject: string;

  @IsString()
  teacher: string;

  @IsString()
  day: string;

  @IsString()
  time: string;

  @IsString()
  room: string;

  @IsOptional()
  @IsString()
  course?: string;

  @IsOptional()
  @IsString()
  semester?: string;

  @IsOptional()
  @IsString()
  section?: string;
}

export class MergeSkippedClassesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SkippedClassDto)
  skippedClasses: SkippedClassDto[];
}
