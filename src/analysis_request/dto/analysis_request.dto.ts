import { Transform } from 'class-transformer';
import {
  IsDefined,
  IsNotEmpty,
  IsString,
  IsUUID,
  IsDate,
  IsOptional,
} from 'class-validator';

export class AnalysisDto {
  @IsOptional()
  @IsUUID()
  requestId: string;

  @IsDefined()
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @IsOptional()
  @IsUUID()
  requestorId: string;

  @IsDefined()
  @IsString()
  requestorName: string;

  @IsDefined()
  @IsString()
  requestorEmail: string;

  @IsDefined()
  @IsString()
  requestorOrgName: string;

  @IsDefined()
  @IsString()
  requestorPosition: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  projectName: string;

  @IsDefined()
  @IsDate()
  @Transform(({ value }) => transformDateString(value))
  projectStartDate: Date;

  @IsDefined()
  @IsDate()
  @Transform(({ value }) => transformDateString(value))
  projectEndDate: Date;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  projectDescription: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  projectObjective: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  projectOutcome: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  projectMembers: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  projectEthicsId: string;
}

function transformDateString(value: string | Date): Date {
  if (value instanceof Date) return value;

  const parsedDate = new Date(value);
  return isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
}
