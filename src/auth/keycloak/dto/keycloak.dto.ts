import { Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class KeycloakPermissionDto {
  @IsDefined()
  @IsString()
  id!: string;

  @IsDefined()
  @IsString({ each: true })
  scopes!: string[];
}

export class KeycloakAuthzRequestDto {
  @IsString()
  response_mode: string = 'decision'; // can be 'permissions'

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KeycloakPermissionDto)
  permissions?: KeycloakPermissionDto[];

  @IsOptional()
  @IsString()
  audience?: string;
}
