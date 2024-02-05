import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConnectionRequestDto, DatabaseInfoDto } from './dto';
import { testConnection } from '@epsilon-data/epsilon-connector';

@Injectable()
export class ConnectionRequestService {
  constructor(private prisma: PrismaService) {}
  async details(requestId: number) {
    const request = await this.prisma.connectionRequest.findUnique({
      where: {
        id: requestId,
      },
      include: {
        Project: true,
        OrgAdmin: true,
        ResearcherDb: true,
      },
    });

    const mappedRequest: ConnectionRequestDto = {
      requestor: request.requestor,
      status: request.status,
      date: request.createdDate,
      projectInfo: {
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
    if (request.ResearcherDb) {
      info = {
        databaseInfo: {
          name: request.ResearcherDb.name,
          type: request.ResearcherDb.type,
          host: request.ResearcherDb.host,
          port: request.ResearcherDb.port,
        },
      };
    } else {
      info = {
        orgAdminEmail: request.OrgAdmin.email,
        additionalInfo: request.additionalInfo,
      };
    }

    return { ...mappedRequest, ...info };
  }

  async summary(userId: number, userType: string) {
    if (userType === 'researcher') {
      return await this.prisma.connectionRequest.findMany({
        where: {
          requestor: userId,
        },
        select: {
          id: true,
          status: true,
          createdDate: true,
          Project: {
            select: {
              name: true,
            },
          },
        },
      });
    } else if (userType === 'orgAdmin') {
      return await this.prisma.connectionRequest.findMany({
        where: {
          orgAdminId: userId,
        },
        select: {
          id: true,
          requestor: true,
          status: true,
          createdDate: true,
          Project: {
            select: {
              name: true,
            },
          },
        },
      });
    }
  }

  async create(dto: ConnectionRequestDto) {
    const request = {
      requestor: dto.requestor,
      status: 1,
      dataParticipantsNum: dto.dataInfo.participantsNumber,
      dataDescription: dto.dataInfo.description,
      dataKeywords: dto.dataInfo.keywords,
      additionalInfo: dto.additionalInfo,
      dataCollectionStartDate: dto.dataInfo.collectionDuration[0],
      dataCollectionEndDate: dto.dataInfo.collectionDuration[1],
      Project: {
        create: {
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

    let info = {};
    if (dto.databaseInfo) {
      info = {
        ResearcherDb: {
          create: {
            name: dto.databaseInfo.name,
            type: dto.databaseInfo.type,
            host: dto.databaseInfo.host,
            port: dto.databaseInfo.port,
            username: dto.databaseInfo.username,
            password: dto.databaseInfo.password,
          },
        },
      };
    } else {
      const existingOrgAdmin = await this.prisma.orgAdmin.findFirst({
        where: {
          email: dto.orgAdminEmail,
        },
        select: {
          id: true,
        },
      });
      if (existingOrgAdmin) {
        info = {
          orgAdminId: existingOrgAdmin.id,
        };
      } else {
        info = {
          OrgAdmin: {
            create: {
              email: dto.orgAdminEmail,
            },
          },
        };
      }
      return await this.prisma.connectionRequest.create({
        data: {
          ...request,
          ...info,
        },
      });
    }
  }

  async update(dto: ConnectionRequestDto) {
    const request = await this.prisma.connectionRequest.findUnique({
      where: {
        id: dto.id,
      },
      include: {
        Project: true,
        OrgAdmin: true,
        ResearcherDb: true,
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
        status: dto.status,
        additionalInfo: dto.additionalInfo,
        dataParticipantsNum: dto.dataInfo.participantsNumber,
        dataDescription: dto.dataInfo.description,
        dataKeywords: dto.dataInfo.keywords,
        dataCollectionStartDate: dto.dataInfo.collectionDuration[0],
        dataCollectionEndDate: dto.dataInfo.collectionDuration[1],
      },
    });

    let transactions = [];

    if (request.ResearcherDb) {
      const researcherDbUpdate = this.prisma.researcherDb.update({
        where: { id: request.ResearcherDb.id },
        data: {
          name: dto.databaseInfo.name,
          type: dto.databaseInfo.type,
          host: dto.databaseInfo.host,
          port: dto.databaseInfo.port,
          username: dto.databaseInfo.username,
          password: dto.databaseInfo.password,
        },
      });
      transactions = [
        projectUpdate,
        connectionRequestUpdate,
        researcherDbUpdate,
      ];
    } else {
      const orgAdminUpdate = this.prisma.orgAdmin.update({
        where: { id: request.OrgAdmin.id },
        data: {
          email: dto.orgAdminEmail,
        },
      });
      transactions = [projectUpdate, connectionRequestUpdate, orgAdminUpdate];
    }

    return await this.prisma.$transaction(transactions);
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
}
