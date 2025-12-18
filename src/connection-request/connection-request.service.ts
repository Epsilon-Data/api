import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ConnectionDecisionDto,
  ConnectionRequestResponseDto,
  DatabaseTestDto,
} from './dto';
import { testConnection } from '@epsilon-data/epsilon-connector';
import { QueueService } from 'src/queue/queue.service';
import { $Enums } from 'src/generated/prisma/client';
import { CurrentUserInfo } from 'src/common/decorators/user.decorator';
import { VaultService } from 'src/vault/vault.service';

@Injectable()
export class ConnectionRequestService {
  constructor(
    private prisma: PrismaService,
    private queue: QueueService,
    private readonly vaultService: VaultService,
  ) {}

  async getList(userId: string): Promise<ConnectionRequestResponseDto[]> {
    return await this.prisma.connection.findMany({
      where: {
        request: {
          requestorId: userId,
        },
      },
      select: {
        project: {
          select: {
            projectId: true,
            customId: true,
            name: true,
          },
        },
        request: {
          select: {
            requestId: true,
            status: true,
            createdDate: true,
            lastModified: true,
          },
        },
      },
    });
  }

  async testConnection(database: DatabaseTestDto) {
    const connectionData = {
      driver: database.type,
      port: parseInt(database.port || ''),
      host: database.host,
      user: database.username,
      password: database.password,
      database: database.name,
      ssl: database.ssl ?? false,
    };
    // on success it returns now() - current db datetime
    return await testConnection(connectionData);
  }

  async approve(
    user: CurrentUserInfo,
    requestId: string,
    projectId: string,
    dto: ConnectionDecisionDto,
    accessToken: string,
  ) {
    const status = dto.isApproved
      ? $Enums.RequestStatus.APPROVED
      : $Enums.RequestStatus.REJECTED;

    // database credentials should exist so run database crawling
    if (status === $Enums.RequestStatus.APPROVED && dto.tempDbDetails?.url) {
      await this.prisma.project.update({
        where: { projectId: projectId },
        data: {
          status: 'CRAWLING',
        },
      });
      //add secrets
      const token = await this.vaultService.auth(accessToken);

      // encrypt with transit (user token only needs encrypt)
      const ciphertext = await this.vaultService.transitEncrypt(
        token,
        'connector-db',
        {
          ...dto.tempDbDetails,
        },
      );
      // store project-scoped copy for Coordinator (EC2)
      await this.vaultService.writeProjectCiphertext(
        token,
        projectId,
        ciphertext,
      );
      await this.queue.dataBrokerJob(
        user.username,
        projectId,
        requestId,
        dto.tempDbDetails,
      );
    }
    await this.prisma.request.update({
      where: { requestId: requestId },
      data: {
        status,
      },
    });
    // just return, no content
    return;
  }
}
