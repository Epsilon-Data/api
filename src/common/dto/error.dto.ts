import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsArray, ValidateIf } from 'class-validator';

export class ErrorResponseDto {
  @ApiProperty({ example: 404 })
  @IsNumber()
  statusCode!: number;

  @ApiProperty({
    example: 'Resource not found',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  })
  // When message is a string
  @ValidateIf((o: ErrorResponseDto) => typeof o.message === 'string')
  @IsString()
  // When message is an array of strings
  @ValidateIf((o: ErrorResponseDto) => Array.isArray(o.message))
  @IsArray()
  @IsString({ each: true })
  message!: string | string[];

  @ApiProperty({ example: 'Not Found' })
  @IsString()
  error!: string;
}
