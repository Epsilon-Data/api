import {
  IsDefined,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
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
