import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GraphPayload } from '../../graph/types';

export class JobStatusPendingDto {
  @ApiProperty({
    description: 'Job status',
    enum: ['pending'],
    example: 'pending',
  })
  status: 'pending';
}

export class JobStatusCompletedDto {
  @ApiProperty({
    description: 'Job status',
    enum: ['completed'],
    example: 'completed',
  })
  status: 'completed';

  @ApiProperty({
    description: 'Analysis result with graph data',
    type: GraphPayload,
  })
  result: GraphPayload;
}

export class JobStatusErrorDto {
  @ApiProperty({
    description: 'Job status',
    enum: ['error'],
    example: 'error',
  })
  status: 'error';

  @ApiProperty({
    description: 'Error message',
    example: 'Failed to parse PDF file',
  })
  error: string;
}

export class JobStatusDto {
  @ApiProperty({
    description: 'Current job status',
    enum: ['pending', 'completed', 'error'],
    example: 'completed',
  })
  status: 'pending' | 'completed' | 'error';

  @ApiPropertyOptional({
    description: 'Analysis result (only present when status is completed)',
    type: GraphPayload,
  })
  result?: GraphPayload;

  @ApiPropertyOptional({
    description: 'Error message (only present when status is error)',
    example: 'Failed to parse PDF file',
  })
  error?: string;
}
