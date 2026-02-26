import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JobService } from './job.service';
import { JobStatusResponseDto } from './dto';
import { $Enums } from 'src/generated/prisma/client';

@ApiTags('Jobs')
@Controller('jobs')
export class JobController {
  constructor(private readonly jobService: JobService) {}

  @ApiOperation({ summary: 'Get background job status' })
  @ApiOkResponse({ type: JobStatusResponseDto })
  @Get(':jobId/status')
  async getJobStatus(
    @Param('jobId', ParseUUIDPipe) jobId: string,
  ): Promise<JobStatusResponseDto> {
    const job = await this.jobService.getJobStatus(jobId);

    const statusMap: Record<$Enums.JobStatus, JobStatusResponseDto['status']> =
      {
        PENDING: 'pending',
        ACTIVE: 'pending',
        COMPLETED: 'completed',
        FAILED: 'error',
      };

    return {
      jobId: job.jobId,
      status: statusMap[job.status],
      ...(job.result != null && { result: job.result }),
      ...(job.error != null && { error: job.error }),
    };
  }
}
