import { Injectable } from '@nestjs/common';
import { CassandraService } from 'src/cassandra/cassandra.service';
import { DockerService } from 'src/docker/docker.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { Request } from 'express';
import { ProceedDto, RequestDto, RevisionDto } from './dto';

@Injectable()
export class AccessRequestService {
  constructor(
    private prisma: PrismaService,
    private cassandra: CassandraService,
    private docker: DockerService,
  ) {}
  async details(requestId: string) {
    const request = await this.prisma.userRequest.findUnique({
      where: {
        id: requestId,
      },
      select: {
        id: true,
        accessPurpose: true,
        requestorName: true,
        requestorEmail: true,
        requestorOrgName: true,
        requestorPosition: true,
        status: true,
        createdDate: true,
        projectName: true,
        projectStartDate: true,
        projectEndDate: true,
        projectBackground: true,
        projectObjective: true,
        projectHypotheses: true,
        projectOutcome: true,
        projectMembers: true,
        ethicsId: true,
        Project: {
          select: {
            customId: true,
            name: true,
          },
        },
        revisionInfo: true,
      },
    });

    const mappedRequest = {
      id: request.id,
      customId: request.Project.customId,
      name: request.Project.name,
      accessPurpose: request.accessPurpose,
      requestorName: request.requestorName,
      email: request.requestorEmail,
      orgName: request.requestorOrgName,
      position: request.requestorPosition,
      projectName: request.projectName,
      projectDuration: [request.projectStartDate, request.projectEndDate],
      projectBackground: request.projectBackground,
      projectObjective: request.projectObjective,
      projectHypotheses: request.projectHypotheses,
      projectOutcome: request.projectOutcome,
      projectMembers: request.projectMembers,
      ethicsId: request.ethicsId,
      status: request.status,
      createdDate: request.createdDate,
      revisionInfo: request.revisionInfo,
    };

    return mappedRequest;
  }

  async summary(request: Request, mode: string) {
    const userId = request.auth.payload.sub;
    let requestList = [];
    if (mode == 'sent') {
      requestList = await this.prisma.userRequest.findMany({
        where: {
          requestor: userId,
        },
        select: {
          id: true,
          requestorName: true,
          status: true,
          createdDate: true,
          projectName: true,
          Project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    } else {
      const projectList = await this.prisma.connectionRequest.findMany({
        where: {
          requestor: userId,
          status: {
            equals: 3,
          },
        },
        select: {
          Project: {
            select: {
              id: true,
            },
          },
        },
      });

      const projectIdList = projectList.map((item) => item.Project.id);

      requestList = await this.prisma.userRequest.findMany({
        where: {
          projectId: {
            in: projectIdList,
          },
        },
        select: {
          id: true,
          requestorName: true,
          status: true,
          createdDate: true,
          projectName: true,
          Project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    }

    return { requests: requestList };
  }

  async revision(dto: RevisionDto) {
    return await this.prisma.userRequest.update({
      where: { id: dto.requestId },
      data: {
        revisionInfo: dto.revisionInfo,
        status: 2,
      },
    });
  }

  async proceed(dto: ProceedDto) {
    let status = 3;
    if (!dto.isApproved) {
      status = 4;
    }
    return await this.prisma.userRequest.update({
      where: { id: dto.requestId },
      data: {
        status: status,
        completeDate: new Date(),
      },
    });
  }

  async delete(requestId: string) {
    return await this.prisma.userRequest.delete({
      where: {
        id: requestId,
      },
    });
  }

  async edit(dto: RequestDto) {
    return await this.prisma.userRequest.update({
      where: { id: dto.id },
      data: {
        accessPurpose: dto.accessPurpose,
        requestorOrgName: dto.orgName,
        requestorPosition: dto.position,
        projectName: dto.projectName,
        projectStartDate: dto.projectDuration[0],
        projectEndDate: dto.projectDuration[1],
        projectBackground: dto.projectBackground,
        projectObjective: dto.projectObjective,
        projectHypotheses: dto.projectHypotheses,
        projectOutcome: dto.projectOutcome,
        projectMembers: dto.projectMembers,
        ethicsId: dto.ethicsId,
        status: 1,
      },
    });
  }
}
