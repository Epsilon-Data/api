import { Test, TestingModule } from '@nestjs/testing';
import { ConnectionRequestService } from './connection-request.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueueService } from 'src/queue/queue.service';
import { $Enums } from 'src/generated/prisma/client';

import { CurrentUserInfo } from 'src/common/decorators/user.decorator';
import { VaultService } from 'src/vault/vault.service';

describe('ConnectionRequestService', () => {
  let service: ConnectionRequestService;

  let prismaMock: {
    connection: { findMany: jest.Mock; findUniqueOrThrow: jest.Mock };
    project: { update: jest.Mock };
    request: { update: jest.Mock };
  };

  let queueMock: {
    dataBrokerJob: jest.Mock;
  };

  const vaultMock = {
    auth: jest.fn(),
    transitEncrypt: jest.fn(),
    writeProjectCiphertext: jest.fn(),
  } as unknown as VaultService;

  beforeEach(async () => {
    prismaMock = {
      connection: {
        findMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      project: {
        update: jest.fn(),
      },
      request: {
        update: jest.fn(),
      },
    };

    queueMock = {
      dataBrokerJob: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConnectionRequestService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: QueueService,
          useValue: queueMock,
        },
        {
          provide: VaultService,
          useValue: vaultMock,
        },
      ],
    }).compile();

    service = module.get<ConnectionRequestService>(ConnectionRequestService);

    jest.clearAllMocks();
  });

  describe('getList', () => {
    it('should return list of connection requests for a user', async () => {
      const userId = 'user-123';

      const expectedResult = [
        {
          project: {
            projectId: 'proj-1',
            customId: 'P-001',
            name: 'Test Project',
          },
          request: {
            requestId: 'req-1',
            status: $Enums.RequestStatus.PENDING,
            createdDate: new Date('2025-01-01T00:00:00Z'),
            lastModified: new Date('2025-01-02T00:00:00Z'),
          },
        },
      ];

      prismaMock.connection.findMany.mockResolvedValue(expectedResult);

      const result = await service.getList(userId);

      expect(prismaMock.connection.findMany).toHaveBeenCalledWith({
        where: {
          request: {
            requestorId: userId,
          },
        },
        select: {
          project: {
            select: {
              projectId: true,
              customId: true,
              name: true,
            },
          },
          request: {
            select: {
              requestId: true,
              status: true,
              createdDate: true,
              lastModified: true,
            },
          },
        },
      });

      expect(result).toEqual(expectedResult);
    });
  });

  describe('getDetails', () => {
    const email = 'admin@example.com';
    const requestId = 'req-123';

    it('should return request details for given email and requestId', async () => {
      const expectedResult = {
        project: {
          projectId: 'proj-1',
          name: 'Project Name',
          description: 'A test project',
          university: 'Test University',
          faculty: 'Engineering',
          ethicsId: 'ETH-001',
          startDate: new Date('2025-01-01T00:00:00Z'),
          endDate: new Date('2025-12-31T00:00:00Z'),
          participantsNum: 100,
          lead: 'Lead Researcher',
          members: ['Member 1', 'Member 2'],
        },
        request: {
          comments: 'Some comments',
          requestId: 'req-123',
          status: $Enums.RequestStatus.PENDING,
          createdDate: new Date('2025-02-01T00:00:00Z'),
          lastModified: new Date('2025-02-02T00:00:00Z'),
        },
      };

      prismaMock.connection.findUniqueOrThrow.mockResolvedValue(expectedResult);

      const result = await service.getDetails(email, requestId);

      expect(prismaMock.connection.findUniqueOrThrow).toHaveBeenCalledWith({
        where: {
          requestId,
          orgAdminEmail: email,
        },
        select: {
          project: {
            select: {
              projectId: true,
              name: true,
              description: true,
              university: true,
              faculty: true,
              ethicsId: true,
              startDate: true,
              endDate: true,
              participantsNum: true,
              lead: true,
              members: true,
            },
          },
          request: {
            select: {
              comments: true,
              requestId: true,
              status: true,
              createdDate: true,
              lastModified: true,
            },
          },
        },
      });

      expect(result).toEqual(expectedResult);
    });

    it('should throw if record is not found', async () => {
      prismaMock.connection.findUniqueOrThrow.mockRejectedValue(
        new Error('Not found'),
      );

      await expect(service.getDetails(email, requestId)).rejects.toThrow(
        'Not found',
      );
    });
  });

  describe('approve', () => {
    const user: CurrentUserInfo = {
      id: '123',
      username: 'admin-user',
      family_name: 'Admin',
      given_name: 'User',
      email: 'admin@test.com',
    };

    const requestId = 'req-1';
    const projectId = 'proj-1';

    it('should approve request, update project to CRAWLING and enqueue job when tempDbDetails.url exists', async () => {
      const tempDbDetails = {
        url: 'pg://test_admin:supersecret@localhost:5433/test',
        name: 'test',
        type: 'postgres',
      };

      const dto = {
        isApproved: true,
        tempDbDetails,
      };

      prismaMock.project.update.mockResolvedValue({});
      prismaMock.request.update.mockResolvedValue({});

      const result = await service.approve(
        user,
        requestId,
        projectId,
        dto,
        'test-token',
      );

      expect(prismaMock.project.update).toHaveBeenCalledWith({
        where: { projectId },
        data: {
          status: 'CRAWLING',
        },
      });

      expect(queueMock.dataBrokerJob).toHaveBeenCalledWith(
        user.username,
        projectId,
        requestId,
        tempDbDetails,
      );

      expect(prismaMock.request.update).toHaveBeenCalledWith({
        where: { requestId },
        data: {
          status: $Enums.RequestStatus.APPROVED,
        },
      });

      expect(result).toBeUndefined();
    });

    it('should approve request but NOT update project or enqueue job when tempDbDetails.url is missing', async () => {
      const dto = {
        isApproved: true,
        tempDbDetails: {
          name: 'test',
          type: 'postgres',
          // no url
        },
      };

      prismaMock.request.update.mockResolvedValue({});

      const result = await service.approve(
        user,
        requestId,
        projectId,
        dto,
        'test-token',
      );

      expect(prismaMock.project.update).not.toHaveBeenCalled();
      expect(queueMock.dataBrokerJob).not.toHaveBeenCalled();

      expect(prismaMock.request.update).toHaveBeenCalledWith({
        where: { requestId },
        data: {
          status: $Enums.RequestStatus.APPROVED,
        },
      });

      expect(result).toBeUndefined();
    });

    it('should reject request and not update project or enqueue job', async () => {
      const dto = {
        isApproved: false,
        tempDbDetails: {
          name: 'Example DB',
          type: 'postgresql',
          url: 'pg://should-not-be-used',
        },
      };

      prismaMock.request.update.mockResolvedValue({});

      const result = await service.approve(
        user,
        requestId,
        projectId,
        dto,
        'test-token',
      );

      expect(prismaMock.project.update).not.toHaveBeenCalled();
      expect(queueMock.dataBrokerJob).not.toHaveBeenCalled();

      expect(prismaMock.request.update).toHaveBeenCalledWith({
        where: { requestId },
        data: {
          status: $Enums.RequestStatus.REJECTED,
        },
      });

      expect(result).toBeUndefined();
    });
  });
});
