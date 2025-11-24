import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDefined, IsNotEmpty, IsString } from 'class-validator';

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
