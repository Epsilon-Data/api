import { Injectable, Logger } from '@nestjs/common';
import { DatabaseInfoDto } from 'src/connection_request/dto';
import * as Docker from 'dockerode';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DockerService {
  private docker: Docker;
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
    this.atlasUrl = config.get<string>('atlas.uri');
    this.password = config.get<string>('atlas.adminPassword');
    this.username = config.get<string>('atlas.adminUsername');

    this.docker = new Docker();
    this.imageName = config.get<string>('brokerImage');

    this.isDev = config.get<boolean>('isDev');
  }

  async runDataBroker(
    ownerId: string,
    projectId: string,
    database?: DatabaseInfoDto,
    requestId?: string,
  ): Promise<string> {
    this.logger.log(`Preparing to run container for request: ${requestId}.`);
    const envArgs = [
      `ATLAS_URI=${this.isDev ? this.atlasUrl.replace('localhost', 'host.docker.internal') : this.atlasUrl}`,
      `ATLAS_ADMIN_USER=${this.username}`,
      `ATLAS_ADMIN_PASSWORD=${this.password}`,
      `OWNER=${ownerId}`,
      `DATABASE_URL=${this.isDev ? database.url.replace('localhost', 'host.docker.internal') + '?sslmode=disable' : database}`,
      `PROJECT_ID=${projectId}`,
    ];

    const instanceName = `data-broker-${projectId}`;
    try {
      // 1. Check if image exists and throw error if it does not
      this.logger.debug(`Checking for base image ${this.imageName}...`);
      this.imageExistsLocally(this.imageName);

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
        // set project status to active (e.g. ready for mapping)
        await this.prisma.project.update({
          where: { projectId },
          data: { status: 'ACTIVE' },
        });
      } catch (err) {
        throw err; // rethrow errors because async
      } finally {
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
    } finally {
      // pretty pointless return here
      // maybe should return information if success of failure
      return projectId;
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
  ) {
    const container = await this.docker.createContainer({
      Image: imageName,
      name,
      Env: envVariables,
      // run runDataBroker function should remove the container
      HostConfig: {
        AutoRemove: false,
      },
      // only for dev
      NetworkingConfig: this.isDev
        ? {
            EndpointsConfig: {
              epsilon_pg_test: {},
            },
          }
        : {},
    });

    await container.start();
    return container;
  }

  private monitorContainer(container: Docker.Container): Promise<void> {
    return new Promise((resolve, reject) => {
      container.wait((err, data) => {
        if (err) return reject(err);
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
}
