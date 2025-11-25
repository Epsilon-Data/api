import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDefined,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class PermissionDto {
  @IsDefined()
  @IsString()
  id!: string;

  @IsDefined()
  @IsString({ each: true })
  scopes!: string[];
}

export class KeycloakPermissionDto {
  @IsDefined()
  @IsString()
  rsid!: string;

  @IsDefined()
  @IsString()
  rsname!: string;

  @IsDefined()
  @IsString({ each: true })
  scopes!: string[];
}

export class KeycloakAuthzRequestDto {
  @IsString()
  response_mode: string = 'permissions'; // can be 'decision'

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionDto)
  permissions?: PermissionDto[];

  @IsOptional()
  @IsString()
  audience?: string;
}

export class KeycloakPermissionDecisionDto {
  @IsDefined()
  @IsBoolean()
  result: boolean;
}
