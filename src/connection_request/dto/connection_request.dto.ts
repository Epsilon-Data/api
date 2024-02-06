import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsDate,
  IsDefined,
  IsEmail,
  IsNotEmpty,
  IsNotEmptyObject,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

class ProjectInfoDto {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsDefined()
  @IsDate({ each: true })
  @ArrayNotEmpty()
  @Transform(({ value }) => value.map((item) => transformDateString(item)))
  duration: Date[];

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  lead: string;

  @IsDefined()
  @IsString({ each: true })
  members: string[];

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
}

class DataInfoDto {
  @IsDefined()
  @IsDate({ each: true })
  @ArrayNotEmpty()
  @Transform(({ value }) => value.map((item) => transformDateString(item)))
  collectionDuration: Date[];

  @IsDefined()
  @IsNumber()
  @IsNotEmpty()
  @Transform(({ value }) => parseInt(value))
  participantsNumber: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString({ each: true })
  keywords?: string[];
}

export class DatabaseInfoDto {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsOptional()
  @IsString()
  host?: string;

  @IsOptional()
  @IsString()
  port?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;
}

export class ConnectionRequestDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsDefined()
  @IsUUID()
  @IsNotEmpty()
  requestor: string;

  @IsOptional()
  @IsDate()
  @Transform(({ value }) => transformDateString(value))
  date?: Date;

  @IsOptional()
  @IsNumber()
  status?: number;

  @IsDefined()
  @IsNotEmptyObject()
  @IsObject()
  @ValidateNested()
  @Type(() => ProjectInfoDto)
  projectInfo: ProjectInfoDto;

  @IsOptional()
  @IsEmail()
  orgAdminEmail?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => DatabaseInfoDto)
  databaseInfo?: DatabaseInfoDto;

  @IsDefined()
  @IsNotEmptyObject()
  @IsObject()
  @ValidateNested()
  @Type(() => DataInfoDto)
  dataInfo: DataInfoDto;

  @IsOptional()
  @IsString()
  additionalInfo?: string;
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
