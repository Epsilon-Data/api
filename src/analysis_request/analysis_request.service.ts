import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AnalysisDto } from './dto';

@Injectable()
export class AnalysisRequestService {
  constructor(private prisma: PrismaService) {}
  async getDetails(requestId: string) {
    const request = await this.prisma.analysis.findUnique({
      where: {
        requestId: requestId,
      },
      include: {
        request: true,
        project: true,
      },
    });

    return request;
  }

  async getList(userId: string) {
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

  async createRequest(dto: AnalysisDto) {
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
      projectMembers: dto.projectMembers,
      projectEthicsId: dto.projectEthicsId,
      request: {
        create: {
          requestorId: dto.requestorId,
        },
      },
      project: {
        connect: {
          projectId: dto.projectId,
        },
      },
    };

    return await this.prisma.analysis.create({
      data: request,
      include: { request: true, project: true },
    });
  }

  async approve(requestId: string) {
    return await this.prisma.request.update({
      where: { requestId: requestId },
      data: {
        status: 'APPROVED',
      },
    });
  }

  async update(requestId: string, dto: AnalysisDto) {
    return await this.prisma.analysis.update({
      where: { requestId: requestId },
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
  }

  async delete(requestId: string) {
    return await this.prisma.request.delete({
      where: {
        requestId: requestId,
      },
    });
  }
}
