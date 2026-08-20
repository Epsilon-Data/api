import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
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
import { DatabaseService } from 'src/database/database.service';
import {
  buildSyntheticManifest,
  decodeUtf8Csv,
} from 'src/utils/csv-manifest.util';
import { MAX_SYNTHETIC_DATA_BYTES } from 'src/utils/options.util';

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);
  constructor(
    private prisma: PrismaService,
    private queue: QueueService,
    private fileStorage: FileStorageService,
    private readonly vaultService: VaultService,
    private readonly keycloak: KeycloakAdminService,
    private readonly database: DatabaseService,
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
  // after the archetype is published. Both attach methods (uploaded CSV or pasted
  // public link) are validated, fingerprinted with a column manifest and
  // materialised into S3 under a versioned key (syntheticDataKey) — the link is
  // just an ingest method. Researchers only ever receive a projection of it.
  private static readonly SYNTHETIC_BUCKET = 'synthetic';
  // one shared cap across upload, link materialisation and the projected
  // download — see MAX_SYNTHETIC_DATA_BYTES
  private static readonly MAX_SYNTHETIC_BYTES = MAX_SYNTHETIC_DATA_BYTES;
  private static readonly LINK_FETCH_TIMEOUT_MS = 30_000;
  private static readonly MAX_LINK_REDIRECTS = 3;

  private syntheticKey(projectId: string, version: number): string {
    return `${projectId}/v${version}/synthetic.csv`;
  }

  /** Current synthetic-dataset state for the project detail page. */
  async getSyntheticData(projectId: string): Promise<SyntheticDataResponseDto> {
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { projectId },
      select: {
        syntheticDataUrl: true,
        syntheticDataKey: true,
        syntheticDataFileName: true,
        syntheticDataColumns: true,
        syntheticDataSchemaHash: true,
        syntheticDataVersion: true,
        syntheticDataRowCount: true,
      },
    });

    if (project.syntheticDataUrl) {
      // legacy link attachment (predates materialisation) — no manifest, so
      // researchers cannot download it until the owner re-attaches
      return {
        type: 'link',
        url: project.syntheticDataUrl,
        fileName: null,
        needsReattach: true,
      };
    }
    if (project.syntheticDataKey) {
      const url = await this.fileStorage.getFileUrl(
        ProjectService.SYNTHETIC_BUCKET,
        project.syntheticDataKey,
      );
      return {
        type: 'file',
        url,
        fileName: project.syntheticDataFileName,
        ...(project.syntheticDataSchemaHash
          ? {
              schemaHash: project.syntheticDataSchemaHash,
              version: project.syntheticDataVersion,
              columns: project.syntheticDataColumns as string[],
              rowCount: project.syntheticDataRowCount ?? undefined,
            }
          : // legacy upload without a manifest — flag it so the data owner is
            // told to re-attach instead of researchers silently getting nothing
            { needsReattach: true }),
      };
    }
    return { type: 'none', url: null, fileName: null };
  }

  /**
   * Attach a synthetic dataset by public link. The CSV is fetched server-side
   * and materialised into S3 exactly like an upload (manifest, reconciliation,
   * versioned key) — syntheticDataUrl stays null, preserving the invariant.
   */
  async setSyntheticDataLink(
    projectId: string,
    url: string,
  ): Promise<SyntheticDataResponseDto> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException(`Invalid synthetic dataset URL: ${url}`);
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException(
        'Synthetic dataset URL must use http or https',
      );
    }

    // existence check before fetching the remote file
    await this.prisma.project.findUniqueOrThrow({
      where: { projectId },
      select: { projectId: true },
    });

    const csvText = await this.fetchSyntheticCsv(url);
    const fileName = parsed.pathname.split('/').at(-1) || 'synthetic.csv';
    return this.ingestSyntheticCsv(projectId, csvText, fileName, 'link');
  }

  /** Attach a synthetic dataset by uploading a CSV to S3. */
  async uploadSyntheticData(
    projectId: string,
    file: Express.Multer.File,
  ): Promise<SyntheticDataResponseDto> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    if (file.buffer.byteLength > ProjectService.MAX_SYNTHETIC_BYTES) {
      throw new BadRequestException(
        `Synthetic dataset exceeds the ${ProjectService.MAX_SYNTHETIC_BYTES / (1024 * 1024)}MB limit`,
      );
    }

    // existence check before ingesting
    await this.prisma.project.findUniqueOrThrow({
      where: { projectId },
      select: { projectId: true },
    });

    return this.ingestSyntheticCsv(
      projectId,
      // strict decode — corrupting a Latin-1 export into U+FFFD would silently
      // damage the stored object, the manifest and everything downstream
      decodeUtf8Csv(file.buffer),
      file.originalname,
      'upload',
    );
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
      // delete every stored version under the project prefix, not just the
      // current one — detaching must not leave prior version objects behind
      let keys: (string | undefined)[] = [];
      try {
        keys = await this.fileStorage.listFiles(
          ProjectService.SYNTHETIC_BUCKET,
          `${projectId}/`,
        );
      } catch (error) {
        this.logger.warn(
          `Could not list synthetic dataset versions for project ${projectId}: ${String(error)}`,
        );
      }
      const toDelete = new Set(
        keys.filter((key): key is string => Boolean(key)),
      );
      toDelete.add(project.syntheticDataKey);
      await Promise.all(
        [...toDelete].map((key) =>
          this.fileStorage.deleteFile(ProjectService.SYNTHETIC_BUCKET, key),
        ),
      );
    }

    await this.prisma.project.update({
      where: { projectId },
      data: {
        syntheticDataUrl: null,
        syntheticDataKey: null,
        syntheticDataFileName: null,
        syntheticDataColumns: Prisma.DbNull,
        syntheticDataSchemaHash: null,
        syntheticDataRowCount: null,
        // syntheticDataVersion intentionally kept — it is a monotonic counter
        lastModified: new Date(),
      },
    });

    return { type: 'none', url: null, fileName: null };
  }

  /**
   * SSRF guard for pasted synthetic dataset links: only http(s) URLs whose
   * host resolves exclusively to public addresses may be fetched. Re-run on
   * every redirect hop so a public URL cannot bounce the server into an
   * internal service or the cloud metadata endpoint.
   */
  private async assertPublicSyntheticUrl(url: string): Promise<void> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException(`Invalid synthetic dataset URL: ${url}`);
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException(
        'Synthetic dataset URL must use http or https',
      );
    }
    const hostname = parsed.hostname.replace(/^\[|\]$/g, ''); // [::1] -> ::1
    let addresses: string[];
    if (isIP(hostname)) {
      addresses = [hostname];
    } else {
      try {
        addresses = (await lookup(hostname, { all: true })).map(
          (entry) => entry.address,
        );
      } catch {
        throw new BadRequestException(
          'Could not resolve the synthetic dataset URL host',
        );
      }
    }
    if (
      addresses.length === 0 ||
      addresses.some((address) => this.isNonPublicAddress(address))
    ) {
      throw new BadRequestException(
        'Synthetic dataset URL must point to a publicly reachable host',
      );
    }
  }

  /** Loopback, private, link-local, CGNAT and unspecified ranges (v4 + v6). */
  private isNonPublicAddress(address: string): boolean {
    if (isIP(address) === 6) {
      const ip = address.toLowerCase();
      // IPv4-mapped (::ffff:10.0.0.1) — check the embedded IPv4 address
      const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip);
      if (mapped) return this.isNonPublicAddress(mapped[1]);
      return (
        ip === '::' ||
        ip === '::1' ||
        /^fe[89ab]/.test(ip) || // fe80::/10 link-local
        /^f[cd]/.test(ip) // fc00::/7 unique-local
      );
    }
    const octets = address.split('.').map(Number);
    if (octets.length !== 4 || octets.some((octet) => Number.isNaN(octet))) {
      return true;
    }
    const [a, b] = octets;
    return (
      a === 0 || // 0.0.0.0/8 "this network"
      a === 10 || // 10.0.0.0/8 private
      a === 127 || // 127.0.0.0/8 loopback
      (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 CGNAT
      (a === 169 && b === 254) || // 169.254.0.0/16 link-local / metadata
      (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12 private
      (a === 192 && b === 168) // 192.168.0.0/16 private
    );
  }

  /**
   * Follow redirects manually (bounded) so every hop — not just the pasted
   * URL — passes the SSRF guard before it is fetched.
   */
  private async fetchWithSsrfGuard(
    url: string,
    signal: AbortSignal,
  ): Promise<Response> {
    let currentUrl = url;
    for (let hop = 0; ; hop++) {
      await this.assertPublicSyntheticUrl(currentUrl);
      const response = await fetch(currentUrl, {
        signal,
        redirect: 'manual',
      });
      if (response.status < 300 || response.status >= 400) return response;
      const location = response.headers.get('location');
      if (!location || hop >= ProjectService.MAX_LINK_REDIRECTS) {
        throw new BadRequestException(
          'Could not read synthetic dataset (too many redirects)',
        );
      }
      currentUrl = new URL(location, currentUrl).toString();
    }
  }

  /**
   * Fetch a pasted synthetic dataset link server-side, with a timeout and a
   * hard size cap so we never buffer an unbounded remote file.
   */
  private async fetchSyntheticCsv(url: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      ProjectService.LINK_FETCH_TIMEOUT_MS,
    );
    try {
      const response = await this.fetchWithSsrfGuard(url, controller.signal);
      if (!response.ok || !response.body) {
        throw new BadRequestException(
          `Could not read synthetic dataset (HTTP ${response.status})`,
        );
      }
      const chunks: Buffer[] = [];
      let bytes = 0;
      for await (const chunk of response.body) {
        const buf = Buffer.isBuffer(chunk)
          ? chunk
          : Buffer.from(chunk as Uint8Array);
        bytes += buf.byteLength;
        if (bytes > ProjectService.MAX_SYNTHETIC_BYTES) {
          throw new BadRequestException(
            `Synthetic dataset link exceeds the ${ProjectService.MAX_SYNTHETIC_BYTES / (1024 * 1024)}MB limit`,
          );
        }
        chunks.push(buf);
      }
      return decodeUtf8Csv(Buffer.concat(chunks));
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      // log the detail server-side but keep the response generic — echoing
      // fetch errors would hand a project editor a port-scanning oracle
      this.logger.warn(
        `Could not fetch synthetic dataset link ${url}: ${String(error)}`,
      );
      throw new BadRequestException(
        'Could not fetch synthetic dataset link — check that it is a publicly reachable CSV and try again',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Shared attach path: build the column manifest, reconcile it against the
   * crawled Atlas schema, store the CSV under a new versioned key (prior
   * version objects are kept until detach — cheap provenance) and persist the
   * manifest. The version is reserved with an atomic increment so concurrent
   * attaches can never share an S3 key, and the final manifest write is
   * guarded so the stored manifest always describes the object at
   * syntheticDataKey — a lost race gets a 409 instead of silently clobbering.
   */
  private async ingestSyntheticCsv(
    projectId: string,
    csvText: string,
    fileName: string,
    source: 'upload' | 'link',
  ): Promise<SyntheticDataResponseDto> {
    const manifest = buildSyntheticManifest(csvText);
    await this.reconcileSyntheticColumns(projectId, manifest.columns, source);

    // atomically reserve the next version — concurrent attaches each get
    // their own key (the counter is monotonic; gaps from failed attaches are fine)
    const { syntheticDataVersion: version } = await this.prisma.project.update({
      where: { projectId },
      data: { syntheticDataVersion: { increment: 1 } },
      select: { syntheticDataVersion: true },
    });
    const key = this.syntheticKey(projectId, version);
    await this.fileStorage.createBucketIfNotExists(
      ProjectService.SYNTHETIC_BUCKET,
    );
    await this.fileStorage.putFile(ProjectService.SYNTHETIC_BUCKET, key, {
      buffer: Buffer.from(csvText, 'utf8'),
      mimetype: 'text/csv',
    } as Express.Multer.File);

    // persist the manifest only while this is still the newest reservation
    const updated = await this.prisma.project.updateMany({
      where: { projectId, syntheticDataVersion: version },
      data: {
        syntheticDataKey: key,
        syntheticDataFileName: fileName,
        syntheticDataUrl: null,
        syntheticDataColumns: manifest.columns,
        syntheticDataSchemaHash: manifest.schemaHash,
        syntheticDataRowCount: manifest.rowCount,
        lastModified: new Date(),
      },
    });
    if (updated.count === 0) {
      throw new ConflictException(
        'The synthetic dataset was attached concurrently by another request — retry if this version should win',
      );
    }

    const url = await this.fileStorage.getFileUrl(
      ProjectService.SYNTHETIC_BUCKET,
      key,
    );
    return {
      type: 'file',
      url,
      fileName,
      schemaHash: manifest.schemaHash,
      version,
      columns: manifest.columns,
      rowCount: manifest.rowCount,
    };
  }

  /**
   * Reject a CSV whose headers share nothing with the crawled schema. Soft —
   * data owners are not blocked when the project has no crawled columns or
   * Atlas is unavailable.
   */
  private async reconcileSyntheticColumns(
    projectId: string,
    headers: string[],
    source: 'upload' | 'link',
  ): Promise<void> {
    let known: { name: string }[];
    try {
      known = await this.database.columns(projectId);
    } catch (error) {
      this.logger.warn(
        `Skipping synthetic dataset reconciliation for project ${projectId}: Atlas unavailable (${String(error)})`,
      );
      return;
    }
    if (known.length === 0) return; // project not crawled (yet) — nothing to check
    const knownNames = new Set(known.map((column) => column.name));
    if (!headers.some((header) => knownNames.has(header))) {
      // never echo fetched content back for link ingests — the header list is
      // the first line of whatever the URL actually returned
      const columnList = source === 'upload' ? ` (${headers.join(', ')})` : '';
      throw new BadRequestException(
        `None of the CSV columns${columnList} match this project's crawled database schema — check that the CSV corresponds to this project`,
      );
    }
  }
}
