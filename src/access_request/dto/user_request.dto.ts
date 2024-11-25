import { Transform } from 'class-transformer';
import {
  IsDefined,
  IsNotEmpty,
  IsString,
  IsUUID,
  IsDate,
  ArrayNotEmpty,
  IsOptional,
  IsNumber,
} from 'class-validator';

export class RequestDto {
  @IsDefined()
  @IsUUID()
  @IsNotEmpty()
  id: string;

  @IsOptional()
  @IsString()
  customId: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  accessPurpose: string;

  @IsOptional()
  @IsUUID()
  requestor: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  requestorName: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  email: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  orgName: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  position: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  projectName: string;

  @IsDefined()
  @IsDate({ each: true })
  @ArrayNotEmpty()
  @Transform(({ value }) => value.map((item) => transformDateString(item)))
  projectDuration: string[];

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

  @IsOptional()
  @IsNumber()
  status: number;

  @IsOptional()
  @IsDate()
  @Transform(({ value }) => transformDateString(value))
  createdDate: Date;

  @IsOptional()
  @IsString()
  revisionInfo: string;
}

export class RevisionDto {
  @IsDefined()
  @IsUUID()
  @IsNotEmpty()
  requestId: string;

  @IsDefined()
  @IsString()
  revisionInfo: string;
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
