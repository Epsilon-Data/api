import { Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { ArchetypeDto } from 'src/archetype/dto';
import { DatabaseInfoDto } from 'src/connection-request/dto';

export class ArchetypeJobDataDto {
  @IsUUID()
  @IsDefined()
  jobId!: string;

  @IsString()
  @IsDefined()
  owner!: string;

  @IsString()
  @IsDefined()
  projectId!: string;

  @ValidateNested()
  @Type(() => ArchetypeDto)
  archetype!: ArchetypeDto;
}

export class AddResourceJobDataDto {
  @IsUUID()
  @IsDefined()
  jobId!: string;

  @IsUUID()
  @IsDefined()
  id!: string;

  @IsUUID()
  @IsDefined()
  ownerId!: string;

  @IsArray()
  @IsOptional()
  collaborators?: string[];

  @IsString()
  @IsOptional()
  custodian?: string;
}

export class DeleteProjectAtlasJobDataDto {
  @IsUUID()
  @IsDefined()
  jobId!: string;

  @IsString()
  @IsDefined()
  projectId!: string;
}

export class DataBrokerJobDataDto {
  @IsUUID()
  @IsDefined()
  jobId!: string;

  @IsString()
  @IsDefined()
  owner!: string;

  @IsString()
  @IsDefined()
  @IsString()
  projectId!: string;

  @IsString()
  @IsDefined()
  @IsString()
  requestId!: string;

  @ValidateNested()
  @IsOptional()
  @Type(() => DatabaseInfoDto)
  database?: DatabaseInfoDto;

  @IsOptional()
  loadOnly?: boolean;

  @IsString()
  @IsOptional()
  metadataPath?: string;
}
