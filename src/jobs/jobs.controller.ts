import {
  Controller,
  Get,
  Param,
  NotFoundException,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { JobsService } from './jobs.service';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiNotFoundResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JobStatusDto } from './dto/job-status.dto';

@ApiTags('jobs')
@ApiBearerAuth() // is this needed? idk if this api should be protected or not -Vincent
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get(':id/status')
  @ApiOperation({
    summary: 'Get job status',
    description:
      'Check the status of an analysis job by ID. Returns pending (202), completed (200), or error (200).',
  })
  @ApiParam({
    name: 'id',
    description: 'Job ID returned from file upload',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Job completed or errored',
    type: JobStatusDto,
  })
  @ApiResponse({
    status: 202,
    description: 'Job still pending',
    type: JobStatusDto,
  })
  @ApiNotFoundResponse({
    description: 'Job ID not found',
  })
  getStatus(@Param('id') id: string, @Res() res: Response) {
    const st = this.jobs.status(id);
    if (!st) throw new NotFoundException('Job id not found');

    if (st.status === 'pending') {
      return res.status(HttpStatus.ACCEPTED).json(st);
    }

    return res.status(HttpStatus.OK).json(st);
  }
}
