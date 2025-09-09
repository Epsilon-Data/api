import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ArchetypeDto } from 'src/archetype/dto';
import { DatabaseInfoDto } from 'src/connection_request/dto';

@Injectable()
export class QueueService {
  constructor(@InjectQueue('atlas-queue') private atlasQueue: Queue) {}

  async addArchetypeJob(owner: string, dbId: string, archetype: ArchetypeDto) {
    const parsedMapping = JSON.parse(archetype.columnMapping);
    const parsedTemplate = JSON.parse(archetype.archetype);
    const postData = {
      owner: owner,
      dbId: dbId,
      projectId: archetype.projectId,
      columnMapping: parsedMapping,
      template: parsedTemplate,
    };
    return await this.atlasQueue.add('process-add-archetype', postData, {
      attempts: 5,
      backoff: 10000,
    });
  }

  async deleteTemplateJob(archetype: ArchetypeDto) {
    const postData = {
      templateId: archetype.archetypeId,
      projectId: archetype.projectId,
    };
    return await this.atlasQueue.add('process-delete-archetype', postData, {
      attempts: 5,
      backoff: 10000,
    });
  }

  async addPermissionsJob(permissions: string, projectId: string) {
    const postData = {
      permissions: permissions,
      projectId: projectId,
    };
    return await this.atlasQueue.add('process-add-permissions', postData, {
      attempts: 5,
      backoff: 10000,
    });
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
