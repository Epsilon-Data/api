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

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  accessPurpose: string;

  @IsOptional()
  @IsUUID()
  requestorId: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  requestorName: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  requestorEmail: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  requestorOrgName: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
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
  projectBackground: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  projectObjective: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  projectHypotheses: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  projectOutcome: string;

  @IsDefined()
  @IsString({ each: true })
  projectMembers: string[];

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  ethicsId: string;
}

function transformDateString(value: any): Date {
  if (typeof value === 'string') {
    const parsedDate = new Date(value);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  }
  return value;
}
