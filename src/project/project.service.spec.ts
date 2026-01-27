/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ProjectService } from './project.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueueService } from 'src/queue/queue.service';
import { FileStorageService } from 'src/file-storage/file_storage.service';
import { KeycloakAdminService } from 'src/admin/keycloak/keycloak-admin.service';
import { Prisma, RequestStatus } from 'src/generated/prisma/client';
import { SettingsDto, UpdateCredentialsDto } from './dto';
import { NotFoundException } from '@nestjs/common/exceptions';
import { VaultService } from 'src/vault/vault.service';
import { CurrentUserInfo } from 'src/common/decorators/user.decorator';

// mock nanoid + uuid to make tests deterministic
jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => 'mockedCustomId12'),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mocked-request-id'),
}));

describe('ProjectService', () => {
  let service: ProjectService;

  const prismaMock = {
    project: {
      findMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
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
  } as unknown as QueueService;

  const fileStorageMock = {
    getFileUrl: jest.fn(),
    deleteFile: jest.fn(),
    putFile: jest.fn(),
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
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
  });

  describe('getUserOwnedProjects', () => {
    it('should return projects for given ownerId', async () => {
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

      const result = await service.getUserOwnedProjects(userId);

      expect(prismaMock.project.findMany).toHaveBeenCalledWith({
        where: { ownerId: userId },
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
      expect(result).toEqual(projects);
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

      const result = await service.getUserSharedProjects(permissions);

      expect(prismaMock.project.findMany).toHaveBeenCalledWith({
        where: {
          projectId: {
            in: ['p1', 'p3'],
          },
        },
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
      expect(result).toEqual(projects);
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

      const result = await service.getAllProjects();

      expect(prismaMock.project.findMany).toHaveBeenCalledWith({
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
          dbKeywords: true,
          university: true,
          faculty: true,
        },
      });
      expect(result).toEqual(projects);
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
    it('should delete project and include connection and analysis', async () => {
      const projectId = 'proj-1';
      const deleted = {
        projectId,
        connection: [],
        analysis: [],
      };

      (prismaMock.project.delete as jest.Mock).mockResolvedValue(deleted);

      await service.deleteProject(projectId);

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
});
