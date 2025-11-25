import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDate,
  IsDefined,
  IsNotEmpty,
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
