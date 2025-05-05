import { Injectable } from '@nestjs/common';
import { AtlasService } from 'src/atlas/atlas.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ProjectDto } from './dto';
import { FileStorageService } from 'src/file_storage/file_storage.service';

@Injectable()
export class ProjectService {
  constructor(
    private prisma: PrismaService,
    private atlas: AtlasService,
    private fileStorage: FileStorageService,
  ) {}

  async getList(userId: string) {
    const projects = await this.prisma.project.findMany({
      where: {
        ownerId: userId,
      },
      select: {
        projectId: true,
        customId: true,
        name: true,
        createdDate: true,
        status: true,
      },
    });

    return projects;
  }

  async getRequestList(projectId: string, email: string) {
    const requestList = { connection: [], analysis: [] };
    requestList.connection = await this.prisma.connection.findMany({
      where: {
        orgAdminEmail: email,
      },
      select: {
        request: {
          select: {
            requestId: true,
            status: true,
            createdDate: true,
          },
        },
        project: {
          select: {
            projectId: true,
            name: true,
          },
        },
      },
    });

    requestList.analysis = await this.prisma.analysis.findMany({
      where: {
        projectId: projectId,
      },
      select: {
        request: {
          select: {
            requestId: true,
            status: true,
            createdDate: true,
          },
        },
        projectName: true,
      },
    });

    return requestList;
  }

  async create(dto: ProjectDto) {
    const customId = await this.generateProjectCustomId(dto.ownerId);
    const request = {
      ownerId: dto.ownerId,
      customId: customId,
      name: dto.name,
      lead: dto.lead,
      university: dto.university,
      faculty: dto.faculty,
      ethicsId: dto.ethicsId,
      description: dto.description,
      startDate: dto.startDate,
      endDate: dto.endDate,
      members: dto.members,
      dbCollectionStartDate: dto.dbCollectionStartDate,
      dbCollectionEndDate: dto.dbCollectionEndDate,
      dbParticipantsNum: dto.dbParticipantsNum,
      dbDescription: dto.dbDescription,
      dbKeywords: dto.dbKeywords,
      connection: {
        create: {
          orgAdminEmail: dto.connection.orgAdminEmail,
          tempDbDetails: dto.connection.tempDbDetails,
          request: {
            create: {
              requestorId: dto.ownerId,
            },
          },
        },
      },
    };

    const project = await this.prisma.project.create({
      data: request,
      include: {
        connection: {
          include: {
            request: true,
          },
        },
      },
    });

    if (dto.connection.additionalInfo) {
      await this.prisma.comment.create({
        data: {
          requestId: project.connection.request.requestId,
          authorId: dto.ownerId,
          content: dto.connection.additionalInfo,
        },
      });
    }

    return project;
  }

  async getDetails(projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        projectId: projectId,
      },
      include: {
        connection: {
          include: {
            request: {
              include: {
                comments: true,
              },
            },
          },
        },
      },
    });

    return project;
  }

  async generateProjectCustomId(userId: string) {
    const MAX_ATTEMPTS = 10;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const length = 6;
      const chars =
        'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let customId = '';
      for (let i = 0; i < length; i++) {
        customId += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const existing = await this.prisma.project.findFirst({
        where: {
          ownerId: userId,
          customId: customId,
        },
      });

      if (!existing) {
        return customId;
      }
    }

    return null;
  }

  // async projectSummary(projectId: string) {
  //   const request = await this.prisma.project.findUnique({
  //     where: {
  //       projectId: projectId,
  //     },
  //     select: {
  //       customId: true,
  //       name: true,
  //       university: true,
  //     },
  //   });

  //   return {
  //     id: request.customId,
  //     name: request.name,
  //     university: request.university,
  //   };
  // }

  // async createAnalysisRequest(details: AccessDto) {
  //   await this.prisma.analysis.create({
  //     data: {
  //       request: {
  //         create: {
  //           requestorId: details.requestor,
  //           status: 1,
  //         },
  //       },
  //       project: {
  //         connect: {
  //           projectId: details.id,
  //         },
  //       },
  //       accessPurpose: details.accessPurpose,
  //       requestorName: details.requestorName,
  //       requestorEmail: details.email,
  //       requestorOrgName: details.orgName,
  //       requestorPosition: details.position,
  //       projectName: details.projectName,
  //       projectStartDate: details.projectDuration[0],
  //       projectEndDate: details.projectDuration[1],
  //       projectBackground: details.projectBackground,
  //       projectObjective: details.projectObjective,
  //       projectHypotheses: details.projectHypotheses,
  //       projectOutcome: details.projectOutcome,
  //       projectMembers: details.projectMembers,
  //       ethicsId: details.ethicsId,
  //     },
  //     include: {
  //       request: true,
  //     },
  //   });
  //   return details;
  // }

  // async edit(dto: ConnectionRequestDto) {
  //   const request = await this.prisma.connection.findUnique({
  //     where: {
  //       requestId: dto.id,
  //     },
  //     include: {
  //       project: true,
  //     },
  //   });

  //   const projectUpdate = this.prisma.project.update({
  //     where: { projectId: request.project.projectId },
  //     data: {
  //       name: dto.projectInfo.name,
  //       lead: dto.projectInfo.lead,
  //       university: dto.projectInfo.university,
  //       faculty: dto.projectInfo.faculty,
  //       ethicsId: dto.projectInfo.ethicsId,
  //       description: dto.projectInfo.description,
  //       startDate: dto.projectInfo.duration[0],
  //       endDate: dto.projectInfo.duration[1],
  //       members: dto.projectInfo.members,
  //       additionalInfo: dto.additionalInfo,
  //       dbParticipantsNum: dto.dataInfo.participantsNumber,
  //       dbDescription: dto.dataInfo.description,
  //       dbKeywords: dto.dataInfo.keywords,
  //       dbCollectionStartDate: dto.dataInfo.collectionDuration[0],
  //       dbCollectionEndDate: dto.dataInfo.collectionDuration[1],
  //     },
  //   });

  //   let transactions = [];

  //   if (request.orgAdminEmail == null) {
  //     await this.atlas.delete('/entity/guid/' + request.atlasId);
  //     await this.queue.dataBrokerJob(dto.requestor, dto.id, dto.databaseInfo);
  //     transactions = [projectUpdate];
  //   } else {
  //     const orgAdminUpdate = this.prisma.connection.update({
  //       where: { requestId: dto.id },
  //       data: {
  //         request: {
  //           update: {
  //             status: 1,
  //           },
  //         },
  //         orgAdminEmail: dto.orgAdminEmail,
  //       },
  //     });
  //     transactions = [projectUpdate, orgAdminUpdate];
  //     //TODO: get boolean whether if email is a registered org admin
  //   }

  //   return await this.prisma.$transaction(transactions);
  // }

  // async delete(requestId: string) {
  //   const request = await this.prisma.connection.findUnique({
  //     where: {
  //       requestId: requestId,
  //     },
  //     select: {
  //       atlasId: true,
  //     },
  //   });

  //   if (request.atlasId) {
  //     await this.atlas.delete('/entity/guid/' + request.atlasId);
  //   }

  //   return await this.prisma.request.delete({
  //     where: {
  //       requestId: requestId,
  //     },
  //     include: {
  //       connection: true,
  //       comments: true,
  //     },
  //   });
  // }

  // async approve(userId: string, dto: DatabaseInfoDto, requestId: string) {
  //   await this.queue.dataBrokerJob(userId, requestId, dto);
  // }

  // async revision(dto: RevisionDto) {
  //   //TODO: add comments rather than revision string
  //   return await this.prisma.request.update({
  //     where: { requestId: dto.requestId },
  //     data: {
  //       status: 2,
  //     },
  //   });
  // }
}
