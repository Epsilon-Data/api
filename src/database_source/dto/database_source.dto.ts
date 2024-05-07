import { Type } from 'class-transformer';
import {
  IsDefined,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class TemplateDto {
  @IsDefined()
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @IsOptional()
  @IsString()
  template: string;

  @IsOptional()
  @IsString()
  columnMapping: string;

  @IsOptional()
  @IsString()
  templateId: string;
}

export class PermissionsDto {
  @IsDefined()
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  permissions: string;
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
  @Type(() => TableauDto)
  tableau?: TableauDto[];
}

class TableauDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  url?: string;
}
