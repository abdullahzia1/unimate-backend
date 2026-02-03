import {
  IsArray,
  IsString,
  IsOptional,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TimetableEntryDto {
  @IsString()
  @IsNotEmpty()
  day: string;

  @IsString()
  @IsNotEmpty()
  time: string;

  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  teacher: string;

  @IsString()
  @IsNotEmpty()
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

export class UpdateTimetableEntriesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimetableEntryDto)
  entries: TimetableEntryDto[];
}
