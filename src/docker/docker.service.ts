/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable, Logger } from '@nestjs/common';
import { DatabaseInfoDto } from 'src/connection-request/dto';
import Docker, { Container } from 'dockerode';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DockerService {
  private readonly docker: Docker;
  private atlasUrl: string;
  private username: string;
  private password: string;

  private isDev: boolean;

  private imageName: string;
  private readonly logger = new Logger(DockerService.name);

  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    this.atlasUrl = config.get<string>('atlas.uri')!;
    this.password = config.get<string>('atlas.adminPassword')!;
    this.username = config.get<string>('atlas.adminUsername')!;

    this.docker = new Docker();
    this.imageName = config.get<string>('brokerImage')!;

    this.isDev = config.get<boolean>('isDev')!;
  }

  async runDataBroker(
    ownerId: string,
    projectId: string,
    requestId: string,
    database: DatabaseInfoDto,
  ) {
    this.logger.log(
      `Preparing to run crawler container for request ${requestId}...`,
    );
    const envArgs = [
      `ATLAS_URI=${this.isDev ? this.atlasUrl.replace('localhost', 'host.docker.internal') : this.atlasUrl}`,
      `ATLAS_ADMIN_USER=${this.username}`,
      `ATLAS_ADMIN_PASSWORD=${this.password}`,
      `OWNER=${ownerId}`,
      `DATABASE_URL=${this.isDev ? database.url?.replace('localhost', 'host.docker.internal') + '?sslmode=disable' : database.url}`,
      `PROJECT_ID=${projectId}`,
    ];

    const instanceName = `data-broker-${projectId}`;
    try {
      // 1. Check if image exists and throw error if it does not
      this.logger.debug(`Checking for base image ${this.imageName}...`);
      void this.imageExistsLocally(this.imageName);

      //  2. Start container
      this.logger.debug(`Starting the container ${instanceName}...`);

      const container = await this.createAndStartContainer(
        this.imageName,
        envArgs,
        instanceName,
      );

      try {
        //  3. Monitor container
        this.logger.debug(
          `Waiting for the container ${instanceName} to finish...`,
        );
        await this.monitorContainer(container);

        const output = await this.readAllLogs(container);
        const done = /(^|\n)DONE(\r?\n|$)/.test(output);
        const inspect = await container.inspect();
        const exitCode = inspect.State?.ExitCode ?? 1;
        const success = done || exitCode === 0;

        if (!success) {
          throw new Error(
            `Container finished without DONE marker and non-zero exit code with output ${output}`,
          );
        }
        //  4. Crawling done, container run successfully
        this.logger.log(
          `Container ${instanceName} run successfully for request ${requestId}.`,
        );
        // set project status to READY (e.g. ready for mapping)
        await this.prisma.project.update({
          where: { projectId },
          data: { status: 'READY' },
        });
      } finally {
        //  5. Run cleanup for the container instance
        this.logger.debug(`Removing container ${instanceName}...`);
        await container.remove({ force: true });
        this.logger.debug(`Container ${instanceName} removed successfully.`);
      }
    } catch (error) {
      await this.prisma.project.update({
        where: { projectId: projectId },
        data: {
          status: 'ERROR',
        },
      });
      this.logger.error(`Error running container ${instanceName}: `, error);
    }
  }

  private async imageExistsLocally(imageName) {
    try {
      const image = this.docker.getImage(imageName);
      await image.inspect(); // throws if image not found
      return true;
    } catch (err) {
      if (err.statusCode === 404) {
        this.logger.error(
          `Image ${this.imageName} does not exist. Please use 'docker pull ${this.imageName}' to pull it from GHCR.`,
        );
      }
      // some other error (e.g. Docker not reachable)
      this.logger.error(`Error checking if image ${imageName} exists: `, err);
      throw err;
    }
  }

  private async createAndStartContainer(
    imageName: string,
    envVariables: string[],
    name: string,
  ): Promise<Container> {
    const existingContainers = await this.docker.listContainers({
      all: true,
      filters: {
        name: [name],
      },
    });

    // remove container if stopped
    if (existingContainers.length > 0) {
      if (await this.isContainerRunning(existingContainers[0].Id as string)) {
        this.logger.debug(`Running image ${imageName} exists, monitoring...`);
        return await this.docker.getContainer(existingContainers[0].Id);
      } else {
        const existingContainer = this.docker.getContainer(
          existingContainers[0].Id,
        );
        // should ne stopped, but just in case
        await existingContainer.stop();
        await existingContainer.remove();
      }
    }
    const container = await this.docker.createContainer({
      Image: imageName,
      name,
      Env: envVariables,
      // run runDataBroker function should remove the container
      HostConfig: {
        AutoRemove: false,
      },
      // only for dev + testing
      NetworkingConfig: {
        EndpointsConfig: {
          epsilon_pg_test: {},
        },
      },
    });
    await container.start();
    return container;
  }

  private monitorContainer(container: Docker.Container) {
    return new Promise((resolve, reject) => {
      container.wait((err, data) => {
        if (err)
          return reject(err instanceof Error ? err : new Error(String(err)));
        resolve(data);
      });
    });
  }

  private async readAllLogs(container: Docker.Container): Promise<string> {
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      follow: false,
    });
    return Buffer.isBuffer(logs) ? logs.toString('utf8') : String(logs);
  }

  private async isContainerRunning(containerId: string) {
    try {
      const container = this.docker.getContainer(containerId);
      const data = await container.inspect();
      return data.State.Running === true;
    } catch (err) {
      if (err.statusCode === 404) {
        this.logger.error(`Container ${containerId} not found`);
        return false;
      }
      throw err; // rethrow for other errors
    }
  }
}
