import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ArchetypeDto } from 'src/archetype/dto';
import { DatabaseInfoDto } from 'src/connection_request/dto';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  constructor(@InjectQueue('atlas-queue') private atlasQueue: Queue) {}

  async dataBrokerJob(
    ownerId: string,
    projectId: string,
    requestId: string,
    database: DatabaseInfoDto,
  ) {
    this.logger.log(
      `Submitting 'process-data-broker' to queue with requestId ${requestId}`,
    );
    return await this.atlasQueue.add(
      'process-data-broker',
      {
        ownerId,
        projectId,
        requestId,
        database,
      },
      {
        jobId: `process-data-broker:${requestId}`,
        attempts: 5,
        backoff: 10000,
      },
    );
  }

  async addArchetypeJob(owner: string, archetype: ArchetypeDto) {
    this.logger.log(
      `Submitting 'process-add-archetype' to queue for projectId ${archetype.projectId}`,
    );
    return await this.atlasQueue.add(
      'process-add-archetype',
      {
        owner,
        projectId: archetype.projectId,
        archetype,
      },
      {
        attempts: 5,
        backoff: 10000,
      },
    );
  }

  async updateArchetypeJob(archetype: ArchetypeDto) {
    this.logger.log(
      `Submitting 'process-update-archetype' to queue for archetypeId ${archetype.archetypeId}`,
    );
    return await this.atlasQueue.add(
      'process-update-archetype',
      {
        projectId: archetype.projectId,
        archetype,
      },
      {
        // TODO: add jobid?
        attempts: 5,
        backoff: 10000,
      },
    );
  }

  async deleteArchetypeJob(projectId: string, archetypeId: string) {
    this.logger.log(
      `Submitting 'process-delete-archetype' to queue with archetypeId ${archetypeId}...`,
    );
    return await this.atlasQueue.add(
      'process-delete-archetype',
      {
        projectId,
        archetypeId,
      },
      {
        attempts: 5,
        backoff: 10000,
      },
    );
  }

  // TODO: remove redundant method
  async addPermissionsJob(permissions: string, projectId: string) {
    return await this.atlasQueue.add(
      'process-add-permissions',
      {
        permissions,
        projectId,
      },
      {
        attempts: 5,
        backoff: 10000,
      },
    );
  }

  async getJobResult(jobId: number | string) {
    const job = await this.atlasQueue.getJob(jobId);
    if (!job) {
      return { message: 'Job not found or still processing' };
    }

    const result = await job.finished();
    return { jobId, result };
  }

  async getJob(jobId: number | string) {
    return await this.atlasQueue.getJob(jobId);
  }
}
