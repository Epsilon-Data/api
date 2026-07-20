import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  BrowseProjectsQueryDto,
  CreateProjectDto,
  PaginationQueryDto,
  ProjectDetailsResponseDto,
  ProjectRequestsResponse,
  ProjectRequestsResponseDto,
  SettingsDto,
  SettingsResponseDto,
  SyntheticDataResponseDto,
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

  private buildPaginationOrderBy(
    sort: PaginationQueryDto['sort'],
  ): Prisma.ProjectOrderByWithRelationInput {
    return sort === 'title'
      ? { name: 'asc' }
      : sort === 'last-modified'
        ? { lastModified: 'desc' }
        : { createdDate: 'desc' };
  }

  private readonly projectSummarySelect = {
    projectId: true,
    name: true,
    lastModified: true,
    status: true,
    university: true,
    lead: true,
    faculty: true,
    createdDate: true,
  } as const;

  // Queries
  async getUserOwnedProjects(userId: string, query: PaginationQueryDto = {}) {
    const { page = 1, limit = 12, sort = 'date-created', search } = query;

    const where: Prisma.ProjectWhereInput = {
      ownerId: userId,
      ...(search && { name: { contains: search, mode: 'insensitive' } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        orderBy: this.buildPaginationOrderBy(sort),
        skip: (page - 1) * limit,
        take: limit,
        select: this.projectSummarySelect,
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getUserSharedProjects(
    permissions: KeycloakPermissionDto[],
    query: PaginationQueryDto = {},
  ) {
    const { page = 1, limit = 12, sort = 'date-created', search } = query;

    const uuids = permissions
      .filter(
        (item) =>
          item.scopes.includes('view') && !item.scopes.includes('delete'),
      )
      .map((item) => item.rsname.split(':').at(1)!);

    const where: Prisma.ProjectWhereInput = {
      projectId: { in: uuids },
      ...(search && { name: { contains: search, mode: 'insensitive' } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        orderBy: this.buildPaginationOrderBy(sort),
        skip: (page - 1) * limit,
        take: limit,
        select: this.projectSummarySelect,
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getAllProjects(query: BrowseProjectsQueryDto = {}) {
    const {
      page = 1,
      limit = 12,
      search,
      field = 'all',
      sort = 'date-created',
    } = query;

    const baseWhere: Prisma.ProjectWhereInput = {
      status: { in: ['MAPPED'] },
      isPublic: true,
    };

    const searchWhere: Prisma.ProjectWhereInput | undefined = search
      ? field === 'name'
        ? { name: { contains: search, mode: 'insensitive' } }
        : field === 'keywords'
          ? { dbKeywords: { hasSome: [search] } }
          : field === 'organisation'
            ? {
                OR: [
                  { university: { contains: search, mode: 'insensitive' } },
                  { faculty: { contains: search, mode: 'insensitive' } },
                ],
              }
            : {
                OR: [
                  { name: { contains: search, mode: 'insensitive' } },
                  { university: { contains: search, mode: 'insensitive' } },
                  { faculty: { contains: search, mode: 'insensitive' } },
                  { dbKeywords: { hasSome: [search] } },
                ],
              }
      : undefined;

    const where: Prisma.ProjectWhereInput = {
      ...baseWhere,
      ...(searchWhere && { AND: [searchWhere] }),
    };

    const orderBy: Prisma.ProjectOrderByWithRelationInput =
      sort === 'title'
        ? { name: 'asc' }
        : sort === 'last-modified'
          ? { lastModified: 'desc' }
          : { createdDate: 'desc' };

    const [data, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          projectId: true,
          name: true,
          lastModified: true,
          createdDate: true,
          university: true,
          faculty: true,
          dbKeywords: true,
          isPublic: true,
        },
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
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
        projectId: projectId,
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
        isPublic: true,
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
      isPublic: projectInfo.isPublic,
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
    const connectionType = (dto.connectionType ?? 'CLOUD_CONNECT') as
      | 'CLOUD_CONNECT'
      | 'DIRECT_DB'
      | 'PROXY';

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
      connectionType,

      ...(members && {
        members,
      }),
      dbKeywords: dto.dbKeywords,
      ...(dto.isPublic !== undefined && { isPublic: dto.isPublic }),
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

    const memberEmails = [
      ...new Set(dto.members.flatMap((m) => (m.email ? [m.email] : []))),
    ].filter((email) => email !== user.email);

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
    } else if (connectionType === 'PROXY') {
      // Proxy mode: no credentials needed, no crawling
      // Data owner will install epsilon-proxy and register it later
      this.logger.log(
        `Project ${project.projectId} created with PROXY connection type — awaiting proxy registration`,
      );
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
      ...(dto.isPublic !== undefined && {
        isPublic: dto.isPublic,
      }),
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
    // delete keycloak resource first — if this fails, project stays intact
    await this.keycloak.auth();
    await this.keycloak.deleteResource(projectId);
    // queue Atlas cleanup (fire-and-forget, retries on its own)
    await this.queue.deleteProjectAtlasJob(projectId);
    // delete project information
    await this.prisma.project.delete({
      where: {
        projectId: projectId,
      },
      include: {
        connection: true,
        analysis: true,
      },
    });
    return;
  }

  async retryCrawl(user: CurrentUserInfo, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { projectId },
      select: { status: true, connectionType: true },
    });

    if (!project) throw new NotFoundException('Project not found');
    if (!['ERROR', 'CRAWLING'].includes(project.status)) {
      throw new BadRequestException(
        `Cannot retry crawl for project with status ${project.status}`,
      );
    }

    // For PROXY projects: reset to PENDING so proxy's heartbeat triggers re-crawl
    if (project.connectionType === 'PROXY') {
      await this.prisma.project.update({
        where: { projectId },
        data: { status: 'PENDING' },
      });
      this.logger.log(
        `Retry crawl for PROXY project ${projectId}: reset to PENDING`,
      );
      return { status: 'pending', message: 'Waiting for proxy to re-crawl' };
    }

    // resubmit using existing job data from Redis
    try {
      const { jobId } = await this.queue.retryCrawlJob(
        projectId,
        user.username,
      );

      // only set CRAWLING after job is successfully queued
      await this.prisma.project.update({
        where: { projectId },
        data: { status: 'CRAWLING' },
      });

      this.logger.log(`Retry crawl for project ${projectId}, jobId: ${jobId}`);
      return { jobId };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to retry crawl',
      );
    }
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

  // ---- Synthetic dataset ----
  // A project can have at most one synthetic dataset, attached by the data owner
  // after the archetype is published. It is either a pasted public link
  // (syntheticDataUrl) or an uploaded CSV stored in S3 (syntheticDataKey). The SDK
  // downloads it in place of generating dummy data.
  private static readonly SYNTHETIC_BUCKET = 'synthetic';

  private syntheticKey(projectId: string): string {
    return `${projectId}/synthetic.csv`;
  }

  /** Current synthetic-dataset state for the project detail page. */
  async getSyntheticData(projectId: string): Promise<SyntheticDataResponseDto> {
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { projectId },
      select: {
        syntheticDataUrl: true,
        syntheticDataKey: true,
        syntheticDataFileName: true,
      },
    });

    if (project.syntheticDataUrl) {
      return { type: 'link', url: project.syntheticDataUrl, fileName: null };
    }
    if (project.syntheticDataKey) {
      const url = await this.fileStorage.getFileUrl(
        ProjectService.SYNTHETIC_BUCKET,
        project.syntheticDataKey,
      );
      return { type: 'file', url, fileName: project.syntheticDataFileName };
    }
    return { type: 'none', url: null, fileName: null };
  }

  /** Attach a synthetic dataset by public link; clears any previous upload. */
  async setSyntheticDataLink(
    projectId: string,
    url: string,
  ): Promise<SyntheticDataResponseDto> {
    // Remove a previously uploaded object so we don't leak orphaned S3 files.
    const existing = await this.prisma.project.findUniqueOrThrow({
      where: { projectId },
      select: { syntheticDataKey: true },
    });
    if (existing.syntheticDataKey) {
      await this.fileStorage.deleteFile(
        ProjectService.SYNTHETIC_BUCKET,
        existing.syntheticDataKey,
      );
    }

    await this.prisma.project.update({
      where: { projectId },
      data: {
        syntheticDataUrl: url,
        syntheticDataKey: null,
        syntheticDataFileName: null,
        lastModified: new Date(),
      },
    });

    return { type: 'link', url, fileName: null };
  }

  /** Attach a synthetic dataset by uploading a CSV to S3; clears any previous link. */
  async uploadSyntheticData(
    projectId: string,
    file: Express.Multer.File,
  ): Promise<SyntheticDataResponseDto> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    await this.prisma.project.findUniqueOrThrow({
      where: { projectId },
      select: { projectId: true },
    });

    const key = this.syntheticKey(projectId);
    await this.fileStorage.createBucketIfNotExists(
      ProjectService.SYNTHETIC_BUCKET,
    );
    await this.fileStorage.putFile(ProjectService.SYNTHETIC_BUCKET, key, file);

    await this.prisma.project.update({
      where: { projectId },
      data: {
        syntheticDataKey: key,
        syntheticDataFileName: file.originalname,
        syntheticDataUrl: null,
        lastModified: new Date(),
      },
    });

    const url = await this.fileStorage.getFileUrl(
      ProjectService.SYNTHETIC_BUCKET,
      key,
    );
    return { type: 'file', url, fileName: file.originalname };
  }

  /** Detach the synthetic dataset (link or upload). */
  async removeSyntheticData(
    projectId: string,
  ): Promise<SyntheticDataResponseDto> {
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { projectId },
      select: { syntheticDataKey: true },
    });
    if (project.syntheticDataKey) {
      await this.fileStorage.deleteFile(
        ProjectService.SYNTHETIC_BUCKET,
        project.syntheticDataKey,
      );
    }

    await this.prisma.project.update({
      where: { projectId },
      data: {
        syntheticDataUrl: null,
        syntheticDataKey: null,
        syntheticDataFileName: null,
        lastModified: new Date(),
      },
    });

    return { type: 'none', url: null, fileName: null };
  }
}
