import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDate,
  IsDefined,
  IsNotEmpty,
  IsObject,
  IsString,
  IsUUID,
} from 'class-validator';
import { transformDateString } from 'src/utils/class.util';

export class LoginDto {
  @ApiProperty({
    description: 'Username used to log in (can also be an email)',
    example: 'owner.user@example.com',
  })
  @IsString()
  @IsDefined()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({
    description: 'Plain-text password for the user',
    example: '*********',
  })
  @IsString()
  @IsDefined()
  @IsNotEmpty()
  password!: string;
}

export class AuthTokenResponseDto {
  @ApiProperty({
    description: 'The JWT access token issued after successful authentication',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  access_token!: string;

  @ApiPropertyOptional({
    description:
      'Token lifetime in seconds (optional depending on identity provider)',
    example: 3600,
  })
  expires_in?: number;
}

export class DatasetDto {
  @ApiProperty({
    description: 'Unique identifier of the dataset',
    format: 'uuid',
    example: '2c7a2cb4-9fa4-4c1e-8573-0f9ab84b9e92',
  })
  @IsUUID()
  @IsNotEmpty()
  datasetId!: string;

  @ApiProperty({
    description: 'Identifier of the associated package',
    example: 'test_db_creds_dGDZ6c',
  })
  @IsString()
  @IsNotEmpty()
  packageId!: string;

  @ApiProperty({
    description: 'Timestamp when the dataset was last modified',
    type: String,
    format: 'date-time',
    example: '2025-11-21T13:45:30.000Z',
  })
  @IsDate()
  @IsDefined()
  @Transform(({ value }) => transformDateString(value))
  lastModified!: Date;
}

export class AnalysisArchetypeResponseDto {
  @ApiProperty({
    description: 'Id of the Archetype',
    example: '3kHBQLNwl9qc',
  })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  $id!: string;

  @ApiProperty({
    description: 'JSON Schema meta-identifier (draft URI)',
    example: 'https://json-schema.org/draft/2020-12/schema',
  })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  $schema!: string;

  @ApiProperty({
    description: 'Human-readable title for the archetype schema',
    example: 'Heart Rate Monitoring Archetype',
  })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({
    description: 'Top-level JSON Schema type',
    example: 'object',
  })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  type!: string;

  @ApiProperty({
    description:
      'JSON Schema properties map. Keys are field names, values are JSON Schema fragments describing each field.',
    type: 'object',
    additionalProperties: true,
    example: {
      condition: {
        type: 'object',
        properties: {
          diagnosis: {
            type: 'object',
            description: 'Diagnosis',
          },
          critical: {
            type: 'boolean',
            description: 'Critical',
          },
        },
      },
      health: {
        type: 'object',
        properties: {
          blood_pressure: {
            type: 'object',
            description: 'Blood pressure',
          },
          heart_rate: {
            type: 'integer',
            description: 'Heart rate',
          },
        },
      },
    },
  })
  @IsDefined()
  @IsObject()
  properties!: Record<string, object>;
}
