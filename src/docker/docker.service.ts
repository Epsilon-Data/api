import { Injectable, Logger } from '@nestjs/common';
import { DatabaseInfoDto } from 'src/connection_request/dto';
import * as Docker from 'dockerode';
import { join } from 'path';
import * as tar from 'tar-stream';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DockerService {
  private docker: Docker;
  private baseUrl: string;
  private password: string;

  private readonly logger = new Logger(DockerService.name);

  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    this.baseUrl = config.get<string>('atlas.uri');
    this.password = config.get<string>('atlas.adminPassword');
    this.docker = new Docker();
  }

  async runDataBroker(
    ownerId: string,
    projectId: string,
    requestId: string,
    database: DatabaseInfoDto,
  ): Promise<string> {
    const dockerLocal = 'host.docker.internal';
    const atlasUrl = this.baseUrl.replace('localhost', dockerLocal);

    const envArgs = [
      `ATLAS_URI=${atlasUrl}`,
      `ATLAS_ADMIN_PASSWORD=${this.password}`,
      `OWNER=${ownerId}`,
    ];

    const url =
      database.url.replace('localhost', 'host.docker.internal') +
      '?sslmode=disable';

    envArgs.push(`DATABASE_URL=${url}`);
    envArgs.push(`SOURCE_ID=${projectId}`);

    try {
      const goPackagesPath = join(process.cwd(), '..', 'go-packages');
      const imageName = 'go-packages-data_broker';

      const imageExists = await this.isImageBuilt(imageName);
      if (!imageExists) {
        this.logger.log('Building the Docker container...');
        await this.buildImage(goPackagesPath, imageName);
      }

      this.logger.log('Starting the Docker container...');
      const container = await this.createAndStartContainer(
        imageName,
        envArgs,
        projectId,
      );

      const containerOutput = await this.captureContainerOutput(container);

      this.logger.log('Waiting for the container to finish...');
      await this.monitorContainer(container);

      this.logger.log('Removing the container...');
      await container.remove();
      this.logger.log('Container removed successfully.');

      const guidRegex =
        /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\s*$/i;

      const guidMatch = containerOutput.match(guidRegex);
      if (guidMatch && guidMatch[0]) {
        await this.prisma.connection.update({
          where: { requestId: requestId },
          data: {
            atlasId: guidMatch[0].trim(),
          },
        });

        await this.prisma.project.update({
          where: { projectId: projectId },
          data: {
            status: 'ACTIVE',
          },
        });

        return guidMatch[0].trim();
      } else {
        await this.prisma.project.update({
          where: { projectId: projectId },
          data: {
            status: 'ERROR',
          },
        });
        throw new Error(
          `Failed to extract GUID from container output: ${containerOutput}`,
        );
      }
    } catch (error) {
      await this.prisma.project.update({
        where: { projectId: projectId },
        data: {
          status: 'ERROR',
        },
      });
      this.logger.error('Error running Data Broker container', error);
    }
  }

  private async isImageBuilt(imageName: string): Promise<boolean> {
    try {
      const images = await this.docker.listImages();

      const imageExists = images.some(
        (image) =>
          image.RepoTags && image.RepoTags.includes(`${imageName}:latest`),
      );

      return imageExists;
    } catch (error) {
      this.logger.error(
        `Error checking if image ${imageName} is built:`,
        error,
      );
      throw error;
    }
  }

  private buildImage(buildContext: string, imageName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tarStream = tar.pack(buildContext);
      this.docker.buildImage(
        tarStream,
        { t: imageName, dockerfile: 'Dockerfile' },
        (error, stream) => {
          if (error) {
            return reject(error);
          }
          this.docker.modem.followProgress(stream, (err) => {
            if (err) return reject(err);
            resolve();
          });
        },
      );
    });
  }

  private async createAndStartContainer(
    imageName: string,
    envVariables: string[],
    name?: string,
  ) {
    const existingContainers = await this.docker.listContainers({
      all: true,
      filters: {
        name: [name],
      },
    });

    if (existingContainers.length > 0) {
      const containerToRemove = this.docker.getContainer(
        existingContainers[0].Id,
      );
      await containerToRemove.stop();
      await containerToRemove.remove();
    }

    const container = await this.docker.createContainer({
      Image: imageName,
      name: name,
      Env: envVariables,
      HostConfig: {
        NetworkMode: 'epsilon_pg_internal',
      },
      AutoRemove: true,
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

  private captureContainerOutput(container: Docker.Container): Promise<string> {
    return new Promise((resolve, reject) => {
      container.logs(
        { follow: true, stdout: true, stderr: true },
        (err, stream) => {
          if (err) {
            return reject(err);
          }

          let output = '';
          stream.on('data', (chunk) => {
            output += chunk.toString();
          });

          stream.on('end', () => {
            resolve(output);
          });

          stream.on('error', (err) => {
            reject(err);
          });
        },
      );
    });
  }
}
