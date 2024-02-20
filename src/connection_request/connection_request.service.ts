import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConnectionRequestDto, DatabaseInfoDto, RevisionDto } from './dto';
import { testConnection } from '@epsilon-data/epsilon-connector';
import { Request } from 'express';
import { CassandraService } from 'src/cassandra/cassandra.service';
import { v4 as uuid } from 'uuid';
import { UserService } from 'src/user/user.service';

@Injectable()
export class ConnectionRequestService {
  constructor(
    private prisma: PrismaService,
    private cassandra: CassandraService,
    private user: UserService,
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
      const query = `SELECT name, type, host, port FROM sources WHERE id = ?`;
      const queryParams = [request.dbId];
      const result = await this.cassandra.executeQuery(query, queryParams);
      console.log(result);
      info = {
        databaseInfo: {
          name: result[0].name,
          type: result[0].type,
          host: result[0].host,
          port: result[0].port,
        },
      };
    }

    return { ...mappedRequest, ...info };
  }

  async summary(request: Request) {
    const isAdmin = await this.user.admin(request);
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
        .then(() => console.log('Source inserted successfully'))
        .catch((err) => console.error('Error inserting source: ', err));
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

    if (request.dbId) {
      const query =
        'UPDATE sources SET name = ?, type = ?, host = ?, port = ?, username = ?, password = ? WHERE id = ?';
      const queryParams = [
        dto.databaseInfo.name,
        dto.databaseInfo.type,
        dto.databaseInfo.host,
        dto.databaseInfo.port,
        dto.databaseInfo.username,
        dto.databaseInfo.password,
        request.dbId,
      ];
      this.cassandra.executeQuery(query, queryParams);
      transactions = [projectUpdate, connectionRequestUpdate];
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
    });

    if (request.dbId) {
      const query = 'DELETE FROM sources WHERE id = ?';
      const queryParams = [request.dbId];
      this.cassandra.executeQuery(query, queryParams);
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

  async approve(dto: DatabaseInfoDto, requestId: string) {
    const query =
      'INSERT INTO sources (id, connect_date, host, name, password, port, status, type, username) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
    const dbId = uuid();
    const queryParams = [
      dbId,
      this.cassandra.getCurrentDate(),
      dto.host,
      dto.name,
      dto.password,
      dto.port,
      1,
      dto.type,
      dto.username,
    ];
    this.cassandra
      .executeQuery(query, queryParams)
      .then(() => console.log('Source inserted successfully'))
      .catch((err) => console.error('Error inserting source: ', err));

    return await this.prisma.connectionRequest.update({
      where: { id: requestId },
      data: {
        dbId: dbId,
        status: 3,
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
}
