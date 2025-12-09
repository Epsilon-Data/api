import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDefined, IsNotEmpty, IsString } from 'class-validator';

export class ClientLoginDto {
  @ApiProperty({
    description: 'Client id',
    example: 'coordinator-client',
  })
  @IsString()
  @IsDefined()
  @IsNotEmpty()
  clientId!: string;

  @ApiProperty({
    description: 'Client secret',
    example: '*********',
  })
  @IsString()
  @IsDefined()
  @IsNotEmpty()
  clientSecret!: string;
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
