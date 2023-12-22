import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsDate,
  IsDefined,
  IsEmail,
  IsNotEmpty,
  IsNotEmptyObject,
  IsNumber,
  IsObject,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';

export class ConnectionRequestDto {
  @IsNumber()
  @IsNotEmpty()
  id?: number;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  requestor: string;

  @IsDate()
  @IsNotEmpty()
  date?: Date;

  @IsNumber()
  @IsNotEmpty()
  status?: number;

  @IsDefined()
  @IsNotEmptyObject()
  @IsObject()
  @ValidateNested()
  @Type(() => ProjectInfoDto)
  projectInfo: ProjectInfoDto;

  @IsEmail()
  orgAdminEmail?: string;

  @IsNotEmptyObject()
  @IsObject()
  @ValidateNested()
  @Type(() => DatabaseInfoDto)
  databaseInfo?: DatabaseInfoDto;

  @IsDefined()
  @IsNotEmptyObject()
  @IsObject()
  @ValidateNested()
  @Type(() => DatabaseInfoDto)
  dataInfo: DataInfoDto;

  @IsString()
  additionalInfo?: string;
}

class ProjectInfoDto {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsDefined()
  @IsDate({ each: true })
  @ArrayNotEmpty()
  duration: Date[];

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  lead: string;
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
  ethicsApprovalId: string;

  @IsString()
  description?: string;
}

class DataInfoDto {
  @IsDefined()
  @IsDate({ each: true })
  @ArrayNotEmpty()
  collectionDuration: Date[];

  @IsDefined()
  @IsNumber()
  @IsNotEmpty()
  participantsNumber: number;

  @IsString()
  description?: string;

  @IsString({ each: true })
  @ArrayNotEmpty()
  keywords?: string[];
}

class DatabaseInfoDto {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsUrl()
  @IsNotEmpty()
  url?: string;

  @IsString()
  @IsNotEmpty()
  username?: string;

  @IsString()
  @IsString()
  password?: string;
}
