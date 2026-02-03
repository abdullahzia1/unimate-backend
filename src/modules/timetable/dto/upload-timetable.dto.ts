import { IsString, IsOptional, IsArray, IsNumber } from 'class-validator';

export class UploadTimetableDto {
  @IsString()
  departmentId: string;

  @IsOptional()
  @IsString()
  filename?: string;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  dividers?: number[];
}
