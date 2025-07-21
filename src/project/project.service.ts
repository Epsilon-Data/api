import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ProjectDto, SettingsDto } from './dto';
import { FileStorageService } from 'src/file_storage/file_storage.service';
import { KeycloakAdminService } from 'src/admin/keycloak/keycloak.admin.service';
import { nanoid } from 'nanoid';
import { QueueService } from 'src/queue/queue.service';

@Injectable()
export class ProjectService {
  constructor(
    private prisma: PrismaService,
    private queue: QueueService,
    private fileStorage: FileStorageService,
    private keycloak: KeycloakAdminService,
  ) {}

  async getUserOwnedProjects(userId: string) {
    const projects = await this.prisma.project.findMany({
      where: {
        ownerId: userId,
        connection: {
          request: {
            requestorId: userId,
          },
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

  async getUserSharedProjects(userEmail: string) {
    const projects = await this.prisma.project.findMany({
      where: {
        members: {
          some: {
            email: userEmail,
          },
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

  async getUserProjects(permissions: any) {
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
      where: {
        status: 'MAPPED',
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
    const dbData = JSON.stringify(dto.connection.tempDbDetails);
    const memberData = JSON.parse(dto.members);

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
      participantsNum: dto.participantsNum,
      dbKeywords: dto.dbKeywords,
      connection: {
        create: {
          orgAdminEmail: dto.connection.orgAdminEmail,
          tempDbDetails: dbData,
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

    if (memberData && memberData.length > 0) {
      const members = memberData.map((member) => ({
        projectId: project.projectId,
        email: member.email,
        role: member.role,
      }));

      await this.prisma.projectMember.createMany({
        data: members,
        skipDuplicates: true,
      });
    }

    const memberEmails = memberData.map((member) => member.email);

    // NOTE: example of add resource and permissions
    this.keycloak.newResource(project.projectId, 'test_user', memberEmails);

    if (dto.connection.additionalInfo) {
      await this.prisma.comment.create({
        data: {
          requestId: project.connection.request.requestId,
          authorId: dto.ownerId,
          content: dto.connection.additionalInfo,
        },
      });
    }

    if (dto.connection.tempDbDetails) {
      await this.prisma.request.update({
        where: {
          requestId: project.connection.requestId,
        },
        data: {
          status: 'APPROVED',
        },
      });
      await this.queue.dataBrokerJob(
        dto.ownerId,
        project.projectId,
        project.connection.requestId,
        dto.connection.tempDbDetails,
      );
    }

    return project;
  }

  async getProjectDetails(projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        projectId: projectId,
      },
      include: {
        members: true,
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
    const dbData = JSON.stringify(dto.connection.tempDbDetails);
    const memberData = JSON.parse(dto.members);
    await this.prisma.project.update({
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
        participantsNum: dto.participantsNum,
        dbKeywords: dto.dbKeywords,
        connection: {
          update: {
            tempDbDetails: dbData,
          },
        },
      },
    });

    if (memberData && memberData.length > 0) {
      const members = memberData.map((member) => ({
        projectId: projectId,
        email: member.email,
        role: member.role,
      }));

      await this.prisma.projectMember.createMany({
        data: members,
        skipDuplicates: true,
      });
    }
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
