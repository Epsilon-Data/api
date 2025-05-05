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
        projectName: true,
        request: {
          select: {
            status: true,
            createdDate: true,
          },
        },
      },
    });

    return requestList;
  }

  async approve(requestId: string) {
    return await this.prisma.request.update({
      where: { requestId: requestId },
      data: {
        status: 'APPROVED',
      },
    });
  }

  async update(dto: AnalysisDto) {
    return await this.prisma.analysis.update({
      where: { requestId: dto.requestId },
      data: {
        accessPurpose: dto.accessPurpose,
        requestorOrgName: dto.requestorOrgName,
        requestorPosition: dto.requestorPosition,
        projectName: dto.projectName,
        projectStartDate: dto.projectStartDate,
        projectEndDate: dto.projectEndDate,
        projectBackground: dto.projectBackground,
        projectObjective: dto.projectObjective,
        projectHypotheses: dto.projectHypotheses,
        projectOutcome: dto.projectOutcome,
        projectMembers: dto.projectMembers,
        ethicsId: dto.ethicsId,
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
