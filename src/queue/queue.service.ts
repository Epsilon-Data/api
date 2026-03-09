import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue, Job } from 'bull';
import { ArchetypeDto } from 'src/archetype/dto';
import { DatabaseInfoDto } from 'src/connection-request/dto';
import { JobService } from 'src/job/job.service';
import { PrismaService } from 'src/prisma/prisma.service';

type BullJobData = {
  jobId?: string;
  owner?: string;
  projectId?: string;
  requestId?: string;
  database?: DatabaseInfoDto;
};

@Injectable()
export class QueueService implements OnModuleInit {
  private readonly logger = new Logger(QueueService.name);
  constructor(
    @InjectQueue('atlas-queue') private atlasQueue: Queue,
    @InjectQueue('keycloak-queue') private keycloakQueue: Queue,
    private readonly jobService: JobService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    await this.reconcileJobs(this.atlasQueue);
    await this.retryFailedJobs(this.atlasQueue);
    await this.retryFailedJobs(this.keycloakQueue);
  }

  /**
   * On startup, sync Postgres state (backgroundJob + project.status)
   * with Bull/Redis which is the source of truth for job execution.
   */
  private async reconcileJobs(queue: Queue) {
    // 1. Completed Bull jobs → ensure backgroundJob=COMPLETED, project=READY
    const completed = await queue.getCompleted();
    for (const job of completed) {
      await this.syncJobState(job, 'completed');
    }

    // 2. Failed Bull jobs (exhausted attempts) → ensure backgroundJob=FAILED, project=ERROR
    const failed = await queue.getFailed();
    const exhaustedJobs = failed.filter(
      (job) => job.attemptsMade >= (job.opts.attempts ?? 1),
    );
    for (const job of exhaustedJobs) {
      await this.syncJobState(job, 'failed');
    }

    // 3. Active backgroundJobs with no matching Bull job → mark as FAILED
    const staleJobs = await this.prisma.backgroundJob.findMany({
      where: { status: { in: ['PENDING', 'ACTIVE'] } },
    });
    for (const bgJob of staleJobs) {
      // check if there's a matching Bull job still in queue
      const allJobs = [
        ...(await queue.getWaiting()),
        ...(await queue.getActive()),
        ...(await queue.getDelayed()),
        ...failed.filter((j) => j.attemptsMade < (j.opts.attempts ?? 1)),
      ];
      const hasBullJob = allJobs.some(
        (j) => (j.data as BullJobData)?.jobId === bgJob.jobId,
      );
      if (!hasBullJob) {
        this.logger.warn(
          `Stale backgroundJob ${bgJob.jobId} (${bgJob.type}) has no matching Bull job, marking as FAILED`,
        );
        await this.jobService.markFailed(
          bgJob.jobId,
          'Job lost during API restart',
        );
      }
    }

    // 4. Orphaned CRAWLING projects with no matching Bull job → mark as ERROR
    const crawlingProjects = await this.prisma.project.findMany({
      where: { status: 'CRAWLING' },
      select: { projectId: true },
    });
    const activeBullJobs = [
      ...(await queue.getWaiting()),
      ...(await queue.getActive()),
      ...(await queue.getDelayed()),
      ...failed.filter((j) => j.attemptsMade < (j.opts.attempts ?? 1)),
    ];
    const projectIdsWithBullJob = new Set(
      activeBullJobs
        .filter((j) => j.name === 'process-data-broker')
        .map((j) => (j.data as BullJobData)?.projectId),
    );
    let orphanedCount = 0;
    for (const project of crawlingProjects) {
      if (!projectIdsWithBullJob.has(project.projectId)) {
        await this.prisma.project.update({
          where: { projectId: project.projectId },
          data: { status: 'ERROR' },
        });
        orphanedCount++;
        this.logger.warn(
          `Orphaned CRAWLING project ${project.projectId} has no matching Bull job, set to ERROR`,
        );
      }
    }

    if (
      completed.length ||
      exhaustedJobs.length ||
      staleJobs.length ||
      orphanedCount
    ) {
      this.logger.log(
        `Reconciliation done: ${completed.length} completed, ${exhaustedJobs.length} exhausted, ${staleJobs.length} stale backgroundJobs checked, ${orphanedCount} orphaned CRAWLING projects`,
      );
    }
  }

  private async syncJobState(job: Job, state: 'completed' | 'failed') {
    const { jobId, projectId } = (job.data as BullJobData) ?? {};
    if (!jobId) return;

    try {
      const bgJob = await this.prisma.backgroundJob.findUnique({
        where: { jobId },
      });
      if (!bgJob || bgJob.status === 'COMPLETED' || bgJob.status === 'FAILED')
        return;

      if (state === 'completed') {
        await this.jobService.markCompleted(jobId);
        this.logger.log(`Synced backgroundJob ${jobId} → COMPLETED`);
      } else {
        await this.jobService.markFailed(
          jobId,
          job.failedReason ?? 'Exhausted all retry attempts',
        );
        this.logger.log(`Synced backgroundJob ${jobId} → FAILED`);
      }

      // sync project status for data-broker jobs
      if (projectId && job.name === 'process-data-broker') {
        const project = await this.prisma.project.findUnique({
          where: { projectId },
        });
        if (project && project.status === 'CRAWLING') {
          const newStatus = state === 'completed' ? 'READY' : 'ERROR';
          await this.prisma.project.update({
            where: { projectId },
            data: { status: newStatus },
          });
          this.logger.log(`Synced project ${projectId} status → ${newStatus}`);
        }
      }
    } catch (err) {
      this.logger.warn(`Failed to sync job ${jobId}: ${err}`);
    }
  }

  private async retryFailedJobs(queue: Queue) {
    const failed = await queue.getFailed();
    if (!failed.length) return;

    // only retry jobs that haven't exhausted all attempts
    const retryableJobs = failed.filter(
      (job) => job.attemptsMade < (job.opts.attempts ?? 1),
    );
    if (!retryableJobs.length) return;

    this.logger.log(
      `Retrying ${retryableJobs.length} failed job(s) in '${queue.name}'...`,
    );
    for (const job of retryableJobs) {
      try {
        // assign a new jobId if missing (old jobs before job tracking)
        const data = job.data as BullJobData;
        if (!data.jobId) {
          data.jobId = await this.jobService.createJob(job.name);
          await job.update(data);
        }
        await job.retry();
        this.logger.log(`Retried job ${job.id} (${job.name})`);
      } catch (err) {
        this.logger.warn(`Could not retry job ${job.id}: ${err}`);
      }
    }
  }

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

  async retryCrawlJob(projectId: string, owner: string) {
    // check for already active job for this project
    const activeJobs = [
      ...(await this.atlasQueue.getWaiting()),
      ...(await this.atlasQueue.getActive()),
      ...(await this.atlasQueue.getDelayed()),
    ];
    const hasActiveJob = activeJobs.some(
      (j) =>
        j.name === 'process-data-broker' &&
        (j.data as BullJobData)?.projectId === projectId,
    );
    if (hasActiveJob) {
      throw new Error(
        `A data-broker job is already active for project ${projectId}`,
      );
    }

    // find the last completed or failed data-broker job for this project
    const finishedJobs = [
      ...(await this.atlasQueue.getCompleted()),
      ...(await this.atlasQueue.getFailed()),
    ];

    const previousJob = finishedJobs.find(
      (j) =>
        j.name === 'process-data-broker' &&
        (j.data as BullJobData)?.projectId === projectId,
    );

    if (!previousJob) {
      throw new Error(
        `No previous data-broker job found for project ${projectId}`,
      );
    }

    const { database, requestId } = previousJob.data as BullJobData;
    this.logger.log(
      `Retrying 'process-data-broker' for projectId ${projectId} using existing job data`,
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
        jobId: `process-data-broker:retry:${jobId}`,
        attempts: 5,
        backoff: 10000,
      },
    );
    return { jobId };
  }

  async getJob(jobId: number | string) {
    return await this.atlasQueue.getJob(jobId);
  }
}
