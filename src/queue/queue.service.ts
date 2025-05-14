import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ArchetypeDto } from 'src/archetype/dto';
import { DatabaseInfoDto } from 'src/connection_request/dto';

@Injectable()
export class QueueService {
  constructor(@InjectQueue('atlas-queue') private atlasQueue: Queue) {}

  async addArchetypeJob(template: ArchetypeDto, dbId: string) {
    const parsedMapping = JSON.parse(template.columnMapping);
    const parsedTemplate = JSON.parse(template.template);
    const postData = {
      projectId: template.projectId,
      columnMapping: parsedMapping,
      template: parsedTemplate,
      dbId: dbId,
    };
    return await this.atlasQueue.add('process-add-archetype', postData, {
      attempts: 5,
      backoff: 10000,
    });
  }

  async deleteTemplateJob(template: ArchetypeDto) {
    const postData = {
      templateId: template.templateId,
      projectId: template.projectId,
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

  async dataBrokerJob(
    ownerId: string,
    sourceId: string,
    database: DatabaseInfoDto | { databaseId: string },
  ) {
    const postData = {
      ownerId: ownerId,
      sourceId: sourceId,
      database: database,
    };
    return await this.atlasQueue.add('process-data-broker', postData, {
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
