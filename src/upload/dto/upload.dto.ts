import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UploadDto {
  @ApiPropertyOptional({
    description: 'Additional context or instructions for the analysis',
    maxLength: 2000,
    example: 'Focus on identifying primary categories and their relationships',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  context?: string;

  @ApiProperty({
    description: 'File type being uploaded (pdf or csv)',
    enum: ['pdf', 'csv'],
    example: 'pdf',
  })
  @IsString()
  filetype: string;

  @ApiPropertyOptional({
    description: 'LLM model ID to use for analysis',
    example: 'openai:gpt-4',
  })
  @IsOptional()
  @IsString()
  modelId?: string;
}

export class UploadResponseDto {
  @ApiProperty({
    description: 'Unique job ID for tracking analysis progress',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  jobId: string;
}
