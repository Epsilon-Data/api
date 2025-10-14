import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ArchetypeDto } from 'src/archetype/dto';
import { DatabaseInfoDto } from 'src/connection_request/dto';

@Injectable()
export class QueueService {
  constructor(@InjectQueue('atlas-queue') private atlasQueue: Queue) {}

  async dataBrokerJob(
    ownerId: string,
    projectId: string,
    requestId: string,
    database: DatabaseInfoDto,
  ) {
    return await this.atlasQueue.add(
      'process-data-broker',
      {
        ownerId,
        projectId,
        requestId,
        database,
      },
      {
        jobId: `process-data-broker:${projectId}`,
        attempts: 5,
        backoff: 10000,
      },
    );
  }

  async addArchetypeJob(owner: string, archetype: ArchetypeDto) {
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

  async deleteTemplateJob(projectId: string, archetypeId: string) {
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
