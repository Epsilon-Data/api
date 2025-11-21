import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
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
import {
  ConnectionRequestResponseDto,
  DatabaseInfoDto,
} from 'src/connection_request/dto';
import { AnalysisRequestResponseDto } from 'src/analysis_request/dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);
  constructor(
    private prisma: PrismaService,
    private queue: QueueService,
    private fileStorage: FileStorageService,
    private readonly keycloak: KeycloakAdminService,
  ) {}

  // Queries
  async getUserOwnedProjects(userId: string): Promise<ProjectSummaryInfoDto[]> {
    return await this.prisma.project.findMany({
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
    return await this.prisma.project.findMany({
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

  async getProjectDetails(
    projectId: string,
  ): Promise<ProjectDetailsResponseDto> {
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

  async getProjectPublicDetails(
    projectId: string,
  ): Promise<ProjectDetailsResponseDto> {
    const projectInfo = await this.prisma.project.findUniqueOrThrow({
      where: {
        projectId: projectId,
      },
      select: {
        projectId: true,
        status: true,
        customId: true,
        ownerId: true,
        name: true,
        lead: true,
        university: true,
        faculty: true,
        ethicsId: true,
        description: true,
        startDate: true,
        endDate: true,
        participantsNum: true,
        members: true, // TODO: these need to be names not emails
        lastModified: true,
        dbKeywords: true,
        createdDate: true,
        connection: {
          select: {
            tempDbDetails: true, // TODO: need to move database and nature out from there
          },
        },
      },
    });
    if (!projectInfo) {
      // Nest will automatically turn this into a 404 JSON response
      throw new NotFoundException(`Project with ID '${projectId}' not found`);
    }
    // TODO: get member names from keycloak
    // const members = projectInfo.members as string[];
    // if (members.length)

    const { name, type } =
      projectInfo.connection?.tempDbDetails &&
      typeof projectInfo.connection?.tempDbDetails === 'object'
        ? (projectInfo.connection?.tempDbDetails as Partial<DatabaseInfoDto>)
        : {};
    return {
      projectId: projectInfo.projectId,
      status: projectInfo.status,
      customId: projectInfo.customId,
      ownerId: projectInfo.ownerId,
      name: projectInfo.name,
      lead: projectInfo.lead,
      university: projectInfo.university,
      faculty: projectInfo.faculty,
      ethicsId: projectInfo.ethicsId,
      description: projectInfo.description,
      startDate: projectInfo.startDate,
      endDate: projectInfo.endDate,
      participantsNum: projectInfo.participantsNum,
      dbKeywords: projectInfo.dbKeywords,
      members: projectInfo.members,
      // TODO: need to fix these things
      connection: {
        tempDbDetails: { name, type },
      },
    };
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

  // Commands
  async createProject(user: CurrentUserInfo, dto: CreateProjectDto) {
    const { packageId, customId } = this.createIds(dto.name, dto.customId);
    const ownerId = user.id; //using current logged in user details rather than post
    // check if members are added
    const members = dto.members
      ? (dto.members as unknown as Prisma.JsonArray)
      : undefined;
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

      ...(members && {
        members,
      }),
      dbKeywords: dto.dbKeywords,
    };

    // check if database credential request is needed
    const createRequest = dto.connection.orgAdminEmail ? true : false;
    const requestId = uuidv4();
    // check if any DB temp details
    const tempDbDetails = dto.connection.tempDbDetails
      ? (dto.connection.tempDbDetails as unknown as Prisma.JsonObject)
      : undefined;
    const project = await this.prisma.project.create({
      data: {
        ...request,
        connection: {
          create: {
            // if no orgAdminEmail provider make owner admin
            orgAdminEmail: dto.connection.orgAdminEmail ?? user.email,
            tempDbDetails,
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

    const memberEmails = dto.members.flatMap((m) => (m.email ? [m.email] : []));

    // add keycloak resource
    // TODO: better error handling
    void this.keycloak.newResource(
      project.projectId,
      project.ownerId,
      memberEmails.length ? memberEmails : undefined,
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

  async updateProject(projectId: string, dto: UpdateProjectDto) {
    // should not update on invalid projectId
    if (projectId !== dto.projectId)
      throw new BadRequestException(`Update projectIds do not match`);
    const members = dto.members
      ? (dto.members as unknown as Prisma.JsonArray)
      : undefined;
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
      ...(members && {
        members,
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
                tempDbDetails: dto.connection
                  .tempDbDetails as unknown as Prisma.JsonObject,
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

  async updateProjectSettings(projectId: string, dto: SettingsDto) {
    if (projectId !== dto.projectId)
      throw new BadRequestException(`Update projectIds do not match`);
    if (dto.visualizations) {
      // nothing to update
      await this.prisma.project.update({
        where: {
          projectId: projectId,
        },
        data: {
          visualizations: dto.visualizations as unknown as Prisma.JsonArray,
        },
      });

      // TODO: check this
      await this.fileStorage.deleteFile('cover', `${projectId}`);
    }
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
