import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class JobService {
  private readonly logger = new Logger(JobService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createJob(type: string): Promise<string> {
    const job = await this.prisma.backgroundJob.create({
      data: { type },
    });
    this.logger.log(`Created background job ${job.jobId} (type=${type})`);
    return job.jobId;
  }

  async markActive(jobId: string) {
    await this.prisma.backgroundJob.update({
      where: { jobId },
      data: { status: 'ACTIVE' },
    });
  }

  async markCompleted(jobId: string, result?: unknown) {
    await this.prisma.backgroundJob.update({
      where: { jobId },
      data: {
        status: 'COMPLETED',
        result: result != null ? (result as object) : undefined,
      },
    });
  }

  async markFailed(jobId: string, error: string) {
    await this.prisma.backgroundJob.update({
      where: { jobId },
      data: { status: 'FAILED', error },
    });
  }

  async getJobStatus(jobId: string) {
    const job = await this.prisma.backgroundJob.findUnique({
      where: { jobId },
    });
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }
    return job;
  }
}
