import { Transform, Type } from 'class-transformer';
import {
  IsDefined,
  IsNotEmpty,
  IsString,
  IsUUID,
  IsDate,
  IsOptional,
  IsNumber,
  IsNotEmptyObject,
  IsObject,
  ValidateNested,
  IsUrl,
} from 'class-validator';

class ConnectionDto {
  @IsOptional()
  @IsUUID()
  requestId?: string;

  @IsOptional()
  @IsString()
  orgAdminEmail?: string;

  @IsOptional()
  @IsString()
  tempDbDetails?: string;

  @IsOptional()
  @IsString()
  additionalInfo?: string;
}

export class ProjectDto {
  @IsOptional()
  @IsUUID()
  projectId: string;

  @IsDefined()
  @IsUUID()
  @IsNotEmpty()
  ownerId: string;

  @IsOptional()
  @IsString()
  customId?: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  lead: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  university: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  faculty: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  ethicsId: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDefined()
  @IsDate()
  @Transform(({ value }) => transformDateString(value))
  startDate: Date;

  @IsDefined()
  @IsDate()
  @Transform(({ value }) => transformDateString(value))
  endDate: Date;

  @IsDefined()
  @IsString({ each: true })
  members: string[];

  @IsDefined()
  @IsDate()
  @Transform(({ value }) => transformDateString(value))
  dbCollectionStartDate: Date;

  @IsDefined()
  @IsDate()
  @Transform(({ value }) => transformDateString(value))
  dbCollectionEndDate: Date;

  @IsDefined()
  @IsNumber()
  @IsNotEmpty()
  @Transform(({ value }) => parseInt(value))
  dbParticipantsNum: number;

  @IsOptional()
  @IsString()
  dbDescription?: string;

  @IsOptional()
  @IsString({ each: true })
  dbKeywords?: string[];

  @IsDefined()
  @IsNotEmptyObject()
  @IsObject()
  @ValidateNested()
  @Type(() => ConnectionDto)
  connection: ConnectionDto;
}

export class SettingsDto {
  @IsDefined()
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @IsOptional()
  cover?: Buffer;

  @IsOptional()
  @IsObject()
  @ValidateNested({ each: true })
  @Type(() => VisualDto)
  visualizations?: VisualDto[];
}

class VisualDto {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsDefined()
  @IsUrl()
  @IsNotEmpty()
  link: string;
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
