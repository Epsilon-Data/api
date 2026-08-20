/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { Readable } from 'stream';
import { ProjectService } from './project.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueueService } from 'src/queue/queue.service';
import { FileStorageService } from 'src/file-storage/file_storage.service';
import { KeycloakAdminService } from 'src/admin/keycloak/keycloak-admin.service';
import { DatabaseService } from 'src/database/database.service';
import { Prisma, RequestStatus } from 'src/generated/prisma/client';
import { SettingsDto, UpdateCredentialsDto } from './dto';
import { NotFoundException } from '@nestjs/common/exceptions';
import { VaultService } from 'src/vault/vault.service';
import { CurrentUserInfo } from 'src/common/decorators/user.decorator';
import { computeSchemaHash } from 'src/utils/csv-manifest.util';
import { lookup } from 'node:dns/promises';

// mock nanoid + uuid to make tests deterministic
jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => 'mockedCustomId12'),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mocked-request-id'),
}));

// mock DNS so the synthetic-link SSRF guard resolves deterministically
jest.mock('node:dns/promises', () => ({
  lookup: jest.fn(),
}));

describe('ProjectService', () => {
  let service: ProjectService;

  const prismaMock = {
    project: {
      findMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    connection: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    analysis: {
      findMany: jest.fn(),
    },
    comment: {
      create: jest.fn(),
    },
  } as unknown as PrismaService;

  const queueMock = {
    dataBrokerJob: jest.fn(),
    addResourceJob: jest.fn(),
    deleteProjectAtlasJob: jest.fn(),
  } as unknown as QueueService;

  const fileStorageMock = {
    getFileUrl: jest.fn(),
    deleteFile: jest.fn(),
    putFile: jest.fn(),
    createBucketIfNotExists: jest.fn(),
    listFiles: jest.fn(),
  } as unknown as FileStorageService;

  const keycloakMock = {
    newResource: jest.fn(),
    auth: jest.fn(),
    getUserById: jest.fn(),
    deleteResource: jest.fn(),
  } as unknown as KeycloakAdminService;

  const vaultMock = {
    auth: jest.fn(),
    transitEncrypt: jest.fn(),
    writeProjectCiphertext: jest.fn(),
    runConnectionFlow: jest.fn(),
  } as unknown as VaultService;

  const databaseMock = {
    columns: jest.fn(),
  } as unknown as DatabaseService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: QueueService, useValue: queueMock },
        { provide: FileStorageService, useValue: fileStorageMock },
        { provide: KeycloakAdminService, useValue: keycloakMock },
        { provide: VaultService, useValue: vaultMock },
        { provide: DatabaseService, useValue: databaseMock },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
  });

  describe('getUserOwnedProjects', () => {
    it('should return paginated projects for given ownerId', async () => {
      const userId = 'user-123';
      const projects = [
        {
          projectId: 'p1',
          name: 'Project 1',
          lastModified: new Date(),
          createdDate: new Date(),
          status: 'MAPPED',
          university: 'Uni',
          lead: 'Lead',
          faculty: 'Faculty',
        },
      ];
      (prismaMock.project.findMany as jest.Mock).mockResolvedValue(projects);
      (prismaMock.project.count as jest.Mock).mockResolvedValue(1);

      const result = await service.getUserOwnedProjects(userId);

      expect(prismaMock.project.findMany).toHaveBeenCalledWith({
        where: { ownerId: userId },
        orderBy: { createdDate: 'desc' },
        skip: 0,
        take: 12,
        select: {
          projectId: true,
          name: true,
          lastModified: true,
          createdDate: true,
          status: true,
          university: true,
          lead: true,
          faculty: true,
        },
      });
      expect(prismaMock.project.count).toHaveBeenCalledWith({
        where: { ownerId: userId },
      });
      expect(result).toEqual({
        data: projects,
        pagination: { page: 1, limit: 12, total: 1, totalPages: 1 },
      });
    });
  });

  describe('getUserSharedProjects', () => {
    it('should filter permissions and return matching projects', async () => {
      const permissions = [
        {
          rsname: 'project:p1',
          scopes: ['view'],
          rsid: 'id1',
        },
        {
          rsname: 'project:p2',
          scopes: ['view', 'delete'], // should be excluded as it's owned by user
          rsid: 'id2',
        },
        {
          rsname: 'project:p3',
          scopes: ['view'],
          rsid: 'id3',
        },
      ];

      const projects = [
        {
          projectId: 'p1',
          name: 'Project 1',
          lastModified: new Date(),
          status: 'MAPPED',
          university: 'Uni',
          faculty: 'Faculty',
          lead: 'Lead',
        },
        {
          projectId: 'p3',
          name: 'Project 3',
          lastModified: new Date(),
          status: 'MAPPED',
          university: 'Uni',
          faculty: 'Faculty',
          lead: 'Lead',
        },
      ];

      (prismaMock.project.findMany as jest.Mock).mockResolvedValue(projects);
      (prismaMock.project.count as jest.Mock).mockResolvedValue(2);

      const result = await service.getUserSharedProjects(permissions);

      expect(prismaMock.project.findMany).toHaveBeenCalledWith({
        where: {
          projectId: {
            in: ['p1', 'p3'],
          },
        },
        orderBy: { createdDate: 'desc' },
        skip: 0,
        take: 12,
        select: {
          projectId: true,
          name: true,
          createdDate: true,
          lastModified: true,
          lead: true,
          status: true,
          university: true,
          faculty: true,
        },
      });
      expect(result).toEqual({
        data: projects,
        pagination: { page: 1, limit: 12, total: 2, totalPages: 1 },
      });
    });
  });

  describe('getAllProjects', () => {
    it('should return all mapped projects', async () => {
      const projects = [
        {
          projectId: 'p1',
          name: 'Project 1',
          lastModified: new Date(),
          createdDate: new Date(),
          university: 'Uni',
          faculty: 'Faculty',
        },
      ];

      (prismaMock.project.findMany as jest.Mock).mockResolvedValue(projects);
      (prismaMock.project.count as jest.Mock).mockResolvedValue(1);

      const result = await service.getAllProjects();

      expect(prismaMock.project.findMany).toHaveBeenCalledWith({
        where: {
          status: {
            in: ['MAPPED'],
          },
          isPublic: true,
        },
        orderBy: { createdDate: 'desc' },
        skip: 0,
        take: 12,
        select: {
          projectId: true,
          name: true,
          lastModified: true,
          createdDate: true,
          dbKeywords: true,
          university: true,
          faculty: true,
          isPublic: true,
        },
      });
      expect(result).toEqual({
        data: projects,
        pagination: { page: 1, limit: 12, total: 1, totalPages: 1 },
      });
    });
  });

  describe('getProjectRequests', () => {
    it('should return connection and analysis requests', async () => {
      const projectId = 'proj-1';
      const userId = 'owner-1';
      const email = 'admin@example.com';

      const now = new Date();

      const connectionRequests = [
        {
          requestId: 'conn-1',
          project: {
            name: 'Project 1',
            lead: 'Alice Analysis',
            university: 'Org A',
          },
          request: {
            requestorId: 'user-a',
            status: RequestStatus.PENDING,
            createdDate: now,
          },
        },
      ];

      const analysisRequests = [
        {
          requestId: 'anal-1',
          requestorName: 'Alice Analysis',
          requestorEmail: 'alice@example.com',
          requestorOrgName: 'Org A',
          projectName: 'Project 1',
          request: {
            requestorId: 'user-a',
            status: RequestStatus.APPROVED,
            createdDate: now,
          },
        },
      ];

      (prismaMock.connection.findMany as jest.Mock).mockResolvedValue(
        connectionRequests,
      );
      (prismaMock.analysis.findMany as jest.Mock).mockResolvedValue(
        analysisRequests,
      );

      (keycloakMock.getUserById as jest.Mock).mockResolvedValue(null);

      const result = await service.getProjectRequests(projectId, userId, email);

      expect(prismaMock.connection.findMany).toHaveBeenCalledWith({
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

      expect(prismaMock.analysis.findMany).toHaveBeenCalledWith({
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

      expect(result).toEqual({
        connection: [
          {
            requestId: 'conn-1',
            projectName: 'Project 1',
            status: RequestStatus.PENDING,
            requestorName: 'Alice Analysis',
            requestorEmail: 'alice@example.com',
            requestorOrgName: 'Org A',
            createdDate: now,
          },
        ],
        analysis: [
          {
            requestId: 'anal-1',
            projectName: 'Project 1',
            status: RequestStatus.APPROVED,
            requestorName: 'Alice Analysis',
            requestorEmail: 'alice@example.com',
            requestorOrgName: 'Org A',
            createdDate: now,
          },
        ],
      });
    });
  });

  describe('createProject', () => {
    // user mock
    const user = {
      email: 'owner@example.com',
      username: 'owner-user',
      given_name: 'Owner',
      family_name: 'User',
      id: 'user1',
    };

    it('should create project, create keycloak resource and comment when orgAdminEmail defined', async () => {
      // create dto mock
      const dto = {
        name: 'My Project',
        lead: 'Lead Name',
        university: 'Uni',
        faculty: 'Faculty',
        ethicsId: 'ETH-123',
        description: 'Desc',
        startDate: new Date(),
        endDate: new Date(),
        participantsNum: 10,
        members: [{ email: 'member1@example.com', role: 'collaborator' }],
        dbKeywords: ['keyword1', 'keyword2'],
        connection: {
          orgAdminEmail: 'admin@example.com',
          additionalInfo: 'Please approve quickly',
        },
      };
      (prismaMock.project.create as jest.Mock).mockResolvedValue({
        projectId: 'proj-1',
        ownerId: user.id,
        connection: {
          request: {
            requestId: 'mocked-request-id',
          },
        },
      });

      await service.createProject(user, dto, 'test-token');

      expect(prismaMock.project.create).toHaveBeenCalled();
      expect(prismaMock.comment.create).toHaveBeenCalledWith({
        data: {
          requestId: 'mocked-request-id',
          authorId: user.id,
          authorName: `${user.given_name} ${user.family_name}`,
          content: dto.connection.additionalInfo,
        },
      });
      expect(queueMock.dataBrokerJob).not.toHaveBeenCalled();
    });

    it('should trigger dataBrokerJob when no orgAdminEmail and dbDetails.url present', async () => {
      // create dto mock
      const dto = {
        name: 'My Project',
        lead: 'Lead Name',
        university: 'Uni',
        faculty: 'Faculty',
        ethicsId: 'ETH-123',
        description: 'Desc',
        startDate: new Date(),
        endDate: new Date(),
        participantsNum: 10,
        members: [{ email: 'member1@example.com', role: 'collaborator' }],
        dbKeywords: ['keyword1', 'keyword2'],
        connection: {
          dbDetails: {
            url: 'postgres://...',
            type: 'postgres',
            name: 'User added Database Name',
          },
        },
      };
      (prismaMock.project.create as jest.Mock).mockResolvedValue({
        projectId: 'proj-1',
        ownerId: user.id,
        connection: {
          request: null,
        },
      });

      await service.createProject(user, dto, 'test-token');

      expect(queueMock.dataBrokerJob).toHaveBeenCalledWith(
        'user1',
        'proj-1',
        'mocked-request-id',
        dto.connection.dbDetails,
      );
      expect(queueMock.addResourceJob).toHaveBeenCalled();
    });
  });

  describe('getProjectDetails', () => {
    it('should delegate to prisma.project.findUniqueOrThrow', async () => {
      const projectId = 'proj-1';
      const project = {
        projectId,
        connection: {
          request: {
            comments: [],
          },
        },
      };

      (prismaMock.project.findUniqueOrThrow as jest.Mock).mockResolvedValue(
        project,
      );

      const result = await service.getProjectDetails(projectId);

      expect(prismaMock.project.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { projectId },
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
      expect(result).toEqual(project);
    });
  });

  describe('updateProject', () => {
    it('should call prisma.project.update with correct payload', async () => {
      // mocks
      const projectId = 'proj-1';
      const dto = {
        projectId,
        name: 'Updated name',
        lead: 'Updated lead',
        university: 'Updated Uni',
        faculty: 'Updated Faculty',
        ethicsId: 'ETH-999',
        description: 'Updated description',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
        participantsNum: 100,
        dbKeywords: ['updated'],
        connection: {
          dbDetails: {
            url: 'postgres://updated',
            type: 'postgres',
            name: 'Database update',
          },
        },
      };

      (prismaMock.project.update as jest.Mock).mockResolvedValue({});

      await service.updateProject(projectId, dto, 'test-token');

      expect(prismaMock.project.update).toHaveBeenCalledWith({
        where: { projectId },
        data: {
          name: dto.name,
          lead: dto.lead,
          university: dto.university,
          faculty: dto.faculty,
          ethicsId: dto.ethicsId,
          description: dto.description,
          startDate: dto.startDate,
          endDate: dto.endDate,
          lastModified: expect.any(Date),
          participantsNum: dto.participantsNum,
          dbKeywords: dto.dbKeywords,
        },
      });
    });
  });

  describe('deleteProject', () => {
    it('should delete keycloak resource, queue Atlas cleanup and delete project', async () => {
      const projectId = 'proj-1';
      const deleted = {
        projectId,
        connection: [],
        analysis: [],
      };

      (prismaMock.project.delete as jest.Mock).mockResolvedValue(deleted);

      await service.deleteProject(projectId);

      expect(keycloakMock.auth).toHaveBeenCalled();
      expect(keycloakMock.deleteResource).toHaveBeenCalledWith(projectId);
      expect(queueMock.deleteProjectAtlasJob).toHaveBeenCalledWith(projectId);
      expect(prismaMock.project.delete).toHaveBeenCalledWith({
        where: { projectId },
        include: {
          connection: true,
          analysis: true,
        },
      });
    });
  });

  describe('getProjectSettings', () => {
    it('should return settings with cover URL when project exists', async () => {
      const projectId = 'proj-1';
      const visualizations = [
        { title: 'Dash', link: 'https://example.com' },
      ] as Prisma.JsonArray;

      (prismaMock.project.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        visualizations,
      });

      (fileStorageMock.getFileUrl as jest.Mock).mockResolvedValue(
        'https://cdn.example.com/cover.jpg',
      );

      const result = await service.getProjectSettings(projectId);

      expect(prismaMock.project.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { projectId },
        select: {
          visualizations: true,
        },
      });

      expect(fileStorageMock.getFileUrl).toHaveBeenCalledWith(
        'cover',
        `${projectId}/cover.jpg`,
      );

      expect(result).toEqual({
        projectId,
        visualizations,
        cover: 'https://cdn.example.com/cover.jpg',
      });
    });

    it('should return null when project does not exist', async () => {
      const projectId = 'proj-1';
      (prismaMock.project.findUniqueOrThrow as jest.Mock).mockRejectedValue(
        new NotFoundException('Resource not found'),
      );

      await expect(
        service.getProjectSettings(projectId),
      ).rejects.toBeInstanceOf(NotFoundException);

      // expect(result).toThrow();
      expect(fileStorageMock.getFileUrl).not.toHaveBeenCalled();
    });
  });

  describe('updateCredentials', () => {
    const user: CurrentUserInfo = {
      id: '123',
      username: 'normal-user',
      family_name: 'User',
      given_name: 'Normal',
      email: 'user@test.com',
    };

    const requestId = 'req-1';
    const projectId = 'proj-1';
    const accessToken = 'test-token';

    beforeEach(() => {
      (prismaMock.connection.findFirst as jest.Mock).mockReset();
      (vaultMock.runConnectionFlow as jest.Mock).mockReset();
    });

    it('should run connection flow when dbDetails.url exists and requestId is found', async () => {
      const dbDetails = {
        url: 'pg://test_user:supersecret@localhost:5433/test',
        name: 'test',
        type: 'postgres',
      };

      (prismaMock.connection.findFirst as jest.Mock).mockResolvedValue({
        requestId,
      });

      const result = await service.updateCredentials(
        user,
        projectId,
        { dbDetails } as UpdateCredentialsDto,
        accessToken,
      );

      expect(prismaMock.connection.findFirst).toHaveBeenCalledWith({
        where: { projectId },
        select: { requestId: true },
      });

      expect(vaultMock.runConnectionFlow).toHaveBeenCalledWith(
        user,
        projectId,
        requestId,
        dbDetails,
        accessToken,
      );

      expect(result).toBeUndefined();
    });

    it('should do nothing when dbDetails.url is missing', async () => {
      const dto = {
        dbDetails: {
          name: 'test',
          type: 'postgres',
        },
      };

      const result = await service.updateCredentials(
        user,
        projectId,
        dto,
        accessToken,
      );

      expect(vaultMock.runConnectionFlow).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('should do nothing when requestId is not found', async () => {
      const dbDetails = {
        url: 'pg://test_user:supersecret@localhost:5433/test',
        name: 'test',
        type: 'postgres',
      };

      (prismaMock.connection.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.updateCredentials(
        user,
        projectId,
        { dbDetails } as UpdateCredentialsDto,
        accessToken,
      );

      expect(prismaMock.connection.findFirst).toHaveBeenCalled();
      expect(vaultMock.runConnectionFlow).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });
  });

  describe('updateProjectSettings', () => {
    it('should update visualizations and delete old cover', async () => {
      const projectId = 'proj-1';

      const dto: SettingsDto = {
        projectId,
        cover: undefined,
        visualizations: [
          {
            title: 'New Dash',
            link: 'https://example.com/new',
          },
        ],
      };

      (prismaMock.project.update as jest.Mock).mockResolvedValue({});

      const result = await service.updateProjectSettings(projectId, dto);

      expect(prismaMock.project.update).toHaveBeenCalledWith({
        where: { projectId },
        data: {
          visualizations: dto.visualizations,
        },
      });

      expect(fileStorageMock.deleteFile).toHaveBeenCalledWith(
        'cover',
        `${projectId}`,
      );

      expect(result).toBe(projectId);
    });
  });

  describe('uploadProjectCover', () => {
    it('should update lastModified and upload cover file', async () => {
      const projectId = 'proj-1';

      const file = {
        buffer: Buffer.from('filedata'),
      } as Express.Multer.File;

      (prismaMock.project.update as jest.Mock).mockResolvedValue({});

      const result = await service.uploadProjectCover(projectId, file);

      expect(prismaMock.project.update).toHaveBeenCalledWith({
        where: { projectId },
        data: {
          lastModified: expect.any(Date),
        },
      });

      expect(fileStorageMock.putFile).toHaveBeenCalledWith(
        'cover',
        `${projectId}/cover.jpg`,
        file,
      );

      expect(result).toBe(file.buffer);
    });
  });

  describe('synthetic dataset', () => {
    const projectId = 'proj-1';

    it('getSyntheticData returns a link when syntheticDataUrl is set', async () => {
      (prismaMock.project.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        syntheticDataUrl: 'https://nectar.example/data.csv',
        syntheticDataKey: null,
        syntheticDataFileName: null,
      });

      const result = await service.getSyntheticData(projectId);

      // legacy link attachments have no manifest — flagged for re-attach
      expect(result).toEqual({
        type: 'link',
        url: 'https://nectar.example/data.csv',
        fileName: null,
        needsReattach: true,
      });
      expect(fileStorageMock.getFileUrl).not.toHaveBeenCalled();
    });

    it('getSyntheticData signs a URL when a file was uploaded', async () => {
      (prismaMock.project.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        syntheticDataUrl: null,
        syntheticDataKey: `${projectId}/synthetic.csv`,
        syntheticDataFileName: 'individuals.csv',
      });
      (fileStorageMock.getFileUrl as jest.Mock).mockResolvedValue(
        'https://s3.example/signed',
      );

      const result = await service.getSyntheticData(projectId);

      expect(fileStorageMock.getFileUrl).toHaveBeenCalledWith(
        'synthetic',
        `${projectId}/synthetic.csv`,
      );
      // legacy upload without a manifest — flagged for re-attach
      expect(result).toEqual({
        type: 'file',
        url: 'https://s3.example/signed',
        fileName: 'individuals.csv',
        needsReattach: true,
      });
    });

    it('getSyntheticData returns none when nothing is attached', async () => {
      (prismaMock.project.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        syntheticDataUrl: null,
        syntheticDataKey: null,
        syntheticDataFileName: null,
      });

      const result = await service.getSyntheticData(projectId);

      expect(result).toEqual({ type: 'none', url: null, fileName: null });
    });

    it('getSyntheticData includes the manifest fields when present', async () => {
      (prismaMock.project.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        syntheticDataUrl: null,
        syntheticDataKey: `${projectId}/v2/synthetic.csv`,
        syntheticDataFileName: 'individuals.csv',
        syntheticDataColumns: ['household_id', 'age'],
        syntheticDataSchemaHash: 'hash-1',
        syntheticDataVersion: 2,
        syntheticDataRowCount: 10,
      });
      (fileStorageMock.getFileUrl as jest.Mock).mockResolvedValue(
        'https://s3.example/signed',
      );

      const result = await service.getSyntheticData(projectId);

      expect(result).toEqual({
        type: 'file',
        url: 'https://s3.example/signed',
        fileName: 'individuals.csv',
        schemaHash: 'hash-1',
        version: 2,
        columns: ['household_id', 'age'],
        rowCount: 10,
      });
    });

    it('setSyntheticDataLink fetches, validates and materialises the CSV into S3', async () => {
      (prismaMock.project.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        projectId,
      });
      (lookup as jest.Mock).mockResolvedValue([
        { address: '203.0.113.10', family: 4 },
      ]);
      (databaseMock.columns as jest.Mock).mockResolvedValue([]);
      (prismaMock.project.update as jest.Mock).mockResolvedValue({
        syntheticDataVersion: 1,
      });
      (prismaMock.project.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });
      (fileStorageMock.getFileUrl as jest.Mock).mockResolvedValue(
        'https://s3.example/signed',
      );
      const csv = 'household_id,age\nH0001,54\n';
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        body: Readable.from([Buffer.from(csv)]),
      } as never);

      try {
        const result = await service.setSyntheticDataLink(
          projectId,
          'https://nectar.example/dir/data.csv',
        );

        expect(fetchSpy).toHaveBeenCalledWith(
          'https://nectar.example/dir/data.csv',
          expect.objectContaining({
            signal: expect.anything(),
            redirect: 'manual',
          }),
        );
        expect(fileStorageMock.putFile).toHaveBeenCalledWith(
          'synthetic',
          `${projectId}/v1/synthetic.csv`,
          expect.objectContaining({ mimetype: 'text/csv' }),
        );
        // the version is reserved with an atomic increment
        expect(prismaMock.project.update).toHaveBeenCalledWith({
          where: { projectId },
          data: { syntheticDataVersion: { increment: 1 } },
          select: { syntheticDataVersion: true },
        });
        // materialised as a file — the invariant 'never both url and key'
        // holds, and the manifest write is guarded on the reserved version
        expect(prismaMock.project.updateMany).toHaveBeenCalledWith({
          where: { projectId, syntheticDataVersion: 1 },
          data: expect.objectContaining({
            syntheticDataKey: `${projectId}/v1/synthetic.csv`,
            syntheticDataFileName: 'data.csv',
            syntheticDataUrl: null,
            syntheticDataColumns: ['household_id', 'age'],
            syntheticDataSchemaHash: computeSchemaHash(['household_id', 'age']),
            syntheticDataRowCount: 1,
          }),
        });
        expect(result).toMatchObject({
          type: 'file',
          fileName: 'data.csv',
          version: 1,
          columns: ['household_id', 'age'],
        });
      } finally {
        fetchSpy.mockRestore();
      }
    });

    it('setSyntheticDataLink rejects non-http(s) URLs', async () => {
      await expect(
        service.setSyntheticDataLink(projectId, 'ftp://host/data.csv'),
      ).rejects.toThrow('http or https');
      expect(fileStorageMock.putFile).not.toHaveBeenCalled();
    });

    it('setSyntheticDataLink rejects links resolving to private addresses (SSRF)', async () => {
      (prismaMock.project.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        projectId,
      });
      (lookup as jest.Mock).mockResolvedValue([
        { address: '10.0.0.5', family: 4 },
      ]);
      const fetchSpy = jest.spyOn(global, 'fetch');

      try {
        await expect(
          service.setSyntheticDataLink(
            projectId,
            'https://internal.example/data.csv',
          ),
        ).rejects.toThrow('publicly reachable host');
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(fileStorageMock.putFile).not.toHaveBeenCalled();
      } finally {
        fetchSpy.mockRestore();
      }
    });

    it('setSyntheticDataLink re-validates every redirect hop (SSRF)', async () => {
      (prismaMock.project.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        projectId,
      });
      (lookup as jest.Mock).mockResolvedValue([
        { address: '203.0.113.10', family: 4 },
      ]);
      // public host redirects to the cloud metadata endpoint
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 302,
        headers: new Map([
          ['location', 'http://169.254.169.254/latest/meta-data/'],
        ]) as never,
        body: null,
      } as never);

      try {
        await expect(
          service.setSyntheticDataLink(
            projectId,
            'https://nectar.example/data.csv',
          ),
        ).rejects.toThrow('publicly reachable host');
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(fileStorageMock.putFile).not.toHaveBeenCalled();
      } finally {
        fetchSpy.mockRestore();
      }
    });

    it('uploadSyntheticData stores a versioned object with its manifest', async () => {
      (prismaMock.project.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        projectId,
      });
      (databaseMock.columns as jest.Mock).mockResolvedValue([
        { id: 'g1', name: 'household_id', table: 'individuals' },
      ]);
      (prismaMock.project.update as jest.Mock).mockResolvedValue({
        syntheticDataVersion: 3,
      });
      (prismaMock.project.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });
      (fileStorageMock.getFileUrl as jest.Mock).mockResolvedValue(
        'https://s3.example/signed',
      );
      const file = {
        originalname: 'individuals.csv',
        buffer: Buffer.from('household_id,age\nH0001,54\nH0002,36\n'),
        mimetype: 'text/csv',
      } as Express.Multer.File;

      const result = await service.uploadSyntheticData(projectId, file);

      const expectedHash = computeSchemaHash(['household_id', 'age']);
      expect(fileStorageMock.createBucketIfNotExists).toHaveBeenCalledWith(
        'synthetic',
      );
      // stored under a NEW versioned key; prior versions are never deleted
      expect(fileStorageMock.putFile).toHaveBeenCalledWith(
        'synthetic',
        `${projectId}/v3/synthetic.csv`,
        expect.objectContaining({ mimetype: 'text/csv' }),
      );
      expect(fileStorageMock.deleteFile).not.toHaveBeenCalled();
      // atomic version reservation, then a guarded manifest write
      expect(prismaMock.project.update).toHaveBeenCalledWith({
        where: { projectId },
        data: { syntheticDataVersion: { increment: 1 } },
        select: { syntheticDataVersion: true },
      });
      expect(prismaMock.project.updateMany).toHaveBeenCalledWith({
        where: { projectId, syntheticDataVersion: 3 },
        data: expect.objectContaining({
          syntheticDataKey: `${projectId}/v3/synthetic.csv`,
          syntheticDataFileName: 'individuals.csv',
          syntheticDataUrl: null,
          syntheticDataColumns: ['household_id', 'age'],
          syntheticDataSchemaHash: expectedHash,
          syntheticDataRowCount: 2,
        }),
      });
      expect(result).toEqual({
        type: 'file',
        url: 'https://s3.example/signed',
        fileName: 'individuals.csv',
        schemaHash: expectedHash,
        version: 3,
        columns: ['household_id', 'age'],
        rowCount: 2,
      });
    });

    it('uploadSyntheticData rejects a CSV that is not valid UTF-8', async () => {
      (prismaMock.project.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        projectId,
      });
      const file = {
        originalname: 'individuals.csv',
        // 0xE9 is 'é' in Latin-1 but an invalid UTF-8 sequence
        buffer: Buffer.concat([
          Buffer.from('household_id,ag'),
          Buffer.from([0xe9]),
          Buffer.from('\nH0001,54\n'),
        ]),
        mimetype: 'text/csv',
      } as Express.Multer.File;

      await expect(
        service.uploadSyntheticData(projectId, file),
      ).rejects.toThrow('not valid UTF-8');
      expect(fileStorageMock.putFile).not.toHaveBeenCalled();
      expect(prismaMock.project.updateMany).not.toHaveBeenCalled();
    });

    it('uploadSyntheticData throws 409 when a concurrent attach superseded it', async () => {
      (prismaMock.project.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        projectId,
      });
      (databaseMock.columns as jest.Mock).mockResolvedValue([]);
      (prismaMock.project.update as jest.Mock).mockResolvedValue({
        syntheticDataVersion: 3,
      });
      // another attach bumped the counter between reservation and manifest write
      (prismaMock.project.updateMany as jest.Mock).mockResolvedValue({
        count: 0,
      });
      const file = {
        originalname: 'individuals.csv',
        buffer: Buffer.from('household_id,age\nH0001,54\n'),
        mimetype: 'text/csv',
      } as Express.Multer.File;

      await expect(
        service.uploadSyntheticData(projectId, file),
      ).rejects.toThrow('attached concurrently');
    });

    it('uploadSyntheticData rejects a CSV with zero crawled-column matches', async () => {
      (prismaMock.project.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        syntheticDataVersion: 0,
      });
      (databaseMock.columns as jest.Mock).mockResolvedValue([
        { id: 'g1', name: 'heart_rate', table: 'examination' },
      ]);
      const file = {
        originalname: 'individuals.csv',
        buffer: Buffer.from('a,b\n1,2\n'),
        mimetype: 'text/csv',
      } as Express.Multer.File;

      await expect(
        service.uploadSyntheticData(projectId, file),
      ).rejects.toThrow("match this project's crawled database schema");
      expect(fileStorageMock.putFile).not.toHaveBeenCalled();
      expect(prismaMock.project.update).not.toHaveBeenCalled();
    });

    it('uploadSyntheticData skips reconciliation when Atlas is unavailable', async () => {
      (prismaMock.project.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        projectId,
      });
      (prismaMock.project.update as jest.Mock).mockResolvedValue({
        syntheticDataVersion: 1,
      });
      (prismaMock.project.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });
      (databaseMock.columns as jest.Mock).mockRejectedValue(
        new Error('atlas down'),
      );
      (fileStorageMock.getFileUrl as jest.Mock).mockResolvedValue(
        'https://s3.example/signed',
      );
      const file = {
        originalname: 'individuals.csv',
        buffer: Buffer.from('a,b\n1,2\n'),
        mimetype: 'text/csv',
      } as Express.Multer.File;

      const result = await service.uploadSyntheticData(projectId, file);

      expect(fileStorageMock.putFile).toHaveBeenCalledWith(
        'synthetic',
        `${projectId}/v1/synthetic.csv`,
        expect.objectContaining({ mimetype: 'text/csv' }),
      );
      expect(result).toMatchObject({ type: 'file', version: 1 });
    });

    it('uploadSyntheticData skips reconciliation when the project has no crawled columns', async () => {
      (prismaMock.project.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        projectId,
      });
      (prismaMock.project.update as jest.Mock).mockResolvedValue({
        syntheticDataVersion: 1,
      });
      (prismaMock.project.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });
      (databaseMock.columns as jest.Mock).mockResolvedValue([]);
      (fileStorageMock.getFileUrl as jest.Mock).mockResolvedValue(
        'https://s3.example/signed',
      );
      const file = {
        originalname: 'individuals.csv',
        buffer: Buffer.from('a,b\n1,2\n'),
        mimetype: 'text/csv',
      } as Express.Multer.File;

      const result = await service.uploadSyntheticData(projectId, file);

      expect(fileStorageMock.putFile).toHaveBeenCalled();
      expect(result).toMatchObject({ type: 'file', version: 1 });
    });

    it('removeSyntheticData deletes every stored version and nulls the manifest fields', async () => {
      (prismaMock.project.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        syntheticDataKey: `${projectId}/v2/synthetic.csv`,
      });
      (fileStorageMock.listFiles as jest.Mock).mockResolvedValue([
        `${projectId}/v1/synthetic.csv`,
        `${projectId}/v2/synthetic.csv`,
      ]);

      const result = await service.removeSyntheticData(projectId);

      // ALL versions under the project prefix are purged, not just the latest
      expect(fileStorageMock.listFiles).toHaveBeenCalledWith(
        'synthetic',
        `${projectId}/`,
      );
      expect(fileStorageMock.deleteFile).toHaveBeenCalledTimes(2);
      expect(fileStorageMock.deleteFile).toHaveBeenCalledWith(
        'synthetic',
        `${projectId}/v1/synthetic.csv`,
      );
      expect(fileStorageMock.deleteFile).toHaveBeenCalledWith(
        'synthetic',
        `${projectId}/v2/synthetic.csv`,
      );
      expect(prismaMock.project.update).toHaveBeenCalledWith({
        where: { projectId },
        data: expect.objectContaining({
          syntheticDataUrl: null,
          syntheticDataKey: null,
          syntheticDataFileName: null,
          syntheticDataColumns: Prisma.DbNull,
          syntheticDataSchemaHash: null,
          syntheticDataRowCount: null,
        }),
      });
      // the monotonic version counter is never reset
      const [updateArgs] = (prismaMock.project.update as jest.Mock).mock
        .calls[0] as [{ data: Record<string, unknown> }];
      expect(updateArgs.data).not.toHaveProperty('syntheticDataVersion');
      expect(result).toEqual({ type: 'none', url: null, fileName: null });
    });
  });
});
