import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ProjectDetailsResponseDto,
  ProjectDto,
  ProjectRequestsResponse,
  ProjectSummaryInfoDto,
  SettingsDto,
} from './dto';
import { FileStorageService } from 'src/file_storage/file_storage.service';
import { KeycloakAdminService } from 'src/admin/keycloak/keycloak.admin.service';
import { nanoid } from 'nanoid';
import { QueueService } from 'src/queue/queue.service';

import { KeycloakPermissionDto } from 'src/auth/keycloak/dto';
import { CurrentUserInfo } from 'src/common/decorators/user.decorator';
import { v4 as uuidv4 } from 'uuid';
import { ConnectionRequestResponseDto } from 'src/connection_request/dto';
import { AnalysisRequestResponseDto } from 'src/analysis_request/dto';

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);
  constructor(
    private prisma: PrismaService,
    private queue: QueueService,
    private fileStorage: FileStorageService,
    private readonly keycloak: KeycloakAdminService,
  ) {}

  async getUserOwnedProjects(userId: string): Promise<ProjectSummaryInfoDto[]> {
    const projects = await this.prisma.project.findMany({
      where: {
        ownerId: userId,
      },
      select: {
        projectId: true,
        customId: true,
        name: true,
        lastModified: true,
        status: true,
        university: true,
        lead: true,
        faculty: true,
      },
    });
    return projects;
  }

  async getUserSharedProjects(
    permissions: KeycloakPermissionDto[],
  ): Promise<ProjectSummaryInfoDto[]> {
    const uuids = permissions
      .filter(
        (item) =>
          item.scopes.includes('view') && !item.scopes.includes('delete'),
      )
      .map((item) => item.rsname.split(':').at(1)!);
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
        lead: true,
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
        status: {
          in: ['MAPPED'],
        },
      },
      select: {
        projectId: true,
        customId: true,
        name: true,
        lastModified: true,
        createdDate: true,
        university: true,
        faculty: true,
      },
    });
  }

  async getProjectRequests(
    projectId: string,
    email: string,
  ): Promise<ProjectRequestsResponse> {
    const requestList: {
      connection: ConnectionRequestResponseDto[];
      analysis: AnalysisRequestResponseDto[];
    } = {
      connection: [],
      analysis: [],
    };
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

  async createProject(user: CurrentUserInfo, dto: ProjectDto) {
    // TODO:  Why not have this as object?
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const memberData: unknown[] = JSON.parse(dto.members ?? '[]');
    const customId = nanoid(12);
    const packageName = dto.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    const request = {
      ownerId: dto.ownerId,
      customId: customId,
      packageId: `${packageName}_${customId.slice(0, 6)}`,
      name: dto.name,
      lead: dto.lead,
      university: dto.university,
      faculty: dto.faculty,
      ethicsId: dto.ethicsId,
      description: dto.description,
      startDate: dto.startDate,
      endDate: dto.endDate,
      participantsNum: dto.participantsNum,

      ...(memberData.length && {
        members: dto.members,
      }),
      dbKeywords: dto.dbKeywords,
    };

    // check if database credential request is needed
    const createRequest = dto.connection.orgAdminEmail ? true : false;
    const requestId = uuidv4();
    const project = await this.prisma.project.create({
      data: {
        ...request,
        connection: {
          create: {
            // if no orgAdminEmail provider make owner admin
            orgAdminEmail: dto.connection.orgAdminEmail ?? user.email,
            tempDbDetails:
              JSON.stringify(dto.connection.tempDbDetails) ?? undefined,
            ...(createRequest && {
              request: {
                create: {
                  requestId,
                  requestorId: dto.ownerId,
                },
              },
            }),
          },
        },
      },
      include: {
        connection: {
          include: { request: true },
        },
      },
    });

    const memberEmails = memberData.map(
      (member: Record<string, string>) => member.email,
    );

    // add keycloak resource
    // TODO: better error handling
    void this.keycloak.newResource(
      project.projectId,
      project.ownerId,
      memberEmails,
    );

    if (createRequest) {
      // create comment if additionalInfo is provided to request
      if (dto.connection.additionalInfo) {
        await this.prisma.comment.create({
          data: {
            requestId,
            authorId: dto.ownerId,
            content: dto.connection.additionalInfo,
          },
        });
      }
    } else {
      // database credentials should exist so run database crawling
      if (dto.connection.tempDbDetails?.url) {
        await this.queue.dataBrokerJob(
          user.username,
          project.projectId,
          requestId,
          dto.connection.tempDbDetails,
        );
      }
    }
    // just return, no content
    return;
  }

  async getProjectDetails(
    projectId: string,
  ): Promise<ProjectDetailsResponseDto | null> {
    return await this.prisma.project.findUnique({
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
  }

  async updateProject(projectId: string, dto: ProjectDto) {
    const dbData = JSON.stringify(dto.connection.tempDbDetails);
    // const memberData = JSON.parse(dto.members);
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

    if (project) {
      const bucket = 'cover';
      const key = `${projectId}/cover.jpg`;

      const cover = await this.fileStorage.getFileUrl(bucket, key);

      return {
        projectId: projectId,
        visualizations: project.visualizations,
        cover: cover || null,
      };
    }
    return null;
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

    // TODO: check this
    await this.fileStorage.deleteFile('cover', `${projectId}`);
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

    await this.fileStorage.putFile('cover', `${projectId}/cover.jpg`, file);
    return file.buffer;
  }
}
