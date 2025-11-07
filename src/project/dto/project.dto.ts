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
import { parseInteger, transformDateString } from 'src/common/utils/class.util';

class DatabaseDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsOptional()
  @IsString()
  url: string;

  @IsOptional()
  @IsString()
  username: string;

  @IsOptional()
  @IsString()
  password: string;
}

class ConnectionDto {
  @IsOptional()
  @IsUUID()
  requestId: string;

  @IsOptional()
  @IsString()
  orgAdminEmail?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => DatabaseDto)
  tempDbDetails?: DatabaseDto;

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

  @IsDefined()
  @IsString()
  description: string;

  @IsDefined()
  @IsDate()
  @Transform(({ value }) => transformDateString(value))
  startDate: Date;

  @IsDefined()
  @IsDate()
  @Transform(({ value }) => transformDateString(value))
  endDate: Date;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  members: string;

  @IsDefined()
  @IsNumber()
  @IsNotEmpty()
  @Transform(({ value }) => parseInteger(value))
  participantsNum: number;

  @IsDefined()
  @IsString({ each: true })
  dbKeywords: string[];

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
