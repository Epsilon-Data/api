import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsArray, ValidateIf } from 'class-validator';

export class GenericErrorResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 400,
  })
  @IsNumber()
  statusCode!: number;

  @ApiProperty({
    description:
      'Error message. In some cases this can be an array of messages (e.g. validation errors).',
    example: 'Invalid request data for database operation',
  })
  // When message is a string
  @ValidateIf((o: GenericErrorResponseDto) => typeof o.message === 'string')
  @IsString()
  // When message is an array of strings
  @ValidateIf((o: GenericErrorResponseDto) => Array.isArray(o.message))
  @IsArray()
  @IsString({ each: true })
  message!: string | string[];

  @ApiProperty({
    description:
      'High-level error type or source identifier (e.g. MetadataServiceError, DatabaseError, BadRequestException)',
    example: 'DatabaseError',
  })
  @IsString()
  error!: string;
}
