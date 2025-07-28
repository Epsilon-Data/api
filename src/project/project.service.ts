import { Injectable } from '@nestjs/common';
import { AtlasService } from 'src/atlas/atlas.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ProjectDto, SettingsDto } from './dto';
import { FileStorageService } from 'src/file_storage/file_storage.service';
import { KeycloakAdminService } from 'src/admin/keycloak/keycloak.admin.service';
import { nanoid } from 'nanoid';

import { PermissionsDto } from 'src/auth/dto';
@Injectable()
export class ProjectService {
  constructor(
    private prisma: PrismaService,
    private atlas: AtlasService,
    private fileStorage: FileStorageService,
    private readonly keycloak: KeycloakAdminService,
  ) {}

  async getUserOwnedProjects(userId: string) {
    const projects = await this.prisma.project.findMany({
      where: {
        ownerId: userId,
      },
      select: {
        projectId: true,
        customId: true,
        name: true,
        lastModified: true,
        createdDate: true,
        status: true,
        university: true,
        faculty: true,
      },
    });
    return projects;
  }

  async getUserProjects(permissions: PermissionsDto[]) {
    const uuids = permissions.map((item) => item.rsname.split(':')[1]);
    const projects = await this.prisma.project.findMany({
      where: {
        projectId: {
          in: uuids, // find all projects associated
        },
      },
      select: {
        projectId: true,
        customId: true,
        name: true,
        lastModified: true,
        createdDate: true,
        status: true,
        university: true,
        faculty: true,
      },
    });

    return projects;
  }

  async getAllProjects() {
    return await this.prisma.project.findMany({
      select: {
        projectId: true,
        customId: true,
        name: true,
        lastModified: true,
        createdDate: true,
        status: true,
        university: true,
        faculty: true,
      },
    });
  }

  async getProjectRequests(projectId: string, email: string) {
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

  async createProject(dto: ProjectDto) {
    const request = {
      ownerId: dto.ownerId,
      customId: nanoid(12),
      name: dto.name,
      lead: dto.lead,
      university: dto.university,
      faculty: dto.faculty,
      ethicsId: dto.ethicsId,
      description: dto.description,
      startDate: dto.startDate,
      endDate: dto.endDate,
      members: dto.members,
      participantsNum: dto.participantsNum,
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
    // add keycloak resource
    this.keycloak.newResource(
      project.projectId,
      project.ownerId,
      project.members,
    );

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

  async getProjectDetails(projectId: string) {
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

  async updateProject(projectId: string, dto: ProjectDto) {
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
        participantsNum: dto.participantsNum,
        dbKeywords: dto.dbKeywords,
        connection: {
          update: {
            tempDbDetails: dto.connection.tempDbDetails,
          },
        },
      },
    });
  }

  async deleteProject(projectId: string) {
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

  async getProjectSettings(projectId: string) {
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

  async updateProjectSettings(projectId: string, dto: SettingsDto) {
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

  async uploadProjectCover(projectId: string, file: Express.Multer.File) {
    await this.prisma.project.update({
      where: {
        projectId: projectId,
      },
      data: {
        lastModified: new Date(),
      },
    });

    this.fileStorage.putFile('cover', `${projectId}/cover.jpg`, file);
    return file.buffer;
  }
}
