import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConnectionRequestDto, DatabaseInfoDto, RevisionDto } from './dto';
import { testConnection } from '@epsilon-data/epsilon-connector';
import { Request } from 'express';
import { CassandraService } from 'src/cassandra/cassandra.service';
import { DockerService } from 'src/docker/docker.service';

@Injectable()
export class ConnectionRequestService {
  constructor(
    private prisma: PrismaService,
    private cassandra: CassandraService,
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

  async summary(request: Request) {
    // check if user is admin
    let isAdmin = false;
    const access: { roles?: string[] } = request.auth.payload.realm_access;
    if (access && access.roles) {
      isAdmin = access.roles.indexOf('admin') !== -1;
    }

    const userId = request.auth.payload.sub;
    let requestList = [];
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
              customId: true,
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

      requestList = await Promise.all(
        requestList.map(async (connRequest) => {
          const { dbName, ...requestDetails } = connRequest;
          if (dbName) {
            const query = `SELECT status FROM sources WHERE id = ?`;
            const queryParams = [requestDetails.id];
            const result = await this.cassandra.executeQuery(
              query,
              queryParams,
            );

            if (result[0]) {
              requestDetails.dbStatus = result[0].status;
            }
          }
          return requestDetails;
        }),
      );
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

    let info = {};
    if (dto.databaseInfo) {
      try {
        const result = await this.docker.runDataBroker(
          createdRequest.id,
          dto.databaseInfo,
        );
        console.log('Data broker container started successfully:', result);
        info = { status: 3 };
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
      const deleteQuery = 'DELETE FROM sources WHERE id = ?';
      const deleteQueryParams = [request.id];
      this.cassandra.executeQuery(deleteQuery, deleteQueryParams);
      try {
        const result = await this.docker.runDataBroker(
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
    });

    if (request.dbName) {
      const query = 'DELETE FROM sources WHERE id = ?';
      const queryParams = [request.id];
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
    let status = 1;
    try {
      const result = await this.docker.runDataBroker(requestId, dto);
      console.log('Data broker container started successfully:', result);
      status = 3;
    } catch (error) {
      console.error('Failed to start data broker container:', error);
    }

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

  async validProjectId(request: Request, projectId: string) {
    const result = await this.prisma.connectionRequest.findFirst({
      where: {
        requestor: request.auth.payload.sub,
        Project: {
          customId: projectId,
        },
      },
    });
    return result ? false : true;
  }
}
