import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DatasourceService } from 'src/datasource/datasource.service';
import { DataProcessingService } from 'src/data_processing/data_processing.service';
import { FileStorageService } from 'src/file_storage/file_storage.service';

@Injectable()
export class DatasetService {
  constructor(
    private prisma: PrismaService,
    private databaseSource: DatasourceService,
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

    const zipFilePath = await this.dataProcess.createAndZipCsvFiles(
      result.data,
    );

    return zipFilePath;
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

  async getDatasetsByUser(userId: string, isSynthetic: boolean) {
    const requestList = await this.prisma.userRequest.findMany({
      where: {
        requestor: userId,
        status: 3,
      },
      include: {
        Project: {
          include: {
            ConnectionRequest: true,
          },
        },
      },
    });

    const datasetList = [];

    for (const request of requestList) {
      const sourceId = request.Project.ConnectionRequest.id;
      const atlasId = request.Project.ConnectionRequest.atlasId;

      let result = { data: [], csvColumns: [] };

      if (isSynthetic) {
        result = await this.dataProcess.generateDownloadDataset(
          sourceId,
          atlasId,
        );
      } else {
        result = await this.dataProcess.generateDataset(atlasId);
      }

      if (result.data.length === 0) {
        continue;
      }

      datasetList.push({
        projectId: request.Project.id,
        sourceId: sourceId,
        atlasId: atlasId,
        csvColumns: result.csvColumns,
        dataset: result.data,
      });
    }

    return datasetList;
  }
}
