import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DatabaseInfoDto } from './dto';
import { testConnection } from '@epsilon-data/epsilon-connector';

@Injectable()
export class ConnectionRequestService {
  constructor(private prisma: PrismaService) {}

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

  async approve(requestId: string) {
    return await this.prisma.request.update({
      where: { requestId: requestId },
      data: {
        status: 'APPROVED',
      },
    });
  }
}
