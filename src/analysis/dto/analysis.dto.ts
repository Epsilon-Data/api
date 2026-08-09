import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDate,
  IsDefined,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { transformDateString } from 'src/utils/class.util';

export class LoginDto {
  @ApiPropertyOptional({
    description: 'Username used to log in (can also be an email)',
    example: 'owner.user@example.com',
  })
  @IsString()
  @IsOptional()
  username!: string;

  @ApiPropertyOptional({
    description: 'Plain-text password for the user',
    example: '*********',
  })
  @IsString()
  @IsOptional()
  password!: string;

  @ApiPropertyOptional({
    description: 'JWT refresh token',
    example:
      'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2tleWNsb2FrLmV4YW1wbGUuY29tL3JlYWxtcy9teS1yZWFsbSIsImF6cCI6ImJhY2tlbmQtY29vcmRpbmF0b3IiLCJzY29wZSI6ImJhY2tlbmQ6c3luYyJ9.signature',
  })
  @IsString()
  @IsOptional()
  refreshToken!: string;
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

  @ApiPropertyOptional({
    description:
      'Public URL to the synthetic dataset for this project, if the data owner attached one. ' +
      'The SDK downloads this into generated/data.csv for local testing instead of generating dummy data.',
    example:
      'https://object-store.example/seaco/individuals_codebook_p10000.csv',
  })
  @IsOptional()
  @IsString()
  syntheticDataUrl?: string;
}

export class SyntheticDataPreviewDto {
  @ApiProperty({
    description: 'Whether a synthetic dataset is attached to the project.',
    example: true,
  })
  attached!: boolean;

  @ApiProperty({
    description: 'CSV header row (column names).',
    example: ['household_id', 'sex', 'age', 'ethnicity'],
    type: [String],
  })
  columns!: string[];

  @ApiProperty({
    description: 'Capped sample of data rows; each row aligns with `columns`.',
    example: [
      ['H0001', 'Female', '54', 'Malay'],
      ['H0002', 'Male', '36', 'Chinese'],
    ],
    type: 'array',
    items: { type: 'array', items: { type: 'string' } },
  })
  rows!: string[][];

  @ApiProperty({
    description: 'Number of data rows returned in this preview.',
    example: 20,
  })
  rowCount!: number;
}
