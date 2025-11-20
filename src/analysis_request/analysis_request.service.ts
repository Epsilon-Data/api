import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  AnalysisDto,
  AnalysisRequestDetailsResponseDto,
  AnalysisRequestSummaryInfoDto,
} from './dto';
import { Prisma } from '@prisma/client';
import { ProjectMember } from 'src/project/dto';

@Injectable()
export class AnalysisRequestService {
  constructor(private prisma: PrismaService) {}

  async getDetails(
    userId: string,
    requestId: string,
  ): Promise<AnalysisRequestDetailsResponseDto> {
    const result = await this.prisma.analysis.findUniqueOrThrow({
      where: {
        requestId: requestId,
        request: {
          requestorId: userId,
        },
      },
      include: {
        request: true,
        project: true,
      },
    });

    const projectMembers =
      result.projectMembers as Prisma.JsonArray | null as ProjectMember[];

    // original project
    const project = result.project;
    const members =
      project.members as Prisma.JsonArray | null as ProjectMember[];

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
      projectEthicsId: '7sjsi9-dsaa',
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

    await this.prisma.analysis.create({
      data: request,
      include: { request: true, project: true },
    });

    return;
  }

  async approve(requestId: string) {
    return await this.prisma.request.update({
      where: { requestId: requestId },
      data: {
        status: 'APPROVED',
      },
    });
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
}
