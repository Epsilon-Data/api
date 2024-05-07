import { Injectable } from '@nestjs/common';
import { CassandraService } from 'src/cassandra/cassandra.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class BrowseDatasetService {
  constructor(
    private prisma: PrismaService,
    private cassandra: CassandraService,
  ) {}

  async projects(isSearch: boolean) {
    const request = await this.prisma.connectionRequest.findMany({
      select: {
        dataKeywords: true,
        createdDate: true,
        cover: true,
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
          cover: item.cover,
        };
      }
    });

    return browseList;
  }

  async projectDetails(projectId: string) {
    const request = await this.prisma.connectionRequest.findUnique({
      where: {
        projectId: projectId,
      },
      select: {
        id: true,
        visualisations: true,
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
    const result = await this.cassandra.executeQuery(query, params);

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
      visualisations: request.visualisations,
    };

    return details;
  }
}
