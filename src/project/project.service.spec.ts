/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ProjectService } from './project.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueueService } from 'src/queue/queue.service';
import { FileStorageService } from 'src/file_storage/file_storage.service';
import { KeycloakAdminService } from 'src/admin/keycloak/keycloak.admin.service';
import { RequestStatus } from '@prisma/client';
import { SettingsDto } from './dto';
import { NotFoundException } from '@nestjs/common/exceptions';

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
  } as unknown as QueueService;

  const fileStorageMock = {
    getFileUrl: jest.fn(),
    deleteFile: jest.fn(),
    putFile: jest.fn(),
  } as unknown as FileStorageService;

  const keycloakMock = {
    newResource: jest.fn(),
  } as unknown as KeycloakAdminService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: QueueService, useValue: queueMock },
        { provide: FileStorageService, useValue: fileStorageMock },
        { provide: KeycloakAdminService, useValue: keycloakMock },
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
          customId: 'c1',
          name: 'Project 1',
          lastModified: new Date(),
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
          customId: true,
          name: true,
          lastModified: true,
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
          customId: 'c1',
          name: 'Project 1',
          lastModified: new Date(),
          status: 'MAPPED',
          university: 'Uni',
          faculty: 'Faculty',
          lead: 'Lead',
        },
        {
          projectId: 'p3',
          customId: 'c3',
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
          customId: true,
          name: true,
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
          customId: 'c1',
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
          customId: true,
          name: true,
          lastModified: true,
          createdDate: true,
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
      const email = 'admin@example.com';

      const connectionRequests = [
        {
          request: {
            requestId: 'req-1',
            status: RequestStatus.PENDING,
            createdDate: new Date(),
          },
          project: {
            projectId: 'proj-1',
            name: 'Project 1',
          },
        },
      ];

      const analysisRequests = [
        {
          request: {
            requestId: 'req-2',
            status: RequestStatus.APPROVED,
            createdDate: new Date(),
          },
          projectName: 'Project 1',
        },
      ];

      (prismaMock.connection.findMany as jest.Mock).mockResolvedValue(
        connectionRequests,
      );
      (prismaMock.analysis.findMany as jest.Mock).mockResolvedValue(
        analysisRequests,
      );

      const result = await service.getProjectRequests(projectId, email);

      expect(prismaMock.connection.findMany).toHaveBeenCalledWith({
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

      expect(prismaMock.analysis.findMany).toHaveBeenCalledWith({
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

      expect(result).toEqual({
        connection: connectionRequests,
        analysis: analysisRequests,
      });
    });
  });

  describe('createProject', () => {
    // user mock
    const user = {
      email: 'owner@example.com',
      username: 'owner-user',
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
        members: JSON.stringify([
          { email: 'member1@example.com', role: 'collaborator' },
        ]),
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

      await service.createProject(user, dto);

      expect(prismaMock.project.create).toHaveBeenCalled();
      expect(keycloakMock.newResource).toHaveBeenCalledWith('proj-1', 'user1', [
        'member1@example.com',
      ]);
      expect(prismaMock.comment.create).toHaveBeenCalledWith({
        data: {
          requestId: 'mocked-request-id',
          authorId: user.id,
          content: dto.connection.additionalInfo,
        },
      });
      expect(queueMock.dataBrokerJob).not.toHaveBeenCalled();
    });

    it('should trigger dataBrokerJob when no orgAdminEmail and tempDbDetails.url present', async () => {
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
        members: JSON.stringify([
          { email: 'member1@example.com', role: 'collaborator' },
        ]),
        dbKeywords: ['keyword1', 'keyword2'],
        connection: {
          tempDbDetails: {
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

      await service.createProject(user, dto);

      expect(queueMock.dataBrokerJob).toHaveBeenCalledWith(
        'owner-user',
        'proj-1',
        'mocked-request-id',
        dto.connection.tempDbDetails,
      );
      expect(keycloakMock.newResource).toHaveBeenCalled();
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
          tempDbDetails: {
            url: 'postgres://updated',
            type: 'postgres',
            name: 'Database update',
          },
        },
      };

      (prismaMock.project.update as jest.Mock).mockResolvedValue({});

      await service.updateProject(projectId, dto);

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
          connection: {
            update: {
              tempDbDetails: JSON.stringify(dto.connection.tempDbDetails),
            },
          },
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

      const result = await service.deleteProject(projectId);

      expect(prismaMock.project.delete).toHaveBeenCalledWith({
        where: { projectId },
        include: {
          connection: true,
          analysis: true,
        },
      });
      expect(result).toEqual(deleted);
    });
  });

  describe('getProjectSettings', () => {
    it('should return settings with cover URL when project exists', async () => {
      const projectId = 'proj-1';
      const visualizations = [{ title: 'Dash', link: 'https://example.com' }];

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
          visualizations: JSON.stringify(dto.visualizations),
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
