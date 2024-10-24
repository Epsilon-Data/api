import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConnectionRequestDto, DatabaseInfoDto, RevisionDto } from './dto';
import { testConnection } from '@epsilon-data/epsilon-connector';
import { AtlasService } from 'src/atlas/atlas.service';
import { DockerService } from 'src/docker/docker.service';
import { DataProcessingService } from 'src/data_processing/data_processing.service';

@Injectable()
export class ConnectionRequestService {
  constructor(
    private prisma: PrismaService,
    private atlas: AtlasService,
    private dataProcess: DataProcessingService,
    private docker: DockerService,
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
        Project: {
          select: {
            id: true,
            customId: true,
            name: true,
          },
        },
      },
    });

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

    let info: any = {};
    if (dto.databaseInfo) {
      try {
        const instanceGuid = await this.docker.runDataBroker(
          dto.requestor,
          createdRequest.id,
          dto.databaseInfo,
        );
        console.log('Data broker container started successfully.');
        info = { status: 3, atlasId: instanceGuid };
      } catch (error) {
        console.error('Failed to start data broker container:', error);
        info = { status: 2 };
      }
      info = { ...info, dbName: dto.databaseInfo.name };
    } else {
      //TODO: get boolean whether if email is a registered org admin
      info = { status: 1, orgAdminEmail: dto.orgAdminEmail };
      // const existingOrgAdmin
      // if (!existingOrgAdmin) {
      //   TODO: send email to org admin
      // }
    }

    if (info.atlasId) {
      this.dataProcess.dataSynthesis(info.atlasId);
    }

    return await this.prisma.connectionRequest.update({
      where: { id: createdRequest.id },
      data: info,
    });
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
      let status = 2;
      await this.atlas.delete('/entity/guid/' + request.atlasId);

      try {
        const result = await this.docker.runDataBroker(
          dto.requestor,
          dto.id,
          dto.databaseInfo,
        );
        console.log('Data broker container started successfully:', result);
        status = 3;
      } catch (error) {
        console.error('Failed to start data broker container:', error);
      }

      const databaseUpdate = this.prisma.connectionRequest.update({
        where: { id: dto.id },
        data: {
          dbName: dto.databaseInfo.name,
          status: status,
        },
      });
      transactions = [projectUpdate, connectionRequestUpdate, databaseUpdate];
    } else {
      const orgAdminUpdate = this.prisma.connectionRequest.update({
        where: { id: dto.id },
        data: {
          orgAdminEmail: dto.orgAdminEmail,
          status: 1,
        },
      });
      transactions = [projectUpdate, connectionRequestUpdate, orgAdminUpdate];
      //TODO: get boolean whether if email is a registered org admin
      // const existingOrgAdmin
      // if (!existingOrgAdmin) {
      //   TODO: send email to org admin
      // }
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
    let status = 1;
    try {
      this.docker.runDataBroker(userId, requestId, dto);
      console.log('Data broker container started successfully.');
      status = 3;
    } catch (error) {
      console.error('Failed to start data broker container:', error);
    }

    this.dataProcess.dataSynthesis(requestId);

    return await this.prisma.connectionRequest.update({
      where: { id: requestId },
      data: {
        dbName: dto.name,
        status: status,
      },
    });
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
