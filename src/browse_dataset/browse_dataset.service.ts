import { Injectable } from '@nestjs/common';
import { CassandraService } from 'src/cassandra/cassandra.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AccessDto } from './dto';
import { Request } from 'express';

@Injectable()
export class BrowseDatasetService {
  constructor(
    private prisma: PrismaService,
    private cassandra: CassandraService,
  ) {}

  async projects(isSearch: boolean) {
    const request = await this.prisma.connectionRequest.findMany({
      where: {
        status: {
          equals: 3,
        },
      },
      select: {
        dataKeywords: true,
        createdDate: true,
        Project: true,
      },
    });

    const browseList = request.map((item) => {
      if (isSearch) {
        return {
          id: item.Project.id,
          name: item.Project.name,
          organisation: item.Project.university,
          createdDate: item.createdDate,
          description: item.Project.description,
          keywords: item.dataKeywords,
        };
      } else {
        return {
          id: item.Project.id,
          name: item.Project.name,
          organisation: item.Project.university,
          createdDate: item.createdDate,
          cover: item.Project.cover,
        };
      }
    });

    return browseList;
  }

  async projectDetails(projectId: string, requestBody: Request) {
    const userId = requestBody.auth.payload.sub;

    const isOwnProject = await this.prisma.connectionRequest.findFirst({
      where: {
        requestor: userId,
        projectId: projectId,
      },
    });

    const request = await this.prisma.connectionRequest.findUnique({
      where: {
        projectId: projectId,
      },
      select: {
        id: true,
        dataDescription: true,
        dataParticipantsNum: true,
        dataKeywords: true,
        dataCollectionStartDate: true,
        dataCollectionEndDate: true,
        Project: true,
      },
    });

    const query = `SELECT template, permissions FROM sources WHERE id = ?`;
    const params = [request.id];
    const result = await this.cassandra.query(query, params);

    let activeTemplates = [];

    if (result[0].template && result[0].permissions) {
      const templateList = JSON.parse(result[0].template);
      const permissionsList = JSON.parse(result[0].permissions);
      activeTemplates = templateList.filter((template) =>
        permissionsList.some(
          (permission) =>
            permission.templateId === template.id && permission.active,
        ),
      );
    }

    const details = {
      name: request.Project.name,
      duration: [request.Project.startDate, request.Project.endDate],
      lead: request.Project.lead,
      members: request.Project.members,
      university: request.Project.university,
      faculty: request.Project.faculty,
      ethicsId: request.Project.ethicsId,
      description: request.Project.description,
      dataDescription: request.dataDescription,
      collectionDuration: [
        request.dataCollectionStartDate,
        request.dataCollectionEndDate,
      ],
      dataKeywords: request.dataKeywords,
      dataParticipantsNum: request.dataParticipantsNum,
      archetype: activeTemplates.length > 0 ? activeTemplates[0] : null,
      visualisations: request.Project.visualisations,
      isOwnProject: isOwnProject ? true : false,
      lastUpdated: request.Project.lastUpdated,
    };

    return details;
  }

  async projectSummary(projectId: string) {
    const request = await this.prisma.connectionRequest.findUnique({
      where: {
        projectId: projectId,
      },
      select: {
        createdDate: true,
        Project: true,
      },
    });

    return {
      id: request.Project.customId,
      name: request.Project.name,
      organisation: request.Project.university,
      createdDate: request.createdDate,
    };
  }

  async applyRequest(details: AccessDto) {
    await this.prisma.userRequest.create({
      data: {
        projectId: details.id,
        accessPurpose: details.accessPurpose,
        requestor: details.requestor,
        requestorName: details.requestorName,
        requestorEmail: details.email,
        requestorOrgName: details.orgName,
        requestorPosition: details.position,
        projectName: details.projectName,
        projectStartDate: details.projectDuration[0],
        projectEndDate: details.projectDuration[1],
        projectBackground: details.projectBackground,
        projectObjective: details.projectObjective,
        projectHypotheses: details.projectHypotheses,
        projectOutcome: details.projectOutcome,
        projectMembers: details.projectMembers,
        ethicsId: details.ethicsId,
        status: 1,
      },
    });
    return details;
  }
}
