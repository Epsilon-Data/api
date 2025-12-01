import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AnalysisRequestService } from './analysis-request.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { KeycloakAdminService } from 'src/admin/keycloak/keycloak-admin.service';
import { $Enums } from '@prisma/client';
import { AnalysisDecisionDto, AnalysisDto } from './dto';
import { ProjectMember } from 'src/project/dto';

describe('AnalysisRequestService', () => {
  let service: AnalysisRequestService;
  let prisma: {
    analysis: {
      findUniqueOrThrow: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    request: {
      update: jest.Mock;
      findFirst: jest.Mock;
      delete: jest.Mock;
    };
    comment: {
      create: jest.Mock;
      findMany: jest.Mock;
    };
  };
  const keycloakMock = {
    addUserToUserPolicy: jest.fn(),
  } as unknown as KeycloakAdminService;

  beforeEach(async () => {
    prisma = {
      analysis: {
        findUniqueOrThrow: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      request: {
        update: jest.fn(),
        findFirst: jest.fn(),
        delete: jest.fn(),
      },
      comment: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalysisRequestService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        { provide: KeycloakAdminService, useValue: keycloakMock },
      ],
    }).compile();

    service = module.get<AnalysisRequestService>(AnalysisRequestService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getDetails', () => {
    it('should return mapped details including project, request and comments', async () => {
      const userId = 'user-1';
      const requestId = 'req-1';

      const projectMembersJson: ProjectMember[] = [
        { email: 'member1@example.org', role: 'collaborator' } as ProjectMember,
      ];

      const projectMembersOriginal: ProjectMember[] = [
        { email: 'orig1@example.org', role: 'owner' } as ProjectMember,
      ];

      const analysisRecord = {
        requestId,
        projectId: 'proj-1',
        requestorName: 'Requestor Name',
        requestorOrgName: 'Org',
        requestorEmail: 'requestor@example.org',
        requestorPosition: 'Researcher',
        projectName: 'Project Name',
        projectStartDate: new Date('2025-01-01T00:00:00.000Z'),
        projectEndDate: new Date('2025-12-31T00:00:00.000Z'),
        projectDescription: 'Description',
        projectObjective: 'Objective',
        projectOutcome: 'Outcome',
        projectMembers: projectMembersJson,
        projectEthicsId: 'ETH-1',
        request: {
          requestId,
          requestorId: userId,
          status: $Enums.RequestStatus.PENDING,
          createdDate: new Date('2025-01-10T00:00:00.000Z'),
          lastModified: new Date('2025-01-11T00:00:00.000Z'),
          comments: [
            {
              requestId,
              commentId: 'comment-1',
              authorId: 'user-1',
              authorName: 'User 1',
              content: 'Comment 1',
              createdDate: new Date('2025-01-10T00:00:00.000Z'),
            },
          ],
        },
        project: {
          projectId: 'proj-1',
          name: 'Original Project',
          members: projectMembersOriginal,
          university: 'Uni',
        },
      };

      prisma.analysis.findUniqueOrThrow.mockResolvedValue(analysisRecord);

      const result = await service.getDetails(userId, requestId);

      expect(prisma.analysis.findUniqueOrThrow).toHaveBeenCalledWith({
        where: {
          requestId: requestId,
          request: {
            requestorId: userId,
          },
        },
        include: {
          request: {
            include: {
              comments: true,
            },
          },
          project: true,
        },
      });

      expect(result).toEqual({
        requestId: analysisRecord.requestId,
        projectId: analysisRecord.projectId,
        requestorName: analysisRecord.requestorName,
        requestorOrgName: analysisRecord.requestorOrgName,
        requestorEmail: analysisRecord.requestorEmail,
        requestorPosition: analysisRecord.requestorPosition,
        projectName: analysisRecord.projectName,
        projectStartDate: analysisRecord.projectStartDate,
        projectEndDate: analysisRecord.projectEndDate,
        projectDescription: analysisRecord.projectDescription,
        projectObjective: analysisRecord.projectObjective,
        projectOutcome: analysisRecord.projectOutcome,
        projectMembers: projectMembersJson,
        projectEthicsId: analysisRecord.projectEthicsId,
        request: analysisRecord.request,
        project: {
          ...analysisRecord.project,
          members: projectMembersOriginal,
        },
      });
    });
  });

  describe('getList', () => {
    it('should map analysis records to summary DTOs', async () => {
      const userId = 'user-1';

      const requestList = [
        {
          requestId: 'req-1',
          project: {
            projectId: 'proj-1',
            name: 'Project 1',
            university: 'Uni 1',
          },
          request: {
            status: $Enums.RequestStatus.PENDING,
            createdDate: new Date('2025-01-01T00:00:00.000Z'),
            lastModified: new Date('2025-01-02T00:00:00.000Z'),
          },
        },
        {
          requestId: 'req-2',
          project: {
            projectId: 'proj-2',
            name: 'Project 2',
            university: 'Uni 2',
          },
          request: {
            status: $Enums.RequestStatus.APPROVED,
            createdDate: new Date('2025-02-01T00:00:00.000Z'),
            lastModified: new Date('2025-02-02T00:00:00.000Z'),
          },
        },
      ];

      prisma.analysis.findMany.mockResolvedValue(requestList);

      const result = await service.getList(userId);

      expect(prisma.analysis.findMany).toHaveBeenCalledWith({
        where: {
          request: {
            requestorId: userId,
          },
        },
        select: {
          requestId: true,
          project: {
            select: {
              projectId: true,
              name: true,
              university: true,
            },
          },
          request: {
            select: {
              status: true,
              createdDate: true,
              lastModified: true,
            },
          },
        },
      });

      expect(result).toEqual([
        {
          requestId: 'req-1',
          projectId: 'proj-1',
          projectName: 'Project 1',
          projectUniversity: 'Uni 1',
          status: $Enums.RequestStatus.PENDING,
          createdDate: requestList[0].request.createdDate,
          lastModified: requestList[0].request.lastModified,
        },
        {
          requestId: 'req-2',
          projectId: 'proj-2',
          projectName: 'Project 2',
          projectUniversity: 'Uni 2',
          status: $Enums.RequestStatus.APPROVED,
          createdDate: requestList[1].request.createdDate,
          lastModified: requestList[1].request.lastModified,
        },
      ]);
    });
  });

  describe('createRequest', () => {
    it('should create an analysis request and not return content', async () => {
      const userId = 'user-1';
      const dto: AnalysisDto = {
        projectId: 'proj-1',
        requestorName: 'Req Name',
        requestorEmail: 'req@example.org',
        requestorOrgName: 'Org',
        requestorPosition: 'Position',
        projectName: 'Proj Name',
        projectStartDate: new Date('2025-01-01T00:00:00.000Z'),
        projectEndDate: new Date('2025-12-31T00:00:00.000Z'),
        projectDescription: 'Description',
        projectObjective: 'Objective',
        projectOutcome: 'Outcome',
        projectMembers: [
          { email: 'm1@example.org', role: 'collaborator' } as ProjectMember,
        ],
        projectEthicsId: 'ETH-1',
      };

      prisma.analysis.create.mockResolvedValue({});

      const result = await service.createRequest(userId, dto);

      expect(prisma.analysis.create).toHaveBeenCalledWith({
        data: {
          requestorName: dto.requestorName,
          requestorEmail: dto.requestorEmail,
          requestorOrgName: dto.requestorOrgName,
          requestorPosition: dto.requestorPosition,
          projectName: dto.projectName,
          projectStartDate: dto.projectStartDate,
          projectEndDate: dto.projectEndDate,
          projectDescription: dto.projectDescription,
          projectObjective: dto.projectObjective,
          projectOutcome: dto.projectOutcome,
          projectMembers: dto.projectMembers,
          projectEthicsId: dto.projectEthicsId,
          request: {
            create: {
              requestorId: userId,
            },
          },
          project: {
            connect: {
              projectId: dto.projectId,
            },
          },
        },
        include: { request: true, project: true },
      });

      expect(result).toBeUndefined();
    });
  });

  describe('approve', () => {
    it('should set status APPROVED when isApproved is true', async () => {
      const requestId = 'req-1';
      const projectId = '8b7e2f36-9217-4ea0-8d6e-b621fb6e5230';
      const dto: AnalysisDecisionDto = { isApproved: true };

      const updated = { requestId, status: $Enums.RequestStatus.APPROVED };
      prisma.request.update.mockResolvedValue(updated);

      await service.approve(requestId, projectId, dto);

      expect(prisma.request.update).toHaveBeenCalledWith({
        where: { requestId },
        data: {
          status: $Enums.RequestStatus.APPROVED,
        },
      });
    });

    it('should set status REJECTED when isApproved is false', async () => {
      const requestId = 'req-1';
      const projectId = '8b7e2f36-9217-4ea0-8d6e-b621fb6e5230';
      const dto: AnalysisDecisionDto = { isApproved: false };

      const updated = { requestId, status: $Enums.RequestStatus.REJECTED };
      prisma.request.update.mockResolvedValue(updated);

      await service.approve(requestId, projectId, dto);

      expect(prisma.request.update).toHaveBeenCalledWith({
        where: { requestId },
        data: {
          status: $Enums.RequestStatus.REJECTED,
        },
      });
    });
  });

  describe('update', () => {
    it('should update analysis with provided dto', async () => {
      const userId = 'user-1';
      const requestId = 'req-1';

      const dto: AnalysisDto = {
        requestId: requestId,
        projectId: 'proj-1',
        requestorName: 'Name',
        requestorEmail: 'email@example.org',
        requestorOrgName: 'Org',
        requestorPosition: 'Pos',
        projectName: 'New Project',
        projectStartDate: new Date('2025-01-01T00:00:00.000Z'),
        projectEndDate: new Date('2025-12-31T00:00:00.000Z'),
        projectDescription: 'New Desc',
        projectObjective: 'New Obj',
        projectOutcome: 'New Out',
        projectMembers: [
          { email: 'm1@example.org', role: 'collaborator' } as ProjectMember,
        ],
        projectEthicsId: 'ETH-2',
      };

      const updated = { requestId, projectName: dto.projectName };
      prisma.analysis.update.mockResolvedValue(updated);

      const result = await service.update(userId, requestId, dto);

      expect(prisma.analysis.update).toHaveBeenCalledWith({
        where: {
          requestId: requestId,
          request: {
            requestorId: userId,
          },
        },
        data: {
          projectName: dto.projectName,
          projectStartDate: dto.projectStartDate,
          projectEndDate: dto.projectEndDate,
          projectDescription: dto.projectDescription,
          projectObjective: dto.projectObjective,
          projectOutcome: dto.projectOutcome,
          projectMembers: dto.projectMembers,
          projectEthicsId: dto.projectEthicsId,
        },
      });

      expect(result).toEqual(updated);
    });
  });

  describe('delete', () => {
    it('should throw NotFoundException if request is not found or not owned by user', async () => {
      const userId = 'user-1';
      const requestId = 'req-1';

      prisma.request.findFirst.mockResolvedValue(null);

      await expect(service.delete(userId, requestId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.request.delete).not.toHaveBeenCalled();
    });

    it('should delete the request when found and owned by user', async () => {
      const userId = 'user-1';
      const requestId = 'req-1';

      const reqRecord = { requestId, requestorId: userId };
      const deleted = { requestId };

      prisma.request.findFirst.mockResolvedValue(reqRecord);
      prisma.request.delete.mockResolvedValue(deleted);

      const result = await service.delete(userId, requestId);

      expect(prisma.request.findFirst).toHaveBeenCalledWith({
        where: {
          requestId: requestId,
          requestorId: userId,
        },
      });

      expect(prisma.request.delete).toHaveBeenCalledWith({
        where: { requestId: requestId },
      });

      expect(result).toEqual(deleted);
    });
  });

  describe('createComment', () => {
    it('should create a comment and not return content', async () => {
      const userId = 'user-1';
      const requestId = 'req-123';
      const dto = {
        requestId: requestId,
        authorId: userId,
        authorName: 'Alice',
        content: 'Looks good to me.',
        createdDate: new Date('2025-03-01T10:00:00.000Z'),
      };

      prisma.comment.create.mockResolvedValue({});

      const result = await service.createComment(userId, requestId, dto);

      expect(prisma.comment.create).toHaveBeenCalledWith({
        data: {
          requestId,
          authorId: userId,
          authorName: dto.authorName,
          content: dto.content,
          createdDate: dto.createdDate,
        },
      });
      expect(result).toBeUndefined();
    });
  });

  describe('getComments', () => {
    it('should return all comments for a request owned by the user', async () => {
      const userId = 'user-1';
      const requestId = 'req-123';
      const comments = [
        {
          authorName: 'User 1',
          content: 'First comment',
          createdDate: new Date(),
        },
        {
          authorName: 'User 2',
          content: 'Second comment',
          createdDate: new Date(),
        },
      ];

      prisma.comment.findMany.mockResolvedValue(comments);

      const result = await service.getComments(userId, requestId);

      expect(prisma.comment.findMany).toHaveBeenCalledWith({
        where: {
          requestId,
          request: {
            requestorId: userId,
          },
        },
      });
      expect(result).toEqual(comments);
    });
  });

  describe('getAnalysisProjects', () => {
    it('should call prisma with correct filters and map result to DatasetDto[]', async () => {
      const userId = 'user-123';

      const now = new Date('2025-01-01T10:00:00.000Z');

      const prismaResult = [
        {
          project: {
            projectId: 'proj-1',
            lastModified: now,
            packageId: 'pkg-1',
          },
        },
        {
          project: {
            projectId: 'proj-2',
            lastModified: now,
            packageId: null,
          },
        },
      ];

      jest.spyOn(prisma.analysis, 'findMany').mockResolvedValue(prismaResult);

      const result = await service.getAnalysisProjects(userId);

      expect(prisma.analysis.findMany).toHaveBeenCalledWith({
        where: {
          request: {
            is: {
              status: $Enums.RequestStatus.APPROVED,
              requestorId: userId,
            },
          },
          project: {
            is: {
              status: $Enums.ProjectStatus.MAPPED,
            },
          },
        },
        select: {
          project: {
            select: {
              projectId: true,
              lastModified: true,
              packageId: true,
            },
          },
        },
      });

      expect(result).toEqual([
        {
          datasetId: 'proj-1',
          packageId: 'pkg-1',
          lastModified: now,
        },
        {
          datasetId: 'proj-2',
          packageId: null,
          lastModified: now,
        },
      ]);
    });

    it('should return an empty array when no analysis projects are found', async () => {
      const userId = 'user-456';

      jest.spyOn(prisma.analysis, 'findMany').mockResolvedValue([]);

      const result = await service.getAnalysisProjects(userId);

      expect(prisma.analysis.findMany).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });
});
