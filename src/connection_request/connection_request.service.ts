import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConnectionRequestDto, DatabaseInfoDto } from './dto';
import { testConnection } from '@epsilon-data/epsilon-connector';
import { Request } from 'express';
import { CassandraService } from 'src/cassandra/cassandra.service';
import { v4 as uuid } from 'uuid';

@Injectable()
export class ConnectionRequestService {
  constructor(
    private prisma: PrismaService,
    private cassandra: CassandraService,
  ) {}
  async details(requestId: string) {
    const request = await this.prisma.connectionRequest.findUnique({
      where: {
        id: requestId,
      },
      include: {
        Project: true,
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
        orgAdminEmail: request.orgAdminEmail,
        additionalInfo: request.additionalInfo,
      };
    }

    return { ...mappedRequest, ...info };
  }

  async summary(request: Request) {
    const isAdmin = await this.isAdmin(request);
    const userId = request.auth.payload.sub;
    let requestList = {};
    if (isAdmin) {
      const userEmail = request.auth.payload.email;
      requestList = await this.prisma.connectionRequest.findMany({
        where: {
          orgAdminEmail: userEmail,
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
    } else {
      requestList = await this.prisma.connectionRequest.findMany({
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
    }
    return { requests: requestList, isAdmin: isAdmin };
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
      const query =
        'INSERT INTO sources (id, connect_date, host, name, password, port, status, type, username) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
      const dbId = uuid();
      const queryParams = [
        dbId,
        this.cassandra.getCurrentDate(),
        dto.databaseInfo.host,
        dto.databaseInfo.name,
        dto.databaseInfo.password,
        dto.databaseInfo.port,
        1,
        dto.databaseInfo.type,
        dto.databaseInfo.username,
      ];
      this.cassandra
        .executeQuery(query, queryParams)
        .then(() => console.log('User inserted successfully'))
        .catch((err) => console.error('Error inserting user', err));
      info = {
        dbId: dbId,
      };
    } else {
      //TODO: get boolean whether if email is a registered org admin
      info = { orgAdminEmail: dto.orgAdminEmail };
      // const existingOrgAdmin
      // if (!existingOrgAdmin) {
      //   TODO: send email to org admin
      // }
    }

    return await this.prisma.connectionRequest.create({
      data: {
        ...request,
        ...info,
      },
    });
  }

  async update(dto: ConnectionRequestDto) {
    const request = await this.prisma.connectionRequest.findUnique({
      where: {
        id: dto.id,
      },
      include: {
        Project: true,
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
      //TODO: get boolean whether if email is a registered org admin
      const orgAdminUpdate = this.prisma.connectionRequest.update({
        where: { id: dto.id },
        data: {
          orgAdminEmail: dto.orgAdminEmail,
        },
      });
      transactions = [projectUpdate, connectionRequestUpdate, orgAdminUpdate];
      // const existingOrgAdmin
      // if (!existingOrgAdmin) {
      //   TODO: send email to org admin
      // }
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

  async isAdmin(request: Request) {
    const access: { account?: { roles: string[] } } =
      request.auth.payload.resource_access;
    if (access && access.account && access.account.roles) {
      return access.account.roles.indexOf('admin') !== -1;
    }
    return false;
  }
}
