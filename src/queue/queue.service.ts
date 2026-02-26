import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { ArchetypeDto } from 'src/archetype/dto';
import { DatabaseInfoDto } from 'src/connection-request/dto';
import { JobService } from 'src/job/job.service';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  constructor(
    @InjectQueue('atlas-queue') private atlasQueue: Queue,
    @InjectQueue('keycloak-queue') private keycloakQueue: Queue,
    private readonly jobService: JobService,
  ) {}

  async addResourceJob(
    id: string,
    ownerId: string,
    collaborators?: string[],
    custodian?: string,
  ) {
    this.logger.log(
      `Submitting 'process-add-resource' to queue with resource id ${id}`,
    );

    const jobId = await this.jobService.createJob('process-add-resource');
    await this.keycloakQueue.add(
      'process-add-resource',
      {
        jobId,
        id,
        ownerId,
        collaborators,
        custodian,
      },
      {
        attempts: 5,
        backoff: 10000,
      },
    );
    return { jobId };
  }

  async dataBrokerJob(
    owner: string,
    projectId: string,
    requestId: string,
    database: DatabaseInfoDto,
  ) {
    this.logger.log(
      `Submitting 'process-data-broker' to queue with requestId ${requestId}`,
    );
    const jobId = await this.jobService.createJob('process-data-broker');
    await this.atlasQueue.add(
      'process-data-broker',
      {
        jobId,
        owner,
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
    return { jobId };
  }

  async addArchetypeJob(
    owner: string,
    projectId: string,
    archetype: ArchetypeDto,
  ) {
    this.logger.log(
      `Submitting 'process-add-archetype' to queue for projectId ${archetype.projectId}`,
    );
    const jobId = await this.jobService.createJob('process-add-archetype');
    await this.atlasQueue.add(
      'process-add-archetype',
      {
        jobId,
        owner,
        projectId: projectId,
        archetype,
      },
      {
        attempts: 5,
        backoff: 10000,
      },
    );
    return { jobId };
  }

  async updateArchetypeJob(
    owner: string,
    projectId: string,
    archetypeId: string,
    archetype: ArchetypeDto,
  ) {
    this.logger.log(
      `Submitting 'process-update-archetype' to queue for archetypeId ${archetypeId}`,
    );
    const jobId = await this.jobService.createJob('process-update-archetype');
    await this.atlasQueue.add(
      'process-update-archetype',
      {
        jobId,
        owner,
        projectId,
        archetype,
      },
      {
        attempts: 5,
        backoff: 10000,
      },
    );
    return { jobId };
  }

  async deleteProjectAtlasJob(projectId: string) {
    this.logger.log(
      `Submitting 'process-delete-project-atlas' to queue with projectId ${projectId}...`,
    );
    const jobId = await this.jobService.createJob(
      'process-delete-project-atlas',
    );
    await this.atlasQueue.add(
      'process-delete-project-atlas',
      {
        jobId,
        projectId,
      },
      {
        attempts: 5,
        backoff: 10000,
      },
    );
    return { jobId };
  }

  async deleteArchetypeJob(projectId: string, archetypeId: string) {
    this.logger.log(
      `Submitting 'process-delete-archetype' to queue with archetypeId ${archetypeId}...`,
    );
    const jobId = await this.jobService.createJob('process-delete-archetype');
    await this.atlasQueue.add(
      'process-delete-archetype',
      {
        jobId,
        projectId,
        archetypeId,
      },
      {
        attempts: 5,
        backoff: 10000,
      },
    );
    return { jobId };
  }

  async getJobResult(jobId: number | string) {
    const job = await this.atlasQueue.getJob(jobId);
    if (!job) {
      return { message: 'Job not found or still processing' };
    }

    const result: unknown = await job.finished();
    return { jobId, result };
  }

  async getJob(jobId: number | string) {
    return await this.atlasQueue.getJob(jobId);
  }
}
