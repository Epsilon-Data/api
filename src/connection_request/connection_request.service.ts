import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DatabaseInfoDto } from './dto';
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

  async testConnection(databaseDto: DatabaseInfoDto) {
    const connectionData = {
      driver: databaseDto.type,
      port: parseInt(databaseDto.port),
      host: databaseDto.host,
      user: databaseDto.username,
      password: databaseDto.password,
      database: databaseDto.name,
      ssl: false,
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
