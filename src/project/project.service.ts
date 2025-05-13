import { Injectable } from '@nestjs/common';
import { AtlasService } from 'src/atlas/atlas.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ProjectDto, SettingsDto } from './dto';
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

  async update(projectId: string, dto: ProjectDto) {
    return await this.prisma.project.update({
      where: { projectId: projectId },
      data: {
        name: dto.name,
        lead: dto.lead,
        university: dto.university,
        faculty: dto.faculty,
        ethicsId: dto.ethicsId,
        description: dto.description,
        startDate: dto.startDate,
        endDate: dto.endDate,
        members: dto.members,
        dbParticipantsNum: dto.dbParticipantsNum,
        dbCollectionStartDate: dto.dbCollectionStartDate,
        dbCollectionEndDate: dto.dbCollectionEndDate,
        dbDescription: dto.dbDescription,
        dbKeywords: dto.dbKeywords,
        connection: {
          update: {
            tempDbDetails: dto.connection.tempDbDetails,
          },
        },
      },
    });
  }

  async delete(projectId: string) {
    return await this.prisma.project.delete({
      where: {
        projectId: projectId,
      },
      include: {
        connection: true,
        analysis: true,
      },
    });
  }

  async getSettings(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: {
        projectId: projectId,
      },
      select: {
        visualizations: true,
      },
    });

    const bucket = 'cover';
    const key = `${projectId}/cover.jpg`;
    let cover = null;

    const exists = await this.fileStorage.fileExists(bucket, key);
    if (exists) {
      cover = await this.fileStorage.getFileUrl(bucket, key);
    }

    return {
      projectId: projectId,
      visualizations: project.visualizations,
      cover: cover,
    };
  }

  async updateSettings(projectId: string, dto: SettingsDto) {
    await this.prisma.project.update({
      where: {
        projectId: projectId,
      },
      data: {
        visualizations: JSON.stringify(dto.visualizations),
      },
    });

    this.fileStorage.deleteFile('cover', `${projectId}`);
    return projectId;
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
}
