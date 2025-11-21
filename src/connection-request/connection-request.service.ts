import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DatabaseTestDto } from './dto';
import { testConnection } from '@epsilon-data/epsilon-connector';
import { QueueService } from 'src/queue/queue.service';
// import { KeycloakAdminService } from 'src/admin/keycloak/keycloak.admin.service';
// import { KeycloakService } from 'src/auth/keycloak/keycloak.service';
// import { ConfigService } from '@nestjs/config';
// import { Credentials } from '@epsilon-data/keycloak-admin-client';

@Injectable()
export class ConnectionRequestService {
  // credentials: Credentials;
  constructor(
    private prisma: PrismaService,
    private queue: QueueService,
  ) {}

  async getList(userId: string) {
    const requestList = await this.prisma.connection.findMany({
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
            lastModified: true,
          },
        },
      },
    });

    return requestList;
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
    return await testConnection(connectionData);
  }

  async approve(userId: string, requestId: string) {
    // await this.queue.dataBrokerJob(userId, requestId);
    return await this.prisma.request.update({
      where: { requestId: requestId },
      data: {
        status: 'APPROVED',
      },
    });
  }
}
