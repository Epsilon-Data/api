import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DatabaseSourceService {
  constructor(private prisma: PrismaService) {}
  async list(userId: number) {
    const requestList = await this.prisma.connectionRequest.findMany({
      where: {
        requestor: userId,
        status: 3,
      },
      include: {
        Project: true,
        ResearcherDb: true,
      },
    });

    const filteredList = requestList.map((request) => {
      const project = {
        projectId: request.Project.id,
        projectName: request.Project.name,
      };
      const researcherDb = request.ResearcherDb
        ? {
            databaseName: request.ResearcherDb.name,
            connectDate: request.ResearcherDb.connectDate,
            sourceStatus: request.ResearcherDb.status,
          }
        : null;
      if (researcherDb) {
        return {
          ...project,
          ...researcherDb,
        };
      }
    });

    return filteredList;
  }
}
