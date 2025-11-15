import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateProjectDto,
  ProjectDetailsResponseDto,
  ProjectRequestsResponse,
  ProjectSummaryInfoDto,
  SettingsDto,
  SettingsResponseDto,
  UpdateProjectDto,
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

  async createProject(user: CurrentUserInfo, dto: CreateProjectDto) {
    // TODO:  Why not have this as object?
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const memberData: unknown[] = JSON.parse(dto.members ?? '[]');
    const { packageId, customId } = this.createIds(dto.name, dto.customId);
    const ownerId = user.id; //using current logged in user details rather than post

    const request = {
      ownerId,
      customId,
      packageId,
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
                  requestorId: ownerId,
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
            authorId: ownerId,
            content: dto.connection.additionalInfo,
          },
        });
      }
    } else {
      // database credentials should exist so run database crawling
      if (dto.connection.tempDbDetails?.url) {
        await this.prisma.project.update({
          where: { projectId: project.projectId },
          data: {
            status: 'CRAWLING',
          },
        });
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
    return await this.prisma.project.findUniqueOrThrow({
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

  async updateProject(projectId: string, dto: UpdateProjectDto) {
    // should not update on invalid projectId
    if (projectId !== dto.projectId) return;
    // TODO:  Why not have this as object?
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const memberData: unknown[] = JSON.parse(dto.members ?? '[]');
    const data = {
      // NOTE: can you change name as that changes package???
      name: dto.name,
      lead: dto.lead,
      status: dto.status,
      // NOTE: can you change customId as that also changes package??
      university: dto.university,
      faculty: dto.faculty,
      ethicsId: dto.ethicsId,
      description: dto.description,
      startDate: dto.startDate,
      endDate: dto.endDate,
      lastModified: new Date(),
      participantsNum: dto.participantsNum,
      ...(memberData.length && {
        members: dto.members,
      }),
      dbKeywords: dto.dbKeywords,
    };

    // remove undefined fields
    Object.keys(data).forEach(
      (key) => data[key] === undefined && delete data[key],
    );

    // Check if connection details are updated
    const connection =
      dto.connection?.tempDbDetails !== undefined
        ? {
            connection: {
              update: {
                tempDbDetails: JSON.stringify(dto.connection.tempDbDetails),
              },
            },
          }
        : {};
    return await this.prisma.project.update({
      where: { projectId: projectId },
      data: {
        ...data,
        ...connection,
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

  async getProjectSettings(projectId: string): Promise<SettingsResponseDto> {
    const project = await this.prisma.project.findUniqueOrThrow({
      where: {
        projectId: projectId,
      },
      select: {
        visualizations: true,
      },
    });
    const bucket = 'cover';
    const key = `${projectId}/cover.jpg`;

    const cover = await this.fileStorage.getFileUrl(bucket, key);

    return {
      projectId: projectId,
      visualizations: project.visualizations,
      cover: cover ?? null,
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
    // FIXME: not sure if forcing jpg is good, it should use the ext it has been uploaded
    await this.fileStorage.putFile('cover', `${projectId}/cover.jpg`, file);
    return file.buffer;
  }

  // TODO: review this generation
  private createIds(name: string, id?: string) {
    const customId = id ?? nanoid(12);
    const packageName = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    const packageId = `${packageName}_${customId.slice(0, 6)}`;
    return { packageId, customId };
  }
}
