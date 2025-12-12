import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsInt,
  IsOptional,
  IsString,
  Min,
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

export class KeycloakTokenResponseDto {
  @ApiProperty({
    description: 'JWT access token issued by Keycloak',
    example:
      'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2tleWNsb2FrLmV4YW1wbGUuY29tL3JlYWxtcy9teS1yZWFsbSIsImF6cCI6ImJhY2tlbmQtY29vcmRpbmF0b3IiLCJzY29wZSI6ImJhY2tlbmQ6c3luYyJ9.signature',
  })
  @IsDefined()
  @IsString()
  access_token!: string;

  @ApiProperty({
    description: 'Token lifetime in seconds',
    example: 300,
  })
  @IsDefined()
  @IsInt()
  @Min(0)
  expires_in!: number;

  @ApiProperty({
    description: 'Refresh token lifetime in seconds (0 for client_credentials)',
    example: 1800,
  })
  @IsDefined()
  @IsInt()
  @Min(0)
  refresh_expires_in!: number;

  @ApiPropertyOptional({
    description:
      'Refresh token (not always returned, e.g. may be absent for client_credentials)',
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.refresh-token.signature',
  })
  @IsOptional()
  @IsString()
  refresh_token?: string;

  @ApiProperty({
    description: 'OAuth2 token type',
    example: 'Bearer',
  })
  @IsDefined()
  @IsString()
  token_type!: string;

  @ApiProperty({
    description:
      'Keycloak not-before policy timestamp (used for token invalidation)',
    example: 0,
  })
  @IsDefined()
  @IsInt()
  @Min(0)
  'not-before-policy'!: number;

  @ApiPropertyOptional({
    description: 'Granted scopes (space-separated)',
    example: 'openid profile email backend:sync',
  })
  @IsOptional()
  @IsString()
  scope?: string;
}
