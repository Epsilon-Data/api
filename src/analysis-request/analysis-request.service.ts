import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  AnalysisDto,
  AnalysisRequestDetailsResponseDto,
  AnalysisRequestSummaryInfoDto,
  AnalysisStatusDto,
} from './dto';
import { $Enums, Prisma } from 'src/generated/prisma/client';
import { ProjectMember } from 'src/project/dto';
import { RequestCommentDto } from 'src/common/dto';
import { KeycloakAdminService } from 'src/admin/keycloak/keycloak-admin.service';
import { DatasetDto } from 'src/analysis/dto';

@Injectable()
export class AnalysisRequestService {
  private readonly logger = new Logger(AnalysisRequestService.name);
  constructor(
    private prisma: PrismaService,
    private readonly keycloak: KeycloakAdminService,
  ) {}

  async getDetails(
    isRequestor: boolean,
    userId: string,
    requestId: string,
  ): Promise<AnalysisRequestDetailsResponseDto> {
    const include = {
      request: { include: { comments: true } },
      project: true,
    } as const;

    const where = isRequestor
      ? { requestId, request: { requestorId: userId } }
      : { requestId, project: { ownerId: userId } };

    const result = await this.prisma.analysis.findUniqueOrThrow({
      where,
      include,
    });

    const projectMembers = (result.projectMembers ?? []) as ProjectMember[];

    const project = result.project;
    const members = (project?.members ?? []) as ProjectMember[];

    return {
      requestId: result.requestId,
      projectId: result.projectId,
      requestorName: result.requestorName,
      requestorOrgName: result.requestorOrgName,
      requestorEmail: result.requestorEmail,
      requestorPosition: result.requestorPosition,
      projectName: result.projectName,
      projectStartDate: result.projectStartDate,
      projectEndDate: result.projectEndDate,
      projectDescription: result.projectDescription,
      projectObjective: result.projectObjective,
      projectOutcome: result.projectOutcome,
      projectMembers,
      projectEthicsId: result.projectEthicsId,
      request: result.request,
      project: {
        ...project,
        members,
      },
    };
  }

  async getList(userId: string): Promise<AnalysisRequestSummaryInfoDto[]> {
    const requestList = await this.prisma.analysis.findMany({
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

    const formatted = requestList.map((request) => {
      return {
        requestId: request.requestId,
        projectId: request.project.projectId,
        projectName: request.project.name,
        projectUniversity: request.project.university,
        status: request.request.status,
        createdDate: request.request.createdDate,
        lastModified: request.request.lastModified,
      };
    });

    return formatted;
  }

  async getByProject(userId: string, projectId: string) {
    const request = await this.prisma.analysis.findFirst({
      where: { projectId: projectId, request: { requestorId: userId } },
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

    if (!request) return null;

    return {
      requestId: request.requestId,
      projectId: request.project.projectId,
      projectName: request.project.name,
      projectUniversity: request.project.university,
      status: request.request.status,
      createdDate: request.request.createdDate,
      lastModified: request.request.lastModified,
    };
  }

  async createRequest(userId: string, dto: AnalysisDto) {
    const request = {
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
      projectMembers: dto.projectMembers as unknown as Prisma.JsonArray,
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
    };

    const createdRequest = await this.prisma.analysis.create({
      data: request,
      include: { request: true, project: true },
    });

    const project = await this.prisma.project.findUnique({
      where: { projectId: dto.projectId },
      select: { isPublic: true },
    });

    if (project?.isPublic) {
      await this.prisma.request.update({
        where: { requestId: createdRequest.requestId },
        data: {
          status: $Enums.RequestStatus.APPROVED,
        },
      });
      await this.keycloak.auth();
      await this.keycloak.addUserToUserPolicy(dto.projectId, userId);
    }

    return; // no content return
  }

  async updateStatus(
    requestId: string,
    projectId: string,
    dto: AnalysisStatusDto,
  ) {
    const { status } = dto;
    const result = await this.prisma.request.update({
      where: { requestId: requestId },
      data: {
        status,
      },
    });
    if (status === $Enums.RequestStatus.APPROVED) {
      // update client auth
      await this.keycloak.auth();
      // TODO: need proper error handling here from keycloak or go via queue
      await this.keycloak.addUserToUserPolicy(projectId, result.requestorId);
    }
    return;
  }

  async checkAnalysisAccess(projectId: string, userId: string) {
    if (!projectId || !userId)
      throw new BadRequestException(
        'Missing parameters projectId and userId are required',
      );
    const request = await this.prisma.analysis.findFirst({
      where: {
        projectId: projectId,
        request: {
          requestorId: userId,
          status: $Enums.RequestStatus.APPROVED,
        },
      },
      select: {
        requestId: true,
      },
    });
    return request ? { isApproved: true } : { isApproved: false };
  }

  async update(userId: string, requestId: string, dto: AnalysisDto) {
    return await this.prisma.analysis.update({
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
        projectMembers: dto.projectMembers as unknown as Prisma.JsonArray,
        projectEthicsId: dto.projectEthicsId,
      },
    });
  }

  async delete(userId: string, requestId: string) {
    // also cascades to delete the analysis project
    const req = await this.prisma.request.findFirst({
      where: {
        requestId: requestId,
        requestorId: userId,
      },
    });

    if (!req) {
      throw new NotFoundException('Request not found or not owned by user');
    }

    return await this.prisma.request.delete({
      where: { requestId: requestId },
    });
  }

  async createComment(
    userId: string,
    requestId: string,
    dto: RequestCommentDto,
  ) {
    const data = {
      requestId: requestId,
      authorId: userId,
      authorName: dto.authorName,
      content: dto.content,
      createdDate: dto.createdDate,
    };

    await this.prisma.comment.create({ data });

    return;
  }

  async getComments(
    userId: string,
    requestId: string,
    isRequestor: boolean,
  ): Promise<RequestCommentDto[]> {
    if (isRequestor) {
      return await this.prisma.comment.findMany({
        where: {
          requestId: requestId,
          request: {
            requestorId: userId,
          },
        },
      });
    }

    return await this.prisma.comment.findMany({
      where: {
        requestId: requestId,
        request: {
          analysis: {
            project: {
              ownerId: userId,
            },
          },
        },
      },
    });
  }

  async getAnalysisProjects(userId: string): Promise<DatasetDto[]> {
    if (!userId) {
      throw new BadRequestException(
        'Analysis project not found or not owned by user',
      );
    }
    const analysisProjectList = await this.prisma.analysis.findMany({
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
          },
        },
      },
    });
    const formatted = analysisProjectList.map((request) => {
      return {
        datasetId: request.project.projectId,
        lastModified: request.project.lastModified,
      };
    });

    return formatted;
  }
}
