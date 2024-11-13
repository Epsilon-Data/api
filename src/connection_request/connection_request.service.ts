import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConnectionRequestDto, DatabaseInfoDto, RevisionDto } from './dto';
import { testConnection } from '@epsilon-data/epsilon-connector';
import { AtlasService } from 'src/atlas/atlas.service';
import { QueueService } from 'src/queue/queue.service';

@Injectable()
export class ConnectionRequestService {
  constructor(
    private prisma: PrismaService,
    private atlas: AtlasService,
    private readonly queue: QueueService,
  ) {}
  async details(requestId: string) {
    const request = await this.prisma.connectionRequest.findUnique({
      where: {
        id: requestId,
      },
      include: {
        Project: true,
      },
    });

    const mappedRequest: ConnectionRequestDto = {
      requestor: request.requestor,
      status: request.status,
      date: request.createdDate,
      revisionInfo: request.revisionInfo,
      projectInfo: {
        id: request.Project.id,
        customId: request.Project.customId,
        name: request.Project.name,
        duration: [request.Project.startDate, request.Project.endDate],
        lead: request.Project.lead,
        members: request.Project.members,
        university: request.Project.university,
        faculty: request.Project.faculty,
        ethicsId: request.Project.ethicsId,
        description: request.Project.description,
      },
      dataInfo: {
        collectionDuration: [
          request.dataCollectionStartDate,
          request.dataCollectionEndDate,
        ],
        participantsNumber: request.dataParticipantsNum,
        description: request.dataDescription,
        keywords: request.dataKeywords,
      },
    };

    let info = {};
    if (request.orgAdminEmail) {
      info = {
        orgAdminEmail: request.orgAdminEmail,
        additionalInfo: request.additionalInfo,
      };
    } else {
      info = {
        databaseInfo: {
          name: request.dbName,
        },
      };
    }

    return { ...mappedRequest, ...info };
  }

  async summary(userId: string, email: string) {
    const requestList = { sent: [], receive: [] };

    requestList.receive = await this.prisma.connectionRequest.findMany({
      where: {
        orgAdminEmail: email,
      },
      select: {
        id: true,
        requestor: true,
        status: true,
        createdDate: true,
        Project: {
          select: {
            customId: true,
            name: true,
          },
        },
      },
    });

    requestList.sent = await this.prisma.connectionRequest.findMany({
      where: {
        requestor: userId,
      },
      select: {
        id: true,
        status: true,
        createdDate: true,
        dbName: true,
        atlasId: true,
        Project: {
          select: {
            id: true,
            customId: true,
            name: true,
          },
        },
      },
    });

    for (const request of requestList.sent) {
      if (request.status === 3 && request.atlasId) {
        const result = await this.atlas.get('/entity/guid/' + request.atlasId);
        request.dbStatus = result.entity.attributes.crawl_status;
      }
    }
    return { requests: requestList };
  }

  async create(dto: ConnectionRequestDto) {
    const request = {
      requestor: dto.requestor,
      dataParticipantsNum: dto.dataInfo.participantsNumber,
      dataDescription: dto.dataInfo.description,
      dataKeywords: dto.dataInfo.keywords,
      additionalInfo: dto.additionalInfo,
      dataCollectionStartDate: dto.dataInfo.collectionDuration[0],
      dataCollectionEndDate: dto.dataInfo.collectionDuration[1],
      Project: {
        create: {
          customId: dto.projectInfo.customId,
          name: dto.projectInfo.name,
          lead: dto.projectInfo.lead,
          university: dto.projectInfo.university,
          faculty: dto.projectInfo.faculty,
          ethicsId: dto.projectInfo.ethicsId,
          description: dto.projectInfo.description,
          startDate: dto.projectInfo.duration[0],
          endDate: dto.projectInfo.duration[1],
          members: dto.projectInfo.members,
        },
      },
    };

    const createdRequest = await this.prisma.connectionRequest.create({
      data: request,
    });

    if (dto.databaseInfo) {
      await this.queue.dataBrokerJob(
        dto.requestor,
        createdRequest.id,
        dto.databaseInfo,
      );
    } else {
      //TODO: get boolean whether if email is a registered org admin
      return await this.prisma.connectionRequest.update({
        where: { id: createdRequest.id },
        data: { status: 1, orgAdminEmail: dto.orgAdminEmail },
      });
    }
  }

  async edit(dto: ConnectionRequestDto) {
    const request = await this.prisma.connectionRequest.findUnique({
      where: {
        id: dto.id,
      },
      include: {
        Project: true,
      },
    });

    const projectUpdate = this.prisma.project.update({
      where: { id: request.Project.id },
      data: {
        name: dto.projectInfo.name,
        lead: dto.projectInfo.lead,
        university: dto.projectInfo.university,
        faculty: dto.projectInfo.faculty,
        ethicsId: dto.projectInfo.ethicsId,
        description: dto.projectInfo.description,
        startDate: dto.projectInfo.duration[0],
        endDate: dto.projectInfo.duration[1],
        members: dto.projectInfo.members,
      },
    });

    const connectionRequestUpdate = this.prisma.connectionRequest.update({
      where: { id: dto.id },
      data: {
        additionalInfo: dto.additionalInfo,
        dataParticipantsNum: dto.dataInfo.participantsNumber,
        dataDescription: dto.dataInfo.description,
        dataKeywords: dto.dataInfo.keywords,
        dataCollectionStartDate: dto.dataInfo.collectionDuration[0],
        dataCollectionEndDate: dto.dataInfo.collectionDuration[1],
      },
    });

    let transactions = [];

    if (request.dbName) {
      await this.atlas.delete('/entity/guid/' + request.atlasId);
      await this.queue.dataBrokerJob(dto.requestor, dto.id, dto.databaseInfo);
      transactions = [projectUpdate, connectionRequestUpdate];
    } else {
      const orgAdminUpdate = this.prisma.connectionRequest.update({
        where: { id: dto.id },
        data: {
          status: 1,
          orgAdminEmail: dto.orgAdminEmail,
        },
      });
      transactions = [projectUpdate, connectionRequestUpdate, orgAdminUpdate];
      //TODO: get boolean whether if email is a registered org admin
    }

    return await this.prisma.$transaction(transactions);
  }

  async delete(requestId: string) {
    const request = await this.prisma.connectionRequest.findUnique({
      where: {
        id: requestId,
      },
      select: {
        atlasId: true,
        dbName: true,
      },
    });

    if (request.dbName) {
      await this.atlas.delete('/entity/guid/' + request.atlasId);
    }

    return await this.prisma.connectionRequest.delete({
      where: {
        id: requestId,
      },
      include: {
        Project: true,
      },
    });
  }

  async approve(userId: string, dto: DatabaseInfoDto, requestId: string) {
    await this.queue.dataBrokerJob(userId, requestId, dto);
  }

  async revision(dto: RevisionDto) {
    return await this.prisma.connectionRequest.update({
      where: { id: dto.requestId },
      data: {
        revisionInfo: dto.revisionInfo,
        status: 2,
      },
    });
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

  async validProjectId(userId: string, projectId: string) {
    const result = await this.prisma.connectionRequest.findFirst({
      where: {
        requestor: userId,
        Project: {
          customId: projectId,
        },
      },
    });
    return result ? false : true;
  }
}
