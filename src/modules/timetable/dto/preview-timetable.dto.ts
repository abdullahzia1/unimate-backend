import { IsString, IsOptional, IsArray, IsNumber } from 'class-validator';

export class PreviewTimetableDto {
  @IsOptional()
  @IsString()
  filename?: string;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  dividers?: number[];
}
