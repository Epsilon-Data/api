import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Request } from 'express';
import { DatasourceService } from 'src/datasource/datasource.service';
import { DescriptiveDto } from './dto';
import { AnalysisService } from 'src/analysis/analysis.service';
import { DatabaseService } from 'src/database/database.service';
import { DataProcessingService } from 'src/data_processing/data_processing.service';
import { FileStorageService } from 'src/file_storage/file_storage.service';

@Injectable()
export class DatasetService {
  constructor(
    private prisma: PrismaService,
    private databaseSource: DatasourceService,
    private analysis: AnalysisService,
    private database: DatabaseService,
    private dataProcess: DataProcessingService,
    private fileStorage: FileStorageService,
  ) {}

  async list(userId: string) {
    const requestList = await this.prisma.userRequest.findMany({
      where: {
        requestor: userId,
        status: 3,
      },
      include: {
        Project: true,
      },
    });

    const filteredList = requestList.map(async (request) => {
      return {
        id: request.id,
        projectId: request.Project.id,
        projectCustomId: request.Project.customId,
        projectName: request.Project.name,
        connectDate: request.completeDate,
      };
    });

    const result = await Promise.all(filteredList);
    return result;
  }

  async analysisList(userRequestId: string) {
    const requestList = await this.prisma.analysis.findMany({
      where: {
        userRequestId: userRequestId,
      },
      select: {
        id: true,
        name: true,
        createdDate: true,
        lastUpdated: true,
        lastUpdatedUser: true,
      },
    });

    return requestList;
  }

  async createAnalysis(request: Request, userRequestId: string, name: string) {
    await this.prisma.analysis.create({
      data: {
        userRequestId: userRequestId,
        name: name,
        lastUpdatedUser:
          request.auth.payload.given_name +
          ' ' +
          request.auth.payload.family_name,
      },
    });
  }

  async analysisDetails(analysisId: string) {
    return await this.prisma.analysis.findUnique({
      where: {
        id: analysisId,
      },
      select: {
        id: true,
        name: true,
        description: true,
        Script: true,
      },
    });
  }

  async getColumns(userRequestId: string) {
    const request = await this.prisma.userRequest.findUnique({
      where: {
        id: userRequestId,
      },
      select: {
        Project: {
          select: {
            id: true,
          },
        },
      },
    });

    return await this.databaseSource.columns(request.Project.id);
  }

  async descriptiveAnalysis(dto: DescriptiveDto) {
    const request = await this.prisma.userRequest.findUnique({
      where: {
        id: dto.id,
      },
      select: {
        Project: {
          select: {
            ConnectionRequest: {
              select: {
                atlasId: true,
              },
            },
          },
        },
      },
    });

    await this.database.connect(request.Project.ConnectionRequest.atlasId);
    await this.database.initialize();
    this.analysis.setDatabaseService(this.database);

    const result = [];
    for (const variable of dto.variables) {
      let analyzedRes = {};
      if (variable.type === 'ord') {
        analyzedRes = await this.analysis.getOrdinalAnalysis(
          variable.table,
          variable.name,
          dto.calculate,
        );
      } else if (variable.type === 'nom') {
        analyzedRes = await this.analysis.getNominalAnalysis(
          variable.table,
          variable.name,
        );
      }
      if (Object.keys(analyzedRes).length !== 0) {
        analyzedRes['name'] = variable.name;
        analyzedRes['type'] = variable.type;
        result.push(analyzedRes);
      }
    }

    this.database.disconnect();

    return Promise.all(result)
      .then(() => {
        return result;
      })
      .catch((error) => {
        console.error(error);
      });
  }

  async deleteAnalysis(analysisId: string) {
    const deleteScript = this.prisma.script.deleteMany({
      where: {
        analysisId: analysisId,
      },
    });

    const deleteAnalysis = this.prisma.analysis.delete({
      where: {
        id: analysisId,
      },
    });

    await this.prisma.$transaction([deleteScript, deleteAnalysis]);
  }

  async downloadDataset(userRequestId: string) {
    const userRequest = await this.prisma.userRequest.findUnique({
      where: {
        id: userRequestId,
      },
      select: {
        Project: {
          select: {
            ConnectionRequest: {
              select: {
                id: true,
                atlasId: true,
              },
            },
          },
        },
      },
    });

    const sourceId = userRequest.Project.ConnectionRequest.id;
    const atlasId = userRequest.Project.ConnectionRequest.atlasId;

    const result = await this.dataProcess.generateDownloadDataset(
      sourceId,
      atlasId,
    );

    return result;
  }

  async getReport(scriptId: string) {
    const script = await this.prisma.script.findUnique({
      where: {
        id: scriptId,
      },
      select: {
        name: true,
        Analysis: {
          select: {
            id: true,
          },
        },
      },
    });

    const analysisId = script.Analysis.id;

    const url = await this.fileStorage.getFileUrl(
      'report',
      `${analysisId}/${script.name}`.replace('.R', '.html'),
    );

    return url;
  }
}
