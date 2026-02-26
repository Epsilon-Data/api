import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class JobStatusResponseDto {
  @ApiProperty({ description: 'Job UUID' })
  jobId!: string;

  @ApiProperty({
    description: 'Job status',
    enum: ['pending', 'completed', 'error'],
  })
  status!: 'pending' | 'completed' | 'error';

  @ApiPropertyOptional({ description: 'Job result payload' })
  result?: unknown;

  @ApiPropertyOptional({ description: 'Error message if job failed' })
  error?: string;
}
