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
  ProjectRequestsResponseDto,
  ProjectSummaryInfoDto,
  SettingsDto,
  SettingsResponseDto,
  UpdateCredentialsDto,
  UpdateProjectDto,
} from './dto';
import { FileStorageService } from 'src/file-storage/file_storage.service';
import { QueueService } from 'src/queue/queue.service';

import { KeycloakPermissionDto } from 'src/auth/dto';
import { CurrentUserInfo } from 'src/common/decorators/user.decorator';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseInfoDto } from 'src/connection-request/dto';
import { Prisma } from 'src/generated/prisma/client';
import { VaultService } from 'src/vault/vault.service';
import { KeycloakAdminService } from 'src/admin/keycloak/keycloak-admin.service';

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);
  constructor(
    private prisma: PrismaService,
    private queue: QueueService,
    private fileStorage: FileStorageService,
    private readonly vaultService: VaultService,
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
        name: true,
        lastModified: true,
        status: true,
        university: true,
        lead: true,
        faculty: true,
        createdDate: true,
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
        name: true,
        lastModified: true,
        createdDate: true,
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
        name: true,
        lastModified: true,
        createdDate: true,
        university: true,
        faculty: true,
        dbKeywords: true,
      },
    });
  }

  async getProjectRequests(
    projectId: string,
    userId: string,
    email: string,
  ): Promise<ProjectRequestsResponse> {
    const requestList: {
      connection: ProjectRequestsResponseDto[];
      analysis: ProjectRequestsResponseDto[];
    } = {
      connection: [],
      analysis: [],
    };
    const connections = await this.prisma.connection.findMany({
      where: {
        orgAdminEmail: email,
        projectId: projectId,
      },
      select: {
        project: {
          select: {
            name: true,
            lead: true,
            university: true,
          },
        },
        requestId: true,
        request: {
          select: {
            requestorId: true,
            status: true,
            createdDate: true,
          },
        },
      },
    });

    const analyses = await this.prisma.analysis.findMany({
      where: {
        project: {
          ownerId: userId,
        },
      },
      select: {
        requestId: true,
        requestorName: true,
        requestorEmail: true,
        requestorOrgName: true,
        projectName: true,
        request: {
          select: {
            requestorId: true,
            status: true,
            createdDate: true,
          },
        },
      },
    });

    const analysisDetailsMap = new Map<
      string,
      { name: string; email: string }
    >();

    for (const a of analyses) {
      const requestorId = a.request.requestorId;
      if (!requestorId) continue;

      analysisDetailsMap.set(requestorId, {
        name: a.requestorName ?? null,
        email: a.requestorEmail ?? null,
      });
    }

    const idsNeedingKeycloak = new Set<string>();

    for (const c of connections) {
      const requestorId = c.request?.requestorId;
      if (!requestorId) continue;

      if (!analysisDetailsMap.has(requestorId)) {
        idsNeedingKeycloak.add(requestorId);
      }
    }

    const keycloakMap = new Map<string, { name: string; email: string }>();

    // re-auth with keycloak
    if (idsNeedingKeycloak.size > 0) {
      await this.keycloak.auth();
    }

    await Promise.all(
      Array.from(idsNeedingKeycloak).map(async (id) => {
        const user = await this.keycloak.getUserById(id);
        if (!user) return;

        const firstName = user.firstName ?? '';
        const lastName = user.lastName ?? '';
        const name =
          (firstName + ' ' + lastName).trim() || user.username || '-';
        const email = user.email ?? '-';

        keycloakMap.set(id, {
          name,
          email,
        });
      }),
    );
    const getRequestorDetails = (
      requestorId: string,
    ): { name: string; email: string } => {
      const fromAnalysis = analysisDetailsMap.get(requestorId);
      if (fromAnalysis) return fromAnalysis;

      const fromKeycloak = keycloakMap.get(requestorId);
      if (fromKeycloak) return fromKeycloak;

      return { name: '-', email: '-' };
    };

    requestList.analysis = analyses.map((a) => {
      const requestorId = a.request.requestorId;
      const details = getRequestorDetails(requestorId);

      return {
        requestId: a.requestId,
        projectName: a.projectName,
        status: a.request.status,
        requestorName: details.name,
        requestorEmail: details.email,
        requestorOrgName: a.requestorOrgName,
        createdDate: a.request.createdDate,
      };
    });

    requestList.connection = connections
      .map((c) => {
        const requestorId = c.request?.requestorId;
        if (requestorId) {
          const details = getRequestorDetails(requestorId);

          return {
            requestId: c.requestId,
            projectName: c.project.name,
            status: c.request?.status || 'PENDING',
            requestorName: c.project.lead,
            requestorEmail: details.email,
            requestorOrgName: c.project.university,
            createdDate: c.request?.createdDate,
          };
        }
        return undefined;
      })
      .filter((item): item is ProjectRequestsResponseDto => item !== undefined);

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
      },
    });
    if (!projectInfo) {
      // Nest will automatically turn this into a 404 JSON response
      throw new NotFoundException(`Project with ID '${projectId}' not found`);
    }
    // TODO: get member names from keycloak
    // const members = projectInfo.members as string[];
    // if (members.length)
    return {
      projectId: projectInfo.projectId,
      status: projectInfo.status,
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
  async createProject(
    user: CurrentUserInfo,
    dto: CreateProjectDto,
    accessToken: string,
  ) {
    const ownerId = user.id; //using current logged in user details rather than post
    // check if members are added
    const members = dto.members
      ? (dto.members as unknown as Prisma.JsonArray)
      : undefined;
    const request = {
      ownerId,
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

    const project = await this.prisma.project.create({
      data: {
        ...request,
        connection: {
          create: {
            // if no orgAdminEmail provider make owner admin
            orgAdminEmail: dto.connection.orgAdminEmail ?? user.email,
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
    await this.queue.addResourceJob(
      project.projectId,
      project.ownerId,
      memberEmails.length ? memberEmails : undefined,
      project.connection?.orgAdminEmail ?? undefined,
    );

    if (createRequest) {
      // create comment if additionalInfo is provided to request
      if (dto.connection.additionalInfo) {
        await this.prisma.comment.create({
          data: {
            requestId,
            authorId: ownerId,
            authorName: `${user.given_name} ${user.family_name}`,
            content: dto.connection.additionalInfo,
          },
        });
      }
    } else {
      // database credentials should exist so run database crawling
      if (dto.connection.dbDetails?.url) {
        await this.addSecrets(
          accessToken,
          project.projectId,
          dto.connection.dbDetails,
        );
        await this.prisma.project.update({
          where: { projectId: project.projectId },
          data: {
            status: 'CRAWLING',
          },
        });
        await this.queue.dataBrokerJob(
          user.id,
          project.projectId,
          requestId,
          dto.connection.dbDetails,
        );
      }
    }
    // just return, no content
    return;
  }

  async updateProject(
    projectId: string,
    dto: UpdateProjectDto,
    accessToken: string,
  ) {
    // should not update on invalid projectId
    if (projectId !== dto.projectId)
      throw new BadRequestException(`Update projectIds do not match`);
    const members = dto.members
      ? (dto.members as unknown as Prisma.JsonArray)
      : undefined;
    const data = {
      name: dto.name,
      lead: dto.lead,
      status: dto.status,
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
    if (dto.connection?.dbDetails) {
      await this.addSecrets(
        accessToken,
        dto.projectId,
        dto.connection.dbDetails,
      );
    }

    return await this.prisma.project.update({
      where: { projectId: projectId },
      data: {
        ...data,
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

  async updateCredentials(
    user: CurrentUserInfo,
    projectId: string,
    dto: UpdateCredentialsDto,
    accessToken: string,
  ) {
    const requestInfo = await this.prisma.connection.findFirst({
      where: { projectId },
      select: { requestId: true },
    });

    const requestId = requestInfo?.requestId;

    if (dto.dbDetails?.url && requestId) {
      await this.vaultService.runConnectionFlow(
        user,
        projectId,
        requestId,
        dto.dbDetails,
        accessToken,
      );
    }

    return;
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

  private async addSecrets(
    accessToken: string,
    projectId: string,
    dbDetails: DatabaseInfoDto,
  ) {
    // add secrets
    const token = await this.vaultService.auth(accessToken);

    // encrypt with transit (user token only needs encrypt)
    const ciphertext = await this.vaultService.transitEncrypt(
      token,
      'connector-db',
      {
        ...dbDetails,
      },
    );
    // store project-scoped copy for Coordinator (EC2)
    await this.vaultService.writeProjectCiphertext(
      token,
      projectId,
      ciphertext,
    );
  }
}
